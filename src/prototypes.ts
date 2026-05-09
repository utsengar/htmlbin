import { Hono } from "hono";
import type { Bindings, Variables } from "./types";
import { authMiddleware } from "./auth";
import { generateSlug, isValidSlug } from "./slug";
import { hashPassword } from "./crypto";
import {
  getPrototype,
  getVersion,
  listPrototypesByUser,
  listVersions,
  rateLimit,
} from "./db";

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_TITLE = 200;
const MAX_DESCRIPTION = 500;
const MAX_CONTEXT_BYTES = 64 * 1024; // 64 KB
const MAX_PROTOTYPES_PER_USER = 500;
const MAX_VERSIONS_PER_DROP = 200;
const MAX_DAILY_WRITES = 500;

export const apiRoutes = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

apiRoutes.use("/prototypes", authMiddleware);
apiRoutes.use("/prototypes/*", authMiddleware);
apiRoutes.use("/me", authMiddleware);
apiRoutes.use("/tokens", authMiddleware);
apiRoutes.use("/tokens/*", authMiddleware);

// ----- who am I -----------------------------------------------------------
apiRoutes.get("/me", async (c) => {
  const user = c.get("user");
  return c.json({ user_id: user.id });
});

// ----- list / revoke tokens for the current user --------------------------
apiRoutes.get("/tokens", async (c) => {
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
    return c.json({ error: "invalid_token_id" }, 400);
  const res = await c.env.DB.prepare(
    `UPDATE tokens SET revoked_at = ? WHERE substr(token_hash,1,12) = ? AND user_id = ?`
  )
    .bind(Date.now(), id, user.id)
    .run();
  if ((res.meta?.changes ?? 0) === 0) return c.json({ error: "not_found" }, 404);
  return c.json({ revoked: id });
});

// ----- list my drops ------------------------------------------------------
apiRoutes.get("/prototypes", async (c) => {
  const user = c.get("user");
  const list = await listPrototypesByUser(c.env.DB, user.id);
  return c.json(
    list.map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      url: `${c.env.PUBLIC_URL}/p/${p.slug}`,
      raw_url: `${c.env.PUBLIC_URL}/p/${p.slug}/raw`,
      locked: !!p.password_hash,
      latest_version: p.latest_version,
      view_count: p.view_count,
      created_at: p.created_at,
      updated_at: p.updated_at,
    }))
  );
});

