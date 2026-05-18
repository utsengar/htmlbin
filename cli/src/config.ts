// Backend resolution + config-file parsing.
//
// Order of precedence for the active backend:
//   1. --to <name> CLI flag (handled by commander, passed in)
//   2. $HTMLBIN_BACKEND env var
//   3. .htmlbin/config TOML file in cwd
//   4. Default: "cloud"

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { CliError, type CliErrorCode } from "./errors.js";
import type { BackendName } from "./backend.js";

const KNOWN_BACKENDS: ReadonlyArray<BackendName> = [
  "cloud",
  "gh-pages",
  "cloudflare",
];

export function isBackendName(s: unknown): s is BackendName {
  return typeof s === "string" && (KNOWN_BACKENDS as readonly string[]).includes(s);
}

export interface ConfigFile {
  backend?: BackendName;
  /** Cloud overrides */
  api_url?: string;
  /** gh-pages overrides */
  repo?: string;
  branch?: string;
  /** cloudflare overrides */
  account_id?: string;
  project?: string;
}

export async function loadConfigFile(cwd = process.cwd()): Promise<ConfigFile> {
  const path = resolve(cwd, ".htmlbin/config");
  try {
    const raw = await readFile(path, "utf8");
    const parsed = parseToml(raw) as Record<string, unknown>;
    const cfg: ConfigFile = {};
    if (typeof parsed.backend === "string") {
      if (!isBackendName(parsed.backend)) {
        throw new CliError(
          "backend_unknown",
          `Unknown backend "${parsed.backend}" in .htmlbin/config.`,
          { hint: `Use one of: ${KNOWN_BACKENDS.join(", ")}` }
        );
      }
      cfg.backend = parsed.backend;
    }
    for (const key of ["api_url", "repo", "branch", "account_id", "project"] as const) {
      if (typeof parsed[key] === "string") (cfg as Record<string, string>)[key] = parsed[key] as string;
    }
    return cfg;
  } catch (e) {
    if (e instanceof CliError) throw e;
    if (isNotFoundError(e)) return {};
    throw new CliError(
      "invalid_arg" as CliErrorCode,
      `Could not read .htmlbin/config: ${(e as Error).message}`,
      { cause: e }
    );
  }
}

export interface ResolvedBackendChoice {
  backend: BackendName;
  source: "flag" | "env" | "config" | "default";
}

export function resolveBackend(opts: {
  flag?: string;
  env?: string;
  config?: ConfigFile;
}): ResolvedBackendChoice {
  if (opts.flag) {
    if (!isBackendName(opts.flag)) {
      throw new CliError(
        "backend_unknown",
        `Unknown backend "${opts.flag}".`,
        { hint: `Use one of: ${KNOWN_BACKENDS.join(", ")}` }
      );
    }
    return { backend: opts.flag, source: "flag" };
  }
  if (opts.env) {
    if (!isBackendName(opts.env)) {
      throw new CliError(
        "backend_unknown",
        `Unknown backend "${opts.env}" in $HTMLBIN_BACKEND.`,
        { hint: `Use one of: ${KNOWN_BACKENDS.join(", ")}` }
      );
    }
    return { backend: opts.env, source: "env" };
  }
  if (opts.config?.backend) return { backend: opts.config.backend, source: "config" };
  return { backend: "cloud", source: "default" };
}

function isNotFoundError(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}
