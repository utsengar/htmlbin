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
console.log("  1. Register a GitHub OAuth app at");
console.log("     https://github.com/settings/applications/new");
console.log("     - Authorization callback URL:");
console.log("         https://<your-domain>/auth/github/callback");
console.log("     Paste the Client ID into wrangler.toml as GITHUB_CLIENT_ID,");
console.log("     then run: wrangler secret put GITHUB_CLIENT_SECRET");
console.log("");
console.log("  2. For local dev, copy .dev.vars.example to .dev.vars. The");
console.log("     defaults use a 'dev-mock' sentinel that short-circuits");
console.log("     github.com so the e2e script works offline. Replace");
console.log("     TOKEN_PEPPER with the value generated above:");
console.log("       TOKEN_PEPPER=\"" + pepper + "\"");
console.log("       GITHUB_CLIENT_ID=\"dev-mock\"");
console.log("       GITHUB_CLIENT_SECRET=\"dev-mock\"");
console.log("");
console.log("  3. npm run dev   # local at http://localhost:8787");
console.log("     npm run deploy");
