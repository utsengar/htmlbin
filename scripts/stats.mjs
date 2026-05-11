#!/usr/bin/env node
// Local stats + risk-signal CLI for htmlbin.
//
// Runs SQL via `wrangler d1 execute` and prints a single screenful:
// adoption snapshot, time-series (day/week/month buckets), top
// drops/users, and risk signals that surface only when something's
// off (burst writes, zero-view aging, rate-limit hits, etc.).
//
// Usage:
//   npm run stats                   # day buckets, last 14 days, remote
//   npm run stats -- --window=week  # weekly buckets, last 12 weeks
//   npm run stats -- --window=month --buckets=6
//   npm run stats -- --local        # query local .wrangler/state/ D1

import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

// ── arg parsing ────────────────────────────────────────────────────
const { values } = parseArgs({
  options: {
    window: { type: "string", default: "day" },
    buckets: { type: "string" },
    local: { type: "boolean", default: false },
  },
  strict: true,
  allowPositionals: false,
});

if (!["day", "week", "month"].includes(values.window)) {
  console.error(`--window must be day|week|month, got: ${values.window}`);
  process.exit(1);
}
const WINDOW = values.window;
const DEFAULT_BUCKETS = WINDOW === "day" ? 14 : 12;
const BUCKETS = values.buckets
  ? Number.parseInt(values.buckets, 10)
  : DEFAULT_BUCKETS;
if (!Number.isFinite(BUCKETS) || BUCKETS < 1) {
  console.error(`--buckets must be a positive integer`);
  process.exit(1);
}
const ENV_FLAG = values.local ? "--local" : "--remote";
const ENV_LABEL = values.local ? "local" : "remote";

// ── time helpers ───────────────────────────────────────────────────
const NOW = Date.now();
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const MS_24H = DAY_MS;
const MS_7D = 7 * DAY_MS;

function bucketFormat(w) {
  return w === "day" ? "%Y-%m-%d" : w === "week" ? "%Y-W%W" : "%Y-%m";
}

// Match SQLite strftime('%W', …): week of year, Mon-start, days before
// the first Monday are in week 00.
function weekLabelUTC(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const jan1 = Date.UTC(y, 0, 1);
  const jan1Dow = new Date(jan1).getUTCDay(); // 0=Sun..6=Sat
  const daysUntilFirstMon = (8 - jan1Dow) % 7; // 0..6
  const dayOfYear = Math.floor((ms - jan1) / DAY_MS);
  const week =
    dayOfYear < daysUntilFirstMon
      ? 0
      : Math.floor((dayOfYear - daysUntilFirstMon) / 7) + 1;
  return `${y}-W${String(week).padStart(2, "0")}`;
}

function dayLabelUTC(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function monthLabelUTC(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function expectedBuckets(w, count) {
  const labels = [];
  if (w === "day") {
    for (let i = count - 1; i >= 0; i--) {
      labels.push(dayLabelUTC(NOW - i * DAY_MS));
    }
  } else if (w === "week") {
    for (let i = count - 1; i >= 0; i--) {
      labels.push(weekLabelUTC(NOW - i * WEEK_MS));
    }
  } else {
    const ref = new Date(NOW);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - i, 1),
      );
      labels.push(monthLabelUTC(d.getTime()));
    }
  }
  // De-dupe (week math can repeat near year boundaries) preserving order.
  return [...new Set(labels)];
}

function bucketCutoffMs(w, count) {
  const unit = w === "day" ? DAY_MS : w === "week" ? WEEK_MS : 31 * DAY_MS;
  return NOW - count * unit;
}

// ── wrangler helper ────────────────────────────────────────────────
function runQuery(sql) {
  const flat = sql.replace(/\s+/g, " ").trim();
  let out;
  try {
    out = execFileSync(
      "npx",
      ["wrangler", "d1", "execute", "htmlbin-db", ENV_FLAG, "--json", "--command", flat],
      { stdio: ["ignore", "pipe", "pipe"] },
    ).toString();
  } catch (e) {
    console.error(`\n  query failed: ${flat}`);
    console.error(`  exit code: ${e.status}`);
    if (e.stdout?.length) console.error(`  stdout:\n${e.stdout.toString()}`);
    if (e.stderr?.length) console.error(`  stderr:\n${e.stderr.toString()}`);
    process.exit(1);
  }
  // Wrangler --json sometimes prefixes stdout with a banner / warnings.
  // The actual JSON starts with `[{`, so anchor on that exact pair.
  const jsonStart = out.indexOf("[{");
  if (jsonStart < 0) {
    console.error(`\n  unexpected wrangler output (no JSON found):\n${out}`);
    process.exit(1);
  }
  try {
    return JSON.parse(out.slice(jsonStart))[0]?.results ?? [];
  } catch (e) {
    console.error(`\n  failed to parse wrangler output: ${e.message}`);
    console.error(`  raw:\n${out}`);
    process.exit(1);
  }
}

