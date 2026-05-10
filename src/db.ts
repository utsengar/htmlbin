import type { Bindings, Drop, User, Version } from "./types";

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

export async function getDrop(
  db: D1Database,
  slug: string
): Promise<Drop | null> {
  const row = await db
    .prepare(`SELECT * FROM drops WHERE slug = ?`)
    .bind(slug)
    .first<Drop>();
  return row ?? null;
}

export type DropSort = "created_at" | "updated_at" | "view_count";
export type SortOrder = "asc" | "desc";

export async function listDropsByUser(
  db: D1Database,
  userId: string,
  opts: {
    limit?: number;
    offset?: number;
    sortBy?: DropSort;
    sortOrder?: SortOrder;
  } = {}
): Promise<{ rows: Drop[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const sortBy: DropSort = opts.sortBy ?? "created_at";
  const sortOrder: SortOrder = opts.sortOrder === "asc" ? "asc" : "desc";

  // Whitelist the ORDER BY column to prevent SQL injection.
  const orderCol =
    sortBy === "updated_at" ? "updated_at"
    : sortBy === "view_count" ? "view_count"
    : "created_at";

  const batchResults = await db.batch<unknown>([
    db.prepare(
      `SELECT * FROM drops WHERE user_id = ?
         ORDER BY ${orderCol} ${sortOrder.toUpperCase()}
         LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset),
    db.prepare(`SELECT COUNT(*) as n FROM drops WHERE user_id = ?`).bind(userId),
  ]);

  const rows = (batchResults[0]?.results as Drop[] | undefined) ?? [];
  const countResults = batchResults[1]?.results as Array<{ n: number }> | undefined;
  const total = countResults?.[0]?.n ?? 0;
  return { rows, total };
}

export async function bumpViewCount(
  db: D1Database,
  slug: string
): Promise<void> {
  await db
    .prepare(`UPDATE drops SET view_count = view_count + 1 WHERE slug = ?`)
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
//
// Returns `{ ok, retryAfter }`: `ok=true` means the request is allowed;
// when `ok=false`, `retryAfter` is seconds until the next window opens
// (suitable for the HTTP Retry-After header).
export async function rateLimit(
  db: D1Database,
  bucketKey: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfter: number }> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const retryAfter = Math.max(1, Math.ceil((windowEnd - now) / 1000));

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
    return { ok: true, retryAfter: 0 };
  }

  if (row.count >= limit) return { ok: false, retryAfter };

  await db
    .prepare(`UPDATE rate_limits SET count = count + 1 WHERE bucket = ?`)
    .bind(bucketKey)
    .run();
  return { ok: true, retryAfter: 0 };
}

export type Env = Bindings;
