// Shared helpers for the e2e suite. Spawns the actual built binary
// (dist/bin.cjs) and captures stdout/stderr/exit so we can assert
// against the contract a real user / agent would see.

import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const CLI_BIN = resolve(__dirname, "../../dist/bin.cjs");

/** True if the bundle has been built. e2e suites skip when this is false. */
export function distAvailable(): boolean {
  return existsSync(CLI_BIN);
}

/**
 * Every coding-agent env var the CLI auto-detects. We scrub these by
 * default so the e2e runs in a "normal terminal" baseline; individual
 * tests opt in by passing `env: { CLAUDE_CODE: "1" }`.
 */
const AGENT_VARS = [
  "CLAUDECODE",
  "CLAUDE_CODE",
  "CURSOR_AGENT",
  "CODEX",
  "CODEX_AGENT",
  "OPENAI_CODEX",
  "OPENCODE",
  "AIDER",
  "CLINE",
  "WINDSURF_AGENT",
  "GITHUB_COPILOT",
  "AMAZON_Q",
  "AWS_Q_DEVELOPER",
  "GEMINI_CODE_ASSIST",
  "SRC_CODY",
  "PI_CODING_AGENT",
  "AMP_CODE",
  "DEVIN",
  "AGENT",
  "FORCE_AGENT_MODE",
] as const;

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunOpts {
  /** Merged on top of a scrubbed-base env (see AGENT_VARS). */
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** Stdin to pipe in. */
  input?: string;
}

export async function runCli(
  args: string[],
  opts: RunOpts = {}
): Promise<RunResult> {
  const base: NodeJS.ProcessEnv = { ...process.env };
  for (const k of AGENT_VARS) delete base[k];
  const env = { ...base, ...(opts.env ?? {}) };

  const execaOpts: Parameters<typeof execa>[2] = {
    reject: false,
    env,
    // Do NOT merge process.env on top of ours. Without this execa
    // helpfully re-injects the parent's CLAUDECODE etc — which is the
    // opposite of what we want for testing the no-agent baseline.
    extendEnv: false,
  };
  if (opts.cwd !== undefined) execaOpts.cwd = opts.cwd;
  if (opts.input !== undefined) execaOpts.input = opts.input;

  const result = await execa("node", [CLI_BIN, ...args], execaOpts);
  return {
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    exitCode: result.exitCode ?? 0,
  };
}

/**
 * Make a tmp dir with a fresh XDG-config + XDG-cache + cwd so tests
 * never touch the real ~/.config/htmlbin or the real cwd's
 * .htmlbin/. Returns an env block ready to spread into runCli's env.
 */
export async function makeIsolatedEnv(): Promise<{
  baseDir: string;
  cwd: string;
  configDir: string;
  cacheDir: string;
  env: NodeJS.ProcessEnv;
}> {
  const baseDir = await mkdtemp(join(tmpdir(), "htmlbin-cli-e2e-"));
  const cwd = join(baseDir, "cwd");
  const configDir = join(baseDir, "xdg-config");
  const cacheDir = join(baseDir, "xdg-cache");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  return {
    baseDir,
    cwd,
    configDir,
    cacheDir,
    env: {
      XDG_CONFIG_HOME: configDir,
      XDG_CACHE_HOME: cacheDir,
      // Force HOME too — some code paths use homedir() directly and we
      // want to be sure no code accidentally writes outside the sandbox.
      HOME: baseDir,
    },
  };
}

/** Try to parse stdout as JSON. Returns null on failure. */
export function parseJson<T = unknown>(s: string): T | null {
  try {
    return JSON.parse(s.trim()) as T;
  } catch {
    return null;
  }
}
