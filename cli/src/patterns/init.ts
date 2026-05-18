// `htmlbin patterns init` — install every pattern from the official
// catalog into the target dir. Falls back to the bundled set if the
// catalog can't be reached (no network, censored mirror, etc.).

import { fetchCatalogIndex } from "./catalog.js";
import { BUNDLED_PATTERNS } from "./bundled-data.js";
import { writePattern, type InstallResult } from "./install.js";
import { parseAndValidatePattern } from "./schema.js";
import { fetchSource, resolveSource } from "./sources.js";

export interface InitResult {
  /** Where the patterns landed. */
  target_dir: string;
  /** True if the bundled fallback was used because the catalog wasn't reachable. */
  offline: boolean;
  /** "force" or "respect-existing". */
  mode: "force" | "respect-existing";
  installed: InstallResult[];
}

export interface InitOpts {
  /** Destination directory — global or project. */
  targetDir: string;
  /** Overwrite existing files. */
  force?: boolean;
  /** Override the catalog base for forks / self-hosted setups. */
  catalogBase?: string;
}

export async function initPatterns(opts: InitOpts): Promise<InitResult> {
  const installed: InstallResult[] = [];

  // Try the live catalog first. Any failure → bundled fallback.
  let offline = false;
  try {
    const { index } = await fetchCatalogIndex(
      opts.catalogBase ? { catalogBase: opts.catalogBase } : {}
    );
    for (const entry of index.patterns) {
      const rs = resolveSource(entry.name, opts.catalogBase ? { catalogBase: opts.catalogBase } : {});
      const raw = await fetchSource(rs);
      const parsed = parseAndValidatePattern(raw, entry.name);
      const r = await writePattern(opts.targetDir, parsed, !!opts.force);
      installed.push(r);
    }
  } catch {
    offline = true;
    installed.length = 0;
    for (const b of BUNDLED_PATTERNS) {
      const parsed = parseAndValidatePattern(b.body, b.name);
      const r = await writePattern(opts.targetDir, parsed, !!opts.force);
      installed.push(r);
    }
  }

  return {
    target_dir: opts.targetDir,
    offline,
    mode: opts.force ? "force" : "respect-existing",
    installed,
  };
}
