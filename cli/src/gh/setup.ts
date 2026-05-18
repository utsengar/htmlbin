// gh-pages setup walkthrough.
//
// What `setup` can do via the API:
//   - create the `gh-pages` branch if it doesn't exist (empty initial commit)
//   - read the repo's plan to detect whether private Pages is available
//   - warn loudly on collisions (top-level dirs named like pr-N)
//
// What it CAN'T do — must be done in the UI by the user:
//   - flip Pages → Private (no API; users must visit Settings → Pages)
//   - choose the IdP for the SAML/SSO flow (that's at the org level)

import { ensureBranch, getBranchHead, listTopLevelSlugs } from "./tree.js";
import type { GitHubClient } from "./octokit.js";
import type { BranchRef } from "./tree.js";
import type { SetupResult } from "../backend.js";

export interface SetupOpts {
  branch: string; // default "gh-pages"
}

export async function setupGhPages(
  gh: GitHubClient,
  ref: { owner: string; repo: string },
  opts: SetupOpts
): Promise<SetupResult> {
  const branchRef: BranchRef = { owner: ref.owner, repo: ref.repo, branch: opts.branch };
  const instructions: string[] = [];

  const before = await getBranchHead(gh, branchRef);
  if (before) {
    instructions.push(`Branch \`${opts.branch}\` already exists on ${ref.owner}/${ref.repo}.`);
  } else {
    await ensureBranch(gh, branchRef);
    instructions.push(`Created branch \`${opts.branch}\` on ${ref.owner}/${ref.repo} with an empty initial commit.`);
  }

  // Collision check
  try {
    const slugs = await listTopLevelSlugs(gh, branchRef, /^pr-\d+$/);
    if (slugs.length > 0) {
      instructions.push(
        `Heads up: ${slugs.length} existing pr-* directory(ies) on this branch (${slugs.slice(0, 5).map((s) => s.slug).join(", ")}${slugs.length > 5 ? "…" : ""}). Subsequent \`htmlbin publish\` calls will overwrite matching ones.`
      );
    }
  } catch {
    // ignore — tree read is best-effort
  }

  // Plan / private-pages probe
  try {
    const repo = await gh.repos.get({ owner: ref.owner, repo: ref.repo });
    const plan = (repo.data as { organization?: { plan?: { name?: string } }; private?: boolean }).organization?.plan?.name;
    const isPrivate = repo.data.private === true;
    if (!isPrivate) {
      instructions.push(
        "⚠ This repo is public — GitHub Pages will be public regardless of any Pages → Private setting. For org-internal SSO gating, move the repo to private or internal first."
      );
    }
    if (plan && !["enterprise", "team", "teams"].includes(plan.toLowerCase())) {
      instructions.push(
        `⚠ Org plan is \`${plan}\`. Private Pages requires GitHub Enterprise Cloud or a Teams plan with private Pages enabled. The publish path will still work, but the served URL will be public.`
      );
    }
  } catch {
    // best effort — token may lack permissions to read plan
  }

  instructions.push("");
  instructions.push("Manual steps to complete the SSO gate (UI-only, no API exposed):");
  instructions.push(`  1. Go to https://github.com/${ref.owner}/${ref.repo}/settings/pages`);
  instructions.push(`  2. Set "Build and deployment" → Source = Deploy from a branch, Branch = ${opts.branch} / (root)`);
  instructions.push(`  3. Set "Access control" to "Private" (requires Enterprise / Teams + private Pages).`);
  instructions.push("  4. Save. The Pages URL will now redirect unauthenticated viewers through GitHub SSO.");

  return { instructions };
}
