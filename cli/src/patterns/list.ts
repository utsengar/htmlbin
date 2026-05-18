// `htmlbin patterns list` — walk both dirs, parse frontmatter (lightly),
// report which file wins per name.

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseFlatYaml } from "./schema.js";
import { globalPatternsDir, projectPatternsDir } from "./paths.js";

export interface ListedPattern {
  name: string;
  path: string;
  description?: string;
}

export type Source = "project" | "global";

export interface ListResult {
  project: ListedPattern[];
  global: ListedPattern[];
  effective: Array<{ name: string; source: Source; path: string; description?: string }>;
}

export async function listPatterns(opts: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): Promise<ListResult> {
  const cwd = opts.cwd ?? process.cwd();
  const env = opts.env ?? process.env;

  const project = await readDir(projectPatternsDir(cwd));
  const global = await readDir(globalPatternsDir(env));

  const byName = new Map<string, { source: Source; entry: ListedPattern }>();
  // Global first, then project — project entries overwrite.
  for (const e of global) byName.set(e.name, { source: "global", entry: e });
  for (const e of project) byName.set(e.name, { source: "project", entry: e });

  const effective = [...byName.values()]
    .map(({ source, entry }) => {
      const out: ListResult["effective"][number] = {
        name: entry.name,
        source,
        path: entry.path,
      };
      if (entry.description !== undefined) out.description = entry.description;
      return out;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { project, global, effective };
}

async function readDir(dir: string): Promise<ListedPattern[]> {
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const out: ListedPattern[] = [];
  for (const f of files) {
    if (!f.endsWith(".md")) continue;
    const path = join(dir, f);
    try {
      const s = await stat(path);
      if (!s.isFile()) continue;
    } catch {
      continue;
    }
    const head = await readFile(path, "utf8").then((s) => s.slice(0, 4096)).catch(() => null);
    let description: string | undefined;
    let name = f.replace(/\.md$/, "");
    if (head && head.startsWith("---")) {
      const fmEnd = head.indexOf("\n---", 4);
      if (fmEnd > -1) {
        try {
          const fm = parseFlatYaml(head.slice(4, fmEnd));
          if (typeof fm["name"] === "string") name = fm["name"];
          if (typeof fm["description"] === "string") description = fm["description"];
        } catch {
          // listing tolerates malformed frontmatter — fall through with
          // filename-derived name.
        }
      }
    }
    const entry: ListedPattern = { name, path };
    if (description !== undefined) entry.description = description;
    out.push(entry);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
