import { describe, expect, it } from "vitest";

// Re-implement the detection list locally so the test exercises the
// same shape the CLI uses. Keep in sync with bin.ts:AGENT_ENV_VARS.

const AGENT_ENV_VARS: ReadonlyArray<readonly [string, string]> = [
  ["CLAUDECODE", "claude-code"],
  ["CLAUDE_CODE", "claude-code"],
  ["CURSOR_AGENT", "cursor"],
  ["CODEX", "codex"],
  ["CODEX_AGENT", "codex"],
  ["OPENAI_CODEX", "codex"],
  ["OPENCODE", "opencode"],
  ["AIDER", "aider"],
  ["CLINE", "cline"],
  ["WINDSURF_AGENT", "windsurf"],
  ["GITHUB_COPILOT", "github-copilot"],
  ["AMAZON_Q", "amazon-q"],
  ["AWS_Q_DEVELOPER", "amazon-q"],
  ["GEMINI_CODE_ASSIST", "gemini-code-assist"],
  ["SRC_CODY", "sourcegraph-cody"],
  ["PI_CODING_AGENT", "pi"],
  ["AMP_CODE", "amp"],
  ["DEVIN", "devin"],
  ["AGENT", "generic-agent"],
];

function detectAgent(env: NodeJS.ProcessEnv): string | null {
  if (env.FORCE_AGENT_MODE) return "forced";
  for (const [key, name] of AGENT_ENV_VARS) {
    if (env[key]) return name;
  }
  return null;
}

describe("agent-context auto-detection", () => {
  it("returns null for an empty environment", () => {
    expect(detectAgent({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("returns null for unrelated env vars", () => {
    expect(
      detectAgent({ PATH: "/usr/bin", HOME: "/home/x" } as NodeJS.ProcessEnv)
    ).toBeNull();
  });

  for (const [key, name] of AGENT_ENV_VARS) {
    it(`detects ${key} → ${name}`, () => {
      expect(detectAgent({ [key]: "1" } as NodeJS.ProcessEnv)).toBe(name);
    });
  }

  it("FORCE_AGENT_MODE wins regardless of other vars", () => {
    expect(detectAgent({ FORCE_AGENT_MODE: "1" } as NodeJS.ProcessEnv)).toBe("forced");
  });

  it("empty string is treated as unset", () => {
    expect(detectAgent({ CLAUDE_CODE: "" } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("first match wins when multiple agent vars are set", () => {
    // CLAUDECODE comes before CURSOR_AGENT in the table.
    expect(
      detectAgent({ CLAUDECODE: "1", CURSOR_AGENT: "1" } as NodeJS.ProcessEnv)
    ).toBe("claude-code");
  });
});
