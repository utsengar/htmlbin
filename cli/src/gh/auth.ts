// GitHub token resolution.
//
//   1. $GITHUB_TOKEN
//   2. shell-out to `gh auth token` (gh CLI must be installed)

import { execa } from "execa";
import { CliError } from "../errors.js";

export interface GitHubTokenSource {
  token: string;
  source: "env" | "gh-cli";
}

export async function resolveGitHubToken(): Promise<GitHubTokenSource | null> {
  const envTok = process.env.GITHUB_TOKEN?.trim();
  if (envTok) return { token: envTok, source: "env" };

  try {
    const { stdout, exitCode } = await execa("gh", ["auth", "token"], {
      reject: false,
      timeout: 5000,
    });
    if (exitCode === 0 && stdout.trim()) {
      return { token: stdout.trim(), source: "gh-cli" };
    }
  } catch {
    // gh not installed; ignore
  }
  return null;
}

export async function requireGitHubToken(): Promise<GitHubTokenSource> {
  const t = await resolveGitHubToken();
  if (!t) {
    throw new CliError("github_token_missing", "No GitHub token found.", {
      hint:
        "Set $GITHUB_TOKEN or run `gh auth login` (then `gh auth status`). For CI, GitHub Actions provides `${{ secrets.GITHUB_TOKEN }}` automatically.",
    });
  }
  return t;
}
