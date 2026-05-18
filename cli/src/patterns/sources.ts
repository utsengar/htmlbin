// Resolve a `<source>` arg passed to `htmlbin patterns add <source>`.
//
// Accepted shapes (matching the spec on the htmlbin side):
//   - bare name       "pr-explainer"                    → catalog
//   - https URL       "https://example.com/foo.md"      → fetch verbatim
//   - http URL        "http://…"                        → fetch verbatim
//   - github:…        "github:user/repo/path/to/file.md" → raw.githubusercontent.com
//   - gist:…          "gist:abc123def" or "gist:abc/file.md" → gist.githubusercontent.com
//   - local file      "./foo.md"  or  "/abs/path/foo.md" → fs read
//
// Returns a small descriptor so the caller can show the user (text mode)
// or surface in JSON output.

import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { request } from "undici";
import { CliError } from "../errors.js";
import { catalogPatternUrl, DEFAULT_CATALOG_BASE } from "./paths.js";
import { userAgent } from "../useragent.js";

export type ResolvedSource =
  | { kind: "catalog"; name: string; url: string }
  | { kind: "url"; url: string }
  | { kind: "github"; url: string; spec: string }
  | { kind: "gist"; url: string; spec: string }
  | { kind: "file"; path: string };

const BARE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GITHUB_RE = /^github:([^/]+)\/([^/]+)\/(.+\.md)$/;
const GIST_RE = /^gist:([A-Za-z0-9]+)(?:\/(.+))?$/;

export function resolveSource(
  source: string,
  opts: { catalogBase?: string; cwd?: string } = {}
): ResolvedSource {
  const s = source.trim();
  const catalogBase = opts.catalogBase ?? DEFAULT_CATALOG_BASE;

  if (s.length === 0) {
    throw new CliError("invalid_arg", "Pattern source is empty.");
  }

  // Local path — explicit relative or absolute.
  if (s.startsWith("./") || s.startsWith("../") || isAbsolute(s)) {
    const cwd = opts.cwd ?? process.cwd();
    return { kind: "file", path: isAbsolute(s) ? s : resolve(cwd, s) };
  }

  // URL — fetch verbatim.
  if (/^https?:\/\//.test(s)) {
    return { kind: "url", url: s };
  }

  // github:user/repo/path → raw.githubusercontent.com/user/repo/HEAD/path
  const gh = GITHUB_RE.exec(s);
  if (gh) {
    const [, owner, repo, path] = gh;
    return {
      kind: "github",
      spec: s,
      url: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`,
    };
  }

  // gist:<hash>[/<file>] → gist.githubusercontent.com
  const gist = GIST_RE.exec(s);
  if (gist) {
    const [, hash, file] = gist;
    const url = file
      ? `https://gist.githubusercontent.com/raw/${hash}/${file}`
      : `https://gist.githubusercontent.com/raw/${hash}`;
    return { kind: "gist", spec: s, url };
  }

  // Bare kebab-case name → catalog.
  if (BARE_NAME_RE.test(s)) {
    return { kind: "catalog", name: s, url: catalogPatternUrl(catalogBase, s) };
  }

  throw new CliError(
    "invalid_arg",
    `Unrecognized pattern source: "${source}".`,
    {
      hint:
        "Use a bare name (pr-explainer), a URL (https://…/foo.md), github:user/repo/path, gist:hash, or a file path (./foo.md).",
    }
  );
}

/** Fetch the raw bytes from any resolved source — file or HTTP. */
export async function fetchSource(rs: ResolvedSource): Promise<string> {
  if (rs.kind === "file") {
    try {
      return await readFile(rs.path, "utf8");
    } catch (e) {
      throw new CliError(
        "file_not_found",
        `Cannot read pattern file: ${rs.path}`,
        { cause: e }
      );
    }
  }

  let res;
  try {
    res = await request(rs.url, {
      method: "GET",
      headers: { "user-agent": userAgent() },
    });
  } catch (e) {
    throw new CliError("network_error", `Could not fetch ${rs.url}`, { cause: e });
  }
  const body = await res.body.text();
  if (res.statusCode === 404) {
    if (rs.kind === "catalog") {
      throw new CliError(
        "not_found",
        `No pattern named "${rs.name}" in the catalog.`,
        { hint: "List available patterns at https://htmlbin.dev/.well-known/patterns/index.json" }
      );
    }
    throw new CliError("not_found", `404 fetching ${rs.url}`);
  }
  if (res.statusCode >= 400) {
    throw new CliError(
      "network_error",
      `HTTP ${res.statusCode} fetching ${rs.url}`,
      { details: { status: res.statusCode, body: body.slice(0, 300) } }
    );
  }
  return body;
}
