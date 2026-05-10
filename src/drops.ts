import { Hono } from "hono";
import type { Bindings, Drop, Variables } from "./types";
import { authMiddleware } from "./auth";
import { generateSlug, isValidSlug } from "./slug";
import { hashPassword } from "./crypto";
import {
  getDrop,
  getVersion,
  listDropsByUser,
  listVersions,
  rateLimit,
} from "./db";
import { apiError } from "./errors";

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;
const MAX_CONTEXT_BYTES = 64 * 1024; // 64 KB
const MAX_DROPS_PER_USER = 500;
const MAX_VERSIONS_PER_DROP = 200;
const MAX_DAILY_WRITES = 500;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export const apiRoutes = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

apiRoutes.use("/drops", authMiddleware);
apiRoutes.use("/drops/*", authMiddleware);
apiRoutes.use("/me", authMiddleware);
apiRoutes.use("/tokens", authMiddleware);
apiRoutes.use("/tokens/*", authMiddleware);

// ───────────────────────────────────────────────────────────────────────
// /api/me — caller's identity, with token + drop count
// ───────────────────────────────────────────────────────────────────────
apiRoutes.on(["GET", "HEAD"], "/me", async (c) => {
  const user = c.get("user");

  const [userRow, tokenRow, countRow] = await Promise.all([
    c.env.DB.prepare(`SELECT id, created_at FROM users WHERE id = ?`)
      .bind(user.id)
      .first<{ id: string; created_at: number }>(),
    c.env.DB.prepare(
      `SELECT substr(token_hash,1,12) AS id, label, created_at, last_used_at
         FROM tokens WHERE token_hash = ?`
    )
      .bind(user.tokenHash)
      .first<{
        id: string;
        label: string | null;
        created_at: number;
        last_used_at: number | null;
      }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM drops WHERE user_id = ?`)
      .bind(user.id)
      .first<{ n: number }>(),
  ]);

  return c.json({
    user_id: user.id,
    created_at: userRow?.created_at ?? null,
    drop_count: countRow?.n ?? 0,
    token: tokenRow ?? null,
  });
});

// ───────────────────────────────────────────────────────────────────────
// /api/tokens — list / revoke
// ───────────────────────────────────────────────────────────────────────
apiRoutes.on(["GET", "HEAD"], "/tokens", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT substr(token_hash,1,12) AS id, label, created_at, last_used_at, revoked_at
       FROM tokens WHERE user_id = ? ORDER BY created_at DESC`
  )
    .bind(user.id)
    .all<{
      id: string;
      label: string | null;
      created_at: number;
      last_used_at: number | null;
      revoked_at: number | null;
    }>();
  return c.json(results ?? []);
});

apiRoutes.delete("/tokens/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  if (!/^[0-9a-f]{12}$/.test(id))
    return apiError(c, "invalid_token_id", "Token id must be 12 hex chars.", 400);
  const res = await c.env.DB.prepare(
    `UPDATE tokens SET revoked_at = ? WHERE substr(token_hash,1,12) = ? AND user_id = ?`
  )
    .bind(Date.now(), id, user.id)
    .run();
  if ((res.meta?.changes ?? 0) === 0)
    return apiError(c, "not_found", "No token with that id belongs to you.", 404);
  return new Response(null, { status: 204 });
});

