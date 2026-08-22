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
brand_sensing: colors-only
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

All five are mandatory. A page missing any of them is not this pattern.

1. **A sticky left rail** (`.rail`) holding the session's numbers and context. It stays on screen while the content column scrolls, so the reader keeps the session's identity while reading any one part.
2. **Two tabs** — `Highlights` (`#p1`, default) and `Dead ends` (`#p2`). Driven by `:target` and `:has()`, never JavaScript.
3. **A compressed timeline** in Highlights. One line per step. This is the index to the whole session.
4. **One card per dead end** in the second tab, `id="dead-N"`.
5. **Deep links from timeline to cards.** A timeline row that has a card is an `<a href="#dead-N">` whose gutter reads `dead-N →`. Clicking it switches tab, scrolls to the card, and rings it. Rows without a card stay a `<div>` and get a plain gutter label.

## Numbers must be measured

Every value in the rail comes from the transcript. Count it; never estimate, never round for effect. **Omit a tile rather than guess** — a wrong number is worse than a missing one. Mark at most one tile `.hot`, and only when it carries the page's central constraint.

Required in the context block: `agent`, `model`. Add `window`, `repo`, `outcome` when known.

## Hard limits

| Thing | Limit |
|---|---|
| Insights | 2–4 items, **150 words total** |
| Timeline rows | 8–16, one line each |
| Dead-end cards | 2–6 |
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

Session transcripts are the most credential-dense artifact on a developer's machine. Live API keys have been found in published session logs more than once. Every excerpt has to clear this list:

- **Scan for secrets.** API keys, bearer tokens, `.env` contents, database URLs, connection strings, signed URLs, private hostnames. High-entropy strings are guilty until proven innocent.
- **Strip absolute home paths.** `/Users/<name>/…` and `/home/<name>/…` leak identity and local layout. Rewrite as repo-relative.
- **Never publish an excerpt the human hasn't seen.** Sessions routinely contain customer names, unshipped work, internal URLs, and third-party code.
- **Default to a passcode for anything team-internal** (`POST /api/drops/:slug/passcode`). Be honest that it's a share gate, not encryption — the HTML is stored unencrypted.
- **If the session touched credentials at all, say so** and tell the human to rotate them, whether or not the value reached the drop.

## Brand sensing is colors only

`brand_sensing: colors-only` — narrower than other patterns. Apply the user's palette, and type to the BRAND TOKENS block. Keep **one** accent; failures and the active tab are the only elements that wear it. Do not add a second hue to color-code phases: the phase label carries the meaning, and a multi-hue badge set needs a validated categorical palette.

Structure does not adapt to brand. A session explainer should be recognizable as one.

## Conformance check

Before publishing, verify each of these against the rendered page. Every one is checkable, so check it rather than assuming.

**One tab is always hidden, and a hidden panel hides its own defects.** Elements inside `display: none` report zero width and height, so an overflow or a small tap target in the inactive tab measures as passing. Run the layout checks twice, once per tab, or skip zero-size elements explicitly. A check that silently measures nothing is worse than no check.

- `.rail` exists and is `position: sticky` above 760px
- Both `#p1` and `#p2` exist; `#p1` shows by default
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
