// Smoke tests for the CLI binary — surface area, exit codes, output
// mode resolution. No network, no real backends.

import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  distAvailable,
  makeIsolatedEnv,
  parseJson,
  runCli,
} from "./helpers.js";

describe.skipIf(!distAvailable())("CLI smoke", () => {
  it("--version prints a semver-ish string", async () => {
    const r = await runCli(["--version"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("--help lists every top-level command", async () => {
    const r = await runCli(["--help"]);
    expect(r.exitCode).toBe(0);
    for (const cmd of ["publish", "list", "delete", "url", "login", "setup", "patterns"]) {
      expect(r.stdout).toContain(cmd);
    }
  });

  it("patterns --help lists the three sub-subcommands", async () => {
    const r = await runCli(["patterns", "--help"]);
    expect(r.exitCode).toBe(0);
    for (const cmd of ["list", "init", "add"]) {
      expect(r.stdout).toContain(cmd);
    }
  });

  it("unknown subcommand exits non-zero with a helpful commander error", async () => {
    const r = await runCli(["bananas"]);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr.toLowerCase()).toContain("unknown command");
  });

  it("unknown --to value is rejected by commander", async () => {
    const r = await runCli(["--to", "vercel", "list"]);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr.toLowerCase()).toContain("invalid");
  });

  it("invalid HTMLBIN_BACKEND env exits with backend_unknown (code 7)", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(["list"], { env: { ...env, HTMLBIN_BACKEND: "vercel" } });
    expect(r.exitCode).toBe(7);
    expect(r.stderr).toContain("backend_unknown");
  });

  it("publish with a missing file exits 4 with file_not_found", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(["publish", "/tmp/does-not-exist-99999.html"], { env });
    expect(r.exitCode).toBe(4);
    expect(r.stderr).toContain("file_not_found");
  });

  it("publish missing file in JSON mode emits structured error on stderr", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(
      ["--output", "json", "publish", "/tmp/does-not-exist-99999.html"],
      { env }
    );
    expect(r.exitCode).toBe(4);
    const parsed = parseJson<{ error?: { code?: string; message?: string } }>(r.stderr);
    expect(parsed?.error?.code).toBe("file_not_found");
  });

  it("agent-env auto-detect flips to JSON without the flag", async () => {
    const { env, baseDir } = await makeIsolatedEnv();
    const file = join(baseDir, "missing.html");
    const r = await runCli(["publish", file], {
      env: { ...env, CLAUDE_CODE: "1" },
    });
    expect(r.exitCode).toBe(4);
    expect(r.stderr.trim().startsWith("{")).toBe(true);
    expect(parseJson<{ error?: { code?: string } }>(r.stderr)?.error?.code).toBe(
      "file_not_found"
    );
  });

  it("--output text overrides the agent auto-detect", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(
      ["--output", "text", "publish", "/tmp/does-not-exist-99999.html"],
      { env: { ...env, CLAUDE_CODE: "1" } }
    );
    expect(r.exitCode).toBe(4);
    expect(r.stderr).toMatch(/^error:/);
    expect(r.stderr.trim().startsWith("{")).toBe(false);
  });

  it("FORCE_AGENT_MODE also flips to JSON", async () => {
    const { env } = await makeIsolatedEnv();
    const r = await runCli(["publish", "/tmp/does-not-exist-99999.html"], {
      env: { ...env, FORCE_AGENT_MODE: "1" },
    });
    expect(r.exitCode).toBe(4);
    expect(parseJson<{ error?: { code?: string } }>(r.stderr)?.error?.code).toBe(
      "file_not_found"
    );
  });

  it("publish requires auth when no token is in env / fs", async () => {
    // Need a real file or we get file_not_found before auth_required.
    const { env, cwd, baseDir } = await makeIsolatedEnv();
    const html = join(baseDir, "hi.html");
    await writeFile(html, "<!doctype html><h1>hi</h1>", "utf8");
    const r = await runCli(["publish", html], { env, cwd });
    expect(r.exitCode).toBe(2); // auth_required
    expect(r.stderr).toContain("auth_required");
  });

  it("publish from stdin path is not supported (file_not_found on '-')", async () => {
    // Documenting current behavior; --stdin support is out of scope.
    // (If we add it later, this test gets inverted.)
    const { env } = await makeIsolatedEnv();
    const r = await runCli(["publish", "-"], { env });
    expect(r.exitCode).toBe(4);
  });
});
