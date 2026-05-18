// Path resolution for the patterns module.
//
// Honors XDG Base Directory spec for the global and cache locations
// (the existing token fallback at ~/.config/htmlbin/token doesn't yet,
// but we want patterns to do the right thing — and bring the token along
// in a follow-up). The skill at /.well-known/agent-skills/htmlbin/SKILL.md
// teaches agents the same precedence: project beats global beats catalog.

import { homedir } from "node:os";
import { resolve, join } from "node:path";

/** Project-local patterns directory, resolved against the given cwd. */
export function projectPatternsDir(cwd: string = process.cwd()): string {
  return resolve(cwd, ".htmlbin/patterns");
}

/** Machine-global patterns directory. $XDG_CONFIG_HOME/htmlbin/patterns or ~/.config/htmlbin/patterns. */
export function globalPatternsDir(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CONFIG_HOME?.trim();
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "htmlbin", "patterns");
}

/** Catalog-index cache file. $XDG_CACHE_HOME/htmlbin/patterns/index.json or ~/.cache/htmlbin/patterns/index.json. */
export function cacheIndexFile(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env.XDG_CACHE_HOME?.trim();
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".cache");
  return join(base, "htmlbin", "patterns", "index.json");
}

/** Default base URL for the official pattern catalog. */
export const DEFAULT_CATALOG_BASE = "https://htmlbin.dev/.well-known/patterns";

/** Build the catalog URL for a given base + name. */
export function catalogPatternUrl(base: string, name: string): string {
  return `${base.replace(/\/+$/, "")}/${encodeURIComponent(name)}.md`;
}

/** Build the catalog index URL for a given base. */
export function catalogIndexUrl(base: string): string {
  return `${base.replace(/\/+$/, "")}/index.json`;
}
