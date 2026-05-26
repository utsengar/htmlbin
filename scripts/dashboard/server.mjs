#!/usr/bin/env node
// Local visual dashboard for htmlbin.
//
// Spawns `wrangler d1 execute --remote --json` for queries (same pattern as
// scripts/stats.mjs) and serves a small SPA at http://127.0.0.1:5173 with
// overview + per-user + per-drop drill-down views.
//
// Usage:
//   npm run dashboard          # remote D1
//   npm run dashboard -- --local
//
// Local only. Bound to 127.0.0.1. Read-only queries. Whitelisted inputs.

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { extname, resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const PORT = Number(process.env.PORT) || 5173;
const ENV_FLAG = process.argv.includes("--local") ? "--local" : "--remote";
const ENV_LABEL = ENV_FLAG === "--local" ? "local" : "remote";

// Invoke wrangler's entry point directly. `npx wrangler` works in
// theory but the `.bin/wrangler` shim is installed as a regular file
// (not a symlink) which breaks its `__dirname`-based path math.
const WRANGLER_ENTRY = resolve(REPO_ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
if (!existsSync(WRANGLER_ENTRY)) {
  console.error(`wrangler not found at ${WRANGLER_ENTRY} — run \`npm install\` first.`);
  process.exit(1);
}

const CACHE_TTL_MS = 30_000;
const cache = new Map();

function runQuery(sql) {
  const flat = sql.replace(/\s+/g, " ").trim();
  const cached = cache.get(flat);
  if (cached && cached.expires > Date.now()) return cached.results;
  let out;
  try {
    out = execFileSync(
      process.execPath,
      [
        WRANGLER_ENTRY, "d1", "execute", "htmlbin-db",
        ENV_FLAG, "--json", "--command", flat,
      ],
      { stdio: ["ignore", "pipe", "pipe"], cwd: REPO_ROOT },
    ).toString();
  } catch (e) {
    const msg = e.stderr?.toString() || e.message || "unknown";
    throw new Error(`wrangler failed: ${msg.slice(0, 800)}`);
  }
  const match = out.match(/\[\s*\{/);
  if (!match) {
    if (out.match(/\[\s*\]/)) return [];
    throw new Error(`unexpected wrangler output:\n${out.slice(0, 400)}`);
  }
  const results = JSON.parse(out.slice(match.index))[0]?.results ?? [];
  cache.set(flat, { results, expires: Date.now() + CACHE_TTL_MS });
  return results;
}

// ── inputs ─────────────────────────────────────────────────────────
// Strict whitelists. wrangler d1 execute --command does not accept bind
// params, so every interpolated value comes through one of these gates.
const RE_USER = /^[A-Za-z0-9_-]{1,64}$/;
const RE_SLUG = /^[A-Za-z0-9]{6,12}$/;
const WINDOWS = new Set(["day", "week", "month"]);

// ── time helpers (mirror stats.mjs) ────────────────────────────────
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

function bucketFormat(w) {
  return w === "day" ? "%Y-%m-%d" : w === "week" ? "%Y-W%W" : "%Y-%m";
}
function bucketCutoffMs(w, count, now) {
  const unit = w === "day" ? DAY_MS : w === "week" ? WEEK_MS : 31 * DAY_MS;
  return now - count * unit;
}
function expectedBuckets(w, count, now) {
  const pad = (n) => String(n).padStart(2, "0");
  const labels = [];
  if (w === "day") {
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now - i * DAY_MS);
      labels.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    }
  } else if (w === "week") {
    for (let i = count - 1; i >= 0; i--) {
      const ms = now - i * WEEK_MS;
      const d = new Date(ms);
      const y = d.getUTCFullYear();
      const jan1 = Date.UTC(y, 0, 1);
      const jan1Dow = new Date(jan1).getUTCDay();
      const daysUntilFirstMon = (8 - jan1Dow) % 7;
      const dayOfYear = Math.floor((ms - jan1) / DAY_MS);
      const week = dayOfYear < daysUntilFirstMon
        ? 0
        : Math.floor((dayOfYear - daysUntilFirstMon) / 7) + 1;
      labels.push(`${y}-W${pad(week)}`);
    }
  } else {
    const ref = new Date(now);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - i, 1));
      labels.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
    }
  }
  return [...new Set(labels)];
}