// ----- create a new drop (always v1) -------------------------------------
apiRoutes.post("/prototypes", async (c) => {
  const user = c.get("user");

  if (!(await rateLimit(c.env.DB, `write:${user.id}`, 60, 60_000)))
    return c.json({ error: "rate_limited" }, 429);
  if (!(await rateLimit(c.env.DB, `daily:${user.id}`, MAX_DAILY_WRITES, 86_400_000)))
    return c.json({ error: "daily_quota_exceeded", max: MAX_DAILY_WRITES }, 429);

  const body = (await c.req.json().catch(() => null)) as
    | {
        title?: string;
        description?: string;
        html?: string;
        password?: string;
        context?: string;
      }
    | null;
  if (!body) return c.json({ error: "invalid_json" }, 400);

  const valid = validateBody(body);
  if (valid.error) return c.json({ error: valid.error, ...valid.detail }, 400);

  const { title, description, html, password, context } = valid.value;

  // Quota
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM prototypes WHERE user_id = ?`
  )
    .bind(user.id)
    .first<{ n: number }>();
  if ((countRow?.n ?? 0) >= MAX_PROTOTYPES_PER_USER) {
    return c.json(
      { error: "quota_exceeded", max: MAX_PROTOTYPES_PER_USER },
      403
    );
  }

  // Slug
  let slug = generateSlug(title);
  for (let i = 0; i < 5; i++) {
    if (!(await getPrototype(c.env.DB, slug))) break;
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
  await c.env.PROTOTYPES_KV.put(`html:${slug}:v1`, html);

  // D1: prototypes + versions in one batch.
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO prototypes
         (slug, user_id, title, description, password_hash, password_salt,
          latest_version, view_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
    ).bind(slug, user.id, title, description, passwordHash, passwordSalt, now, now),
    c.env.DB.prepare(
      `INSERT INTO versions (slug, version, size_bytes, context, created_at)
       VALUES (?, 1, ?, ?, ?)`
    ).bind(slug, sizeBytes, context || null, now),
  ]);

  return c.json(
    {
      slug,
      version: 1,
      url: `${c.env.PUBLIC_URL}/p/${slug}`,
      raw_url: `${c.env.PUBLIC_URL}/p/${slug}/raw`,
      locked: !!passwordHash,
    },
    201
  );
});

// ----- update = NEW VERSION (slug stays, URL stays) ----------------------
apiRoutes.put("/prototypes/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug)) return c.json({ error: "invalid_slug" }, 400);

  if (!(await rateLimit(c.env.DB, `write:${user.id}`, 60, 60_000)))
    return c.json({ error: "rate_limited" }, 429);

  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.json({ error: "not_found" }, 404);
  if (proto.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

  if (proto.latest_version >= MAX_VERSIONS_PER_DROP) {
    return c.json(
      { error: "version_limit_reached", max: MAX_VERSIONS_PER_DROP },
      403
    );
  }

  const body = (await c.req.json().catch(() => null)) as
    | { title?: string; description?: string; html?: string; context?: string }
    | null;
  if (!body) return c.json({ error: "invalid_json" }, 400);

  const title = body.title?.trim();
  const description = body.description?.trim();
  const html = body.html;
  const context = body.context;

  if (title !== undefined && title.length === 0)
    return c.json({ error: "title_required" }, 400);
  if (title && title.length > MAX_TITLE)
    return c.json({ error: "title_too_long", max: MAX_TITLE }, 400);
  if (description && description.length > MAX_DESCRIPTION)
    return c.json({ error: "description_too_long", max: MAX_DESCRIPTION }, 400);
  if (context && byteLength(context) > MAX_CONTEXT_BYTES)
    return c.json({ error: "context_too_large", max_bytes: MAX_CONTEXT_BYTES }, 400);

  const now = Date.now();
  let nextVersion = proto.latest_version;

  // If html is included, mint a new version. Otherwise just update metadata.
  if (html !== undefined) {
    const sizeBytes = byteLength(html);
    if (sizeBytes > MAX_HTML_BYTES)
      return c.json(
        { error: "html_too_large", max_bytes: MAX_HTML_BYTES },
        400
      );

    nextVersion = proto.latest_version + 1;
    await c.env.PROTOTYPES_KV.put(`html:${slug}:v${nextVersion}`, html);

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO versions (slug, version, size_bytes, context, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(slug, nextVersion, sizeBytes, context || null, now),
      c.env.DB.prepare(
        `UPDATE prototypes
            SET title = COALESCE(?, title),
                description = COALESCE(?, description),
                latest_version = ?,
                updated_at = ?
          WHERE slug = ? AND user_id = ?`
      ).bind(title ?? null, description ?? null, nextVersion, now, slug, user.id),
    ]);
  } else {
    // Metadata-only update — no new version.
    await c.env.DB.prepare(
      `UPDATE prototypes
          SET title = COALESCE(?, title),
              description = COALESCE(?, description),
              updated_at = ?
        WHERE slug = ? AND user_id = ?`
    )
      .bind(title ?? null, description ?? null, now, slug, user.id)
      .run();
  }

  return c.json({
    slug,
    version: nextVersion,
    url: `${c.env.PUBLIC_URL}/p/${slug}`,
    raw_url: `${c.env.PUBLIC_URL}/p/${slug}/raw`,
  });
});

// ----- get one of mine (metadata only) ----------------------------------
apiRoutes.get("/prototypes/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug)) return c.json({ error: "invalid_slug" }, 400);

  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.json({ error: "not_found" }, 404);
  if (proto.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

  return c.json({
    slug: proto.slug,
    title: proto.title,
    description: proto.description,
    url: `${c.env.PUBLIC_URL}/p/${proto.slug}`,
    raw_url: `${c.env.PUBLIC_URL}/p/${proto.slug}/raw`,
    locked: !!proto.password_hash,
    latest_version: proto.latest_version,
    view_count: proto.view_count,
    created_at: proto.created_at,
    updated_at: proto.updated_at,
  });
});

// ----- list versions of a drop ------------------------------------------
apiRoutes.get("/prototypes/:slug/versions", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug)) return c.json({ error: "invalid_slug" }, 400);
  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.json({ error: "not_found" }, 404);
  if (proto.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

  const versions = await listVersions(c.env.DB, slug);
  return c.json(
    versions.map((v) => ({
      version: v.version,
      size_bytes: v.size_bytes,
      has_context: !!v.context,
      created_at: v.created_at,
    }))
  );
});

// ----- get specific version metadata (and context) ----------------------
apiRoutes.get("/prototypes/:slug/v/:n", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  const n = parseInt(c.req.param("n"), 10);
  if (!isValidSlug(slug) || !Number.isFinite(n) || n < 1)
    return c.json({ error: "invalid_arg" }, 400);
  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.json({ error: "not_found" }, 404);
  if (proto.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

  const v = await getVersion(c.env.DB, slug, n);
  if (!v) return c.json({ error: "version_not_found" }, 404);
  return c.json({
    slug,
    version: v.version,
    size_bytes: v.size_bytes,
    context: v.context,
    created_at: v.created_at,
    is_latest: v.version === proto.latest_version,
  });
});

// ----- delete drop (all versions) ---------------------------------------
apiRoutes.delete("/prototypes/:slug", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug)) return c.json({ error: "invalid_slug" }, 400);

  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.json({ error: "not_found" }, 404);
  if (proto.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

  // Delete all versioned HTML keys.
  for (let v = 1; v <= proto.latest_version; v++) {
    await c.env.PROTOTYPES_KV.delete(`html:${slug}:v${v}`);
  }
  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM versions WHERE slug = ?`).bind(slug),
    c.env.DB.prepare(`DELETE FROM prototypes WHERE slug = ? AND user_id = ?`).bind(
      slug,
      user.id
    ),
  ]);

  return c.json({ deleted: slug });
});

