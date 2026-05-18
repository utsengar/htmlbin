import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError } from "../src/errors.js";
import { isBackendName, loadConfigFile, resolveBackend } from "../src/config.js";

describe("isBackendName", () => {
  it("accepts known names", () => {
    expect(isBackendName("cloud")).toBe(true);
    expect(isBackendName("gh-pages")).toBe(true);
    expect(isBackendName("cloudflare")).toBe(true);
  });
  it("rejects unknown / wrong-type", () => {
    expect(isBackendName("vercel")).toBe(false);
    expect(isBackendName("")).toBe(false);
    expect(isBackendName(undefined)).toBe(false);
    expect(isBackendName(42)).toBe(false);
  });
});

describe("resolveBackend", () => {
  it("flag wins", () => {
    expect(
      resolveBackend({
        flag: "cloudflare",
        env: "gh-pages",
        config: { backend: "cloud" },
      })
    ).toEqual({ backend: "cloudflare", source: "flag" });
  });

  it("env beats config", () => {
    expect(
      resolveBackend({ env: "gh-pages", config: { backend: "cloud" } })
    ).toEqual({ backend: "gh-pages", source: "env" });
  });

  it("config wins over default", () => {
    expect(resolveBackend({ config: { backend: "cloudflare" } })).toEqual({
      backend: "cloudflare",
      source: "config",
    });
  });

  it("default is cloud", () => {
    expect(resolveBackend({})).toEqual({ backend: "cloud", source: "default" });
  });

  it("throws on unknown flag", () => {
    expect(() => resolveBackend({ flag: "vercel" })).toThrow(CliError);
  });

  it("throws on unknown env", () => {
    expect(() => resolveBackend({ env: "vercel" })).toThrow(CliError);
  });
});

describe("loadConfigFile", () => {
  async function makeTmpConfig(toml: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "htmlbin-cli-config-"));
    await mkdir(join(dir, ".htmlbin"), { recursive: true });
    await writeFile(join(dir, ".htmlbin/config"), toml, "utf8");
    return dir;
  }

  it("returns empty config when file is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "htmlbin-cli-config-"));
    expect(await loadConfigFile(dir)).toEqual({});
  });

  it("parses backend", async () => {
    const dir = await makeTmpConfig(`backend = "cloudflare"`);
    expect(await loadConfigFile(dir)).toEqual({ backend: "cloudflare" });
  });

  it("parses overrides", async () => {
    const dir = await makeTmpConfig(`
      backend = "gh-pages"
      repo = "foo/bar"
      branch = "preview"
      api_url = "http://localhost:8787"
      account_id = "abc"
      project = "my-pages"
    `);
    expect(await loadConfigFile(dir)).toEqual({
      backend: "gh-pages",
      repo: "foo/bar",
      branch: "preview",
      api_url: "http://localhost:8787",
      account_id: "abc",
      project: "my-pages",
    });
  });

  it("throws on unknown backend in file", async () => {
    const dir = await makeTmpConfig(`backend = "vercel"`);
    await expect(loadConfigFile(dir)).rejects.toThrow(CliError);
  });
});