// ── render helpers ─────────────────────────────────────────────────
const BAR_WIDTH = 14;

function bar(n, max) {
  if (!n) return "";
  const filled = Math.max(1, Math.round((n / Math.max(max, 1)) * BAR_WIDTH));
  return "█".repeat(filled);
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function num(n) {
  return Number(n ?? 0).toLocaleString();
}

function nowStamp() {
  const d = new Date(NOW);
  return `${dayLabelUTC(NOW)} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

// ── data fetch ─────────────────────────────────────────────────────
console.log(`\nhtmlbin stats — ${nowStamp()}  ·  env: ${ENV_LABEL}\n`);

// User-id → github_login lookup (used to humanize risk rows).
const usersById = new Map();
for (const u of runQuery("SELECT id, github_login FROM users")) {
  usersById.set(u.id, u.github_login);
}
function handle(userId) {
  const login = usersById.get(userId);
  return login ? `@${login}` : `user_${String(userId).slice(0, 8)}`;
}

const t24 = NOW - MS_24H;
const t7d = NOW - MS_7D;

// Overview
const dropsRow = runQuery(`
  SELECT COUNT(*) AS total,
         SUM(CASE WHEN created_at >= ${t24} THEN 1 ELSE 0 END) AS d24h,
         SUM(CASE WHEN created_at >= ${t7d} THEN 1 ELSE 0 END) AS d7d
  FROM drops
`)[0] ?? { total: 0, d24h: 0, d7d: 0 };

const usersRow = runQuery(`
  SELECT COUNT(*) AS total,
         SUM(CASE WHEN created_at >= ${t24} THEN 1 ELSE 0 END) AS d24h,
         SUM(CASE WHEN created_at >= ${t7d} THEN 1 ELSE 0 END) AS d7d
  FROM users
`)[0] ?? { total: 0, d24h: 0, d7d: 0 };

const tokensRow = runQuery(`
  SELECT COUNT(DISTINCT user_id) AS active_7d
  FROM tokens
  WHERE last_used_at >= ${t7d} AND revoked_at IS NULL
`)[0] ?? { active_7d: 0 };

const verifyRow = runQuery(`
  SELECT COUNT(*) AS started,
         SUM(CASE WHEN status IN ('verified','claimed') THEN 1 ELSE 0 END) AS completed
  FROM verifications
  WHERE created_at >= ${t24}
`)[0] ?? { started: 0, completed: 0 };

// Time-series
const tsCutoff = bucketCutoffMs(WINDOW, BUCKETS + 1); // small overshoot
const fmt = bucketFormat(WINDOW);
const dropsTs = runQuery(`
  SELECT strftime('${fmt}', created_at/1000, 'unixepoch') AS bucket, COUNT(*) AS n
  FROM drops
  WHERE created_at >= ${tsCutoff}
  GROUP BY bucket
`);
const usersTs = runQuery(`
  SELECT strftime('${fmt}', created_at/1000, 'unixepoch') AS bucket, COUNT(*) AS n
  FROM users
  WHERE created_at >= ${tsCutoff}
  GROUP BY bucket
`);
const dropsByBucket = new Map(dropsTs.map((r) => [r.bucket, r.n]));
const usersByBucket = new Map(usersTs.map((r) => [r.bucket, r.n]));

// Top drops / top users
const topDrops = runQuery(`
  SELECT slug, title, view_count
  FROM drops
  ORDER BY view_count DESC
  LIMIT 10
`);
const topUsers = runQuery(`
  SELECT u.id, u.github_login,
         COUNT(d.slug) AS drops,
         COALESCE(SUM(d.view_count), 0) AS views
  FROM users u
  JOIN drops d ON d.user_id = u.id
  GROUP BY u.id
  ORDER BY drops DESC
  LIMIT 10
`);

// Risk signals
const burstWrites = runQuery(`
  SELECT user_id, COUNT(*) AS n
  FROM drops
  WHERE created_at >= ${t24}
  GROUP BY user_id
  HAVING COUNT(*) >= 20
  ORDER BY n DESC
`);
const zeroViewAging = runQuery(`
  SELECT user_id, COUNT(*) AS n
  FROM drops
  WHERE view_count = 0 AND created_at < ${t24}
  GROUP BY user_id
  HAVING COUNT(*) >= 5
  ORDER BY n DESC
  LIMIT 5
`);
const rateLimitHits = runQuery(`
  SELECT bucket, rate_limits.count AS c, window_start
  FROM rate_limits
  WHERE window_start >= ${t24} AND rate_limits.count >= 60
  ORDER BY rate_limits.count DESC
  LIMIT 5
`);
const storageOutliers = runQuery(`
  SELECT d.user_id, SUM(v.size_bytes) AS bytes, COUNT(DISTINCT d.slug) AS drops
  FROM versions v
  JOIN drops d ON d.slug = v.slug
  GROUP BY d.user_id
  ORDER BY bytes DESC
  LIMIT 5
`);
const editSpam = runQuery(`
  SELECT slug, latest_version
  FROM drops
  WHERE latest_version >= 100
  ORDER BY latest_version DESC
  LIMIT 5
`);
const lockHeavy = runQuery(`
  SELECT user_id,
         COUNT(*) AS n,
         SUM(CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END) * 1.0 / COUNT(*) AS r
  FROM drops
  GROUP BY user_id
  HAVING COUNT(*) >= 5 AND r >= 0.8
  ORDER BY r DESC
  LIMIT 5
`);

// ── render ─────────────────────────────────────────────────────────

// Overview
console.log("OVERVIEW");
console.log(
  `  drops           total ${String(num(dropsRow.total)).padEnd(8)} 24h ${String(num(dropsRow.d24h)).padEnd(6)} 7d ${num(dropsRow.d7d)}`,
);
console.log(
  `  users           total ${String(num(usersRow.total)).padEnd(8)} 24h ${String(num(usersRow.d24h)).padEnd(6)} 7d ${num(usersRow.d7d)}`,
);
console.log(`  tokens active   7d ${num(tokensRow.active_7d)}`);
const conv =
  verifyRow.started > 0
    ? Math.round((Number(verifyRow.completed) / Number(verifyRow.started)) * 100)
    : 0;
console.log(
  `  verify funnel   started ${num(verifyRow.started)}   completed ${num(verifyRow.completed)}   conv ${conv}%`,
);
console.log();

// Time-series
const labels = expectedBuckets(WINDOW, BUCKETS);
const dropsMax = Math.max(1, ...labels.map((l) => dropsByBucket.get(l) ?? 0));
const usersMax = Math.max(1, ...labels.map((l) => usersByBucket.get(l) ?? 0));
console.log(`TIMESERIES — ${WINDOW}, last ${labels.length} ${WINDOW}s`);
for (const l of labels) {
  const dn = Number(dropsByBucket.get(l) ?? 0);
  const un = Number(usersByBucket.get(l) ?? 0);
  console.log(
    `  ${l.padEnd(11)}  drops ${bar(dn, dropsMax).padEnd(BAR_WIDTH)} ${String(dn).padStart(4)}   users ${bar(un, usersMax).padEnd(BAR_WIDTH)} ${String(un).padStart(4)}`,
  );
}
console.log();

// Top drops
if (topDrops.length > 0) {
  console.log("TOP DROPS BY VIEWS");
  for (const d of topDrops) {
    const slug = `/p/${d.slug}`.padEnd(12);
    const title = truncate(d.title ?? "", 42).padEnd(43);
    console.log(`  ${slug} ${title} ${String(num(d.view_count)).padStart(6)}`);
  }
  console.log();
}

// Top users
if (topUsers.length > 1) {
  console.log("TOP USERS BY DROPS");
  for (const u of topUsers) {
    const h = (u.github_login ? `@${u.github_login}` : `user_${String(u.id).slice(0, 8)}`).padEnd(20);
    console.log(
      `  ${h} ${String(num(u.drops)).padStart(3)} drops   ${String(num(u.views)).padStart(7)} views`,
    );
  }
  console.log();
}

// Risk signals — only the rows that triggered.
const riskLines = [];

for (const r of burstWrites) {
  riskLines.push(`  burst writes      ${handle(r.user_id)} created ${num(r.n)} drops in last 24h`);
}
for (const r of zeroViewAging) {
  riskLines.push(`  zero-view aging   ${handle(r.user_id)} has ${num(r.n)} drops >24h old with 0 views`);
}
for (const r of rateLimitHits) {
  riskLines.push(`  rate-limit hits   bucket ${truncate(r.bucket, 32)} at ${num(r.c)} hits`);
}
if (verifyRow.started >= 10 && conv < 50) {
  riskLines.push(`  verify drop-off   24h conversion ${conv}% (${num(verifyRow.completed)}/${num(verifyRow.started)})`);
}
for (const r of storageOutliers) {
  if (Number(r.bytes) === 0) continue;
  riskLines.push(`  storage outlier   ${handle(r.user_id)} ${fmtBytes(Number(r.bytes))} across ${num(r.drops)} drops`);
}
for (const r of editSpam) {
  riskLines.push(`  edit-spam         /p/${r.slug} at v${r.latest_version} of 200`);
}
for (const r of lockHeavy) {
  riskLines.push(`  lock-heavy        ${handle(r.user_id)} ${Math.round(Number(r.r) * 100)}% password-locked across ${num(r.n)} drops`);
}

console.log("RISK SIGNALS");
if (riskLines.length === 0) {
  console.log("  none");
} else {
  for (const l of riskLines) console.log(l);
}
console.log();
