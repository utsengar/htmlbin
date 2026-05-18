---
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
