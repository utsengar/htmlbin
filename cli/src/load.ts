// Shared file-load helper for every backend.
//
// Centralizes the "find the HTML, give a useful error if it isn't there"
// logic so the hint lives in one place. In CI this is the most common
// failure: a build step didn't produce ./out/index.html, or the repo's
// build emits at a different path.

import { readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { CliError } from "./errors.js";

const COMMON_PATHS = [
  "./out/index.html",
  "./dist/index.html",
  "./build/index.html",
  "./public/index.html",
];

export interface LoadedHtml {
  filePath: string;
  html: string;
  bytes: number;
}

export async function loadHtml(file: string, opts: { maxBytes: number; cwd?: string }): Promise<LoadedHtml> {
  const cwd = opts.cwd ?? process.cwd();
  const filePath = isAbsolute(file) ? file : resolve(cwd, file);

  let st;
  try {
    st = await stat(filePath);
  } catch {
    const found = await findExistingAlternatives(cwd);
    const hintParts: string[] = [];
    if (found.length > 0) {
      hintParts.push(`Did your build emit somewhere else? Found: ${found.join(", ")}`);
    } else {
      hintParts.push("Make sure your build step ran and emitted HTML.");
      hintParts.push(`Common output paths checked: ${COMMON_PATHS.join(", ")}.`);
    }
    throw new CliError("file_not_found", `No such file: ${file}`, {
      hint: hintParts.join(" "),
      details: { cwd },
    });
  }

  if (!st.isFile()) {
    throw new CliError("file_not_found", `Not a regular file: ${file}`, {
      hint: "Pass a path to a single HTML file. Multi-file directory publishing is Phase 2.",
    });
  }

  if (st.size > opts.maxBytes) {
    throw new CliError(
      "file_too_large",
      `File is ${st.size} bytes; cap is ${opts.maxBytes}.`,
      { details: { size: st.size, max_bytes: opts.maxBytes } }
    );
  }

  const html = await readFile(filePath, "utf8");
  return { filePath, html, bytes: st.size };
}

async function findExistingAlternatives(cwd: string): Promise<string[]> {
  const found: string[] = [];
  for (const p of COMMON_PATHS) {
    try {
      const s = await stat(resolve(cwd, p));
      if (s.isFile()) found.push(p);
    } catch {
      // ignore
    }
  }
  return found;
}
