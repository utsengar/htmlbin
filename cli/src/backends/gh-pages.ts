// GitHub Pages backend.
// Publishes via the GitHub Git Data API to an atomic commit on the
// configured Pages branch (default `gh-pages`). One PR → one `pr-N/`
// subdirectory.

import { CliError } from "../errors.js";
import { loadHtml } from "../load.js";
import type {
  Backend,
  DropSummary,
  PublishOpts,
  PublishResult,
  SetupResult,
} from "../backend.js";
import { makeOctokit, type GitHubClient } from "../gh/octokit.js";
import { requireGitHubToken } from "../gh/auth.js";
import { detectRepo, parseOwnerName, resolvePrNumber } from "../gh/repo.js";
import {
  commitBlobs,
  listTopLevelSlugs,
  removeSubtree,
  type BranchRef,
} from "../gh/tree.js";
import { setupGhPages } from "../gh/setup.js";

const MAX_HTML_BYTES = 25 * 1024 * 1024; // GitHub blob API caps at 100MB; we cap at 25MB

export interface GhPagesBackendOpts {
  repo?: string;
  branch?: string;
  token?: string;
  cwd?: string;
}

export function createGhPagesBackend(opts: GhPagesBackendOpts = {}): Backend {
  const branch = opts.branch ?? "gh-pages";

  let cached: { gh: GitHubClient; ref: BranchRef } | null = null;
  async function ctx(): Promise<{ gh: GitHubClient; ref: BranchRef; ownerName: string }> {
    if (cached) {
      return { gh: cached.gh, ref: cached.ref, ownerName: `${cached.ref.owner}/${cached.ref.repo}` };
    }
    const token = opts.token ?? (await requireGitHubToken()).token;
    const repo = opts.repo ? parseOwnerName(opts.repo) : await detectRepo({ cwd: opts.cwd });
    const gh = makeOctokit(token);
    const ref: BranchRef = { owner: repo.owner, repo: repo.name, branch };
    cached = { gh, ref };
    return { gh, ref, ownerName: `${repo.owner}/${repo.name}` };
  }

  function slugFor(po: PublishOpts): string {
    if (po.slug) return sanitizeSlug(po.slug);
    const pr = resolvePrNumber({ explicit: po.pr });
    return `pr-${pr}`;
  }

  function pagesUrl(owner: string, repo: string, slug: string): string {
    return `https://${owner.toLowerCase()}.github.io/${repo}/${slug}/`;
  }

  return {
    name: "gh-pages",

    async publish(po: PublishOpts): Promise<PublishResult> {
      const { gh, ref } = await ctx();
      const cwdOpt = opts.cwd === undefined ? {} : { cwd: opts.cwd };
      const { html } = await loadHtml(po.file, { maxBytes: MAX_HTML_BYTES, ...cwdOpt });
      const slug = slugFor(po);
      const path = `${slug}/index.html`;
      const message = `Publish ${slug}/index.html via @htmlbin/cli`;
      await commitBlobs(gh, ref, [{ path, content: html }], message);
      return {
        url: pagesUrl(ref.owner, ref.repo, slug),
        slug,
        note: "GitHub Pages rebuilds within ~60s after the commit lands.",
      };
    },

    async list(): Promise<DropSummary[]> {
      const { gh, ref } = await ctx();
      const slugs = await listTopLevelSlugs(gh, ref, /^pr-\d+$/);
      const now = new Date().toISOString();
      return slugs.map((s) => ({
        slug: s.slug,
        url: pagesUrl(ref.owner, ref.repo, s.slug),
        updated_at: now, // top-level tree read doesn't carry per-entry timestamps cheaply
      }));
    },

    async delete(slugOrPr: string): Promise<void> {
      const { gh, ref } = await ctx();
      const slug = /^\d+$/.test(slugOrPr) ? `pr-${slugOrPr}` : sanitizeSlug(slugOrPr);
      const r = await removeSubtree(gh, ref, slug, `Remove ${slug}/ via @htmlbin/cli`);
      if (r.removed === 0) {
        throw new CliError("not_found", `No entries under \`${slug}/\` on ${ref.branch}.`);
      }
    },

    async url(slugOrPr: string): Promise<string> {
      const { ref } = await ctx();
      const slug = /^\d+$/.test(slugOrPr) ? `pr-${slugOrPr}` : sanitizeSlug(slugOrPr);
      return pagesUrl(ref.owner, ref.repo, slug);
    },

    async setup(): Promise<SetupResult> {
      const { gh, ref } = await ctx();
      return setupGhPages(gh, { owner: ref.owner, repo: ref.repo }, { branch });
    },
  };
}

function sanitizeSlug(s: string): string {
  // Permit only safe path segments — no traversal, no spaces. Match the
  // Pages-side path conventions (lower- and upper-case alphanum, hyphen,
  // underscore, dot, optional single slash for feature/X style).
  const trimmed = s.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)?$/.test(trimmed)) {
    throw new CliError(
      "invalid_slug",
      `Invalid slug: ${s}. Use [A-Za-z0-9._-]+ (optionally with a single /).`
    );
  }
  return trimmed;
}