// ── query builders ─────────────────────────────────────────────────
function overviewData(win, buckets) {
  const now = Date.now();
  const t24 = now - DAY_MS;
  const t7d = now - 7 * DAY_MS;

  const drops = runQuery(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN created_at >= ${t24} THEN 1 ELSE 0 END) AS d24h,
           SUM(CASE WHEN created_at >= ${t7d} THEN 1 ELSE 0 END) AS d7d
    FROM drops
  `)[0] ?? { total: 0, d24h: 0, d7d: 0 };

  const users = runQuery(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN created_at >= ${t24} THEN 1 ELSE 0 END) AS d24h,
           SUM(CASE WHEN created_at >= ${t7d} THEN 1 ELSE 0 END) AS d7d
    FROM users
  `)[0] ?? { total: 0, d24h: 0, d7d: 0 };

  const tokens = runQuery(`
    SELECT COUNT(DISTINCT user_id) AS active_7d
    FROM tokens
    WHERE last_used_at >= ${t7d} AND revoked_at IS NULL
  `)[0] ?? { active_7d: 0 };

  const verify = runQuery(`
    SELECT COUNT(*) AS started,
           SUM(CASE WHEN status IN ('verified','claimed') THEN 1 ELSE 0 END) AS completed
    FROM verifications
    WHERE created_at >= ${t24}
  `)[0] ?? { started: 0, completed: 0 };

  const tsCutoff = bucketCutoffMs(win, buckets + 1, now);
  const fmt = bucketFormat(win);
  const dropsTs = runQuery(`
    SELECT strftime('${fmt}', created_at/1000, 'unixepoch') AS bucket, COUNT(*) AS n
    FROM drops WHERE created_at >= ${tsCutoff} GROUP BY bucket
  `);
  const usersTs = runQuery(`
    SELECT strftime('${fmt}', created_at/1000, 'unixepoch') AS bucket, COUNT(*) AS n
    FROM users WHERE created_at >= ${tsCutoff} GROUP BY bucket
  `);
  const labels = expectedBuckets(win, buckets, now);
  const dropsMap = new Map(dropsTs.map((r) => [r.bucket, r.n]));
  const usersMap = new Map(usersTs.map((r) => [r.bucket, r.n]));
  const timeseries = labels.map((l) => ({
    bucket: l,
    drops: Number(dropsMap.get(l) ?? 0),
    users: Number(usersMap.get(l) ?? 0),
  }));

  const topDrops = runQuery(`
    SELECT d.slug, d.title, d.view_count, d.user_id, u.github_login
    FROM drops d LEFT JOIN users u ON u.id = d.user_id
    ORDER BY d.view_count DESC LIMIT 20
  `);

  const latestDrops = runQuery(`
    SELECT d.slug, d.title, d.created_at, d.view_count, d.latest_version,
           d.user_id, u.github_login
    FROM drops d LEFT JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC LIMIT 20
  `);

  const topUsers = runQuery(`
    SELECT u.id, u.github_login, u.created_at,
           COUNT(d.slug) AS drops,
           COALESCE(SUM(d.view_count), 0) AS views
    FROM users u JOIN drops d ON d.user_id = u.id
    GROUP BY u.id ORDER BY drops DESC LIMIT 20
  `);

  const burst = runQuery(`
    SELECT d.user_id, COUNT(*) AS n, u.github_login
    FROM drops d LEFT JOIN users u ON u.id = d.user_id
    WHERE d.created_at >= ${t24}
    GROUP BY d.user_id HAVING COUNT(*) >= 20 ORDER BY n DESC
  `);
  const zero = runQuery(`
    SELECT d.user_id, COUNT(*) AS n, u.github_login
    FROM drops d LEFT JOIN users u ON u.id = d.user_id
    WHERE d.view_count = 0 AND d.created_at < ${t24}
    GROUP BY d.user_id HAVING COUNT(*) >= 5 ORDER BY n DESC LIMIT 5
  `);
  const rateLimit = runQuery(`
    SELECT bucket, count AS c, window_start
    FROM rate_limits
    WHERE window_start >= ${t24} AND count >= 60
    ORDER BY count DESC LIMIT 5
  `);
  const storage = runQuery(`
    SELECT d.user_id, SUM(v.size_bytes) AS bytes, COUNT(DISTINCT d.slug) AS drops, u.github_login
    FROM versions v JOIN drops d ON d.slug = v.slug
    LEFT JOIN users u ON u.id = d.user_id
    GROUP BY d.user_id ORDER BY bytes DESC LIMIT 5
  `);
  const editSpam = runQuery(`
    SELECT slug, latest_version FROM drops
    WHERE latest_version >= 100 ORDER BY latest_version DESC LIMIT 5
  `);
  const lock = runQuery(`
    SELECT d.user_id, COUNT(*) AS n,
           SUM(CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*) AS r,
           u.github_login
    FROM drops d LEFT JOIN users u ON u.id = d.user_id
    GROUP BY d.user_id HAVING COUNT(*) >= 5 AND r >= 0.8
    ORDER BY r DESC LIMIT 5
  `);

  return {
    env: ENV_LABEL,
    generated_at: now,
    window: win,
    buckets,
    summary: { drops, users, tokens, verify },
    timeseries,
    top_drops: topDrops,
    latest_drops: latestDrops,
    top_users: topUsers,
    risk: {
      burst, zero,
      rate_limit: rateLimit,
      storage, edit_spam: editSpam, lock,
    },
  };
}

