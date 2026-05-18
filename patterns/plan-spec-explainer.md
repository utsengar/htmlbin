---
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
3. **Spec with deep-dives** — longer plans covering multiple sub-systems. Main column + sticky right sidebar with TOC and status meta (status, scope, risk). Sub-systems as expandable cards (`<details>`).

## How to pick

Length + structural shape of the source:

- <300 words, single section → **memo**
- Numbered or explicitly sequenced steps → **stepped progression**
- Multi-section with sub-systems → **spec with deep-dives**

## Don't

- Dump every code anchor as a giant inline code block. Link or summarize; use collapsed `<details>` for the full thing.
- Pretend to be a GitHub README. The drop isn't a repo page.
- Strip out the human author's voice — that's what makes the plan readable in the first place.
- Auto-link to URLs not present in the source. Don't speculate.
- Include rationale that references internal incidents, customers, or people without the human's explicit OK. Plans often have sensitive context — ask before publishing it.
