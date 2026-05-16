import { describe, expect, it } from "vitest";
import { CliError } from "../src/errors.js";
import {
  detectPrFromCiEnv,
  parseGitRemote,
  parseOwnerName,
  resolvePrNumber,
} from "../src/gh/repo.js";

describe("parseGitRemote", () => {
  it("parses SSH form", () => {
    expect(parseGitRemote("git@github.com:utsengar/htmlbin.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin",
    });
  });

  it("parses SSH form without .git", () => {
    expect(parseGitRemote("git@github.com:utsengar/htmlbin")).toEqual({
      owner: "utsengar",
      name: "htmlbin",
    });
  });

  it("parses ssh:// form", () => {
    expect(parseGitRemote("ssh://git@github.com/utsengar/htmlbin.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin",
    });
  });

  it("parses HTTPS form", () => {
    expect(parseGitRemote("https://github.com/utsengar/htmlbin.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin",
    });
  });

  it("parses HTTPS form without .git", () => {
    expect(parseGitRemote("https://github.com/utsengar/htmlbin")).toEqual({
      owner: "utsengar",
      name: "htmlbin",
    });
  });

  it("parses HTTPS form with auth prefix", () => {
    expect(parseGitRemote("https://x-access-token:abc@github.com/utsengar/htmlbin.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin",
    });
  });

  it("parses git:// form", () => {
    expect(parseGitRemote("git://github.com/utsengar/htmlbin.git")).toEqual({
      owner: "utsengar",
      name: "htmlbin",
    });
  });

  it("trims trailing slash", () => {
    expect(parseGitRemote("https://github.com/utsengar/htmlbin/")).toEqual({
      owner: "utsengar",
      name: "htmlbin",
    });
  });

  it("throws on unparseable URL", () => {
    expect(() => parseGitRemote("https://gitlab.com/x/y.git")).toThrow(CliError);
    expect(() => parseGitRemote("not a url")).toThrow(CliError);
  });
});

describe("parseOwnerName", () => {
  it("parses owner/name", () => {
    expect(parseOwnerName("foo/bar")).toEqual({ owner: "foo", name: "bar" });
  });

  it("trims whitespace", () => {
    expect(parseOwnerName("  foo/bar  ")).toEqual({ owner: "foo", name: "bar" });
  });

  it("throws when missing slash", () => {
    expect(() => parseOwnerName("foobar")).toThrow(CliError);
  });

  it("throws when extra slashes", () => {
    expect(() => parseOwnerName("a/b/c")).toThrow(CliError);
  });
});

describe("detectPrFromCiEnv", () => {
  it("parses GITHUB_REF for PR merge", () => {
    expect(detectPrFromCiEnv({ GITHUB_REF: "refs/pull/1234/merge" } as NodeJS.ProcessEnv)).toBe(1234);
  });

  it("parses GITHUB_REF for PR head", () => {
    expect(detectPrFromCiEnv({ GITHUB_REF: "refs/pull/42/head" } as NodeJS.ProcessEnv)).toBe(42);
  });

  it("returns null for branch refs", () => {
    expect(detectPrFromCiEnv({ GITHUB_REF: "refs/heads/main" } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("returns null when GITHUB_REF unset", () => {
    expect(detectPrFromCiEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("resolvePrNumber", () => {
  it("prefers explicit", () => {
    expect(resolvePrNumber({ explicit: 7, env: { GITHUB_REF: "refs/pull/99/merge" } as NodeJS.ProcessEnv })).toBe(7);
  });

  it("falls back to env", () => {
    expect(resolvePrNumber({ env: { GITHUB_REF: "refs/pull/99/merge" } as NodeJS.ProcessEnv })).toBe(99);
  });

  it("throws when neither provided", () => {
    expect(() => resolvePrNumber({ env: {} as NodeJS.ProcessEnv })).toThrow(CliError);
  });

  it("rejects non-positive explicit", () => {
    expect(() => resolvePrNumber({ explicit: 0, env: {} as NodeJS.ProcessEnv })).toThrow(CliError);
  });
});
