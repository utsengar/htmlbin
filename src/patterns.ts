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

## Prose floor

Every drop is read by a human. Write like one wrote it:

- Name the actor — "the team decided", not "a decision was made"
- Cut throat-clearing openers ("Here's the thing:", "Let me be clear") — start with the point
- Delete emphasis crutches: "Full stop.", "Let that sink in.", adverbs like "really" / "literally"
- Skip binary-contrast drama ("Not because X. Because Y.") — just say Y
- Vary sentence length — three short staccato fragments in a row reads as manufactured urgency

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

## Prose floor

Every drop is read by a human. Write like one wrote it:

- Name the actor — "the team decided", not "a decision was made"
- Cut throat-clearing openers ("Here's the thing:", "Let me be clear") — start with the point
- Delete emphasis crutches: "Full stop.", "Let that sink in.", adverbs like "really" / "literally"
- Skip binary-contrast drama ("Not because X. Because Y.") — just say Y
- Vary sentence length — three short staccato fragments in a row reads as manufactured urgency

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

## Prose floor

Every drop is read by a human. Write like one wrote it:

- Name the actor — "the team decided", not "a decision was made"
- Cut throat-clearing openers ("Here's the thing:", "Let me be clear") — start with the point
- Delete emphasis crutches: "Full stop.", "Let that sink in.", adverbs like "really" / "literally"
- Skip binary-contrast drama ("Not because X. Because Y.") — just say Y
- Vary sentence length — three short staccato fragments in a row reads as manufactured urgency

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

