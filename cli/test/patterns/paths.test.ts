import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import {
  cacheIndexFile,
  catalogIndexUrl,
  catalogPatternUrl,
  DEFAULT_CATALOG_BASE,
  globalPatternsDir,
  projectPatternsDir,
} from "../../src/patterns/paths.js";

describe("path helpers", () => {
  it("project dir is cwd-relative", () => {
    expect(projectPatternsDir("/tmp/foo")).toBe("/tmp/foo/.htmlbin/patterns");
  });

  it("global dir honors XDG_CONFIG_HOME", () => {
    expect(globalPatternsDir({ XDG_CONFIG_HOME: "/x/cfg" } as NodeJS.ProcessEnv)).toBe(
      "/x/cfg/htmlbin/patterns"
    );
  });

  it("global dir falls back to ~/.config", () => {
    expect(globalPatternsDir({} as NodeJS.ProcessEnv)).toBe(
      `${homedir()}/.config/htmlbin/patterns`
    );
  });

  it("global dir treats empty XDG_CONFIG_HOME as unset", () => {
    expect(globalPatternsDir({ XDG_CONFIG_HOME: "  " } as NodeJS.ProcessEnv)).toBe(
      `${homedir()}/.config/htmlbin/patterns`
    );
  });

  it("cache file honors XDG_CACHE_HOME", () => {
    expect(cacheIndexFile({ XDG_CACHE_HOME: "/x/cache" } as NodeJS.ProcessEnv)).toBe(
      "/x/cache/htmlbin/patterns/index.json"
    );
  });

  it("catalog URLs round-trip the default base", () => {
    expect(catalogPatternUrl(DEFAULT_CATALOG_BASE, "pr-explainer")).toBe(
      "https://htmlbin.dev/.well-known/patterns/pr-explainer.md"
    );
    expect(catalogIndexUrl(DEFAULT_CATALOG_BASE)).toBe(
      "https://htmlbin.dev/.well-known/patterns/index.json"
    );
  });

  it("catalog URLs strip trailing slashes", () => {
    expect(catalogPatternUrl("https://foo/", "x")).toBe("https://foo/x.md");
  });
});
