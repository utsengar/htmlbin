// Thin Octokit factory with our user-agent.

import { Octokit } from "@octokit/rest";

export function makeOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: "@htmlbin/cli",
    request: { timeout: 30_000 },
  });
}

export type GitHubClient = Octokit;