const SESSION_EXPLAINER_MD = `---
name: session-explainer
description: Explain an agent session — the problem, the approach, the dead ends, and what the thinking actually was.
triggers:
  - publish this session
  - share this trace
  - share my claude code session
  - make a page from this transcript
  - publish my agent session
  - show my thinking on this
brand_sensing: true
brand_scope: colors-only
template: session-explainer.template.html
---

# Session explainer

## When to use

When the source is an agent session — a transcript of work with a coding agent. The drop's job is to explain **how the author thought about a problem**, not to replay the conversation. The reader wants the reasoning; the transcript is raw material, not the deliverable.

**When not to use.** If the audience needs unedited proof that the work happened — a grant or accelerator application, an interview artifact, an audit — this pattern is the wrong tool and so is a drop. Those readers want the original file precisely because nobody curated it, and curation is this pattern's whole point. Say so and hand them the raw transcript instead.

Sessions worth publishing also tend to be the long ones, and a long transcript does not fit in a drop. Distilling isn't a stylistic preference here; it's the only thing that fits.

## Start from the template, don't invent a layout

This pattern is **prescriptive**. Unlike the other official patterns it does not offer layout choices, because the structure is what makes these pages comparable to each other.

    curl -s https://htmlbin.dev/.well-known/patterns/session-explainer.template.html

Fill every \`SLOT_*\` placeholder and each \`<!-- SLOT: ... -->\` region. The template's CSS is split by a marked line: adapt the **BRAND TOKENS** block, treat everything under **STRUCTURE** as fixed.

If you cannot fetch the template, build the same structure from the requirements below. Do not substitute a different one.

## Required structure

All six are mandatory. A page missing any of them is not this pattern.

1. **A sticky left rail** (\`.rail\`) holding the session's numbers and context. It stays on screen while the content column scrolls, so the reader keeps the session's identity while reading any one part.
2. **Three tabs** — \`Highlights\` (\`#p1\`, default), \`Dead ends\` (\`#p2\`), \`Trace\` (\`#p3\`). Driven by \`:target\` and \`:has()\`, never JavaScript.
3. **A compressed timeline** in Highlights. One line per step. This is the index to the whole session.
4. **One card per dead end** in the second tab, \`id="dead-N"\`.
5. **Deep links from timeline to cards.** A timeline row that has a card is an \`<a href="#dead-N">\` whose gutter reads \`dead-N →\`. Clicking it switches tab, scrolls to the card, and rings it. Rows without a card stay a \`<div>\` and get a plain gutter label.
6. **A trace panel** in the third tab: every turn of the session in order, both sides. See below.

## The trace panel

Highlights is an editorial gloss and the cards are narrative. Neither shows what actually happened in sequence, which is the thing a reader most often wants and the thing hardest to fake. The trace panel is that sequence.

**Ship the input whole and compress the output.** This is the asymmetry that makes it fit, and it comes out of measurement rather than taste. Count both sides of a real session before deciding what to cut: the human's side is usually a rounding error. In the session that produced this pattern, 38 prompts came to about 1,600 words against a 12.2 MB transcript — roughly 0.08% of the bytes. So every prompt ships complete, and the agent's side is what gets budgeted.

Per turn, show:

- **Turn number and timestamp**, with a stable \`id="tN"\` anchor so a reader can link to one turn
- **The human's prompt**, complete. Collapse it behind a \`<details>\` above ~40 words, never truncate it away
- **The agent's reply**, collapsed by default, with its first line as the preview and a word count on the toggle so the reader knows what they are opening
- **What the turn did** — tool names with counts, files written, thinking-block count
- A link to the dead-end card if that turn earned one

**Tool results do not belong here.** They are the bulk of the megabytes and almost none of the meaning. Naming the tool and the count carries the information; pasting the output carries the weight.

Mark day boundaries when a session spans more than one, and say plainly when a turn produced no reply.

## Editing policy

"Verbatim" is the wrong promise. Prompts carry typos, and sessions occasionally touch things that should not be published. Three different problems, three different answers, and the page has to state which it applied:

- **Typos and dropped words: fix them silently.** No information lives in a misspelling.
- **Rambling, hedging, and changes of mind: keep them.** That is the thinking trail, and it is exactly what makes a trace worth more than a summary. A prompt that wandered should still read like it wandered. Smoothing it turns the trace back into the Highlights tab.
- **Sensitive or private spans: cut them and mark the cut.** Never silently reword. An unmarked edit makes every other line on the page unverifiable, which costs more credibility than the cut saves.

Keep the edits auditable rather than ambient: a per-turn marker on the turns you touched, and a one-line statement of the rule at the top of the panel. Do not describe the panel as verbatim if you edited it.

## Numbers must be measured

Every value in the rail comes from the transcript. Count it; never estimate, never round for effect. **Omit a tile rather than guess** — a wrong number is worse than a missing one. Mark at most one tile \`.hot\`, and only when it carries the page's central constraint.

Required in the context block: \`agent\`, \`model\`. Add \`window\`, \`repo\`, \`outcome\` when known.

## Hard limits

| Thing | Limit |
|---|---|
| Insights | 2–4 items, **150 words total** |
| Timeline rows | 8–16, one line each |
| Dead-end cards | 2–6 |
| Trace turns | every one, no cap |
| Agent reply per turn | collapsed by default |
| Lede | 2 sentences |
| \`<script>\` tags | **0** |
| Page weight | under 500 KB |

## Insights carry the page

The block under "what this session taught" is the reason someone reads this. It holds **transferable lessons** — what the next person should do differently.

A fact about the artifact is not a lesson. "The transcript is 4 MB", "two PRs were unplanned", "the suite has 136 checks" are trivia; they belong in the rail or nowhere. A lesson generalizes past this session.

Write them as plain sentences. No bold lead-in labels, no em dashes, no aphorisms ("X is not a Y", "X is the Y of Z") — state the concrete claim instead.

## Dead ends are the content

Most of the value is in what didn't work. For each: what was tried, what killed it, what it cost. Include the moment a conclusion flipped, and be specific about the wrong version — a reader learns from the reasoning error, not from the tidy ending.

Do not sanitize the author's voice, including the parts where they were wrong.

## Redaction floor

Session transcripts are the most credential-dense artifact on a developer's machine. Live API keys have been found in published session logs more than once.

**Scan the agent's replies, not just the human's prompts.** This is the part that gets missed. A prompt is short and the human wrote it, so it gets read carefully. The agent's side is fifteen times longer and nobody re-reads it — and it is where the employer name, the job title, the customer's real name, and the internal URL actually turn up, because the agent restated them while being helpful. Building this panel leaked all four on the first render, from replies rather than prompts.

Every excerpt, on either side, has to clear this list:

- **Scan for secrets.** API keys, bearer tokens, \`.env\` contents, database URLs, connection strings, signed URLs, private hostnames. High-entropy strings are guilty until proven innocent.
- **Strip absolute home paths.** \`/Users/<name>/…\` and \`/home/<name>/…\` leak identity and local layout. Rewrite as repo-relative.
- **Never publish an excerpt the human hasn't seen.** Sessions routinely contain customer names, unshipped work, internal URLs, and third-party code. For a trace panel this means the whole panel, both sides. It is a short read: the human's side of a long session is usually under 2,000 words.
- **Third parties don't get published by default.** A named customer, colleague, or company that came up mid-session has not agreed to appear on a public page. Cut and mark, and ask before restoring. The same goes for the human's own employer and job title unless they put them there.
- **Default to a passcode for anything team-internal** (\`POST /api/drops/:slug/passcode\`). Be honest that it's a share gate, not encryption — the HTML is stored unencrypted.
- **If the session touched credentials at all, say so** and tell the human to rotate them, whether or not the value reached the drop.

## Brand sensing is colors only

\`brand_scope: colors-only\` — narrower than other patterns. Apply the user's palette and type to the BRAND TOKENS block. Keep **one** accent; failures and the active tab are the only elements that wear it. Do not add a second hue to color-code phases: the phase label carries the meaning, and a multi-hue badge set needs a validated categorical palette.

Structure does not adapt to brand. A session explainer should be recognizable as one.

## Conformance check

Before publishing, verify each of these against the rendered page. Every one is checkable, so check it rather than assuming.

**One tab is always hidden, and a hidden panel hides its own defects.** Elements inside \`display: none\` report zero width and height, so an overflow or a small tap target in the inactive tab measures as passing. Run the layout checks twice, once per tab, or skip zero-size elements explicitly. A check that silently measures nothing is worse than no check.

- \`.rail\` exists and is \`position: sticky\` above 760px
- \`#p1\`, \`#p2\` and \`#p3\` all exist; \`#p1\` shows by default
- Exactly one tab reads as active in every state, including \`#p3\` and a \`.card\` deep link. A \`:not(:has(#id))\` default rule inherits the id's specificity, so adding a third tab without adding it to that rule leaves two tabs highlighted
- The trace panel has one row per turn, each with a stable \`id="tN"\`
- Agent replies are \`<details>\`, closed on load
- \`document.querySelectorAll('script').length === 0\`
- Every \`a.row[href^="#dead-"]\` resolves to a card with that \`id\`
- Every \`.card[id]\` is reachable from a timeline row
- Clicking a timeline link switches tab, scrolls to the card, and rings it
- Insight text is 150 words or fewer
- At 360px, **with each tab shown in turn**: no horizontal scroll, and no element wider than the viewport outside an \`overflow-x\` container
- Every visible \`summary\` and \`.tabnav a\` is at least 44px tall
- No \`/Users/\` or \`/home/\` string anywhere in the document
- Dark mode is defined with chosen steps, not an inversion

## Don't

- Dump the raw transcript. It won't fit, and a wall of turns isn't a thing anyone reads.
- Include latency, token counts, or cost per step. Those are pipeline-debugging numbers borrowed from observability tools; this reader is here for the thinking.
- Render a span tree or a nested waterfall. A coding session is essentially linear.
- Label the second tab "Full trace". It holds curated cards, not the trace. Promising a trace and showing four cards is a broken promise.
- Claim the page is complete, unedited, or tamper-evident. It's a curated account. If that distinction matters to the reader, point them at the source file.
- Quote a teammate, a customer, or a third party from the transcript without the human's explicit OK.
`;

