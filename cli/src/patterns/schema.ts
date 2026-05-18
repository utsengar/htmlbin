// Pattern file schema + validator.
//
// Contract — every pattern file must:
//   1. Start with `---\n` (YAML frontmatter delimiter).
//   2. Have a frontmatter block that parses against the schema below.
//   3. Have a body with at least one `##` heading.
//
// We hand-parse the frontmatter because the schema is small, flat, and we
// want very clear errors. If a future pattern needs anything fancier than
// scalar key/value or a flat array of strings, swap in `yaml`.

import { CliError } from "../errors.js";

export interface PatternFrontmatter {
  name: string;
  description?: string;
  triggers: string[];
  brand_sensing: boolean; // default true
}

export interface ParsedPattern {
  frontmatter: PatternFrontmatter;
  body: string;
  /** The raw source — what would be written to disk. */
  raw: string;
}

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Parse + validate a pattern file. Throws CliError on any violation.
 *
 * If `expectedName` is provided (the filename's `name` portion when the
 * caller already knows where the file is going), we enforce that
 * frontmatter.name matches it.
 */
export function parseAndValidatePattern(
  raw: string,
  expectedName?: string
): ParsedPattern {
  if (!raw.startsWith("---")) {
    throw new CliError(
      "invalid_arg",
      "Pattern file must start with '---' (YAML frontmatter delimiter).",
      { hint: "First line of every pattern is `---`, then key: value lines, then a closing `---`." }
    );
  }

  const m = FRONTMATTER_RE.exec(raw);
  if (!m) {
    throw new CliError(
      "invalid_arg",
      "Pattern frontmatter block is malformed (no closing '---' found).",
      { hint: "Frontmatter looks like:\n---\nname: foo\ntriggers:\n  - bar\n---\n" }
    );
  }

  const fmText = m[1]!;
  const body = raw.slice(m[0].length);

  const fm = parseFlatYaml(fmText);

  // Required: name
  const name = fm["name"];
  if (typeof name !== "string" || name.length === 0) {
    throw new CliError("invalid_arg", "Pattern frontmatter is missing `name`.", {
      hint: "Add a line like `name: my-pattern`.",
    });
  }
  if (!NAME_RE.test(name)) {
    throw new CliError(
      "invalid_arg",
      `Pattern name "${name}" is not kebab-case.`,
      { hint: "Use lowercase letters, digits, and hyphens only — e.g. `pr-explainer`." }
    );
  }
  if (expectedName !== undefined && name !== expectedName) {
    throw new CliError(
      "invalid_arg",
      `Pattern name mismatch: frontmatter says "${name}", expected "${expectedName}".`,
      { hint: "The `name:` field must match the filename's base (without .md)." }
    );
  }

  // Required: triggers (non-empty list of strings)
  const triggersRaw = fm["triggers"];
  if (!Array.isArray(triggersRaw) || triggersRaw.length === 0) {
    throw new CliError(
      "invalid_arg",
      "Pattern frontmatter must declare a non-empty `triggers` list.",
      {
        hint: "Add:\ntriggers:\n  - explain this pr\n  - summarize this diff",
      }
    );
  }
  const triggers: string[] = [];
  for (const t of triggersRaw) {
    if (typeof t !== "string" || t.trim().length === 0) {
      throw new CliError(
        "invalid_arg",
        "Every entry in `triggers` must be a non-empty string."
      );
    }
    triggers.push(t.trim());
  }

  // Optional: description
  let description: string | undefined;
  if (fm["description"] !== undefined) {
    if (typeof fm["description"] !== "string") {
      throw new CliError(
        "invalid_arg",
        "Pattern `description` must be a string when present."
      );
    }
    description = fm["description"];
  }

  // Optional: brand_sensing (default true)
  let brand_sensing = true;
  if (fm["brand_sensing"] !== undefined) {
    if (typeof fm["brand_sensing"] !== "boolean") {
      throw new CliError(
        "invalid_arg",
        "Pattern `brand_sensing` must be a boolean (true / false) when present."
      );
    }
    brand_sensing = fm["brand_sensing"];
  }

  // Body: at least one `##` heading
  if (!/^##\s+\S/m.test(body)) {
    throw new CliError(
      "invalid_arg",
      "Pattern body must include at least one `## ` heading.",
      { hint: "Standard headings: `## When to use`, `## Content checklist`, `## Don't`." }
    );
  }

  const frontmatter: PatternFrontmatter = {
    name,
    triggers,
    brand_sensing,
  };
  if (description !== undefined) frontmatter.description = description;

  return { frontmatter, body, raw };
}

/**
 * Minimal flat-YAML parser for pattern frontmatter.
 *
 * Supports:
 *   key: scalar              (string / true / false)
 *   key: "quoted scalar"     (single or double)
 *   key:
 *     - list item            (two-space indent)
 *     - "quoted item"
 *
 * Anything more exotic (nested maps, anchors, multi-line scalars, JSON
 * flow style) errors at validation time downstream because the schema
 * doesn't allow it. Keeping this tight is a feature — pattern files
 * stay diff-friendly and reviewable.
 */
export function parseFlatYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = text.split(/\r?\n/);
  let currentList: string[] | null = null;
  let currentListKey: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = stripComment(raw);
    if (line.trim().length === 0) continue;

    const listMatch = /^\s{2,}-\s+(.*)$/.exec(line);
    if (listMatch && currentList) {
      currentList.push(stripQuotes(listMatch[1]!.trim()));
      continue;
    }

    const kvMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/.exec(line);
    if (!kvMatch) {
      throw new CliError(
        "invalid_arg",
        `Unparseable frontmatter line: "${raw}"`,
        { hint: "Lines must be `key: value` or `  - list item`." }
      );
    }
    const [, key, valueRaw] = kvMatch;
    const value = valueRaw!.trim();

    // Close any open list — encountering a new key ends it.
    currentList = null;
    currentListKey = null;

    if (value.length === 0) {
      // Either opens a list or is an empty scalar; tentatively start a list.
      const next = lines[i + 1];
      if (next !== undefined && /^\s{2,}-\s+/.test(stripComment(next))) {
        currentList = [];
        currentListKey = key!;
        out[key!] = currentList;
      } else {
        out[key!] = "";
      }
      continue;
    }

    out[key!] = parseScalar(value);
  }

  // Trim trailing empty list (an empty value followed by no list items)
  if (currentListKey && currentList && currentList.length === 0) {
    out[currentListKey] = [];
  }

  return out;
}

function stripComment(line: string): string {
  // YAML comments only after whitespace, but pattern frontmatter is simple
  // enough we strip on the first un-quoted `#`. Keeps things conservative.
  const hashIdx = findUnquotedHash(line);
  return hashIdx === -1 ? line : line.slice(0, hashIdx).trimEnd();
}

function findUnquotedHash(s: string): number {
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === "#" && !inDouble && !inSingle) {
      // Require a space or BOL before the `#` for it to count as a comment.
      if (i === 0 || /\s/.test(s[i - 1]!)) return i;
    }
  }
  return -1;
}

function parseScalar(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  return stripQuotes(value);
}

function stripQuotes(s: string): string {
  if (s.length >= 2) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
  }
  return s;
}