function userDetail(userId) {
  if (!RE_USER.test(userId)) throw new Error("invalid user id");

  const user = runQuery(`
    SELECT id, display_name, github_login, github_user_id, created_at
    FROM users WHERE id = '${userId}'
  `)[0];
  if (!user) return null;

  const tokens = runQuery(`
    SELECT label, created_at, last_used_at, revoked_at
    FROM tokens WHERE user_id = '${userId}'
    ORDER BY created_at DESC
  `);

  const drops = runQuery(`
    SELECT d.slug, d.title, d.created_at, d.updated_at, d.view_count,
           d.latest_version, (d.password_hash IS NOT NULL) AS locked,
           COALESCE((SELECT SUM(size_bytes) FROM versions WHERE slug = d.slug), 0) AS bytes
    FROM drops d WHERE d.user_id = '${userId}'
    ORDER BY d.created_at DESC
  `);

  const verifications = runQuery(`
    SELECT code, status, label, created_at, expires_at
    FROM verifications WHERE user_id = '${userId}'
    ORDER BY created_at DESC LIMIT 10
  `);

  const now = Date.now();
  const t30 = now - 30 * DAY_MS;
  const dropsTs = runQuery(`
    SELECT strftime('%Y-%m-%d', created_at/1000, 'unixepoch') AS bucket, COUNT(*) AS n
    FROM drops WHERE user_id = '${userId}' AND created_at >= ${t30}
    GROUP BY bucket
  `);
  const labels = expectedBuckets("day", 30, now);
  const map = new Map(dropsTs.map((r) => [r.bucket, r.n]));
  const timeseries = labels.map((l) => ({ bucket: l, drops: Number(map.get(l) ?? 0) }));

  return { user, tokens, drops, verifications, timeseries };
}

function dropDetail(slug) {
  if (!RE_SLUG.test(slug)) throw new Error("invalid slug");

  const drop = runQuery(`
    SELECT slug, user_id, title, description, latest_version, view_count,
           (password_hash IS NOT NULL) AS locked, created_at, updated_at
    FROM drops WHERE slug = '${slug}'
  `)[0];
  if (!drop) return null;

  const owner = runQuery(`
    SELECT id, github_login, created_at FROM users WHERE id = '${drop.user_id}'
  `)[0];

  const versions = runQuery(`
    SELECT version, size_bytes, created_at,
           (context IS NOT NULL AND context != '') AS has_context
    FROM versions WHERE slug = '${slug}' ORDER BY version DESC
  `);

  return { drop, owner, versions };
}

// ── http ───────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname === "/" ? "/index.html" : url.pathname;
  if (p.includes("..")) { res.statusCode = 400; res.end("bad path"); return; }
  const filePath = join(HERE, p);
  try {
    const body = readFileSync(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[extname(filePath)] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}

function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
const sendError = (res, message, status = 400) => sendJson(res, { error: message }, status);

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (path === "/api/overview") {
      const win = url.searchParams.get("window") || "day";
      if (!WINDOWS.has(win)) return sendError(res, "bad window");
      const defaultB = win === "day" ? 14 : 12;
      const buckets = Math.min(60, Math.max(1, Number(url.searchParams.get("buckets") || defaultB)));
      return sendJson(res, overviewData(win, buckets));
    }

    const userMatch = path.match(/^\/api\/user\/(.+)$/);
    if (userMatch) {
      const data = userDetail(decodeURIComponent(userMatch[1]));
      if (!data) return sendError(res, "user not found", 404);
      return sendJson(res, data);
    }

    const dropMatch = path.match(/^\/api\/drop\/(.+)$/);
    if (dropMatch) {
      const data = dropDetail(decodeURIComponent(dropMatch[1]));
      if (!data) return sendError(res, "drop not found", 404);
      return sendJson(res, data);
    }

    serveStatic(req, res);
  } catch (e) {
    sendError(res, e.message || "internal error", 500);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\nhtmlbin dashboard → http://127.0.0.1:${PORT}  (env: ${ENV_LABEL})\n`);
});