// ----- password set / change / remove -----------------------------------
apiRoutes.post("/prototypes/:slug/password", async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");
  if (!isValidSlug(slug)) return c.json({ error: "invalid_slug" }, 400);
  const proto = await getPrototype(c.env.DB, slug);
  if (!proto) return c.json({ error: "not_found" }, 404);
  if (proto.user_id !== user.id) return c.json({ error: "forbidden" }, 403);

  const body = (await c.req.json().catch(() => null)) as
    | { password?: string }
    | null;
  if (!body || typeof body.password !== "string")
    return c.json({ error: "password_required" }, 400);

  if (body.password === "") {
    await c.env.DB.prepare(
      `UPDATE prototypes SET password_hash = NULL, password_salt = NULL,
              updated_at = ? WHERE slug = ?`
    )
      .bind(Date.now(), slug)
      .run();
    return c.json({ slug, locked: false });
  }
  if (body.password.length < 4)
    return c.json({ error: "password_too_short", min: 4 }, 400);

  const { hash, salt } = await hashPassword(body.password);
  await c.env.DB.prepare(
    `UPDATE prototypes SET password_hash = ?, password_salt = ?, updated_at = ?
       WHERE slug = ?`
  )
    .bind(hash, salt, Date.now(), slug)
    .run();
  return c.json({ slug, locked: true });
});

// ----- helpers ----------------------------------------------------------
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

function validateBody(body: {
  title?: string;
  description?: string;
  html?: string;
  password?: string;
  context?: string;
}): { error?: string; detail?: object; value: CreateBody } {
  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const html = body.html ?? "";
  const password = body.password ?? "";
  const context = body.context ?? "";
  const value = { title, description, html, password, context };

  if (!title) return { error: "title_required", value };
  if (title.length > MAX_TITLE)
    return { error: "title_too_long", detail: { max: MAX_TITLE }, value };
  if (description.length > MAX_DESCRIPTION)
    return {
      error: "description_too_long",
      detail: { max: MAX_DESCRIPTION },
      value,
    };
  if (!html) return { error: "html_required", value };
  if (byteLength(html) > MAX_HTML_BYTES)
    return {
      error: "html_too_large",
      detail: { max_bytes: MAX_HTML_BYTES },
      value,
    };
  if (context && byteLength(context) > MAX_CONTEXT_BYTES)
    return {
      error: "context_too_large",
      detail: { max_bytes: MAX_CONTEXT_BYTES },
      value,
    };
  return { value };
}
