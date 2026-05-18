// Pattern catalog — served at /.well-known/patterns/<name>.md and
// /.well-known/patterns/index.json. The skill teaches agents *the convention*
// (where patterns live on the user's filesystem, the file schema, the
// resolution order); this module is the official starter catalog the agent
// fetches when nothing is installed locally.
//
// Patterns are inlined as TypeScript string constants because wrangler 4
// does not reliably honor `[[rules]] type = "Text"` for `.md` imports
// outside `src/` (same gotcha that drove src/skill.ts and src/fonts-data.ts
// to do the same thing — see CLAUDE.md "Bundling non-JS assets" section).
//
// **Source of truth lives in patterns/<name>.md at the repo root.** Those
// files are what humans review in PRs. The constants below must mirror them
// byte-for-byte. When you edit a pattern, edit both files. A future build
// step (or a check in the e2e test) can enforce this — for now it's manual,
// matching the same arrangement as src/skill.ts ↔ skills/htmlbin/SKILL.md.

const PR_EXPLAINER_MD = `---
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
- (Optional) the full diff in a collapsed \`<details>\` block at the end
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

- Dump the raw diff inline at full length. Summarize, then drop the full diff in collapsed \`<details>\` at the end.
- Pretend to be GitHub. Don't embed screenshots of GitHub's chrome or replicate its UI.
- Skip the "why" paragraph. The motivation is the whole point of the drop — without it this is just a diff with prettier fonts.
- Auto-link to issues, commits, or files the PR description doesn't reference. No speculative linking.
`;

const SUMMARY_ROUNDUP_MD = `---
name: summary-roundup
description: Synthesize multiple sources into a digest — discussion threads, weekly status, incident timelines.
triggers:
  - summarize this thread
  - what are people saying about
  - round up the discussion
  - weekly status
  - sprint recap
  - incident postmortem
  - recap of
brand_sensing: true
---

# Summary / roundup

## When to use

When the content is synthesized from multiple inputs and the drop's job is to compress noise into signal without losing fidelity. Every claim is attributed; every quote is linked back. This covers public discussions (Reddit, HN, Twitter), recurring team digests (weekly status, sprint recaps), and event reconstructions (incident timelines).

## Content checklist

- Topic + one-sentence framing (what the reader should walk away knowing in ≤10 words)
- Source links with attribution — platform, community, author, date, count
- 2–4 themes / camps / sections — the bins the noise sorts into
- Direct quotes (verbatim, attributed, linked back). Never paraphrased.
- Points of consensus and disagreement where both exist
- A timeline if the discussion or events evolved
- (Optional) numbers — comment count, upvotes, severity, duration

## Layout directions

1. **Editorial roundup** — single-community discussion. Sources strip at the top, narrative body, quotes pulled inline as the reader hits them.
2. **Camps & quotes** — polarized or multi-faceted topics. 2–4 cards in a grid, each card a camp with a position summary + a representative attributed quote. A pull-quote section below for the big ones.
3. **Briefing memo** — cross-platform, fast-moving topics. Tight chronological structure; mono header; no decorative chrome.
4. **Status report** — recurring digests (weekly team updates, sprint recaps). Lighter on quotes, heavier on numbers and what-shipped lists. Group by area, not by person.
5. **Incident timeline** — minute-by-minute reconstruction. Dotted left rail; timestamps in mono; log excerpts in dark code blocks; follow-ups in a checklist callout at the end.

## How to pick

Source count + diversity of position + content type:

- 1 source, 1 community → **editorial roundup**
- 2+ camps with quotes → **camps & quotes**
- Multiple sources, fast-moving event → **briefing memo**
- Recurring team digest → **status report**
- Time-ordered incident reconstruction → **incident timeline**

## Don't

- Paraphrase quotes. Always quote verbatim and link back to the source.
- Include private handles or names unless they're public figures making a public statement.
- Misrepresent minority positions to make consensus look cleaner than it is.
- Strip out disagreement. If camps disagree, show that — don't smooth it over.
- Insert your own opinion. The synthesis is the value; editorial commentary isn't.
- Quote from anything the human hasn't explicitly shared with you.
`;

