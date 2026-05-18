---
name: pr-explainer
description: A drop that explains a pull request — why, what changed, before/after, and a link back.
triggers:
  - explain this pr
  - summarize this diff
  - make a page for this merge
  - publish a pr writeup
  - share this changelog
brand_sensing: true
---

# PR explainer

## When to use

When the human asks to share or publish a writeup of a pull request, a merge commit, or a diff. The drop's job is to be a two-minute read for a reviewer or stakeholder: what changed, why it mattered, and what the measured impact was.

## Content checklist

- Title and a one-line "why this exists" summary
- A real prose paragraph for the motivation — not just bullets
- Files touched (small inline table; path + delta)
- Before/after on measurable changes — perf numbers, output diffs, screenshots
- A link back to the source PR
- (Optional) the full diff in a collapsed `<details>` block at the end
- (Optional) a single pull-quote from the PR description if there's a great one

## Layout directions

1. **Centered memo** — small PRs (≤3 files, no visual change). Tight single column (~680px), HTTP-memo block up top, numbered sections.
2. **Split before/after** — visual or UI PRs where seeing the change matters more than reading it. Two columns at desktop, stacked on mobile.
3. **Commit timeline** — multi-commit refactors. Dotted vertical rail showing the sequence; each commit gets a short block with its own one-liner.

## How to pick

Count files + presence of visual diff:

- 1–3 files, no visual change → **centered memo**
- Any visual/UI change → **split before/after**
- Many commits across a refactor → **commit timeline**

## Don't

- Dump the raw diff inline at full length. Summarize, then drop the full diff in collapsed `<details>` at the end.
- Pretend to be GitHub. Don't embed screenshots of GitHub's chrome or replicate its UI.
- Skip the "why" paragraph. The motivation is the whole point of the drop — without it this is just a diff with prettier fonts.
- Auto-link to issues, commits, or files the PR description doesn't reference. No speculative linking.
