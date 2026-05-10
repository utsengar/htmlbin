#!/usr/bin/env node
// Regenerate src/fonts-data.ts from the woff2 files in assets/fonts/.
//
// We base64-inline the woff2 bytes because wrangler 4 + ES module Workers
// doesn't honor [[rules]] type="Data" for imports outside src/. The cost
// is ~33% size bloat (no big deal on a Worker bundle); the upside is that
// the build is bulletproof and doesn't depend on wrangler loader behavior.
//
// To add a new weight:
//   1. Drop the .woff2 into assets/fonts/  (e.g. Geist-800.woff2)
//   2. Add the filename to FILES below
//   3. node scripts/build-fonts.mjs
//   4. Add an @font-face entry in src/fonts.ts FONT_FACE_CSS

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const FILES = [
  "Geist-400.woff2",
  "Geist-500.woff2",
  "Geist-600.woff2",
  "Geist-700.woff2",
  "GeistMono-400.woff2",
  "GeistMono-500.woff2",
];

const entries = FILES.map((name) => {
  const buf = fs.readFileSync(path.join(root, "assets/fonts", name));
  return `  "${name}": "${buf.toString("base64")}",`;
}).join("\n");

const out = `// AUTO-GENERATED — do not edit by hand.
// Source: assets/fonts/*.woff2. Regenerate with:
//   node scripts/build-fonts.mjs

export const FONTS_BASE64: Record<string, string> = {
${entries}
};
`;

const outPath = path.join(root, "src/fonts-data.ts");
fs.writeFileSync(outPath, out);
console.log(`wrote ${path.relative(root, outPath)}: ${fs.statSync(outPath).size} bytes`);
