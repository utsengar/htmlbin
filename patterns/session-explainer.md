---
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

Fill every `SLOT_*` placeholder and each `<!-- SLOT: ... -->` region. The template's CSS is split by a marked line: adapt the **BRAND TOKENS** block, treat everything under **STRUCTURE** as fixed.

If you cannot fetch the template, build the same structure from the requirements below. Do not substitute a different one.

## Required structure

All six are mandatory. A page missing any of them is not this pattern.

1. **A sticky left rail** (`.rail`) holding the session's numbers and context. It stays on screen while the content column scrolls, so the reader keeps the session's identity while reading any one part.
2. **Three tabs** — `Highlights` (`#p1`, default), `Dead ends` (`#p2`), `Trace` (`#p3`). Driven by `:target` and `:has()`, never JavaScript.
3. **A compressed timeline** in Highlights. One line per step. This is the index to the whole session.
4. **One card per dead end** in the second tab, `id="dead-N"`.
5. **Deep links from timeline to cards.** A timeline row that has a card is an `<a href="#dead-N">` whose gutter reads `dead-N →`. Clicking it switches tab, scrolls to the card, and rings it. Rows without a card stay a `<div>` and get a plain gutter label.
6. **A trace panel** in the third tab: every turn of the session in order, both sides. See below.

## The trace panel

Highlights is an editorial gloss and the cards are narrative. Neither shows what actually happened in sequence, which is the thing a reader most often wants and the thing hardest to fake. The trace panel is that sequence.

**Ship the input whole and compress the output.** This is the asymmetry that makes it fit, and it comes out of measurement rather than taste. Count both sides of a real session before deciding what to cut: the human's side is usually a rounding error. In the session that produced this pattern, 38 prompts came to about 1,600 words against a 12.2 MB transcript — roughly 0.08% of the bytes. So every prompt ships complete, and the agent's side is what gets budgeted.

Per turn, show:

- **Turn number and timestamp**, with a stable `id="tN"` anchor so a reader can link to one turn
- **The human's prompt**, complete. Collapse it behind a `<details>` above ~40 words, never truncate it away
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

Every value in the rail comes from the transcript. Count it; never estimate, never round for effect. **Omit a tile rather than guess** — a wrong number is worse than a missing one. Mark at most one tile `.hot`, and only when it carries the page's central constraint.

Required in the context block: `agent`, `model`. Add `window`, `repo`, `outcome` when known.

## Hard limits

| Thing | Limit |
|---|---|
| Insights | 2–4 items, **150 words total** |
| Timeline rows | 8–16, one line each |
| Dead-end cards | 2–6 |
| Trace turns | every one, no cap |
| Agent reply per turn | collapsed by default |
| Lede | 2 sentences |
| `<script>` tags | **0** |
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

- **Scan for secrets.** API keys, bearer tokens, `.env` contents, database URLs, connection strings, signed URLs, private hostnames. High-entropy strings are guilty until proven innocent.
- **Strip absolute home paths.** `/Users/<name>/…` and `/home/<name>/…` leak identity and local layout. Rewrite as repo-relative.
- **Never publish an excerpt the human hasn't seen.** Sessions routinely contain customer names, unshipped work, internal URLs, and third-party code. For a trace panel this means the whole panel, both sides. It is a short read: the human's side of a long session is usually under 2,000 words.
- **Third parties don't get published by default.** A named customer, colleague, or company that came up mid-session has not agreed to appear on a public page. Cut and mark, and ask before restoring. The same goes for the human's own employer and job title unless they put them there.
- **Default to a passcode for anything team-internal** (`POST /api/drops/:slug/passcode`). Be honest that it's a share gate, not encryption — the HTML is stored unencrypted.
- **If the session touched credentials at all, say so** and tell the human to rotate them, whether or not the value reached the drop.

## Brand sensing is colors only

`brand_scope: colors-only` — narrower than other patterns. Apply the user's palette and type to the BRAND TOKENS block. Keep **one** accent; failures and the active tab are the only elements that wear it. Do not add a second hue to color-code phases: the phase label carries the meaning, and a multi-hue badge set needs a validated categorical palette.

Structure does not adapt to brand. A session explainer should be recognizable as one.

## Conformance check

Before publishing, verify each of these against the rendered page. Every one is checkable, so check it rather than assuming.

**One tab is always hidden, and a hidden panel hides its own defects.** Elements inside `display: none` report zero width and height, so an overflow or a small tap target in the inactive tab measures as passing. Run the layout checks twice, once per tab, or skip zero-size elements explicitly. A check that silently measures nothing is worse than no check.

- `.rail` exists and is `position: sticky` above 760px
- `#p1`, `#p2` and `#p3` all exist; `#p1` shows by default
- Exactly one tab reads as active in every state, including `#p3` and a `.card` deep link. A `:not(:has(#id))` default rule inherits the id's specificity, so adding a third tab without adding it to that rule leaves two tabs highlighted
- The trace panel has one row per turn, each with a stable `id="tN"`
- Agent replies are `<details>`, closed on load
- `document.querySelectorAll('script').length === 0`
- Every `a.row[href^="#dead-"]` resolves to a card with that `id`
- Every `.card[id]` is reachable from a timeline row
- Clicking a timeline link switches tab, scrolls to the card, and rings it
- Insight text is 150 words or fewer
- At 360px, **with each tab shown in turn**: no horizontal scroll, and no element wider than the viewport outside an `overflow-x` container
- Every visible `summary` and `.tabnav a` is at least 44px tall
- No `/Users/` or `/home/` string anywhere in the document
- Dark mode is defined with chosen steps, not an inversion

## Don't

- Dump the raw transcript. It won't fit, and a wall of turns isn't a thing anyone reads.
- Include latency, token counts, or cost per step. Those are pipeline-debugging numbers borrowed from observability tools; this reader is here for the thinking.
- Render a span tree or a nested waterfall. A coding session is essentially linear.
- Label the second tab "Full trace". It holds curated cards, not the trace. Promising a trace and showing four cards is a broken promise.
- Claim the page is complete, unedited, or tamper-evident. It's a curated account. If that distinction matters to the reader, point them at the source file.
- Quote a teammate, a customer, or a third party from the transcript without the human's explicit OK.
