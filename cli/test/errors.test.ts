import { describe, expect, it } from "vitest";
import { CliError, exitCodeFor } from "../src/errors.js";

describe("CliError", () => {
  it("captures code + hint + details", () => {
    const e = new CliError("auth_required", "no token", {
      hint: "run htmlbin login",
      details: { foo: 1 },
    });
    expect(e.code).toBe("auth_required");
    expect(e.message).toBe("no token");
    expect(e.hint).toBe("run htmlbin login");
    expect(e.details).toEqual({ foo: 1 });
  });
});

describe("exitCodeFor", () => {
  it("maps auth codes to 2", () => {
    expect(exitCodeFor("auth_required")).toBe(2);
    expect(exitCodeFor("unauthorized")).toBe(2);
    expect(exitCodeFor("github_token_missing")).toBe(2);
    expect(exitCodeFor("cloudflare_token_missing")).toBe(2);
  });

  it("maps not_found to 4", () => {
    expect(exitCodeFor("not_found")).toBe(4);
    expect(exitCodeFor("file_not_found")).toBe(4);
    expect(exitCodeFor("github_branch_missing")).toBe(4);
  });

  it("maps rate-limit codes to 5", () => {
    expect(exitCodeFor("rate_limited")).toBe(5);
    expect(exitCodeFor("quota_exceeded")).toBe(5);
    expect(exitCodeFor("daily_quota_exceeded")).toBe(5);
  });

  it("maps size codes to 6", () => {
    expect(exitCodeFor("html_too_large")).toBe(6);
    expect(exitCodeFor("file_too_large")).toBe(6);
    expect(exitCodeFor("title_too_long")).toBe(6);
  });

  it("falls back to 1 for unknown", () => {
    expect(exitCodeFor("unknown")).toBe(1);
  });
});