const SESSION_EXPLAINER_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SLOT_TITLE - SLOT_SLUG - htmlbin.dev</title>
<!--
  session-explainer reference skeleton.

  Fill every SLOT_* placeholder and the <!-- SLOT: ... --> regions.
  Adapt the BRAND TOKENS block below to the user's project.
  Do not restructure anything under STRUCTURE: the rail, the two tabs,
  the timeline, and the cards are required by the pattern.

  Fetch the pattern itself for the rules and limits:
  https://htmlbin.dev/.well-known/patterns/session-explainer.md
-->
<style>
/* ══════════════════════════════════════════════════════════════════
   BRAND TOKENS — adapt these. Apply brand sensing here and nowhere else.
   Keep ONE accent. Failures and the active tab are the only things
   allowed to wear it.
   ══════════════════════════════════════════════════════════════════ */
:root{
  --bg:#FFFFFF; --bg-2:#FAFAFA; --bg-3:#F5F5F5;
  --ink:#0A0A0A; --ink-2:#171717; --ink-soft:#737373; --ink-softer:#A3A3A3;
  --rule:#E5E5E5; --rule-soft:#F0F0F0;
  --accent:#D93025; --accent-bg:#FCE8E6; --accent-stroke:#F4C7C3;
  --ok:#1F8F4A;
  --code-bg:#0A0A0A; --code-fg:#E8E8E8; --code-dim:#6E7681;
  --t-key:#FF7B72; --t-str:#A5D6FF; --t-num:#79C0FF; --t-fn:#D2A8FF; --t-ok:#7EE787;
  --sans:system-ui,-apple-system,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,monospace;
  --rail:264px;
}
@media (prefers-color-scheme:dark){
  /* Pick dark steps deliberately. Do not auto-invert. */
  :root{
    --bg:#0A0A0A; --bg-2:#121212; --bg-3:#1A1A1A;
    --ink:#F5F5F5; --ink-2:#E0E0E0; --ink-soft:#9A9A9A; --ink-softer:#6E6E6E;
    --rule:#242424; --rule-soft:#1A1A1A;
    --accent:#FF6470; --accent-bg:#2A1113; --accent-stroke:#4A1D21;
    --ok:#3FB950; --code-bg:#111111;
  }
}

/* ══════════════════════════════════════════════════════════════════
   STRUCTURE — fixed. Do not edit below this line.
   ══════════════════════════════════════════════════════════════════ */
*{box-sizing:border-box}
html,body{max-width:100vw;overflow-x:clip}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);
  font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
p{overflow-wrap:anywhere;margin:0 0 12px}
code{font-family:var(--mono);font-size:.87em;overflow-wrap:anywhere;
  background:var(--bg-3);padding:1px 5px;border-radius:3px}
a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-stroke)}
a:hover{border-bottom-color:var(--accent)}

