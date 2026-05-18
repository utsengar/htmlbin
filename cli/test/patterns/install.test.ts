import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError } from "../../src/errors.js";
import { parseAndValidatePattern } from "../../src/patterns/schema.js";
import {
  ensureNoSilentSkip,
  installPattern,
  writePattern,
} from "../../src/patterns/install.js";
import { listPatterns } from "../../src/patterns/list.js";

const MIN = `---
name: foo-bar
triggers:
  - go
---

## Heading
`;

async function makeTmpDirs(): Promise<{ project: string; global: string; cwd: string; env: NodeJS.ProcessEnv }> {
  const base = await mkdtemp(join(tmpdir(), "htmlbin-patterns-"));
  const cwd = join(base, "repo");
  const config = join(base, "xdg-config");
  await mkdir(cwd, { recursive: true });
  await mkdir(config, { recursive: true });
  return {
    project: join(cwd, ".htmlbin/patterns"),
    global: join(config, "htmlbin/patterns"),
    cwd,
    env: { XDG_CONFIG_HOME: config } as NodeJS.ProcessEnv,
  };
}

describe("writePattern", () => {
  it("creates the dir + writes the file", async () => {
    const { project } = await makeTmpDirs();
    const parsed = parseAndValidatePattern(MIN);
    const r = await writePattern(project, parsed, false);
    expect(r.status).toBe("wrote");
    expect(r.preexisting).toBe(false);
    const written = await readFile(r.path, "utf8");
    expect(written).toBe(MIN);
  });

  it("skips when destination exists and force=false", async () => {
    const { project } = await makeTmpDirs();
    const parsed = parseAndValidatePattern(MIN);
    await writePattern(project, parsed, false);
    const r2 = await writePattern(project, parsed, false);
    expect(r2.status).toBe("skipped");
    expect(r2.preexisting).toBe(true);
  });

  it("overwrites when force=true", async () => {
    const { project } = await makeTmpDirs();
    const parsed = parseAndValidatePattern(MIN);
    await writePattern(project, parsed, false);
    const r2 = await writePattern(project, parsed, true);
    expect(r2.status).toBe("wrote");
    expect(r2.preexisting).toBe(true);
  });
});

describe("installPattern with a local file source", () => {
  it("validates and writes", async () => {
    const { project, cwd } = await makeTmpDirs();
    const filePath = join(cwd, "incoming.md");
    await writeFile(filePath, MIN, "utf8");
    const r = await installPattern({
      dir: project,
      source: { kind: "file", path: filePath },
      force: false,
    });
    expect(r.status).toBe("wrote");
    expect(r.name).toBe("foo-bar");
  });

  it("rejects invalid pattern content (no body heading)", async () => {
    const { project, cwd } = await makeTmpDirs();
    const filePath = join(cwd, "bad.md");
    const noHeading = `---
name: foo-bar
triggers:
  - go
---

just text, no h2.
`;
    await writeFile(filePath, noHeading, "utf8");
    await expect(
      installPattern({
        dir: project,
        source: { kind: "file", path: filePath },
        force: false,
      })
    ).rejects.toBeInstanceOf(CliError);
  });
});

describe("ensureNoSilentSkip", () => {
  it("throws for add+skip (would silently no-op)", () => {
    expect(() =>
      ensureNoSilentSkip(
        { status: "skipped", name: "foo", path: "/x", preexisting: true },
        "add"
      )
    ).toThrow(CliError);
  });

  it("init+skip is fine (init is idempotent)", () => {
    expect(() =>
      ensureNoSilentSkip(
        { status: "skipped", name: "foo", path: "/x", preexisting: true },
        "init"
      )
    ).not.toThrow();
  });
});

describe("listPatterns", () => {
  it("returns empty when neither dir exists", async () => {
    const { cwd, env } = await makeTmpDirs();
    const r = await listPatterns({ cwd, env });
    expect(r.project).toEqual([]);
    expect(r.global).toEqual([]);
    expect(r.effective).toEqual([]);
  });

  it("project entry wins over global with the same name", async () => {
    const { project, global, cwd, env } = await makeTmpDirs();
    const parsed = parseAndValidatePattern(MIN);
    await writePattern(global, parsed, true);
    await writePattern(project, parsed, true);
    const r = await listPatterns({ cwd, env });
    expect(r.effective).toHaveLength(1);
    expect(r.effective[0]?.source).toBe("project");
  });

  it("global entry shows when no project equivalent", async () => {
    const { global, cwd, env } = await makeTmpDirs();
    const parsed = parseAndValidatePattern(MIN);
    await writePattern(global, parsed, true);
    const r = await listPatterns({ cwd, env });
    expect(r.effective).toHaveLength(1);
    expect(r.effective[0]?.source).toBe("global");
  });
});
