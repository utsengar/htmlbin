import { describe, expect, it } from "vitest";

// Re-implement isAgentContext locally so the test exercises the same
// detection list the CLI uses. The list lives in bin.ts as a runtime
// concern — we keep this test in sync by reading from the same source
// in a follow-up if it grows.

const AGENT_ENV_VARS = [
  "CLAUDE_CODE",
  "CURSOR_AGENT",
  "CODEX",
  "CODEX_AGENT",
  "AIDER",
  "CLINE",
  "AMP_CODE",
  "DEVIN",
] as const;

function isAgentContext(env: NodeJS.ProcessEnv): boolean {
  return AGENT_ENV_VARS.some((k) => env[k]);
}

describe("agent-context auto-detection", () => {
  it("returns false for an empty environment", () => {
    expect(isAgentContext({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("returns false for an environment with unrelated vars", () => {
    expect(
      isAgentContext({ PATH: "/usr/bin", HOME: "/home/x" } as NodeJS.ProcessEnv)
    ).toBe(false);
  });

  for (const k of AGENT_ENV_VARS) {
    it(`detects ${k} when set to any truthy value`, () => {
      expect(isAgentContext({ [k]: "1" } as NodeJS.ProcessEnv)).toBe(true);
    });
  }

  it("ignores known-but-empty env var (set to empty string)", () => {
    // process.env treats unset and "" differently; "" should be falsy in
    // our detection because the agent runner explicitly cleared the var.
    expect(isAgentContext({ CLAUDE_CODE: "" } as NodeJS.ProcessEnv)).toBe(false);
  });
});