const PLAN_SPEC_EXPLAINER_MD = `---
name: plan-spec-explainer
description: Explain a plan, spec, or design document — context, plan body, files, verification, open questions.
triggers:
  - publish this plan
  - share this spec
  - make a page for this design doc
  - turn this plan.md into a webpage
  - publish this proposal
brand_sensing: true
---

# Plan / spec explainer

## When to use

When the source is a plan, spec, or design document — forward-looking, structural, often with multiple sub-systems. The drop's job is to make the plan readable and shareable without losing the author's voice or the technical scaffolding (file paths, code anchors, verification steps).

## Content checklist

- Title + one-line summary
- Author and drafted-at meta line
- **Context** — why this is happening (motivation, constraint, deadline, prior incident)
- The plan body — readable sections; sub-systems if any
- Critical files / paths with code anchors when the source has them
- Verification or test plan, if the plan has one
- Open questions, if any
- Preserve the author's voice — plans have personality; don't sanitize it out

## Layout directions

1. **Memo** — short single-section plans (<300 words). Table-of-contents up top, body below, footer with the source file path so a reader can find it locally.
2. **Stepped progression** — sequential implementation plans. Numbered steps in a vertical timeline; each step has prerequisite, deliverable, and verification mini-blocks.
3. **Spec with deep-dives** — longer plans covering multiple sub-systems. Main column + sticky right sidebar with TOC and status meta (status, scope, risk). Sub-systems as expandable cards (\`<details>\`).

## How to pick

Length + structural shape of the source:

- <300 words, single section → **memo**
- Numbered or explicitly sequenced steps → **stepped progression**
- Multi-section with sub-systems → **spec with deep-dives**

## Don't

- Dump every code anchor as a giant inline code block. Link or summarize; use collapsed \`<details>\` for the full thing.
- Pretend to be a GitHub README. The drop isn't a repo page.
- Strip out the human author's voice — that's what makes the plan readable in the first place.
- Auto-link to URLs not present in the source. Don't speculate.
- Include rationale that references internal incidents, customers, or people without the human's explicit OK. Plans often have sensitive context — ask before publishing it.
`;

type PatternMeta = {
  name: string;
  description: string;
  triggers: readonly string[];
};

const PATTERNS: ReadonlyArray<{ meta: PatternMeta; md: string }> = [
  {
    meta: {
      name: "pr-explainer",
      description:
        "A drop that explains a pull request — why, what changed, before/after, and a link back.",
      triggers: [
        "explain this pr",
        "summarize this diff",
        "make a page for this merge",
        "publish a pr writeup",
        "share this changelog",
      ],
    },
    md: PR_EXPLAINER_MD,
  },
  {
    meta: {
      name: "summary-roundup",
      description:
        "Synthesize multiple sources into a digest — discussion threads, weekly status, incident timelines.",
      triggers: [
        "summarize this thread",
        "what are people saying about",
        "round up the discussion",
        "weekly status",
        "sprint recap",
        "incident postmortem",
        "recap of",
      ],
    },
    md: SUMMARY_ROUNDUP_MD,
  },
  {
    meta: {
      name: "plan-spec-explainer",
      description:
        "Explain a plan, spec, or design document — context, plan body, files, verification, open questions.",
      triggers: [
        "publish this plan",
        "share this spec",
        "make a page for this design doc",
        "turn this plan.md into a webpage",
        "publish this proposal",
      ],
    },
    md: PLAN_SPEC_EXPLAINER_MD,
  },
];

export type PatternIndex = {
  version: string;
  patterns: Array<{
    name: string;
    description: string;
    triggers: readonly string[];
    url: string;
  }>;
};

const PATTERN_INDEX_VERSION = "1";

export function buildPatternIndex(publicUrl: string): PatternIndex {
  const host = publicUrl.replace(/\/$/, "");
  return {
    version: PATTERN_INDEX_VERSION,
    patterns: PATTERNS.map((p) => ({
      name: p.meta.name,
      description: p.meta.description,
      triggers: p.meta.triggers,
      url: `${host}/.well-known/patterns/${p.meta.name}.md`,
    })),
  };
}

// Looks up a pattern's markdown body by URL filename (e.g. "pr-explainer.md").
// Returns null for unknown names or non-.md filenames; the caller turns that
// into a canonical 404 via apiError().
export function getPatternMd(filename: string): string | null {
  if (!filename.endsWith(".md")) return null;
  const name = filename.slice(0, -3);
  const match = PATTERNS.find((p) => p.meta.name === name);
  return match ? match.md : null;
}

// Names only — useful for the e2e test and the future CLI patterns subcommand.
export function listPatternNames(): string[] {
  return PATTERNS.map((p) => p.meta.name);
}
