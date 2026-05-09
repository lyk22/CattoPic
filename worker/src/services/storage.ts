import type { ImagePaths } from '../types/queue';

// R2 Storage Service
export class StorageService {
  constructor(private bucket: R2Bucket) {}

  async upload(key: string, data: ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
    await this.bucket.put(key, data, {
      httpMetadata: { contentType }
    });
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.bucket.delete(keys);
  }

  async list(prefix: string, limit?: number): Promise<R2Objects> {
    return this.bucket.list({ prefix, limit });
  }

  async exists(key: string): Promise<boolean> {
    const head = await this.bucket.head(key);
    return head !== null;
  }

  async deleteImageFiles(paths: ImagePaths): Promise<void> {
    const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
    const keys = Array.from(new Set([paths.original, paths.webp, paths.avif].filter(isNonEmptyString)));
    await this.deleteMany(keys);
  }

  /**
   * Generate storage paths for an image.
   * When `tagSegments` is non-empty, keys are nested under those folder names (after orientation).
   */
  static generatePaths(
    id: string,
    orientation: 'landscape' | 'portrait',
    format: string,
    tagSegments?: readonly string[]
  ): {
    original: string;
    webp: string;
    avif: string;
  } {
    const ext = format === 'gif' ? 'gif' : format;
    const prefix =
      tagSegments && tagSegments.length > 0 ? `${tagSegments.join('/')}/` : '';
    return {
      original: `original/${orientation}/${prefix}${id}.${ext}`,
      webp: `${orientation}/webp/${prefix}${id}.webp`,
      avif: `${orientation}/avif/${prefix}${id}.avif`
    };
  }
}