.shell{display:grid;grid-template-columns:var(--rail) minmax(0,1fr);max-width:1240px;margin:0 auto}
.rail{position:sticky;top:0;align-self:start;height:100vh;overflow-y:auto;
  border-right:1px solid var(--rule);background:var(--bg-2);
  padding:20px 18px;display:flex;flex-direction:column;gap:18px}
.main{min-width:0;padding:30px 34px 40px}

.brand{font-family:var(--mono);font-size:12px;color:var(--ink-soft);line-height:1.9}
.brand b{color:var(--ink);font-weight:600;display:block;font-size:13px}
.brand .crumb{color:var(--ink-softer);font-size:11px}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--bg);
  border:1px solid var(--rule);border-radius:3px;padding:3px 8px;
  font-family:var(--mono);font-size:10.5px;color:var(--ink-soft);margin-top:8px}
.dot{width:6px;height:6px;border-radius:50%;background:var(--ok);flex:none}
.rlab{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.09em;
  color:var(--ink-softer);padding-bottom:7px;border-bottom:1px solid var(--rule);margin-bottom:2px}

.nums{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);
  border:1px solid var(--rule);border-radius:5px;overflow:hidden}
.nums .t{background:var(--bg);padding:9px 10px}
.nums .v{font-family:var(--mono);font-size:19px;font-weight:500;letter-spacing:-.02em;
  line-height:1.15;color:var(--ink)}
.nums .v small{font-size:11px;color:var(--ink-soft);font-weight:400}
.nums .l{font-family:var(--mono);font-size:9px;text-transform:uppercase;
  letter-spacing:.06em;color:var(--ink-softer);margin-top:3px}
.nums .t.hot .v{color:var(--accent)}

.mrows{font-family:var(--mono);font-size:11px}
.mrows div{padding:6px 0;border-bottom:1px solid var(--rule-soft)}
.mrows div:last-child{border-bottom:0}
.mrows k{display:block;color:var(--ink-softer);font-size:9px;text-transform:uppercase;
  letter-spacing:.07em;margin-bottom:2px}
.mrows v{color:var(--ink-2);overflow-wrap:anywhere}
.rfoot{margin-top:auto;font-family:var(--mono);font-size:10px;color:var(--ink-softer);
  border-top:1px solid var(--rule);padding-top:12px;line-height:1.6}

h1{font-size:clamp(27px,3.4vw,37px);line-height:1.13;letter-spacing:-.028em;
  margin:0 0 10px;font-weight:600}
.sub{font-size:17px;color:var(--ink-soft);margin:0 0 24px;max-width:64ch}
.sub b{color:var(--ink);font-weight:500}
.klab{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.09em;
  color:var(--ink-softer);margin:0 0 9px}
.keys{border-left:2px solid var(--accent);padding:2px 0 2px 15px;margin:0 0 6px}
.keys ul{margin:0;padding-left:17px}
.keys li{margin:12px 0;font-size:15px;line-height:1.6}
.keys li:first-child{margin-top:2px}
h2{font-size:16px;margin:34px 0 12px;font-weight:600;letter-spacing:-.01em;
  padding-bottom:6px;border-bottom:1px solid var(--rule-soft)}
h3{font-size:15px;margin:0;font-weight:600}

/* tabs: :target-driven so a highlight row can switch tab AND scroll. No JS. */
.tabs{margin:28px 0 0}
.tabnav{display:flex;gap:2px;border-bottom:1px solid var(--rule);margin-bottom:20px;flex-wrap:wrap}
.tabnav a{font-family:var(--mono);font-size:12px;padding:9px 13px;cursor:pointer;
  color:var(--ink-soft);border-bottom:2px solid transparent;margin-bottom:-1px;
  display:inline-flex;align-items:center;gap:7px;min-height:44px;text-decoration:none}
.tabnav a:hover{color:var(--ink)}
.tabnav a .n{background:var(--bg-3);border-radius:9px;padding:1px 6px;font-size:10.5px;
  color:var(--ink-softer)}