// ───────────────────────────────────────────────────────────────────────
// /api/drops — list (paginated)
// ───────────────────────────────────────────────────────────────────────
apiRoutes.on(["GET", "HEAD"], "/drops", async (c) => {
  const user = c.get("user");
  const q = c.req.query();

  const page = Math.max(parseInt(q.page ?? "1", 10) || 1, 1);
  const pageSizeRaw = parseInt(q.pageSize ?? "", 10);
  const pageSize = Math.min(
    Math.max(Number.isFinite(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  const sortBy = (q.sortBy === "updated_at" || q.sortBy === "view_count")
    ? q.sortBy
    : "created_at";
  const sortOrder = q.sortOrder === "asc" ? "asc" : "desc";

  const { rows, total } = await listDropsByUser(c.env.DB, user.id, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sortBy,
    sortOrder,
  });

  return c.json({
    data: rows.map((d) => serializeDrop(d, c.env.PUBLIC_URL)),
    pagination: {
      page,
      page_size: pageSize,
      total_items: total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
      sort_by: sortBy,
      sort_order: sortOrder,
    },
  });
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/drops — create (mints v1). Returns the full Drop, 201.
// ───────────────────────────────────────────────────────────────────────
apiRoutes.post("/drops", async (c) => {
  const user = c.get("user");

  const writeRl = await rateLimit(c.env.DB, `write:${user.id}`, 60, 60_000);
  if (!writeRl.ok) {
    c.header("Retry-After", String(writeRl.retryAfter));
    return apiError(
      c,
      "rate_limited",
      "Write rate limit exceeded (60/min).",
      429,
      { retry_after_seconds: writeRl.retryAfter }
    );
  }
  const dailyRl = await rateLimit(
    c.env.DB,
    `daily:${user.id}`,
    MAX_DAILY_WRITES,
    86_400_000
  );
  if (!dailyRl.ok) {
    c.header("Retry-After", String(dailyRl.retryAfter));
    return apiError(
      c,
      "daily_quota_exceeded",
      `Daily write quota of ${MAX_DAILY_WRITES} exceeded.`,
      429,
      { max: MAX_DAILY_WRITES, retry_after_seconds: dailyRl.retryAfter }
    );
  }

  const body = (await c.req.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        html?: string;
        password?: string;
        context?: string;
      }
    | null;
  if (!body) return apiError(c, "invalid_json", "Request body must be JSON.", 400);

  const badTypes = nonStringFields(body as Record<string, unknown>, [
    "title", "description", "html", "password", "context",
  ]);
  if (badTypes.length > 0)
    return apiError(
      c,
      "invalid_arg",
      `These fields must be strings: ${badTypes.join(", ")}.`,
      400,
      { fields: badTypes }
    );

  const valid = validateCreateBody(body);
  if (valid.error)
    return apiError(c, valid.error.code, valid.error.message, 400, valid.error.details);

  const { title, description, html, password, context } = valid.value;

  // Per-user drop quota — 429 since it's a "too many" condition.
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM drops WHERE user_id = ?`
  )
    .bind(user.id)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= MAX_DROPS_PER_USER) {
    return apiError(
      c,
      "quota_exceeded",
      `Account drop quota of ${MAX_DROPS_PER_USER} reached.`,
      429,
      { max: MAX_DROPS_PER_USER }
    );
  }

  // Slug
  let slug = generateSlug(title);
  for (let i = 0; i < 5; i++) {
    if (!(await getDrop(c.env.DB, slug))) break;
    slug = generateSlug(title);
  }

  // Password
  let passwordHash: string | null = null;
  let passwordSalt: string | null = null;
  if (password) {
    const { hash, salt } = await hashPassword(password);
    passwordHash = hash;
    passwordSalt = salt;
  }

  const now = Date.now();
  const sizeBytes = byteLength(html);
  await c.env.DROPS_KV.put(`html:${slug}:v1`, html);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO drops
         (slug, user_id, title, description, password_hash, password_salt,
          latest_version, view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
    ).bind(slug, user.id, title, description, passwordHash, passwordSalt, now, now),
    c.env.DB.prepare(
      `INSERT INTO versions (slug, version, size_bytes, context, created_at)
       VALUES (?, 1, ?, ?, ?)`
    ).bind(slug, sizeBytes, context || null, now),
  ]);

  const created = await getDrop(c.env.DB, slug);
  return c.json(serializeDrop(created!, c.env.PUBLIC_URL), 201);
});

// ───────────────────────────────────────────────────────────────────────
// PUT /api/drops/:slug — mint a NEW VERSION. Requires html.
// Title/description may be updated alongside the new version.
// ───────────────────────────────────────────────────────────────────────
apiRoutes.put("/drops/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug))
    return apiError(c, "invalid_slug", "Slug must be 6–12 base62 chars.", 400);

  const writeRl = await rateLimit(c.env.DB, `write:${user.id}`, 60, 60_000);
  if (!writeRl.ok) {
    c.header("Retry-After", String(writeRl.retryAfter));
    return apiError(
      c,
      "rate_limited",
      "Write rate limit exceeded (60/min).",
      429,
      { retry_after_seconds: writeRl.retryAfter }
    );
  }

  const drop = await getDrop(c.env.DB, slug);
  if (!drop) return apiError(c, "not_found", "No such drop.", 404);
  if (drop.user_id !== user.id)
    return apiError(c, "forbidden", "This drop belongs to another user.", 403);

  if (drop.latest_version >= MAX_VERSIONS_PER_DROP)
    return apiError(
      c,
      "version_limit_reached",
      `Per-drop version cap of ${MAX_VERSIONS_PER_DROP} reached.`,
      429,
      { max: MAX_VERSIONS_PER_DROP }
    );

  const body = (await c.req.json().catch(() => null)) as
    | { title?: string; description?: string; html?: string; context?: string }
    | null;
  if (!body) return apiError(c, "invalid_json", "Request body must be JSON.", 400);

  const badTypes = nonStringFields(body as Record<string, unknown>, [
    "title", "description", "html", "context",
  ]);
  if (badTypes.length > 0)
    return apiError(
      c,
      "invalid_arg",
      `These fields must be strings: ${badTypes.join(", ")}.`,
      400,
      { fields: badTypes }
    );

  // PUT minted a new version; html is required. Metadata-only updates use PATCH.
  if (body.html === undefined || body.html === "")
    return apiError(
      c,
      "html_required",
      "PUT mints a new version and requires `html`. For metadata-only edits, use PATCH.",
      400
    );

  const sizeBytes = byteLength(body.html);
  if (sizeBytes > MAX_HTML_BYTES)
    return apiError(c, "html_too_large", `HTML exceeds ${MAX_HTML_BYTES} bytes.`, 400, {
      max_bytes: MAX_HTML_BYTES,
    });

  const title = body.title?.trim();
  const description = body.description?.trim();
  if (title !== undefined && title.length === 0)
    return apiError(c, "title_required", "Title cannot be an empty string.", 400);
  if (title && title.length > MAX_TITLE)
    return apiError(c, "title_too_long", `Title exceeds ${MAX_TITLE} chars.`, 400, {
      max: MAX_TITLE,
    });
  if (description && description.length > MAX_DESCRIPTION)
    return apiError(
      c,
      "description_too_long",
      `Description exceeds ${MAX_DESCRIPTION} chars.`,
      400,
      { max: MAX_DESCRIPTION }
    );
  if (body.context && byteLength(body.context) > MAX_CONTEXT_BYTES)
    return apiError(
      c,
      "context_too_large",
      `Context exceeds ${MAX_CONTEXT_BYTES} bytes.`,
      400,
      { max_bytes: MAX_CONTEXT_BYTES }
    );

  const now = Date.now();
  const nextVersion = drop.latest_version + 1;
  await c.env.DROPS_KV.put(`html:${slug}:v${nextVersion}`, body.html);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO versions (slug, version, size_bytes, context, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(slug, nextVersion, sizeBytes, body.context || null, now),
    c.env.DB.prepare(
      `UPDATE drops
          SET title = COALESCE(?, title),
              description = COALESCE(?, description),
              latest_version = ?,
              updated_at = ?
        WHERE slug = ? AND user_id = ?`
    ).bind(title ?? null, description ?? null, nextVersion, now, slug, user.id),
  ]);

  const updated = await getDrop(c.env.DB, slug);
  return c.json(serializeDrop(updated!, c.env.PUBLIC_URL));
});

// ───────────────────────────────────────────────────────────────────────
// PATCH /api/drops/:slug — metadata-only update. No new version minted.
// ───────────────────────────────────────────────────────────────────────
apiRoutes.patch("/drops/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug))
    return apiError(c, "invalid_slug", "Slug must be 6–12 base62 chars.", 400);

  const drop = await getDrop(c.env.DB, slug);
  if (!drop) return apiError(c, "not_found", "No such drop.", 404);
  if (drop.user_id !== user.id)
    return apiError(c, "forbidden", "This drop belongs to another user.", 403);

  const body = (await c.req.json().catch(() => null)) as
    | { title?: string; description?: string; html?: string }
    | null;
  if (!body) return apiError(c, "invalid_json", "Request body must be JSON.", 400);

  const badTypes = nonStringFields(body as Record<string, unknown>, [
    "title", "description", "html",
  ]);
  if (badTypes.length > 0)
    return apiError(
      c,
      "invalid_arg",
      `These fields must be strings: ${badTypes.join(", ")}.`,
      400,
      { fields: badTypes }
    );

  if (body.html !== undefined)
    return apiError(
      c,
      "metadata_only_on_patch",
      "PATCH only updates title and description. To upload new HTML, use PUT.",
      400
    );

  const title = body.title?.trim();
  const description = body.description?.trim();
  if (title !== undefined && title.length === 0)
    return apiError(c, "title_required", "Title cannot be an empty string.", 400);
  if (title && title.length > MAX_TITLE)
    return apiError(c, "title_too_long", `Title exceeds ${MAX_TITLE} chars.`, 400, {
      max: MAX_TITLE,
    });
  if (description && description.length > MAX_DESCRIPTION)
    return apiError(
      c,
      "description_too_long",
      `Description exceeds ${MAX_DESCRIPTION} chars.`,
      400,
      { max: MAX_DESCRIPTION }
    );

  await c.env.DB.prepare(
    `UPDATE drops
        SET title = COALESCE(?, title),
            description = COALESCE(?, description),
            updated_at = ?
      WHERE slug = ? AND user_id = ?`
  )
    .bind(title ?? null, description ?? null, Date.now(), slug, user.id)
    .run();

  const updated = await getDrop(c.env.DB, slug);
  return c.json(serializeDrop(updated!, c.env.PUBLIC_URL));
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/drops/:slug — metadata for one of mine
// ───────────────────────────────────────────────────────────────────────
apiRoutes.on(["GET", "HEAD"], "/drops/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug))
    return apiError(c, "invalid_slug", "Slug must be 6–12 base62 chars.", 400);

  const drop = await getDrop(c.env.DB, slug);
  if (!drop) return apiError(c, "not_found", "No such drop.", 404);
  if (drop.user_id !== user.id)
    return apiError(c, "forbidden", "This drop belongs to another user.", 403);

  return c.json(serializeDrop(drop, c.env.PUBLIC_URL));
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/drops/:slug/versions — list versions of a drop
// ───────────────────────────────────────────────────────────────────────
apiRoutes.on(["GET", "HEAD"], "/drops/:slug/versions", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug))
    return apiError(c, "invalid_slug", "Slug must be 6–12 base62 chars.", 400);
  const drop = await getDrop(c.env.DB, slug);
  if (!drop) return apiError(c, "not_found", "No such drop.", 404);
  if (drop.user_id !== user.id)
    return apiError(c, "forbidden", "This drop belongs to another user.", 403);

  const versions = await listVersions(c.env.DB, slug);
  return c.json(
    versions.map((v) => ({
      version: v.version,
      size_bytes: v.size_bytes,
      has_context: !!v.context,
      created_at: v.created_at,
      is_latest: v.version === drop.latest_version,
    }))
  );
});

// ───────────────────────────────────────────────────────────────────────
// GET /api/drops/:slug/v/:n — specific version metadata + context
// ───────────────────────────────────────────────────────────────────────
apiRoutes.on(["GET", "HEAD"], "/drops/:slug/v/:n", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const n = parseInt(c.req.param("n"), 10);
  if (!isValidSlug(slug) || !Number.isFinite(n) || n < 1)
    return apiError(c, "invalid_arg", "Slug or version is malformed.", 400);
  const drop = await getDrop(c.env.DB, slug);
  if (!drop) return apiError(c, "not_found", "No such drop.", 404);
  if (drop.user_id !== user.id)
    return apiError(c, "forbidden", "This drop belongs to another user.", 403);

  const v = await getVersion(c.env.DB, slug, n);
  if (!v) return apiError(c, "version_not_found", "No such version on this drop.", 404);
  return c.json({
    slug,
    version: v.version,
    size_bytes: v.size_bytes,
    context: v.context,
    created_at: v.created_at,
    is_latest: v.version === drop.latest_version,
  });
});

// ───────────────────────────────────────────────────────────────────────
// DELETE /api/drops/:slug/v/:n — delete a single version.
// Refuses to delete the last remaining version. Returns the full Drop.
// ───────────────────────────────────────────────────────────────────────
apiRoutes.delete("/drops/:slug/v/:n", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const n = parseInt(c.req.param("n"), 10);
  if (!isValidSlug(slug) || !Number.isFinite(n) || n < 1)
    return apiError(c, "invalid_arg", "Slug or version is malformed.", 400);

  const drop = await getDrop(c.env.DB, slug);
  if (!drop) return apiError(c, "not_found", "No such drop.", 404);
  if (drop.user_id !== user.id)
    return apiError(c, "forbidden", "This drop belongs to another user.", 403);

  const versions = await listVersions(c.env.DB, slug);
  const target = versions.find((v) => v.version === n);
  if (!target)
    return apiError(c, "version_not_found", "No such version on this drop.", 404);
  if (versions.length <= 1)
    return apiError(
      c,
      "last_version_cannot_be_deleted",
      "A drop must keep at least one version.",
      409
    );

  await c.env.DROPS_KV.delete(`html:${slug}:v${n}`);
  await c.env.DB.prepare(
    `DELETE FROM versions WHERE slug = ? AND version = ?`
  )
    .bind(slug, n)
    .run();

  if (n === drop.latest_version) {
    const newLatest = Math.max(
      ...versions.filter((v) => v.version !== n).map((v) => v.version)
    );
    await c.env.DB.prepare(
      `UPDATE drops SET latest_version = ?, updated_at = ? WHERE slug = ?`
    )
      .bind(newLatest, Date.now(), slug)
      .run();
  }

  const updated = await getDrop(c.env.DB, slug);
  return c.json(serializeDrop(updated!, c.env.PUBLIC_URL));
});

// ───────────────────────────────────────────────────────────────────────
// DELETE /api/drops/:slug — delete drop (all versions). 204 No Content.
// ───────────────────────────────────────────────────────────────────────
apiRoutes.delete("/drops/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug))
    return apiError(c, "invalid_slug", "Slug must be 6–12 base62 chars.", 400);

  const drop = await getDrop(c.env.DB, slug);
  if (!drop) return apiError(c, "not_found", "No such drop.", 404);
  if (drop.user_id !== user.id)
    return apiError(c, "forbidden", "This drop belongs to another user.", 403);

  for (let v = 1; v <= drop.latest_version; v++) {
    await c.env.DROPS_KV.delete(`html:${slug}:v${v}`);
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM versions WHERE slug = ?`).bind(slug),
    c.env.DB.prepare(`DELETE FROM drops WHERE slug = ? AND user_id = ?`).bind(
      slug,
      user.id
    ),
  ]);

  return new Response(null, { status: 204 });
});

// ───────────────────────────────────────────────────────────────────────
// POST /api/drops/:slug/password — set / change / remove password.
// Pass `password: ""` to remove. Returns the full Drop.
// ───────────────────────────────────────────────────────────────────────
apiRoutes.post("/drops/:slug/password", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug))
    return apiError(c, "invalid_slug", "Slug must be 6–12 base62 chars.", 400);
  const drop = await getDrop(c.env.DB, slug);
  if (!drop) return apiError(c, "not_found", "No such drop.", 404);
  if (drop.user_id !== user.id)
    return apiError(c, "forbidden", "This drop belongs to another user.", 403);

  const body = (await c.req.json().catch(() => null)) as
    | { password?: string }
    | null;
  if (!body || typeof body.password !== "string")
    return apiError(c, "password_required", "Body must include `password`.", 400);

  if (body.password === "") {
    await c.env.DB.prepare(
      `UPDATE drops SET password_hash = NULL, password_salt = NULL,
              updated_at = ? WHERE slug = ?`
    )
      .bind(Date.now(), slug)
      .run();
  } else {
    if (body.password.length < 4)
      return apiError(
        c,
        "password_too_short",
        "Password must be at least 4 characters.",
        400,
        { min: 4 }
      );
    const { hash, salt } = await hashPassword(body.password);
    await c.env.DB.prepare(
      `UPDATE drops SET password_hash = ?, password_salt = ?, updated_at = ?
         WHERE slug = ?`
    )
      .bind(hash, salt, Date.now(), slug)
      .run();
  }

  const updated = await getDrop(c.env.DB, slug);
  return c.json(serializeDrop(updated!, c.env.PUBLIC_URL));
});

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

