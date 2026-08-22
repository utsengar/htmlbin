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
---

# Session explainer

## When to use

When the source is an agent session — a transcript of work with a coding agent. The drop's job is to explain **how the author thought about a problem**, not to replay the conversation. The reader wants the reasoning; the transcript is raw material, not the deliverable.

**When not to use.** If the audience needs unedited proof that the work happened — a grant or accelerator application, an interview artifact, an audit — this pattern is the wrong tool and so is a drop. Those readers want the original file precisely because nobody curated it, and curation is this pattern's whole point. Say so and hand them the raw transcript instead.

Sessions worth publishing also tend to be the long ones, and a long transcript does not fit in a drop. Distilling isn't a stylistic preference here; it's the only thing that fits.

## Content checklist

- Title + a one-line statement of the problem
- Meta line: agent/tool, date, rough session length
- **The problem** — what was actually being solved, in the author's framing, before any solution
- **The approach** — and why that one, not the obvious alternative
- **Dead ends** — what was tried and abandoned, and what killed it. This is the highest-signal part of any session and the first thing a mechanical transcript renderer throws away. Don't skip it because it looks like failure; it's the reason the page is worth reading.
- Turning points, each with a short excerpt and a stable `id` anchor so a reader can link to one
- What shipped, with a link
- What the author would do differently

## Prose floor

Every drop is read by a human. Write like one wrote it:

- Name the actor — "the team decided", not "a decision was made"
- Cut throat-clearing openers ("Here's the thing:", "Let me be clear") — start with the point
- Delete emphasis crutches: "Full stop.", "Let that sink in.", adverbs like "really" / "literally"
- Skip binary-contrast drama ("Not because X. Because Y.") — just say Y
- Vary sentence length — three short staccato fragments in a row reads as manufactured urgency

## Redaction floor

Session transcripts are the single most credential-dense artifact on a developer's machine. Live API keys have been found in published session logs more than once. Every excerpt you include has to clear this list:

- **Scan for secrets.** API keys, bearer tokens, `.env` contents, database URLs, connection strings, signed URLs, private hostnames. High-entropy strings are guilty until proven innocent.
- **Strip absolute home paths.** `/Users/<name>/…` and `/home/<name>/…` leak identity and local layout. Rewrite as a repo-relative path.
- **Never publish an excerpt the human hasn't seen.** Sessions routinely contain customer names, unshipped work, internal URLs, and third-party code. Show them what you're including before it goes out.
- **Default to a passcode for anything team-internal** (`POST /api/drops/:slug/passcode`). Be honest with the human about what it is: a share gate, not encryption. The HTML is stored unencrypted.
- **If the session touched credentials at all, say so** and tell the human to rotate them — whether or not the value made it into the drop. The agent read them; that's enough.

## Layout directions

1. **Annotated walkthrough** — the default. Narrative prose carrying the story, with short collapsed `<details>` excerpts anchored at each turning point. Reads top to bottom.
2. **Decision log** — sessions whose value is a sequence of choices. One block per decision: what was considered, what was picked, why. Skimmable by decision, not by time.
3. **Problem → dead ends → resolution** — debugging sessions. Front-load the symptom, walk the failed hypotheses in order with what disproved each, land on the root cause.

## How to pick

Shape of the session, not its length:

- Exploration or a build with a clear arc → **annotated walkthrough**
- Several independent judgment calls → **decision log**
- One symptom chased to a root cause → **problem → dead ends → resolution**

## Don't

- Dump the raw transcript. It won't fit, and a wall of turns isn't a thing anyone reads.
- Include latency, token counts, or cost per step. Those are pipeline-debugging numbers borrowed from observability tools; this reader is here for the thinking. Shipping them reads as a pasted dashboard.
- Render a span tree or a nested waterfall. A coding session is essentially linear — a tree adds chrome and no meaning.
- Claim the page is complete, unedited, or tamper-evident. It's a curated account. If that distinction matters to the reader, point them at the source file.
- Sanitize the author's voice, including the parts where they were wrong. The wrong turns are the content.
- Quote a teammate, a customer, or a third party from the transcript without the human's explicit OK.
