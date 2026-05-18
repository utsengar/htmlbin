// Fetch + cache the pattern catalog index.
//
// The live catalog index lives at https://htmlbin.dev/.well-known/patterns/index.json.
// Repeated `htmlbin patterns add <name>` calls shouldn't hammer it, so we
// cache the fetched index on disk at ~/.cache/htmlbin/patterns/index.json
// (XDG-aware) with a 24h TTL.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { request } from "undici";
import { CliError } from "../errors.js";
import { cacheIndexFile, catalogIndexUrl, DEFAULT_CATALOG_BASE } from "./paths.js";
import { userAgent } from "../useragent.js";

export interface CatalogEntry {
  name: string;
  description?: string;
  triggers?: string[];
  url: string;
}

export interface CatalogIndex {
  version: string;
  patterns: CatalogEntry[];
}

interface CachedEnvelope {
  fetched_at: number;
  base: string;
  index: CatalogIndex;
}

const TTL_MS = 24 * 60 * 60 * 1000;

export interface FetchIndexResult {
  index: CatalogIndex;
  fromCache: boolean;
  fetchedAt: number;
}

export async function fetchCatalogIndex(opts: {
  catalogBase?: string;
  env?: NodeJS.ProcessEnv;
  /** Skip the cache and hit the network. */
  force?: boolean;
} = {}): Promise<FetchIndexResult> {
  const env = opts.env ?? process.env;
  const base = opts.catalogBase ?? DEFAULT_CATALOG_BASE;
  const cachePath = cacheIndexFile(env);

  if (!opts.force) {
    const cached = await readCache(cachePath);
    if (cached && cached.base === base && Date.now() - cached.fetched_at < TTL_MS) {
      return { index: cached.index, fromCache: true, fetchedAt: cached.fetched_at };
    }
  }

  const url = catalogIndexUrl(base);
  let res;
  try {
    res = await request(url, {
      method: "GET",
      headers: { "user-agent": userAgent() },
    });
  } catch (e) {
    // Network down — fall back to any stale cache rather than failing hard.
    const stale = await readCache(cachePath);
    if (stale && stale.base === base) {
      return { index: stale.index, fromCache: true, fetchedAt: stale.fetched_at };
    }
    throw new CliError("network_error", `Could not fetch catalog index at ${url}`, { cause: e });
  }
  if (res.statusCode !== 200) {
    const text = await res.body.text();
    const stale = await readCache(cachePath);
    if (stale && stale.base === base) {
      return { index: stale.index, fromCache: true, fetchedAt: stale.fetched_at };
    }
    throw new CliError(
      "network_error",
      `HTTP ${res.statusCode} from catalog index at ${url}`,
      { details: { status: res.statusCode, body: text.slice(0, 300) } }
    );
  }
  const text = await res.body.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CliError("network_error", `Catalog index at ${url} is not valid JSON`);
  }
  const index = validateIndex(parsed, base);

  const now = Date.now();
  const envelope: CachedEnvelope = { fetched_at: now, base, index };
  await writeCache(cachePath, envelope).catch(() => {
    // Cache write is best-effort; missing it just means we re-fetch next time.
  });
  return { index, fromCache: false, fetchedAt: now };
}

async function readCache(path: string): Promise<CachedEnvelope | null> {
  try {
    const raw = await readFile(path, "utf8");
    const obj = JSON.parse(raw) as CachedEnvelope;
    if (
      typeof obj?.fetched_at !== "number" ||
      typeof obj?.base !== "string" ||
      typeof obj?.index !== "object"
    ) {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

async function writeCache(path: string, env: CachedEnvelope): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(env), "utf8");
}

function validateIndex(parsed: unknown, base: string): CatalogIndex {
  if (typeof parsed !== "object" || parsed === null) {
    throw new CliError("network_error", "Catalog index is not a JSON object.");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.version !== "string") {
    throw new CliError("network_error", "Catalog index is missing `version`.");
  }
  if (!Array.isArray(obj.patterns)) {
    throw new CliError("network_error", "Catalog index is missing `patterns` array.");
  }
  const patterns: CatalogEntry[] = [];
  for (const raw of obj.patterns) {
    // The live index might be either an array of strings (names only) OR an
    // array of objects with name+url+description+triggers. Support both
    // shapes — strings get expanded to `<base>/<name>.md`.
    if (typeof raw === "string") {
      patterns.push({ name: raw, url: `${base.replace(/\/+$/, "")}/${encodeURIComponent(raw)}.md` });
      continue;
    }
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.name !== "string") continue;
    const out: CatalogEntry = {
      name: entry.name,
      url:
        typeof entry.url === "string"
          ? entry.url
          : `${base.replace(/\/+$/, "")}/${encodeURIComponent(entry.name)}.md`,
    };
    if (typeof entry.description === "string") out.description = entry.description;
    if (Array.isArray(entry.triggers)) {
      out.triggers = entry.triggers.filter((t): t is string => typeof t === "string");
    }
    patterns.push(out);
  }
  return { version: obj.version, patterns };
}
