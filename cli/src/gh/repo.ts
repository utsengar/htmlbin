// Detect the target repo + PR number from the local environment.
//
// Repo resolution:
//   1. --repo owner/name CLI flag (caller-provided)
//   2. `git remote get-url origin` parsed for owner/name
//   3. error
//
// PR resolution:
//   1. --pr N CLI flag
//   2. $GITHUB_REF (refs/pull/<n>/merge|head) in GitHub Actions
//   3. error

import { execa } from "execa";
import { CliError } from "../errors.js";

export interface RepoRef {
  owner: string;
  name: string;
}

export function parseGitRemote(url: string): RepoRef {
  const trimmed = url.trim();

  // SSH: git@github.com:owner/name(.git)
  const ssh = /^git@github\.com:([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (ssh) return { owner: ssh[1]!, name: ssh[2]! };

  // SSH (with protocol): ssh://git@github.com/owner/name(.git)
  const sshProto = /^ssh:\/\/git@github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (sshProto) return { owner: sshProto[1]!, name: sshProto[2]! };

  // HTTPS: https://github.com/owner/name(.git)
  const https = /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (https) return { owner: https[1]!, name: https[2]! };

  // git:// — historical
  const git = /^git:\/\/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(trimmed);
  if (git) return { owner: git[1]!, name: git[2]! };

  throw new CliError(
    "github_remote_unparseable",
    `Could not parse GitHub repo from URL: ${url}`,
    {
      hint:
        "Provide --repo owner/name explicitly. Supported forms: https://github.com/owner/name(.git), git@github.com:owner/name(.git), ssh://git@github.com/owner/name(.git).",
    }
  );
}

export function parseOwnerName(s: string): RepoRef {
  const m = /^([^/]+)\/([^/]+)$/.exec(s.trim());
  if (!m) {
    throw new CliError(
      "github_remote_unparseable",
      `Expected "owner/name", got: ${s}`
    );
  }
  return { owner: m[1]!, name: m[2]! };
}

export async function readGitRemoteOrigin(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const { stdout, exitCode } = await execa("git", ["remote", "get-url", "origin"], {
      cwd,
      reject: false,
      timeout: 5000,
    });
    if (exitCode === 0 && stdout.trim()) return stdout.trim();
    return null;
  } catch {
    return null;
  }
}

export async function detectRepo(opts: { explicit?: string; cwd?: string }): Promise<RepoRef> {
  if (opts.explicit) return parseOwnerName(opts.explicit);
  const url = await readGitRemoteOrigin(opts.cwd);
  if (!url) {
    throw new CliError(
      "github_remote_unparseable",
      "No git remote `origin` and no --repo flag.",
      { hint: "Pass --repo owner/name or run inside a git checkout with an origin remote." }
    );
  }
  return parseGitRemote(url);
}

export function detectPrFromCiEnv(env: NodeJS.ProcessEnv = process.env): number | null {
  // GitHub Actions sets $GITHUB_REF to refs/pull/<n>/merge or refs/pull/<n>/head on PR events.
  const ref = env.GITHUB_REF;
  if (ref) {
    const m = /^refs\/pull\/(\d+)\//.exec(ref);
    if (m) return Number(m[1]);
  }
  // GitHub Actions also exposes the PR number via GITHUB_EVENT_PATH JSON, but
  // GITHUB_REF is sufficient for the common case and avoids a sync FS read.
  return null;
}

export function resolvePrNumber(opts: { explicit?: number; env?: NodeJS.ProcessEnv }): number {
  if (typeof opts.explicit === "number" && Number.isFinite(opts.explicit) && opts.explicit > 0) {
    return Math.floor(opts.explicit);
  }
  const fromCi = detectPrFromCiEnv(opts.env);
  if (fromCi !== null) return fromCi;
  throw new CliError(
    "pr_required",
    "PR number required for this backend.",
    { hint: "Pass --pr <n>, or run under GitHub Actions where $GITHUB_REF is set on PR events." }
  );
}
