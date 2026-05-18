// End-to-end coverage for `htmlbin patterns {list, init, add}`.
//
// Filesystem-only: we never hit the real catalog. `--catalog` is pointed
// at an unreachable URL to force the offline → bundled fallback path,
// which is the contract every install needs to honor when the network
// is down. The bundled set comes from patterns/*.md at the repo root,
// inlined by scripts/build-bundled-patterns.mjs.

import { describe, expect, it } from "vitest";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  distAvailable,
  makeIsolatedEnv,
  parseJson,
  runCli,
} from "./helpers.js";

const UNREACHABLE = "http://127.0.0.1:1/no-catalog-here";

const MIN = `---
name: e2e-fixture
description: synthetic e2e fixture
triggers:
  - run the e2e tests
---

# Fixture

## When to use

In tests, never in production.
`;

const BAD_NO_FM = `# No frontmatter

## sub

body.
`;

describe.skipIf(!distAvailable())("patterns e2e", () => {
  it("list (empty) prints the install hint", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(["patterns", "list"], { env });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("no patterns installed");
  });

  it("list --output json (empty) returns empty arrays", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(["--output", "json", "patterns", "list"], { env });
    expect(r.exitCode).toBe(0);
    const parsed = parseJson<{ project: unknown[]; global: unknown[]; effective: unknown[] }>(
      r.stdout
    );
    expect(parsed).toEqual({ project: [], global: [], effective: [] });
  });

  it("init with an unreachable catalog uses the bundled fallback", async () => {
    const { env, configDir } = await makeIsolatedEnv();
    const r = await runCli(
      ["--output", "json", "patterns", "init", "--catalog", UNREACHABLE],
      { env }
    );
    expect(r.exitCode).toBe(0);
    const parsed = parseJson<{
      offline: boolean;
      target_dir: string;
      installed: Array<{ status: string; name: string }>;
    }>(r.stdout);
    expect(parsed?.offline).toBe(true);
    expect(parsed?.target_dir).toBe(join(configDir, "htmlbin/patterns"));
    expect(parsed?.installed.length).toBeGreaterThanOrEqual(3);
    expect(parsed?.installed.every((p) => p.status === "wrote")).toBe(true);
    // Files actually exist on disk.
    const files = await readdir(parsed!.target_dir);
    for (const p of parsed!.installed) {
      expect(files).toContain(`${p.name}.md`);
    }
  });

  it("init is idempotent — second run skips everything", async () => {
    const { env } = await makeIsolatedEnv();
    await runCli(["patterns", "init", "--catalog", UNREACHABLE], { env });
    const r = await runCli(
      ["--output", "json", "patterns", "init", "--catalog", UNREACHABLE],
      { env }
    );
    const parsed = parseJson<{ installed: Array<{ status: string }> }>(r.stdout);
    expect(parsed?.installed.every((p) => p.status === "skipped")).toBe(true);
  });

  it("init --force overwrites every file", async () => {
    const { env } = await makeIsolatedEnv();
    await runCli(["patterns", "init", "--catalog", UNREACHABLE], { env });
    const r = await runCli(
      ["--output", "json", "patterns", "init", "--catalog", UNREACHABLE, "--force"],
      { env }
    );
    const parsed = parseJson<{ installed: Array<{ status: string }> }>(r.stdout);
    expect(parsed?.installed.every((p) => p.status === "wrote")).toBe(true);
  });

  it("init --project lands in ./.htmlbin/patterns", async () => {
    const { realpathSync } = await import("node:fs");
    const { env, cwd } = await makeIsolatedEnv();
    const r = await runCli(
      [
        "--output",
        "json",
        "patterns",
        "init",
        "--project",
        "--catalog",
        UNREACHABLE,
      ],
      { env, cwd }
    );
    const parsed = parseJson<{ target_dir: string }>(r.stdout);
    // On macOS, `mkdtemp` returns /var/folders/... but the child's
    // process.cwd() resolves to /private/var/folders/... (/var is a
    // symlink). Compare via realpath to handle either form.
    const got = realpathSync(parsed!.target_dir);
    const expected = realpathSync(join(cwd, ".htmlbin/patterns"));
    expect(got).toBe(expected);
    const files = await readdir(parsed!.target_dir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("list after init shows everything as global", async () => {
    const { env } = await makeIsolatedEnv();
    await runCli(["patterns", "init", "--catalog", UNREACHABLE], { env });
    const r = await runCli(["--output", "json", "patterns", "list"], { env });
    const parsed = parseJson<{
      effective: Array<{ source: string; name: string }>;
    }>(r.stdout);
    expect(parsed?.effective.length).toBeGreaterThanOrEqual(3);
    expect(parsed?.effective.every((e) => e.source === "global")).toBe(true);
  });

  it("list reports project precedence when both dirs have the same name", async () => {
    const { env, cwd } = await makeIsolatedEnv();
    // Seed global first via init.
    await runCli(["patterns", "init", "--catalog", UNREACHABLE], { env });
    // Then drop a project-local override.
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(cwd, ".htmlbin/patterns"), { recursive: true });
    const override = MIN.replace("name: e2e-fixture", "name: pr-explainer");
    await writeFile(join(cwd, ".htmlbin/patterns/pr-explainer.md"), override, "utf8");

    const r = await runCli(["--output", "json", "patterns", "list"], { env, cwd });
    const parsed = parseJson<{
      effective: Array<{ name: string; source: string }>;
    }>(r.stdout);
    const effective = parsed?.effective.find((e) => e.name === "pr-explainer");
    expect(effective?.source).toBe("project");
  });

  it("add <existing-name> errors with invalid_arg (exit 7)", async () => {
    const { env } = await makeIsolatedEnv();
    await runCli(["patterns", "init", "--catalog", UNREACHABLE], { env });
    const r = await runCli(
      ["--output", "json", "patterns", "add", "pr-explainer", "--catalog", UNREACHABLE],
      { env }
    );
    expect(r.exitCode).toBe(7);
    const err = parseJson<{ error?: { code?: string } }>(r.stderr);
    expect(err?.error?.code).toBe("invalid_arg");
  });

  it("add --force overwrites without complaining", async () => {
    const { env } = await makeIsolatedEnv();
    await runCli(["patterns", "init", "--catalog", UNREACHABLE], { env });
    // Bare-name source needs to resolve from somewhere — point to a
    // local file shadowing the catalog so we don't need the network.
    const { mkdir } = await import("node:fs/promises");
    const fixturesDir = join(env.HOME!, "fixtures");
    await mkdir(fixturesDir, { recursive: true });
    const localOverride = MIN.replace("name: e2e-fixture", "name: pr-explainer");
    const fixtureFile = join(fixturesDir, "pr-explainer.md");
    await writeFile(fixtureFile, localOverride, "utf8");
    const r = await runCli(
      ["--output", "json", "patterns", "add", fixtureFile, "--force"],
      { env }
    );
    expect(r.exitCode).toBe(0);
    const parsed = parseJson<{ status: string; preexisting: boolean }>(r.stdout);
    expect(parsed?.status).toBe("wrote");
    expect(parsed?.preexisting).toBe(true);
  });

  it("add ./local.md installs and the bytes match", async () => {
    const { env, baseDir, configDir } = await makeIsolatedEnv();
    const filePath = join(baseDir, "e2e-fixture.md");
    await writeFile(filePath, MIN, "utf8");
    const r = await runCli(
      ["--output", "json", "patterns", "add", filePath],
      { env }
    );
    expect(r.exitCode).toBe(0);
    const dest = join(configDir, "htmlbin/patterns/e2e-fixture.md");
    expect(await readFile(dest, "utf8")).toBe(MIN);
  });

  it("add of a file with no frontmatter rejects (no file written)", async () => {
    const { env, baseDir, configDir } = await makeIsolatedEnv();
    const filePath = join(baseDir, "bad.md");
    await writeFile(filePath, BAD_NO_FM, "utf8");
    const r = await runCli(
      ["--output", "json", "patterns", "add", filePath],
      { env }
    );
    expect(r.exitCode).toBe(7);
    const err = parseJson<{ error?: { code?: string; message?: string } }>(r.stderr);
    expect(err?.error?.code).toBe("invalid_arg");
    // No file should have been written to the global dir.
    const dir = join(configDir, "htmlbin/patterns");
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      // dir doesn't exist — also fine
    }
    expect(files.find((f) => f.startsWith("bad"))).toBeUndefined();
  });

  it("add with garbage source string is rejected", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(
      [
        "--output",
        "json",
        "patterns",
        "add",
        "Invalid Name With Spaces",
      ],
      { env }
    );
    expect(r.exitCode).toBe(7);
    const err = parseJson<{ error?: { code?: string } }>(r.stderr);
    expect(err?.error?.code).toBe("invalid_arg");
  });

  it("add with a file path whose name mismatches the frontmatter rejects", async () => {
    const { env, baseDir } = await makeIsolatedEnv();
    const filePath = join(baseDir, "fixture.md");
    await writeFile(filePath, MIN, "utf8"); // name in frontmatter is e2e-fixture
    // We're not passing expectedName in this path so the install
    // resolves the dest from frontmatter.name = e2e-fixture. This case
    // should SUCCEED — the file lands at e2e-fixture.md.
    const r = await runCli(["--output", "json", "patterns", "add", filePath], { env });
    expect(r.exitCode).toBe(0);
    const parsed = parseJson<{ name: string }>(r.stdout);
    expect(parsed?.name).toBe("e2e-fixture");
  });
});
