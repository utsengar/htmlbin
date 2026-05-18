// Thin Octokit factory with our user-agent.

import { Octokit } from "@octokit/rest";
import { userAgent } from "../useragent.js";

export function makeOctokit(token: string): Octokit {
  return new Octokit({
    auth: token,
    userAgent: userAgent(),
    request: { timeout: 30_000 },
  });
}

export type GitHubClient = Octokit;
