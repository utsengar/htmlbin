import { describe, expect, it, beforeEach } from "vitest";
import { setAgent, userAgent } from "../src/useragent.js";

beforeEach(() => {
  setAgent(null);
});

describe("userAgent", () => {
  it("emits CLI name + version + node + platform when no agent set", () => {
    const ua = userAgent();
    expect(ua).toMatch(/^@htmlbin\/cli\/\d+\.\d+\.\d+ \(node /);
    expect(ua).toContain(process.version);
    expect(ua).toContain(process.platform);
    expect(ua).toContain(process.arch);
    expect(ua).not.toContain("agent ");
  });

  it("appends agent name when setAgent is called", () => {
    setAgent("claude-code");
    expect(userAgent()).toContain("; agent claude-code)");
  });

  it("null agent clears the annotation", () => {
    setAgent("cursor");
    expect(userAgent()).toContain("agent cursor");
    setAgent(null);
    expect(userAgent()).not.toContain("agent ");
  });

  it("ends with a closing paren in all forms", () => {
    expect(userAgent().endsWith(")")).toBe(true);
    setAgent("aider");
    expect(userAgent().endsWith(")")).toBe(true);
  });
});
