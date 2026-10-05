#!/usr/bin/env node
// One-shot setup: provision Cloudflare D1 + KV, patch cloudflare.config.ts,
// apply schema, and prompt for the secrets we need.
//
// Usage: npm run setup
//
// Requires: cf logged in (`cf auth login`), Node 22.18+.

import { execSync, execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "cloudflare.config.ts");

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
  d1Out = sh(`npx cf d1 create --name htmlbin-db`);
} catch {
  console.log("  (already exists, fetching id from `d1 list`)");
  d1Out = sh(`npx cf d1 list --name htmlbin-db`);
}
const d1Id = d1Out.match(/"uuid":\s*"([a-f0-9-]+)"/)?.[1];
if (!d1Id) {
  console.error("Couldn't extract D1 id. Set it manually in cloudflare.config.ts.");
  process.exit(1);
}
console.log(`  D1 id: ${d1Id}`);

console.log("→ Creating KV namespace 'DROPS_KV' …");
const kvOut = sh(`npx cf kv namespaces create --title DROPS_KV`);
const kvId = kvOut.match(/"id":\s*"([a-f0-9]{32})"/)?.[1];
if (!kvId) {
  console.error("Couldn't extract KV id. Set it manually in cloudflare.config.ts.");
  process.exit(1);
}
console.log(`  KV id: ${kvId}`);

console.log("→ Patching cloudflare.config.ts …");
patch(configPath, /REPLACE_WITH_D1_ID/g, d1Id);
patch(configPath, /REPLACE_WITH_KV_ID/g, kvId);

console.log("→ Applying schema (local + remote) …");
const schema = readFileSync(path.join(root, "schema.sql"), "utf8");
execFileSync("npx", ["cf", "d1", "raw", d1Id, "--local", "--persist-to", ".wrangler/state", `--sql=${schema}`], { stdio: ["inherit", "pipe", "inherit"] });
try {
  execFileSync("npx", ["cf", "d1", "raw", d1Id, `--sql=${schema}`], { stdio: ["inherit", "pipe", "inherit"] });
} catch (e) {
  console.warn("  (remote apply failed — run `npm run db:apply:remote` after deploy)");
}

console.log("→ Setting TOKEN_PEPPER secret …");
const pepper = randomBytes(32).toString("hex");
try {
  execFileSync("npx", ["cf", "workers", "secrets", "update", "TOKEN_PEPPER", "--worker", "htmlbin", "--type", "secret_text", "--text", pepper], {
    stdio: ["inherit", "pipe", "inherit"],
  });
} catch (e) {
  console.warn("  (couldn't set secret — the Worker must exist first; deploy, then run `cf workers secrets update TOKEN_PEPPER --worker htmlbin --type secret_text --text <value>`)");
}

console.log("");
console.log("✓ Setup done.");
console.log("");
console.log("Next:");
console.log("  1. Register a GitHub OAuth app at");
console.log("     https://github.com/settings/applications/new");
console.log("     - Authorization callback URL:");
console.log("         https://<your-domain>/auth/github/callback");
console.log("     Paste the Client ID into cloudflare.config.ts as GITHUB_CLIENT_ID,");
console.log("     then run: cf workers secrets update GITHUB_CLIENT_SECRET --worker htmlbin --type secret_text --text <secret>");
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
