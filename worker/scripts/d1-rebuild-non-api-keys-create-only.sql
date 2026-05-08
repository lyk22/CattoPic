-- Run AFTER dropping image_tags, images, tags, config (api_keys must remain).
-- Cloudflare D1 Console: paste ONE statement at a time, in order.
-- Or: pnpm wrangler d1 execute <DATABASE_NAME> --remote --file=scripts/d1-rebuild-non-api-keys-create-only.sql

CREATE TABLE images (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    upload_time TEXT NOT NULL,
    expiry_time TEXT,
    orientation TEXT NOT NULL CHECK (orientation IN ('landscape', 'portrait')),
    format TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    path_original TEXT NOT NULL,
    path_webp TEXT,
    path_avif TEXT,
    size_original INTEGER NOT NULL,
    size_webp INTEGER DEFAULT 0,
    size_avif INTEGER DEFAULT 0
);

CREATE INDEX idx_images_orientation ON images(orientation);

CREATE INDEX idx_images_upload_time ON images(upload_time DESC);

CREATE INDEX idx_images_expiry_time ON images(expiry_time) WHERE expiry_time IS NOT NULL;

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE INDEX idx_tags_name ON tags(name);

CREATE TABLE image_tags (
    image_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (image_id, tag_id),
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_image_tags_tag_id ON image_tags(tag_id);

CREATE INDEX idx_image_tags_image_id ON image_tags(image_id);

CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