// Defensive runtime check at JSON-body boundaries: JSON.parse will happily
// produce arrays / objects / numbers where the TS annotation says
// `string?`, so we must check before calling .trim() or .length on what
// arrives. Returns the field names that are present but non-string.
function nonStringFields(
  body: Record<string, unknown>,
  fields: readonly string[]
): string[] {
  return fields.filter(
    (f) =>
      body[f] !== undefined && body[f] !== null && typeof body[f] !== "string"
  );
}

// Canonical Drop JSON shape — every mutating + read endpoint returns this.
function serializeDrop(d: Drop, publicUrl: string) {
  return {
    slug: d.slug,
    title: d.title,
    description: d.description,
    url: `${publicUrl}/p/${d.slug}`,
    raw_url: `${publicUrl}/p/${d.slug}/raw`,
    locked: !!d.password_hash,
    latest_version: d.latest_version,
    view_count: d.view_count,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}

function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

type CreateBody = {
  title: string;
  description: string;
  html: string;
  password: string;
  context: string;
};

type ValidationError = {
  code: "title_required" | "title_too_long" | "description_too_long"
       | "html_required" | "html_too_large" | "context_too_large";
  message: string;
  details?: Record<string, unknown>;
};

function validateCreateBody(body: {
  title?: string;
  description?: string;
  html?: string;
  password?: string;
  context?: string;
}): { error?: ValidationError; value: CreateBody } {
  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const html = body.html ?? "";
  const password = body.password ?? "";
  const context = body.context ?? "";
  const value = { title, description, html, password, context };

  if (!title)
    return { error: { code: "title_required", message: "Title is required." }, value };
  if (title.length > MAX_TITLE)
    return {
      error: {
        code: "title_too_long",
        message: `Title exceeds ${MAX_TITLE} chars.`,
        details: { max: MAX_TITLE },
      },
      value,
    };
  if (description.length > MAX_DESCRIPTION)
    return {
      error: {
        code: "description_too_long",
        message: `Description exceeds ${MAX_DESCRIPTION} chars.`,
        details: { max: MAX_DESCRIPTION },
      },
      value,
    };
  if (!html)
    return { error: { code: "html_required", message: "HTML body is required." }, value };
  if (byteLength(html) > MAX_HTML_BYTES)
    return {
      error: {
        code: "html_too_large",
        message: `HTML exceeds ${MAX_HTML_BYTES} bytes.`,
        details: { max_bytes: MAX_HTML_BYTES },
      },
      value,
    };
  if (context && byteLength(context) > MAX_CONTEXT_BYTES)
    return {
      error: {
        code: "context_too_large",
        message: `Context exceeds ${MAX_CONTEXT_BYTES} bytes.`,
        details: { max_bytes: MAX_CONTEXT_BYTES },
      },
      value,
    };
  return { value };
}
