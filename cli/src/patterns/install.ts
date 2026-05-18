// Install one pattern: fetch → validate → write.
//
// Shared by `patterns add` and `patterns init`. Idempotent on its own;
// the caller decides what to do when a file already exists (init skips,
// add errors).

import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { CliError } from "../errors.js";
import { parseAndValidatePattern, type ParsedPattern } from "./schema.js";
import { fetchSource, type ResolvedSource } from "./sources.js";

export interface InstallTarget {
  /** Directory the .md file will land in. */
  dir: string;
  /** Source of pattern bytes (file path or URL — already resolved). */
  source: ResolvedSource;
  /** Allow overwriting an existing destination. */
  force: boolean;
  /**
   * For `patterns add <bare-name>` we know what the name should be before
   * we fetch (so a bad catalog entry can't write under a different name).
   */
  expectedName?: string;
  /**
   * For `patterns init` from the bundled fallback, we pass the raw
   * content directly so we don't try to fetch anything.
   */
  rawOverride?: string;
}

export interface InstallResult {
  /** "wrote" — file was created or overwritten. "skipped" — existed, no --force. */
  status: "wrote" | "skipped";
  name: string;
  path: string;
  /** True if the file existed before this call. */
  preexisting: boolean;
}

export async function installPattern(t: InstallTarget): Promise<InstallResult> {
  // When the destination name is known up-front (catalog source, or
  // caller-supplied expectedName), short-circuit on existing files
  // before doing any network work. Without this, `patterns add <name>`
  // against an existing destination still spends a round-trip on the
  // catalog only to bail out at write-time.
  const presumedName =
    t.expectedName ??
    (t.source.kind === "catalog" ? t.source.name : undefined);
  if (presumedName && !t.force) {
    const presumedPath = join(t.dir, `${presumedName}.md`);
    if (await exists(presumedPath)) {
      return {
        status: "skipped",
        name: presumedName,
        path: presumedPath,
        preexisting: true,
      };
    }
  }

  const raw = t.rawOverride ?? (await fetchSource(t.source));
  const parsed = parseAndValidatePattern(raw, presumedName);
  return writePattern(t.dir, parsed, t.force);
}

export async function writePattern(
  dir: string,
  parsed: ParsedPattern,
  force: boolean
): Promise<InstallResult> {
  const path = join(dir, `${parsed.frontmatter.name}.md`);
  const preexisting = await exists(path);

  if (preexisting && !force) {
    return {
      status: "skipped",
      name: parsed.frontmatter.name,
      path,
      preexisting: true,
    };
  }

  await mkdir(dir, { recursive: true });
  await writeFile(path, parsed.raw, "utf8");

  return {
    status: "wrote",
    name: parsed.frontmatter.name,
    path,
    preexisting,
  };
}

export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Treat `name conflict — already installed` as a CliError when --force isn't set. */
export function ensureNoSilentSkip(
  r: InstallResult,
  context: "add" | "init"
): void {
  if (r.status === "skipped" && context === "add") {
    throw new CliError(
      "invalid_arg",
      `Pattern "${r.name}" already exists at ${r.path}.`,
      { hint: "Re-run with --force to overwrite." }
    );
  }
}
