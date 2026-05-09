# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **R2 paths grouped by tags** — uploads that include tags store objects under nested prefixes derived from tag names (sorted, unique), e.g. `original/landscape/holiday/img-id.jpg`. Untagged uploads keep the previous flat layout.
- **Worker CI deploy (optional)** — `worker/scripts/ci-write-wrangler.sh` and `pnpm run deploy:ci` generate `wrangler.toml` from `WRANGLER_TOML_CONTENT` / `WRANGLER_TOML` when the config is not committed (e.g. public forks).
- **D1 migration** `worker/migrations/0003_api_keys_last_used_at.sql` — run on remote D1 if `api_keys` was created without `last_used_at` (fixes `validate-api-key` returning 500 / `SQLITE_ERROR: no such column: last_used_at`).
- **Optional Cloudflare Queues** - R2 file deletion no longer requires Cloudflare Queues. Set `USE_QUEUE = 'true'` in wrangler.toml to use async queue-based deletion, or `'false'` for synchronous deletion (no paid Queue feature required).
- **ZIP Batch Upload** - Upload images in bulk via ZIP archive
  - Browser-side extraction using JSZip
  - Batch processing (50 images per batch) to prevent memory overflow
  - Real-time extraction and upload progress display
  - Unified tag setting for all images
  - Auto-skip non-image files and files over 70MB

### Changed

- **Worker** — `worker/wrangler.toml` is no longer gitignored; commit a filled `wrangler.toml` so clean clones and Cloudflare Workers Git builds have a stable Wrangler entry point without injecting the file in CI.
- Upload form preferences (compression, expiry, tags) persist in `localStorage` via `app/utils/uploadCompressionPrefs.ts`; last-used values apply for both single-file and ZIP upload until changed.
- Remove global footer attribution link (“Create By 猫猫博客”) from the root layout.
- Use Cloudflare Transform Images URL (`/cdn-cgi/image/...`) as a fallback WebP/AVIF delivery method when stored variants are missing (e.g. uploads over 10MB).
- `/api/random` now redirects (302) to the selected image URL instead of proxying the image bytes (more reliable for transformed variants).
- Disable Next.js image optimization since images are already delivered as transformed URLs.
- Transform-URL parameters now follow the configured settings (no extra flags; no forced AVIF resize unless a max size is specified).
- Virtualize the Manage page masonry gallery with TanStack Virtual to keep DOM size stable for large libraries.
- Virtualize Upload sidebars (preview + results) with TanStack Virtual to keep scrolling smooth for large batches.
- Request resized thumbnail URLs via `/cdn-cgi/image/width=...` for UI grids to reduce bandwidth/decode cost.
- Add server-side `format` filtering to `/api/images` (`all|gif|webp|avif|original`) to reduce client-side work for large libraries.
- Increase Manage page page size from 24 to 60 to reduce request churn while scrolling.
- Increase default `maxUploadCount` to 50 and use concurrency=5 for uploads (including AVIF).

### Deprecated

### Removed

### Fixed

- Return a clear error when `R2_PUBLIC_URL` is missing, placeholder, or not a parseable HTTPS URL (instead of a generic `Failed to parse URL` after a successful D1 write).
- Single-file upload: if D1 metadata save fails after R2 writes, delete the uploaded R2 objects so the UI error does not leave orphan files; upload errors now return HTTP 500 with the underlying message for easier diagnosis.
- API Key validation no longer uses `RETURNING id` on `api_keys` updates (legacy D1 schemas without an `id` column failed with `no such column: id`); validation now uses `RETURNING key`.
- Normalize Worker base URLs that mistakenly include a trailing `/api` path segment so requests hit `/api/...` instead of `/api/api/...` (which returned 404 for validation).
- Align API base URL between `/api/config` and API Key validation: both honor `NEXT_PUBLIC_API_URL`, with server/build fallback `API_URL`; validation falls back to same-origin `/api/config` when the public env is unset at runtime.
- Trim pasted API keys before validation and storage to avoid invisible whitespace mismatches.
- Fix orientation detection for WebP and AVIF images - now correctly reads actual image dimensions instead of defaulting to 1920x1080.
- Fix deleted images not disappearing from Upload/Manage pages without a hard refresh (TanStack Query cache + recent uploads list).
- Fix Manage page Random API generator to resolve the real API base URL (via `/api/config`) instead of the placeholder `https://your-worker.workers.dev`.
- Clamp `/api/images` pagination parameters and normalize/sanitize tag updates in `/api/images/:id`.
- Avoid fetching protected image data before an API key is available on the Manage page.
- Fix a production-only React render-loop crash (#301) in the Manage page virtual masonry.
- Fix `/favicon.ico` returning 404 by redirecting to `/static/favicon.ico`.
- Avoid sending `Authorization: Bearer null` when no API key is set.
- Normalize and validate tag route params for tag rename/delete endpoints.
- Accept multipart uploads using either `image` or `file` field names.

### Security

- Tighten tag sanitization to avoid unexpected characters in tag management endpoints.
