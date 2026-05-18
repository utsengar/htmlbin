import { describe, expect, it } from "vitest";
import { CliError } from "../../src/errors.js";
import { resolveSource } from "../../src/patterns/sources.js";

describe("resolveSource", () => {
  it("bare kebab-case → catalog", () => {
    const r = resolveSource("pr-explainer");
    expect(r.kind).toBe("catalog");
    if (r.kind === "catalog") {
      expect(r.name).toBe("pr-explainer");
      expect(r.url).toMatch(/htmlbin\.dev\/.+pr-explainer\.md$/);
    }
  });

  it("--catalog override is respected", () => {
    const r = resolveSource("foo", { catalogBase: "https://forks.example/p" });
    expect(r.kind).toBe("catalog");
    if (r.kind === "catalog") {
      expect(r.url).toBe("https://forks.example/p/foo.md");
    }
  });

  it("https URL → url", () => {
    const r = resolveSource("https://gist.example/raw/x.md");
    expect(r).toEqual({ kind: "url", url: "https://gist.example/raw/x.md" });
  });

  it("http URL also accepted", () => {
    const r = resolveSource("http://example.com/x.md");
    expect(r.kind).toBe("url");
  });

  it("github: shorthand expands to raw.githubusercontent.com", () => {
    const r = resolveSource("github:utsengar/htmlbin/patterns/pr-explainer.md");
    expect(r.kind).toBe("github");
    if (r.kind === "github") {
      expect(r.url).toBe(
        "https://raw.githubusercontent.com/utsengar/htmlbin/HEAD/patterns/pr-explainer.md"
      );
    }
  });

  it("gist:<hash> resolves", () => {
    const r = resolveSource("gist:abc123");
    expect(r.kind).toBe("gist");
    if (r.kind === "gist") {
      expect(r.url).toBe("https://gist.githubusercontent.com/raw/abc123");
    }
  });

  it("gist:<hash>/<file> resolves", () => {
    const r = resolveSource("gist:abc123/foo.md");
    if (r.kind === "gist") {
      expect(r.url).toBe("https://gist.githubusercontent.com/raw/abc123/foo.md");
    }
  });

  it("./relative path → file", () => {
    const r = resolveSource("./foo.md", { cwd: "/tmp" });
    expect(r).toEqual({ kind: "file", path: "/tmp/foo.md" });
  });

  it("absolute path → file", () => {
    const r = resolveSource("/tmp/x/foo.md");
    expect(r).toEqual({ kind: "file", path: "/tmp/x/foo.md" });
  });

  it("garbage string → invalid_arg", () => {
    expect(() => resolveSource("Invalid Name With Spaces")).toThrow(CliError);
  });

  it("empty source → invalid_arg", () => {
    expect(() => resolveSource("")).toThrow(CliError);
  });
});
