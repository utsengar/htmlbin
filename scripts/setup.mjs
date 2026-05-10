#!/usr/bin/env node
// One-shot setup: provision Cloudflare D1 + KV, patch wrangler.toml,
// apply schema, and prompt for the secrets we need.
//
// Usage: npm run setup
//
// Requires: wrangler logged in (`wrangler login`), Node 18+.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const wranglerPath = path.join(root, "wrangler.toml");

function sh(cmd) {
  return execSync(cmd, { stdio: ["inherit", "pipe", "inherit"] }).toString();
}

function patch(file, find, replace) {
  const orig = readFileSync(file, "utf8");
  if (!orig.includes(find)) {
    console.warn(`  (skip) couldn't find placeholder: ${find}`);
    return;
  }
  writeFileSync(file, orig.replace(find, replace));
}

console.log("→ Creating D1 database 'htmlbin-db' …");
let d1Out;
try {
  d1Out = sh(`npx wrangler d1 create htmlbin-db`);
} catch {
  console.log("  (already exists, fetching id from `d1 list`)");
  d1Out = sh(`npx wrangler d1 list --json`);
}
const d1Match = d1Out.match(/"uuid":\s*"([a-f0-9-]+)"|database_id\s*=\s*"([a-f0-9-]+)"/);
const d1Id = d1Match?.[1] ?? d1Match?.[2];
if (!d1Id) {
  console.error("Couldn't extract D1 id. Set it manually in wrangler.toml.");
  process.exit(1);
}
console.log(`  D1 id: ${d1Id}`);

console.log("→ Creating KV namespace 'DROPS_KV' …");
const kvOut = sh(`npx wrangler kv namespace create DROPS_KV`);
const kvMatch = kvOut.match(/id\s*=\s*"([a-f0-9]+)"/);
const kvId = kvMatch?.[1];
if (!kvId) {
  console.error("Couldn't extract KV id. Set it manually in wrangler.toml.");
  process.exit(1);
}
console.log(`  KV id: ${kvId}`);

console.log("→ Patching wrangler.toml …");
patch(wranglerPath, /REPLACE_WITH_D1_ID/g, d1Id);
patch(wranglerPath, /REPLACE_WITH_KV_ID/g, kvId);

console.log("→ Applying schema (local + remote) …");
sh(`npx wrangler d1 execute htmlbin-db --local --file=./schema.sql`);
try {
  sh(`npx wrangler d1 execute htmlbin-db --remote --file=./schema.sql`);
} catch (e) {
  console.warn("  (remote apply failed — run `npm run db:apply:remote` after deploy)");
}

console.log("→ Setting TOKEN_PEPPER secret …");
const pepper = randomBytes(32).toString("hex");
try {
  execSync(`echo "${pepper}" | npx wrangler secret put TOKEN_PEPPER`, {
    stdio: "inherit",
  });
} catch (e) {
  console.warn("  (couldn't set secret — set manually with `wrangler secret put TOKEN_PEPPER`)");
}

console.log("");
console.log("✓ Setup done.");
console.log("");
console.log("Next:");
console.log("  1. Create a Turnstile widget at https://dash.cloudflare.com → Turnstile");
console.log("     Then update TURNSTILE_SITE_KEY in wrangler.toml,");
console.log("     and run: wrangler secret put TURNSTILE_SECRET_KEY");
console.log("");
console.log("  2. For local dev, also create .dev.vars with:");
console.log("       TOKEN_PEPPER=\"" + pepper + "\"");
console.log("       TURNSTILE_SECRET_KEY=\"1x0000000000000000000000000000000AA\"");
console.log("");
console.log("  3. npm run dev   # local at http://localhost:8787");
console.log("     npm run deploy");
