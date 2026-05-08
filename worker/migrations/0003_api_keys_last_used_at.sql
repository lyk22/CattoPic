-- Ensure api_keys.last_used_at exists (required by AuthService.validateApiKey).
-- Cloudflare: D1 → your database → Console, paste and run this statement once.
-- If the column already exists, SQLite will error — ignore or skip.
ALTER TABLE api_keys ADD COLUMN last_used_at TEXT;