.panel{display:none}
#p1{display:block}
.panels:has(#p2:target) #p1{display:none}
.panels:has(#p2:target) #p2{display:block}
.panels:has(.card:target) #p1{display:none}
.panels:has(.card:target) #p2{display:block}
.panels:has(#p1:target) #p1{display:block}
.panels:has(#p1:target) #p2{display:none}
.panels:has(#p3:target) #p1{display:none}
.panels:has(#p3:target) #p2{display:none}
.panels:has(#p3:target) #p3{display:block}
.panels:has(#p2:target) #p3{display:none}
.panels:has(.card:target) #p3{display:none}
.tabs:not(:has(#p2:target)):not(:has(#p3:target)):not(:has(.card:target)) .tabnav a.h,
.tabs:has(#p1:target) .tabnav a.h,
.tabs:has(#p3:target) .tabnav a.r,
.tabs:has(#p2:target) .tabnav a.d,
.tabs:has(.card:target) .tabnav a.d{
  color:var(--ink);border-bottom-color:var(--accent);font-weight:500}
.tabs:not(:has(#p2:target)):not(:has(#p3:target)):not(:has(.card:target)) .tabnav a.h .n,
.tabs:has(#p1:target) .tabnav a.h .n,
.tabs:has(#p3:target) .tabnav a.r .n,
.tabs:has(#p2:target) .tabnav a.d .n,
.tabs:has(.card:target) .tabnav a.d .n{background:var(--accent-bg);color:var(--accent)}
.tabs:has(#p1:target) .tabnav a.d,
.tabs:has(.card:target) .tabnav a.h,
.tabs:has(#p3:target) .tabnav a.h,
.tabs:has(#p3:target) .tabnav a.d,
.tabs:has(#p2:target) .tabnav a.h{
  color:var(--ink-soft);border-bottom-color:transparent;font-weight:400}

.tl{border:1px solid var(--rule);border-radius:5px;overflow:hidden}
.row{display:grid;grid-template-columns:76px minmax(0,1fr) auto;gap:12px;align-items:baseline;
  padding:9px 13px;border-bottom:1px solid var(--rule-soft);font-size:14.5px}
.row:last-child{border-bottom:0}
.row:hover{background:var(--bg-2)}
.ph{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;
  color:var(--ink-soft);border:1px solid var(--rule);border-radius:3px;padding:2px 0;
  text-align:center;background:var(--bg-2)}
.ph.kill{color:var(--accent);border-color:var(--accent-stroke);background:var(--accent-bg)}
.row .t{color:var(--ink-2)}
.row .g{font-family:var(--mono);font-size:11px;color:var(--ink-softer);white-space:nowrap}
a.row{text-decoration:none;color:inherit;border:0}
a.row .g{color:var(--accent)}
a.row:hover{background:var(--bg-2)}
a.row:hover .t{color:var(--ink)}

figure{margin:24px 0}
figcaption{font-family:var(--mono);font-size:10.5px;color:var(--ink-softer);
  text-transform:uppercase;letter-spacing:.07em;margin:0 0 8px}
.brow{display:grid;grid-template-columns:128px minmax(0,1fr) 44px;gap:10px;align-items:center;
  padding:3px 0;font-family:var(--mono);font-size:12px}
.brow .nm{color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.track{display:block;background:var(--bg-3);border-radius:3px;height:9px;overflow:hidden}
.fill{display:block;height:9px;background:var(--accent);border-radius:0 3px 3px 0;min-width:2px}
.brow .vv{text-align:right;color:var(--ink-soft)}

.card{border:1px solid var(--rule);border-radius:5px;margin:14px 0;overflow:hidden;
  scroll-margin-top:16px}
.card>.hd{padding:11px 14px;background:var(--bg-2);border-bottom:1px solid var(--rule);
  display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.card>.bd{padding:13px 14px}
.card .bd>p:last-child{margin-bottom:0}
.card:target{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-bg)}
.tag{font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;
  color:var(--accent);background:var(--accent-bg);border:1px solid var(--accent-stroke);
  border-radius:3px;padding:1px 6px;white-space:nowrap}
.anch{font-family:var(--mono);font-size:10.5px;color:var(--ink-softer);border:0;margin-left:auto}
.anch:hover{color:var(--accent)}

pre{background:var(--code-bg);color:var(--code-fg);font-family:var(--mono);font-size:12.5px;
  line-height:1.7;padding:13px 15px;border-radius:5px;overflow-x:auto;margin:12px 0;
  border:1px solid var(--rule)}
.c{color:var(--code-dim)} .k{color:var(--t-key)} .s{color:var(--t-str)}
.n{color:var(--t-num)} .f{color:var(--t-fn)} .ok{color:var(--t-ok)}
.bad{color:var(--t-key);font-weight:600}

details.ex{border:1px solid var(--rule);border-radius:5px;margin:12px 0;background:var(--bg-2)}
details.ex>summary{cursor:pointer;list-style:none;padding:8px 13px;font-family:var(--mono);
  font-size:11.5px;color:var(--ink-soft);display:flex;justify-content:space-between;gap:10px;
  align-items:center;min-height:44px}
details.ex>summary::-webkit-details-marker{display:none}
details.ex>summary::after{content:"+";color:var(--ink-softer)}
details.ex[open]>summary::after{content:"\\2212"}
details.ex[open]>summary{border-bottom:1px solid var(--rule)}
details.ex .bd{padding:2px 13px 12px}
details.ex .bd pre{margin:10px 0 0}

.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:13px;margin:0}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--rule-soft)}
th{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.06em;
  color:var(--ink-softer);font-weight:500;border-bottom:1px solid var(--rule)}
td.num{font-family:var(--mono);white-space:nowrap}
tr.hot td{color:var(--accent);font-weight:500}

/* trace panel — both sides of every turn */
.tnote{font-size:13.5px;color:var(--ink-soft);border-left:2px solid var(--rule);
  padding-left:13px;margin:0 0 18px;max-width:70ch}
.tnote b{color:var(--ink)}
.trace{border:1px solid var(--rule);border-radius:5px;overflow:hidden}
.tday{font-family:var(--mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--ink-softer);background:var(--bg-2);padding:6px 13px;border-bottom:1px solid var(--rule)}
.turn{display:grid;grid-template-columns:52px minmax(0,1fr);gap:12px;padding:11px 13px;
  border-bottom:1px solid var(--rule-soft)}
.turn:last-child{border-bottom:0}
.turn:hover{background:var(--bg-2)}
.turn:target{background:var(--accent-bg)}
.tn{font-family:var(--mono);font-size:11px;color:var(--ink-softer);line-height:1.5}
.tn a{display:block;color:var(--ink-2);border:0;font-weight:500}
.tn a:hover{color:var(--accent)}
.tn span{display:block;font-size:10px}
.tb{min-width:0}
.rl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.07em;
  color:var(--ink-softer);border:1px solid var(--rule);border-radius:3px;padding:1px 4px;
  margin-right:7px;vertical-align:1px;white-space:nowrap}
.rl.you{color:var(--ink-2);border-color:var(--ink-softer)}
.tp{margin:0;font-size:14.5px;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere}
details.tp>summary{cursor:pointer;list-style:none;color:var(--ink);display:block;
  padding-right:16px;position:relative}
details.tp>summary::-webkit-details-marker{display:none}
details.tp>summary::after{content:"+";position:absolute;right:0;top:0;color:var(--ink-softer);
  font-family:var(--mono);font-size:12px}
details.tp[open]>summary::after{content:"\\2212"}
details.tp[open]>summary{color:var(--ink-softer);font-size:13px;margin-bottom:7px}
details.tp>div{white-space:pre-wrap;font-size:14.5px;color:var(--ink)}
details.tr{margin-top:7px}
details.tr>summary{cursor:pointer;list-style:none;font-size:13.5px;color:var(--ink-soft);
  display:block;padding-right:44px;position:relative;overflow:hidden;text-overflow:ellipsis;
  white-space:nowrap}
details.tr>summary::-webkit-details-marker{display:none}
details.tr>summary i{position:absolute;right:0;top:0;font-style:normal;font-family:var(--mono);
  font-size:10px;color:var(--ink-softer)}
details.tr>summary:hover{color:var(--ink)}
details.tr[open]>summary{white-space:normal;color:var(--ink-softer);margin-bottom:8px}
details.tr>div{white-space:pre-wrap;font-size:13.5px;line-height:1.6;color:var(--ink-2);
  background:var(--bg-2);border:1px solid var(--rule);border-radius:4px;padding:11px 13px;
  overflow-wrap:anywhere;max-height:420px;overflow-y:auto}
.tnoreply{margin:7px 0 0;font-size:13px;color:var(--ink-softer)}
.tm2{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-top:7px}
.tc,.tf,.ted{font-family:var(--mono);font-size:10px;border-radius:3px;padding:1px 5px;white-space:nowrap}
.tc{background:var(--bg-3);color:var(--ink-soft)}
.tc i{font-style:normal;color:var(--ink-softer);margin-left:3px}
.tc.tnone,.tc.tth{background:transparent;color:var(--ink-softer);padding-left:0}
.tf{border:1px solid var(--rule);color:var(--ink-softer);max-width:190px;overflow:hidden;
  text-overflow:ellipsis}
.ted{border:1px dashed var(--rule);color:var(--ink-softer)}
.tcut{border:1px solid var(--accent-stroke);background:var(--accent-bg);color:var(--accent);
  font-family:var(--mono);font-size:10px;border-radius:3px;padding:1px 5px}
.tdeep{font-family:var(--mono);font-size:10px;color:var(--accent);border:0;margin-left:auto}

@media (max-width:900px){
  :root{--rail:216px}
  .main{padding:24px 22px 36px}
  .brow{grid-template-columns:104px minmax(0,1fr) 40px}
}
@media (max-width:760px){
  .shell{grid-template-columns:1fr}
  .rail{position:static;height:auto;overflow:visible;border-right:0;
    border-bottom:1px solid var(--rule);padding:16px 20px;gap:14px}
  .nums{grid-template-columns:repeat(3,1fr)}
  .nums .t{padding:7px 9px}
  .nums .v{font-size:17px}
  .mrows{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
  .mrows div{padding:5px 0}
  .rfoot{margin-top:4px;padding-top:9px}
  .brand .crumb{font-size:10.5px}
  .main{padding:22px 20px 34px}
  .row{grid-template-columns:minmax(0,1fr) auto;gap:4px 9px;padding:10px 12px}
  .ph{grid-row:1;grid-column:1;justify-self:start;padding:2px 7px}
  .row .g{grid-row:1;grid-column:2;align-self:center;font-size:10.5px}
  .row .t{grid-row:2;grid-column:1/-1}
  .tabnav a{padding:9px 9px;font-size:11.5px;gap:5px}
  .brow{grid-template-columns:88px minmax(0,1fr) 34px;font-size:11px;gap:8px}
  .turn{grid-template-columns:1fr;gap:5px}
  .tn{display:flex;gap:8px}
  .tn a,.tn span{display:inline}
  .tf{max-width:140px}
}
@media (max-width:420px){
  .nums .v{font-size:16px}
  .nums .l{font-size:8.5px;letter-spacing:.04em}
  .mrows{gap:0 10px}
}
</style>
</head>
<body>
<div class="shell">

  <aside class="rail">
    <div class="brand">
      <b>SLOT_PROJECT</b>
      <span class="crumb">SLOT_CRUMB</span>
    </div>

    <div>
      <div class="rlab">session</div>
      <!-- SLOT: 4-6 measured numbers. Every one from the transcript, never estimated.
           Omit a tile rather than guess. Mark at most one .hot. -->
      <div class="nums">
        <div class="t"><div class="v">SLOT_N</div><div class="l">messages</div></div>
        <div class="t"><div class="v">SLOT_N</div><div class="l">tool calls</div></div>
        <div class="t"><div class="v">SLOT_N</div><div class="l">thinking</div></div>
        <div class="t"><div class="v">SLOT_N<small>h</small></div><div class="l">elapsed</div></div>
        <div class="t hot"><div class="v">SLOT_N<small>MB</small></div><div class="l">transcript</div></div>
        <div class="t"><div class="v">SLOT_N</div><div class="l">SLOT_LABEL</div></div>
      </div>
    </div>

    <div>
      <div class="rlab">context</div>
      <!-- SLOT: agent and model are required. Add window/repo/outcome when known. -->
      <div class="mrows">
        <div><k>agent</k><v>SLOT_AGENT</v></div>
        <div><k>model</k><v>SLOT_MODEL</v></div>
        <div><k>window</k><v>SLOT_WINDOW</v></div>
        <div><k>repo</k><v>SLOT_REPO</v></div>
      </div>
    </div>

    <div class="rfoot">
      pattern: session-explainer<br>
      published via htmlbin.dev
    </div>
  </aside>

  <main class="main">

    <h1>SLOT_TITLE</h1>
    <!-- SLOT: lede. One or two sentences. State the outcome, not the journey. -->
    <p class="sub">SLOT_LEDE</p>

    <div class="klab">what this session taught</div>
    <!-- SLOT: 2-4 transferable lessons, 150 words total across all of them.
         Each is a plain sentence. No bold lead-in labels. No em dashes.
         A fact about the artifact (file size, PR count) is not a lesson. -->
    <div class="keys"><ul>
      <li>SLOT_INSIGHT</li>
      <li>SLOT_INSIGHT</li>
      <li>SLOT_INSIGHT</li>
    </ul></div>

    <div class="tabs">
      <div class="tabnav">
        <a class="h" href="#p1">Highlights <span class="n">SLOT_N</span></a>
        <a class="d" href="#p2">Dead ends <span class="n">SLOT_N</span></a>
        <a class="r" href="#p3">Trace <span class="n">SLOT_N</span></a>
      </div>

      <div class="panels">
        <div class="panel" id="p1">
          <!-- SLOT: timeline. One line per step, 8-16 rows.
               Phase words: research / measure / decide / build / verify / ship
               Failure words (.kill): killed / blocked / caught
               A row with a matching card MUST be <a class="row" href="#dead-N">
               and its gutter MUST read "dead-N →". Rows without a card stay <div>. -->
          <div class="tl">
            <div class="row"><span class="ph">research</span><span class="t">SLOT_STEP</span><span class="g">SLOT_GUTTER</span></div>
            <a class="row" href="#dead-1"><span class="ph kill">killed</span><span class="t">SLOT_STEP</span><span class="g">dead-1 &rarr;</span></a>
            <div class="row"><span class="ph">ship</span><span class="t">SLOT_STEP</span><span class="g">SLOT_GUTTER</span></div>
          </div>

          <!-- SLOT (optional): one measured distribution. Single hue, direct labels,
               title= on each row. Omit entirely if you have nothing measured. -->
          <figure>
            <figcaption>SLOT_CAPTION</figcaption>
            <div class="bars">
              <div class="brow" title="SLOT_TOOLTIP"><span class="nm">SLOT_NAME</span><span class="track"><span class="fill" style="width:100%"></span></span><span class="vv">SLOT_N</span></div>
            </div>
          </figure>
        </div>

        <div class="panel" id="p2">
          <!-- SLOT: one .card per dead end, id="dead-N" matching the timeline hrefs.
               Tag words: killed / blocked / caught in review.
               Say what was tried, what killed it, what it cost. Raw excerpts go in
               details.ex, redacted per the pattern's redaction floor. -->
          <div class="card" id="dead-1">
            <div class="hd"><span class="tag">killed</span><h3>SLOT_DEAD_END_TITLE</h3><a class="anch" href="#dead-1">#dead-1</a></div>
            <div class="bd">
              <p>SLOT_WHAT_HAPPENED</p>
              <details class="ex"><summary><span>SLOT_EXCERPT_LABEL</span></summary><div class="bd">
<pre><span class="c"># SLOT: redacted excerpt. Repo-relative paths only.</span>
SLOT_EXCERPT</pre>
              </div></details>
            </div>
          </div>

          <h2>What I'd do differently</h2>
          <!-- SLOT: 2-4 lesson rows, each pointing back at the card that earned it. -->
          <div class="tl">
            <div class="row"><span class="ph">lesson</span><span class="t">SLOT_LESSON</span><span class="g">#dead-1</span></div>
          </div>
        </div>

        <div class="panel" id="p3">
          <!-- SLOT: one sentence stating the editing rule you applied, and what
               is not here. Do not call it verbatim if you edited it. -->
          <p class="tnote">Both sides of every turn, in order. <b>SLOT_EDIT_RULE</b>
          Tool results are not here, and that is most of the transcript's weight.</p>

          <div class="trace">
            <!-- SLOT: repeat one .turn per turn, in order. Day separators when the
                 session spans days. The human's prompt is complete; collapse it
                 above ~40 words rather than truncating. The agent's reply is
                 collapsed with its first line as the preview and a word count.
                 Add <span class="tcut">redacted</span> on any turn you cut from. -->
            <div class="tday">SLOT_DATE</div>
            <div class="turn" id="t1">
              <div class="tn"><a href="#t1">1</a><span>SLOT_TIME</span></div>
              <div class="tb">
                <p class="tp"><span class="rl you">you</span>SLOT_PROMPT</p>
                <details class="tr"><summary><span class="rl">agent</span>SLOT_REPLY_FIRST_LINE<i>SLOT_Nw</i></summary><div>SLOT_REPLY</div></details>
                <div class="tm2"><span class="tc">Bash<i>SLOT_N</i></span><span class="tf">SLOT_FILE</span><span class="tc tth">thinking<i>SLOT_N</i></span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </main>
</div>
</body>
</html>
`;

type PatternMeta = {
  name: string;
  description: string;
  triggers: readonly string[];
  /** Filename of an optional reference skeleton served beside the .md. */
  template?: string;
};

const PATTERNS: ReadonlyArray<{ meta: PatternMeta; md: string; template?: string }> = [
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
  {
    meta: {
      name: "session-explainer",
      description:
        "Explain an agent session — the problem, the approach, the dead ends, and what the thinking actually was.",
      triggers: [
        "publish this session",
        "share this trace",
        "share my claude code session",
        "make a page from this transcript",
        "publish my agent session",
        "show my thinking on this",
      ],
      template: "session-explainer.template.html",
    },
    md: SESSION_EXPLAINER_MD,
    template: SESSION_EXPLAINER_TEMPLATE,
  },
];

export type PatternIndex = {
  version: string;
  patterns: Array<{
    name: string;
    description: string;
    triggers: readonly string[];
    url: string;
    /** Present only for prescriptive patterns that ship a reference skeleton. */
    template_url?: string;
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
      ...(p.meta.template
        ? { template_url: `${host}/.well-known/patterns/${p.meta.template}` }
        : {}),
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

// Resolves any file served under /.well-known/patterns/ — the pattern markdown
// and, for prescriptive patterns, a reference skeleton (`<name>.template.html`).
// Returns the body plus the content type so the route doesn't have to guess.
// Null for anything unknown, which the caller turns into a canonical 404.
export function getPatternAsset(
  filename: string,
): { body: string; contentType: string } | null {
  const md = getPatternMd(filename);
  if (md) return { body: md, contentType: "text/markdown; charset=utf-8" };

  const match = PATTERNS.find(
    (p) => p.template && p.meta.template === filename,
  );
  // Deliberately text/plain, not text/html. Cloudflare's automatic HTML
  // rewriting appends the Web Analytics beacon to any text/html response, and
  // an agent that fills in this skeleton would upload that <script> as part of
  // the drop body — stored user content, with a pinned SRI hash that breaks
  // when the beacon rotates. It also contradicts the pattern's own rule of
  // zero script tags. The skeleton is source to copy, not a page to render, so
  // text/plain is both the fix and the honest content type. (Same reason the
  // .md above is unaffected: non-HTML responses aren't rewritten.)
  return match?.template
    ? { body: match.template, contentType: "text/plain; charset=utf-8" }
    : null;
}

// Names only — useful for the e2e test and the future CLI patterns subcommand.
export function listPatternNames(): string[] {
  return PATTERNS.map((p) => p.meta.name);
}
