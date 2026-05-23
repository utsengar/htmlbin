# Landing page redesign — design spec

- **Date:** 2026-05-23
- **Branch:** `landing-redesign-spec`
- **Status:** design approved by user; ready to convert to implementation plan
- **Scope:** `src/views/landing.ts`, `src/views/chrome.ts`, `src/styles.ts`. No API, schema, or auth changes.

## Why

htmlbin v1 launched with a deliberately tight landing — modeline + HTTP memo + hero + single dark prompt slab + 4 examples + signoff. Since launch we shipped material capability that the landing doesn't surface:

- **Queryable drop metadata** — first-class external IDs, filterable on `GET /api/drops`.
- **`@htmlbin/cli`** ([utsengar/htmlbin-cli](https://github.com/utsengar/htmlbin-cli)) — npm-installed binary, one verb, JSON for agents.
- **Patterns** — pluggable file-based templates for recurring drop kinds.

A developer landing today on htmlbin.dev has no way to discover any of this without reading `/api/onboard`.

## Positioning (the framing the page must honor)

**htmlbin is a general-purpose, agent-first HTML hosting tool.** Initial product-market fit lives with developers. Long-term it should welcome anyone sharing work or ideas online.

**CI is one example use case, not the central pitch.** Earlier draft framed the new section as *"Built for CI"* — wrong. The CLI's README leads with CI/GitHub Actions, but that's the README's wedge, not the product narrative. The landing must read as developer-first without becoming CI-only.

## Hard rules preserved (from CLAUDE.md)

1. One primary thing to copy. The hero's prompt slab stays the single primary CTA. The CLI tab is the *same* slab, the *same* CTA, just a different active panel — still "one thing to copy" semantics.
2. No new auth surface. No signup, login UI, dashboard, or account page added.
3. Don't over-index on Cloudflare. The new copy doesn't name Cloudflare.
4. Aesthetic stays in DESIGN.md. No new color, no new font, no new shadow vocabulary.
5. Don't introduce new keywords. "Drop" stays casual English; we don't invent a category.
6. Single source of truth for styles (`src/styles.ts`). New section reuses existing variables; minor additions only.
7. Never push direct to main. This change ships through a PR + Cloudflare preview URL + user approval + merge → wrangler deploy.

## What stays the same

- Modeline header (`<htmlbin> / GET /`). Wordmark, slash separator, red verb, ink path. Unchanged.
- HTTP memo (`<details class="req">`). Same rows, same default-open posture, same red triangle and 200 OK resline.
- Hero h1 and subtitle. Exact copy unchanged: *API for agents to share HTML.* / *Agent-native, end to end.*
- Prompt slab visual treatment: dark `--code-bg` slab, 14px border-radius, traffic-light dots top-left. The slab is the one deliberate exception to "no fake mac chrome" — that exception is preserved.
- Red `Copy prompt` CTA below the slab. Same hue, same uppercase mono label, same red glow shadow.
- Aftermath line: *First publish needs one human click; after that, the agent owns it.*
- "What people are building" cue copy: *↓ a few drops people have made.*
- All discoverability surfaces (`/api/onboard`, `agent-card`, `openapi.json`, `llms.txt`, etc.) remain unchanged.

## What changes

### 1. Header — add a CLI install pill

The header's right side (`.head-meta`) gains a clickable, dark, copy-to-clipboard pill alongside the existing `/api/onboard` link.

- Form: `$ npm i -g @htmlbin/cli` (decided over `npx @htmlbin/cli` — global install is what habituated devs expect).
- Visual: light surface (`--bg-2`) with a hairline `--rule` border. Ink dollar sign (`--ink-softer`), `--red` package name, ink-softer clipboard icon. On hover the border deepens to red and the background lifts to `#fff`. **Deliberately light** — dark chrome at the top of a light-paper page reads as jarring.
- Behavior: click copies `npm i -g @htmlbin/cli` to clipboard, brief green confirmation state.
- Mobile (`.head-meta { display: none }` at `<=720px`): hidden. Matches existing rule. Discoverability lives in the in-page `tool /` section for mobile users.

### 2. Prompt slab — replace `claude` pill with an agent / cli tab switcher

The static `claude` pill in the prompt chrome becomes a two-tab switcher: **agent** | **cli**.

- Default-active: `agent` — preserves the existing experience for the page's primary audience.
- Tab visual: small mono buttons inside a `rgba(255,255,255,0.06)` capsule, active tab gets a `0.14` opacity wash for contrast. Both tabs share the same dark slab, same body padding.
- Click behavior: switches the visible `<pre>` panel; the red Copy CTA label below swaps `Copy prompt` ↔ `Copy command`; the copied text follows the active tab.
- Prompt cue line updates: from *↓ paste into your agent* to *↓ paste into your agent — or pop open a terminal* (acknowledges the second tab exists).

**Agent tab content** — unchanged from current production:

```
Make a delightful HTML page to explain a concept or a problem — show me what
HTML can do that markdown or a flat file can't. Something visual, interactive,
alive.

Publish to htmlbin.dev. Credentials and API at htmlbin.dev/api/onboard.
```

**CLI tab content** — uses `npx` form so it works without install (zero-commitment trial):

```
# one-time — GitHub device-code, ~30s
$ npx @htmlbin/cli login

# every publish
$ npx @htmlbin/cli publish ./out.html
→ https://htmlbin.dev/p/aB3xK7g
```

Note the deliberate divergence: the prompt CLI tab uses `npx` (no install assumed) so it copies-and-runs for newcomers. The `tool /` section's main block (below) uses the post-install `htmlbin` form, since that section walks through the proper setup including the global install.

### 3. NEW — `tool /` section

A new section between the prompt aftermath line and the examples list. Telegraphs that there's a CLI, demonstrates the install/login/publish flow end-to-end, and surfaces four general-purpose capabilities.

**Anatomy**, top to bottom:

1. Eyebrow: mono, uppercase, red — `tool /`
2. Lede (sans-serif, 24px, semibold, slight negative letter-spacing): *Or pop open a terminal.*
3. Sub (sans-serif, 15.5px, ink-soft): *The CLI is your one-verb shortcut to the API — versioning, tags, patterns, passcodes, all in one binary.*
4. Dark spine code block (`--code-bg`, 8px radius, mono 13/1.85, dim comments, code-em accents). Three blank-separated stages — install, login, publish:

   ```
   # install
   $ npm i -g @htmlbin/cli

   # one-time — GitHub device-code, ~30s
   $ htmlbin login

   # publish anything
   $ htmlbin publish ./out.html
   → https://htmlbin.dev/p/aB3xK7g
   ```

   Top-right of the block: small `[copy]` button (`rgba(255,255,255,0.08)` background, mono 11) that copies the entire setup string.
5. Sub-cue: mono, uppercase, ink-softer — *— and there's more under the hood*
6. Capability tile grid — see §4 below.
7. Tool foot: small mono link strip — *@htmlbin/cli on github · full readme · node 20+*

### 4. NEW — capability tile grid (the breadth proof)

A 2×2 grid surfaces four general-purpose features. The features were chosen for being cross-cutting (useful regardless of use case) rather than CI-specific.

**Layout discipline** (this was the second-pass fix after the first mock came back unbalanced):

- `grid-auto-rows: 1fr` and `grid-template-columns: 1fr 1fr` enforce equal row and column heights.
- Each tile is a flex column with the mini-code block pinned to the bottom (`margin: auto 0 0`). Prose flexes to fill whatever vertical space remains.
- Strict copy budget: every tile is exactly **2 lines of prose** + **3 lines of mono code**. No tile gets a blank line between commands; no tile gets a third trailing prose sentence.
- Tile borders form one grid (top + left borders on the container; right + bottom on each tile). No double rules.
- Eyebrow chrome: small red dot + uppercase mono label.
- Headline: sans-serif 17px semibold.
- Prose: 14px ink-soft, ~14-16 words. Embedded `<code>` allowed for one term (`?v=N`, etc.).
- Mini-code: 12px mono on `--bg-2` with hairline `--rule` border, 4px radius, `white-space: pre` (preserves every space — fixes the `list --filter` glue bug we hit on first pass).
- Mobile (`<600px`): grid collapses to 1 column, mini-code switches to `pre-wrap`.

**The four tiles** (eyebrow / headline / prose / code):

#### `versions /` — Iterate. Slug stays put.

> Every publish mints a new version of the same drop. Pin any past one with `?v=N`.

```
# republish — same slug, v2 lands
$ htmlbin publish ./out.html
→ /p/aB3xK7g (v2)
```

#### `tags & queries /` — Find drops by anything.

> Attach any string tag at publish; query your library by any combination, anytime.

```
# tag and query — any string keys
$ htmlbin publish ./out.html --tag kind=plan
$ htmlbin list --filter kind=plan
```

#### `patterns /` — Pluggable templates.

> Pre-shaped drop kinds for recurring use cases. Install the catalog or write your own.

```
# grab the official catalog
$ htmlbin patterns init
$ htmlbin patterns add pr-explainer
```

#### `passcodes /` — Share-gate any drop.

> Public by default. Drop a passcode in front of the viewer when it shouldn't be open.

```
# gate a drop
$ htmlbin publish ./out.html \
   --passcode hunter2
```

**Out-of-scope (capabilities we considered, deliberately left for later):**

- **context** (per-version agent reasoning trace) — too inside-baseball for a landing.
- **raw HTML** (`/p/<slug>/raw`) — composition tool, not a flagship feature.
- **OG cards** (auto-generated PNG) — invisible-good-thing; doesn't earn a tile.
- **CLI backends** (cloud / gh-pages / cloudflare) — niche; lives in the CLI README.

**CLI flag dependency:** the mini-code examples assume the CLI exposes `--tag k=v`, `--filter k=v`, and `--passcode`. The CLI repo's current README documents `--passcode` already; it does not currently document `--tag` / `--filter`. Those flags are required for the queryable-metadata story on this landing to be honest. **This spec assumes the CLI ships those flags before this landing change merges to main.** The implementation plan should reflect that ordering constraint or substitute a different demo for the `tags & queries` tile if the CLI work slips.

### 5. EVOLVED — examples list with a `kind` column

The existing examples list keeps its mono two-column shape but gains a third column: a small right-aligned uppercase `kind` label that signals the *range* of what drops can be.

- Grid: `13ch 1fr 14ch`, mono throughout, 13px (slug + caption), 10.5px (kind) with `letter-spacing: 0.06em`.
- Whole row remains a single `<a>` — hovering anywhere turns the slug, caption, and kind all red.
- Mobile (`<600px`): kind column hidden, grid collapses to `11ch 1fr` (matches current production rule).

**Five seed entries** showing breadth:

| slug | caption | kind |
| --- | --- | --- |
| `/p/gDMy7Vb` | how htmlbin works — an animated explainer | EXPLAINER |
| `/p/1Wyf23j` | cross-platform gstack — pr #1111 deep dive | PR WRITEUP |
| `/p/ztx4J9P` | workers nav — three redesigns side by side | DESIGN |
| `/p/i2taphP` | google logo — animation playground | PLAYFUL |
| `/p/HYmZ6DjCM` | plan: queryable drop metadata | PLAN / SPEC |

Captions are now slightly richer (e.g. "an animated explainer" rather than just "how htmlbin works"). The fifth entry — the queryable-metadata plan drop — is new and reinforces that drops can be plan/spec writeups.

The `EXAMPLES` array in `src/views/landing.ts` gains a `kind` field per item. The render template gains the third column.

### 6. NEW — merged footer (replaces signoff + tail)

Today the page bottom has *two* near-identical mono strips: `signoff` inside `<main>` (`— htmlbin · agent-card · /api/onboard`) and `<footer class="tail">` (`htmlbin.dev · Project by @utsengar`). With the new tool section above, the visual duplication becomes obvious.

**Merge into one row.** Single mono strip with one top border-rule:

```
— htmlbin             agent-card · /api/onboard · @utsengar
```

- Left: `— htmlbin` (red em-dash, ink sigil — same treatment as today).
- Right: three mono links in one cluster: `agent-card`, `/api/onboard`, `@utsengar`. Dots between them are `--ink-softer`.
- `htmlbin.dev` text is dropped — redundant with the address bar.
- The `<footer class="tail">` block goes away. The merged row lives inside `<main>` as the signoff did.

## Implementation file map

| File | Change |
| --- | --- |
| `src/views/landing.ts` | (a) Prompt cue copy update. (b) Prompt slab markup: replace `prompt-mark` button with `tabs` (agent + cli) plus a separate `copy-mark` button; add two `tab-panel` divs. (c) Insert new `tool /` section between aftermath line and examples section. (d) `EXAMPLES` array: add `kind` field per item; append plan-spec entry. (e) Examples render template: add `<span class="kind">` column. (f) Replace `signoff + pageFoot()` with one merged-footer block; drop the `<footer class="tail">` call. (g) JS: tab-switch handler updates active panel + CTA label + copied text; new copy handlers for header pill and tool-block copy button. |
| `src/views/chrome.ts` | (a) `pageHead()` `head-meta` gains the CLI install pill (`<button class="cli-pill">`) before the `/api/onboard` link. (b) `pageFoot()` either deleted or repurposed; landing stops calling it. Other pages calling `pageFoot()` need a separate decision (see Open Questions). |
| `src/styles.ts` | New classes: `.cli-pill`, `.tabs`, `.tab`, `.tab.active`, `.tab-panel`, `.term-block`, `.term-copy`, `.caps`, `.cap` family, `.term-foot`, `.footer-merged`. Modify `.examples a` grid-template-columns to three columns; add `.examples a .kind`. Existing `.signoff` and `footer.tail` either removed or merged. Mobile breakpoints updated to match new structures. |

## Out of scope

- Building the queryable-drop-metadata API feature itself (separate plan, already approved).
- Building `--tag`, `--filter`, and `--passcode` flags in `@htmlbin/cli` (separate work in `htmlbin-cli` repo; this landing change should not merge until those ship).
- Account/dashboard/login UI (Hard Rule #4).
- DESIGN.md edits. The aesthetic isn't shifting — only the page's section layout.
- New illustrations, animations, or images. The page remains type+code+rule based.

## Verification

- **PR preview:** GitHub Actions runs `wrangler versions upload`; user tests against the posted Cloudflare preview URL before merge. (Mandatory per Hard Rule #7.)
- **Manual desktop:**
  - Header pill copies the install command, flashes green.
  - Prompt slab tab switcher toggles content + CTA label.
  - Tool-section copy button copies the full setup string.
  - Capability tiles all four equal height; no `list--filter` glue artifact.
  - Examples list shows the kind column right-aligned.
  - Merged footer is one row; no second footer below.
- **Manual mobile (<=720px):**
  - Header `head-meta` (including new pill) hidden, breadcrumb intact.
  - Capability grid collapses to 1 column.
  - Examples list collapses to 2 columns (slug + caption), kind hidden.
  - Merged footer wraps cleanly.
- **Type check:** `npm run typecheck` (existing CI gate).
- **E2E:** `npm run test:e2e` continues to pass. The script tests API + auth flow, not landing markup, so no new assertions are required.
- **Performance:** new section adds ~3KB of HTML and ~1KB of CSS. No new fonts, no new JS dependencies, no new network requests.

## Open questions for the implementation plan

1. **`pageFoot()` deletion vs repurposing.** The merged footer replaces the tail on the landing page. Other pages (`/verify`, `/p/:slug` viewer, `/manifesto`, `/404`, etc.) may still call `pageFoot()`. The plan should decide per-page whether to (a) keep `pageFoot()` for non-landing pages, (b) merge all pages' signoff/footer the same way as the landing, or (c) delete `pageFoot()` if no callers remain.

2. **CLI flag readiness gate.** The capability tiles reference `htmlbin publish --tag k=v` and `htmlbin list --filter k=v`. These flags need to exist in `@htmlbin/cli` when this landing change deploys. The plan should specify: ship CLI flags first → bump CLI minor version → then merge this landing change. If timing slips, the `tags & queries` tile copy needs a fallback (e.g. show the raw `curl … /api/drops?metadata.k=v` form).

3. **Examples list — 4 vs 5 entries.** Current is 4; spec proposes 5 (adds the plan-spec entry). Verify the fifth row doesn't make the page feel padded. Easy A/B once the preview URL is up.

4. **Mobile pill placement.** The header `head-meta` (now containing the CLI pill) is hidden at `<=720px`. The `tool /` section below is mobile users' primary path to the install command. Confirm that's acceptable, or consider surfacing the pill in the mobile breadcrumb area.

5. **Sentry instrumentation.** The new tab switcher, copy buttons, and capability tiles are new interactions. No new Sentry spans planned, but worth confirming `script-src` CSP in `src/index.ts` doesn't need updating (it shouldn't — all new JS is inline + the existing Sentry loader).

## Next step

When this spec is approved, transition to the `writing-plans` skill to convert it into an implementation plan (file-by-file checklist, test plan, ordering constraints around the CLI flag dependency, etc.).
