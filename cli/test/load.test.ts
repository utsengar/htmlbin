import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError } from "../src/errors.js";
import { loadHtml } from "../src/load.js";

async function makeCwd(): Promise<string> {
  return mkdtemp(join(tmpdir(), "htmlbin-cli-load-"));
}

describe("loadHtml", () => {
  it("loads an existing file relative to cwd", async () => {
    const cwd = await makeCwd();
    await mkdir(join(cwd, "out"), { recursive: true });
    await writeFile(join(cwd, "out/index.html"), "<!doctype html><title>x</title>", "utf8");
    const r = await loadHtml("./out/index.html", { maxBytes: 1024, cwd });
    expect(r.html.startsWith("<!doctype html>")).toBe(true);
    expect(r.bytes).toBeGreaterThan(0);
  });

  it("loads an absolute path", async () => {
    const cwd = await makeCwd();
    const p = join(cwd, "fixture.html");
    await writeFile(p, "<html></html>", "utf8");
    const r = await loadHtml(p, { maxBytes: 1024, cwd: "/nonexistent" });
    expect(r.html).toBe("<html></html>");
  });

  it("throws file_not_found with a hint about common paths when none exist", async () => {
    const cwd = await makeCwd();
    try {
      await loadHtml("./out/index.html", { maxBytes: 1024, cwd });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      const err = e as CliError;
      expect(err.code).toBe("file_not_found");
      expect(err.hint).toContain("Common output paths");
      expect(err.hint).toContain("./out/index.html");
    }
  });

  it("throws file_not_found with 'Did your build emit somewhere else?' when an alternative exists", async () => {
    const cwd = await makeCwd();
    await mkdir(join(cwd, "dist"), { recursive: true });
    await writeFile(join(cwd, "dist/index.html"), "<!doctype html>", "utf8");
    try {
      await loadHtml("./out/index.html", { maxBytes: 1024, cwd });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      const err = e as CliError;
      expect(err.code).toBe("file_not_found");
      expect(err.hint).toContain("Did your build emit somewhere else");
      expect(err.hint).toContain("./dist/index.html");
    }
  });

  it("throws file_not_found when path is a directory, not a file", async () => {
    const cwd = await makeCwd();
    await mkdir(join(cwd, "not-a-file"));
    try {
      await loadHtml("./not-a-file", { maxBytes: 1024, cwd });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("file_not_found");
      expect((e as CliError).message).toContain("Not a regular file");
    }
  });

  it("throws file_too_large past maxBytes", async () => {
    const cwd = await makeCwd();
    await writeFile(join(cwd, "big.html"), "X".repeat(100), "utf8");
    try {
      await loadHtml("./big.html", { maxBytes: 50, cwd });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).code).toBe("file_too_large");
    }
  });
});
