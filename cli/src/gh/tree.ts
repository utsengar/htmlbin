// Atomic-commit primitive against the GitHub Git Data API.
//
// One commit per CLI invocation, no clone, no git binary. The flow:
//   1. GET    /repos/{o}/{r}/git/ref/heads/{branch}        → current SHA
//   2. GET    /repos/{o}/{r}/git/commits/{sha}             → current tree
//   3. POST   /repos/{o}/{r}/git/blobs                     → upload blob(s)
//   4. POST   /repos/{o}/{r}/git/trees { base_tree, tree } → new tree
//   5. POST   /repos/{o}/{r}/git/commits { tree, parents } → new commit
//   6. PATCH  /repos/{o}/{r}/git/refs/heads/{branch}       → advance ref
//
// For deletes we read the current tree recursively, drop the subtree, and
// build a fresh (non-base-tree) commit pointing at the surviving entries.

import type { Octokit } from "@octokit/rest";
import { CliError } from "../errors.js";

export interface BranchRef {
  owner: string;
  repo: string;
  branch: string;
}

export interface BlobInput {
  path: string;
  content: string;
}

export async function getBranchHead(
  gh: Octokit,
  ref: BranchRef
): Promise<{ commitSha: string; treeSha: string } | null> {
  try {
    const r = await gh.git.getRef({ owner: ref.owner, repo: ref.repo, ref: `heads/${ref.branch}` });
    const commitSha = r.data.object.sha;
    const c = await gh.git.getCommit({ owner: ref.owner, repo: ref.repo, commit_sha: commitSha });
    return { commitSha, treeSha: c.data.tree.sha };
  } catch (e) {
    if ((e as { status?: number }).status === 404) return null;
    throw e;
  }
}

export async function ensureBranch(
  gh: Octokit,
  ref: BranchRef,
  fromBranch?: string
): Promise<void> {
  const existing = await getBranchHead(gh, ref);
  if (existing) return;

  // No branch yet — create one from `fromBranch` (default branch's HEAD)
  // or from an empty initial commit if no source branch was given.
  if (fromBranch) {
    const src = await gh.git.getRef({ owner: ref.owner, repo: ref.repo, ref: `heads/${fromBranch}` });
    await gh.git.createRef({
      owner: ref.owner,
      repo: ref.repo,
      ref: `refs/heads/${ref.branch}`,
      sha: src.data.object.sha,
    });
    return;
  }

  // Initial commit: empty tree + an empty commit pointing to it.
  const tree = await gh.git.createTree({
    owner: ref.owner,
    repo: ref.repo,
    tree: [],
  });
  const commit = await gh.git.createCommit({
    owner: ref.owner,
    repo: ref.repo,
    message: "Initial gh-pages commit (created by @htmlbin/cli setup).",
    tree: tree.data.sha,
    parents: [],
  });
  await gh.git.createRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `refs/heads/${ref.branch}`,
    sha: commit.data.sha,
  });
}

export async function commitBlobs(
  gh: Octokit,
  ref: BranchRef,
  blobs: BlobInput[],
  message: string
): Promise<{ commitSha: string }> {
  const head = await getBranchHead(gh, ref);
  if (!head) {
    throw new CliError(
      "github_branch_missing",
      `Branch ${ref.branch} not found on ${ref.owner}/${ref.repo}.`,
      { hint: "Run `htmlbin setup --to gh-pages` first to create it." }
    );
  }

  const blobShas = await Promise.all(
    blobs.map(async (b) => {
      const r = await gh.git.createBlob({
        owner: ref.owner,
        repo: ref.repo,
        content: Buffer.from(b.content, "utf8").toString("base64"),
        encoding: "base64",
      });
      return { path: b.path, sha: r.data.sha };
    })
  );

  const tree = await gh.git.createTree({
    owner: ref.owner,
    repo: ref.repo,
    base_tree: head.treeSha,
    tree: blobShas.map((b) => ({
      path: b.path,
      mode: "100644",
      type: "blob",
      sha: b.sha,
    })),
  });

  const commit = await gh.git.createCommit({
    owner: ref.owner,
    repo: ref.repo,
    message,
    tree: tree.data.sha,
    parents: [head.commitSha],
  });

  await gh.git.updateRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${ref.branch}`,
    sha: commit.data.sha,
    force: false,
  });

  return { commitSha: commit.data.sha };
}

/**
 * Remove all entries whose path starts with `prefix + "/"` (or exactly equals
 * `prefix`). Builds a fresh tree from the surviving entries.
 */
export async function removeSubtree(
  gh: Octokit,
  ref: BranchRef,
  prefix: string,
  message: string
): Promise<{ commitSha: string; removed: number }> {
  const head = await getBranchHead(gh, ref);
  if (!head) {
    throw new CliError(
      "github_branch_missing",
      `Branch ${ref.branch} not found on ${ref.owner}/${ref.repo}.`
    );
  }
  const full = await gh.git.getTree({
    owner: ref.owner,
    repo: ref.repo,
    tree_sha: head.treeSha,
    recursive: "true",
  });

  const survivors: Array<{ path: string; mode: "100644" | "100755" | "040000" | "160000" | "120000"; type: "blob" | "tree" | "commit"; sha: string }> = [];
  let removed = 0;
  for (const entry of full.data.tree) {
    if (!entry.path || !entry.sha || !entry.mode || !entry.type) continue;
    if (entry.type === "tree") continue; // directories rebuild themselves from blob paths
    const p = entry.path;
    if (p === prefix || p.startsWith(prefix + "/")) {
      removed += 1;
      continue;
    }
    survivors.push({
      path: p,
      mode: entry.mode as "100644" | "100755" | "040000" | "160000" | "120000",
      type: entry.type as "blob" | "tree" | "commit",
      sha: entry.sha,
    });
  }

  if (removed === 0) {
    return { commitSha: head.commitSha, removed };
  }

  const tree = await gh.git.createTree({
    owner: ref.owner,
    repo: ref.repo,
    tree: survivors, // no base_tree → fresh tree
  });

  const commit = await gh.git.createCommit({
    owner: ref.owner,
    repo: ref.repo,
    message,
    tree: tree.data.sha,
    parents: [head.commitSha],
  });

  await gh.git.updateRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${ref.branch}`,
    sha: commit.data.sha,
    force: false,
  });

  return { commitSha: commit.data.sha, removed };
}

export async function listTopLevelSlugs(
  gh: Octokit,
  ref: BranchRef,
  filter: RegExp
): Promise<Array<{ slug: string }>> {
  const head = await getBranchHead(gh, ref);
  if (!head) return [];
  const t = await gh.git.getTree({
    owner: ref.owner,
    repo: ref.repo,
    tree_sha: head.treeSha,
    recursive: "false",
  });
  const out: Array<{ slug: string }> = [];
  for (const entry of t.data.tree) {
    if (entry.type === "tree" && entry.path && filter.test(entry.path)) {
      out.push({ slug: entry.path });
    }
  }
  return out;
}
