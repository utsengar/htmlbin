import type { Bindings, Prototype, User, Version } from "./types";

export async function getUserByTokenHash(
  db: D1Database,
  tokenHash: string
): Promise<User | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.display_name, u.created_at
         FROM tokens t
         JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = ? AND t.revoked_at IS NULL`
    )
    .bind(tokenHash)
    .first<User>();
  return row ?? null;
}

export async function touchToken(
  db: D1Database,
  tokenHash: string
): Promise<void> {
  await db
    .prepare(`UPDATE tokens SET last_used_at = ? WHERE token_hash = ?`)
    .bind(Date.now(), tokenHash)
    .run();
}

export async function createUser(
  db: D1Database,
  id: string,
  displayName: string | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`
    )
    .bind(id, displayName, Date.now())
    .run();
}

export async function insertToken(
  db: D1Database,
  tokenHash: string,
  userId: string,
  label: string | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tokens (token_hash, user_id, label, created_at)
       VALUES (?, ?, ?, ?)`
    )
    .bind(tokenHash, userId, label, Date.now())
    .run();
}

export async function getPrototype(
  db: D1Database,
  slug: string
): Promise<Prototype | null> {
  const row = await db
    .prepare(`SELECT * FROM prototypes WHERE slug = ?`)
    .bind(slug)
    .first<Prototype>();
  return row ?? null;
}

export async function listPrototypesByUser(
  db: D1Database,
  userId: string,
  limit = 100
): Promise<Prototype[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM prototypes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .bind(userId, limit)
    .all<Prototype>();
  return results ?? [];
}

export async function bumpViewCount(
  db: D1Database,
  slug: string
): Promise<void> {
  await db
    .prepare(`UPDATE prototypes SET view_count = view_count + 1 WHERE slug = ?`)
    .bind(slug)
    .run();
}

export async function listVersions(
  db: D1Database,
  slug: string
): Promise<Version[]> {
  const { results } = await db
    .prepare(
      `SELECT slug, version, size_bytes, context, created_at
         FROM versions WHERE slug = ? ORDER BY version DESC`
    )
    .bind(slug)
    .all<Version>();
  return results ?? [];
}

export async function getVersion(
  db: D1Database,
  slug: string,
  version: number
): Promise<Version | null> {
  const row = await db
    .prepare(
      `SELECT slug, version, size_bytes, context, created_at
         FROM versions WHERE slug = ? AND version = ?`
    )
    .bind(slug, version)
    .first<Version>();
  return row ?? null;
}

// Best-effort, single-region rate limiter using D1.
// Returns true if the request is allowed, false if rate-limited.
export async function rateLimit(
  db: D1Database,
  bucketKey: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;

  const row = await db
    .prepare(`SELECT count, window_start FROM rate_limits WHERE bucket = ?`)
    .bind(bucketKey)
    .first<{ count: number; window_start: number }>();

  if (!row || row.window_start !== windowStart) {
    await db
      .prepare(
        `INSERT INTO rate_limits (bucket, count, window_start) VALUES (?, 1, ?)
         ON CONFLICT(bucket) DO UPDATE SET count = 1, window_start = excluded.window_start`
      )
      .bind(bucketKey, windowStart)
      .run();
    return true;
  }

  if (row.count >= limit) return false;

  await db
    .prepare(`UPDATE rate_limits SET count = count + 1 WHERE bucket = ?`)
    .bind(bucketKey)
    .run();
  return true;
}

export type Env = Bindings;
