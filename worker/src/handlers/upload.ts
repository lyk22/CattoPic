import type { Context } from 'hono';
import type { Env, ImageMetadata, UploadResult } from '../types';
import type { ImagePaths } from '../types/queue';
import { StorageService } from '../services/storage';
import { MetadataService } from '../services/metadata';
import { CacheService } from '../services/cache';
import { ImageProcessor } from '../services/imageProcessor';
import { CompressionService, parseCompressionOptions } from '../services/compression';
import { successResponse, errorResponse } from '../utils/response';
import { generateImageId, parseTags, parseNumber, tagsToStoragePathSegments } from '../utils/validation';
import { buildImageUrls } from '../utils/imageTransform';

// Maximum file size: 70MB (Cloudflare Images Binding limit)
const MAX_FILE_SIZE = 70 * 1024 * 1024;
// Cloudflare Images transformation limit: 10MB (fallback to Transform-URL for larger images)
const CLOUDFLARE_IMAGES_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Single file upload handler - processes one image with full parallelization
 * Used by frontend concurrent upload for per-file progress tracking
 */
export async function uploadSingleHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const storage = new StorageService(c.env.R2_BUCKET);
  /** If D1 save fails after R2 writes, delete these keys to avoid orphaned objects. */
  let r2PathsForRollback: ImagePaths | null = null;
  let dbCommitted = false;

  try {
    // Check Content-Length header first to fail fast
    const contentLength = c.req.header('Content-Length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_FILE_SIZE) {
        console.error(`File too large: ${size} bytes (max: ${MAX_FILE_SIZE})`);
        return errorResponse(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, 413);
      }
    }

    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch (formError) {
      console.error('Failed to parse form data:', formError);
      return errorResponse('Failed to parse form data. File may be too large or corrupted.', 400);
    }

    const file = (formData.get('image') ?? formData.get('file')) as File | null;
    const tagsString = formData.get('tags') as string | null;
    const expiryMinutes = parseNumber(formData.get('expiryMinutes') as string | null, 0);
    const compressionOptions = parseCompressionOptions(formData);

    if (!file || typeof file === 'string') {
      return errorResponse('No file provided');
    }

    // Double-check file size
    if (file.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${file.size} bytes (max: ${MAX_FILE_SIZE})`);
      return errorResponse(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, 413);
    }

    console.log(`Processing upload: ${file.name}, size: ${file.size} bytes`);

    const tags = parseTags(tagsString);
    const tagPathSegments = tagsToStoragePathSegments(tags);
    const metadata = new MetadataService(c.env.DB);
    const compression = c.env.IMAGES ? new CompressionService(c.env.IMAGES) : null;

    // Read file data
    const arrayBuffer = await file.arrayBuffer();

    // Get image info
    const imageInfo = await ImageProcessor.getImageInfo(arrayBuffer);

    if (!ImageProcessor.isSupportedFormat(imageInfo.format)) {
      return errorResponse(`Unsupported format: ${imageInfo.format}`);
    }

    // Generate unique ID and paths
    const id = generateImageId();
    const generatedPaths = StorageService.generatePaths(
      id,
      imageInfo.orientation,
      imageInfo.format,
      tagPathSegments.length > 0 ? tagPathSegments : undefined
    );
    const paths = { ...generatedPaths, webp: '', avif: '' };
    const contentType = ImageProcessor.getContentType(imageInfo.format);

    const isGif = imageInfo.format === 'gif';
    const isWebp = imageInfo.format === 'webp';
    const isAvif = imageInfo.format === 'avif';
    const shouldSkipProcessing = isGif || isWebp || isAvif;
    let webpSize = 0;
    let avifSize = 0;

    // Always upload original (GIF only stores original)
    const originalUploadPromise = storage.upload(paths.original, arrayBuffer, contentType);

    // Advanced formats: do not recompress; treat upload as best format
    if (shouldSkipProcessing) {
      await originalUploadPromise;

      if (isWebp) {
        paths.webp = paths.original;
        webpSize = file.size;
      }
      if (isAvif) {
        paths.avif = paths.original;
        avifSize = file.size;
      }
    } else if (compression && file.size <= CLOUDFLARE_IMAGES_MAX_BYTES) {
      const compressionPromise = compression.compress(arrayBuffer, imageInfo.format, compressionOptions);
      const wantsWebp = compressionOptions.generateWebp !== false;
      const wantsAvif = compressionOptions.generateAvif !== false;

      // Ensure original is uploaded while compression runs
      await originalUploadPromise;

      const compressionResult = await compressionPromise;
      const uploadPromises: Promise<void>[] = [];

      if (wantsWebp && compressionResult.webp) {
        paths.webp = generatedPaths.webp;
        uploadPromises.push(
          storage.upload(paths.webp, compressionResult.webp.data, 'image/webp')
            .then(() => { webpSize = compressionResult.webp!.size; })
        );
      }

      if (wantsAvif && compressionResult.avif) {
        paths.avif = generatedPaths.avif;
        uploadPromises.push(
          storage.upload(paths.avif, compressionResult.avif.data, 'image/avif')
            .then(() => { avifSize = compressionResult.avif!.size; })
        );
      }

      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
      }

      // If compression failed for some formats, fall back to Transform-URL via marker paths.
      if (wantsWebp && !paths.webp) {
        paths.webp = paths.original;
      }
      if (wantsAvif && !paths.avif) {
        paths.avif = paths.original;
      }
    } else {
      // Skip compression (too large or no Images binding): store original + use Transform-URL via marker paths
      await originalUploadPromise;
      const wantsWebp = compressionOptions.generateWebp !== false;
      const wantsAvif = compressionOptions.generateAvif !== false;
      if (wantsWebp) paths.webp = paths.original;
      if (wantsAvif) paths.avif = paths.original;
    }

    r2PathsForRollback = {
      original: paths.original,
      ...(paths.webp ? { webp: paths.webp } : {}),
      ...(paths.avif ? { avif: paths.avif } : {}),
    };

    // Calculate expiry time
    let expiryTime: string | undefined;
    if (expiryMinutes > 0) {
      const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000);
      expiryTime = expiry.toISOString();
    }

    // Create and save metadata
    const imageMetadata: ImageMetadata = {
      id,
      originalName: file.name,
      uploadTime: new Date().toISOString(),
      expiryTime,
      orientation: imageInfo.orientation,
      tags,
      format: imageInfo.format,
      width: imageInfo.width,
      height: imageInfo.height,
      paths,
      sizes: {
        original: file.size,
        webp: webpSize,
        avif: avifSize,
      },
    };

    await metadata.saveImage(imageMetadata);
    dbCommitted = true;
    r2PathsForRollback = null;

    // Build result — invalid R2_PUBLIC_URL throws "Failed to parse URL" from URL()
    const baseUrl = (c.env.R2_PUBLIC_URL ?? '').trim();
    if (
      !baseUrl
      || baseUrl.includes('<')
      || !/^https:\/\//i.test(baseUrl)
    ) {
      return errorResponse(
        'R2_PUBLIC_URL must be set to a valid HTTPS base URL for public R2 access (Worker vars / wrangler.toml [vars]).',
        500
      );
    }
    try {
      void new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    } catch {
      return errorResponse(
        'R2_PUBLIC_URL is not a parseable URL; use e.g. https://pub-xxx.r2.dev or your R2 custom domain.',
        500
      );
    }

    const urls = buildImageUrls({
      baseUrl,
      image: imageMetadata,
      options: compressionOptions,
    });
    const result: UploadResult = {
      id,
      status: 'success',
      urls: {
        original: urls.original,
        webp: urls.webp,
        avif: urls.avif,
      },
      orientation: imageInfo.orientation,
      tags,
      sizes: imageMetadata.sizes,
      expiryTime,
      format: imageInfo.format,
    };

    // Invalidate caches (non-blocking)
    const cache = new CacheService(c.env.CACHE_KV);
    c.executionCtx.waitUntil(
      Promise.all([
        cache.invalidateImagesList(),
        cache.invalidateTagsList(),
      ])
    );

    return successResponse({ result });
  } catch (err) {
    if (!dbCommitted && r2PathsForRollback) {
      try {
        await storage.deleteImageFiles(r2PathsForRollback);
      } catch (rollbackErr) {
        console.error('R2 rollback after upload failure:', rollbackErr);
      }
    }
    console.error('Single upload error:', err);
    const message =
      err instanceof Error && err.message ? err.message : 'Upload failed';
    return errorResponse(message, 500);
  }
}
