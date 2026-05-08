// D1 Authentication Service
export class AuthService {
  constructor(private db: D1Database) {}

  async validateApiKey(key: string): Promise<boolean> {
    if (!key) return false;

    // Use RETURNING key (not id): legacy api_keys tables may omit the id column.
    const result = await this.db.prepare(`
      UPDATE api_keys SET last_used_at = ? WHERE key = ?
      RETURNING key
    `).bind(new Date().toISOString(), key).first<{ key: string }>();

    return result !== null;
  }

  async addApiKey(key: string): Promise<void> {
    await this.db.prepare(`
      INSERT OR IGNORE INTO api_keys (key, created_at) VALUES (?, ?)
    `).bind(key, new Date().toISOString()).run();
  }

  async removeApiKey(key: string): Promise<void> {
    await this.db.prepare(`
      DELETE FROM api_keys WHERE key = ?
    `).bind(key).run();
  }

  async listApiKeys(): Promise<string[]> {
    const result = await this.db.prepare(`
      SELECT key FROM api_keys ORDER BY created_at DESC
    `).all<{ key: string }>();
    return result.results?.map(r => r.key) || [];
  }

  // Extract API key from Authorization header
  static extractApiKey(authHeader: string | null): string | null {
    if (!authHeader) return null;

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }
}
