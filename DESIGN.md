# DESIGN — htmlbin

The visual and tonal system for htmlbin.dev. One source of truth for
typography, palette, components, page anatomy, and (just as importantly)
what we deliberately don't do. Touch [`src/styles.ts`](./src/styles.ts)
and every page in this app reflects the change.

---

## 0. Two surfaces, one vocabulary

**Read this before editing anything else.** The product has two visual
systems, on purpose, and they are not interchangeable:

| | **Landing** (`/`) | **App chrome** (everything else) |
|---|---|---|
| Job | convince a stranger in ten seconds | get out of the way of the work |
| Pages | `/` only | `/verify`, `/p/:slug`, the passcode gate, `/404` |
| Surface | `--page` `#F4F5F6` + dot texture | pure white |
| Layout | centred, 1080px shell | left-aligned, 720px single column |
| Header | real nav + one solid button (`.lnav`) | mono breadcrumb (`.page-head`) |
| Opens with | display headline + subhead | the HTTP memo (`details.req`) |
| Prefix | `.l*` classes, or scoped to `body.landing` | unprefixed classes |

Shared across both: Geist + Geist Mono, one red accent, no gradients as
decoration, no glassmorphism, no fake window chrome, no emoji.

**Which one am I editing?** If the class starts with `.l` or the rule is
scoped to `body.landing`, it is the landing and only the landing. Every
unprefixed rule still reaches `/verify` and the viewer, so changing one
changes pages you may not be looking at.

---

## 1. Philosophy

The **app chrome** is a document, not a marketing site. Every one of
those pages reads like the output of a curl an agent ran — formal, terse,
unembellished. The product is one paragraph, one URL and a Bearer token,
and that economy is the point.

The **landing** used to follow the same rule, and that was a mistake.
Held next to pages that do this job well it read as *unstyled* rather
than restrained: a left-aligned document on pure white, opening with a
collapsed memo. Fixing it by subtraction — pulling out the accent word,
the subhead, the motion, the shadows — made it worse. Every one of those
cuts was defensible in isolation and the sum was a text file.

> **Austerity is not professionalism.** The pages worth learning from are
> *heavily* designed; they just don't spend the budget on slop
> vocabulary. They pay for a real surface, composition, typographic
> scale, and evidence. Diagnose with a checklist, but fix by adding.

So the landing gets to be a landing: a tinted surface, centred
composition, display type carrying a claim, and a real product shown
above the fold. The app chrome stays a document.

The aesthetic borrows from:
- **Vercel** (geometric sans, sharp hairlines, density)
- **Sentry** (single saturated red as the only color; everything else
  near-monochrome)
- **HTTP itself** — but only where it is actually real. See §5.2.

What we **avoid**:
- Anthropic editorial / italic display serif
- Warm cream paper, IBM Plex Serif, deep forest greens
- Generic AI-slop aesthetics (purple-blue gradients, generic Inter, etc.)
- Anything that overlaps with [getadb.com](https://getadb.com)'s composition
  — that was an early near-clone we course-corrected away from
- Anything that overlaps with **traces.com**'s composition. It is the
  closest thing to a competitor in this space (session sharing for coding
  agents), so borrowing its layout is both a rule-#1 violation and
  strategically dumb. Take sensibility, invent composition.

> **The North Star:** if a developer cracks this site open at 11pm and
> doesn't immediately know whether to take it seriously, we lost.

---

## 2. Typography

| Role | Font | Notes |
|---|---|---|
| Display + body | **Geist** (400 / 500 / 600 / 700) | Vercel's official typeface. Free on Google Fonts. Geometric, neutral, technical. |
| Mono | **Geist Mono** (400 / 500) | Companion to Geist. Used for the wordmark, status pill, memo header, code blocks, inline `code`, all utility microcopy. |
| Fallback | system-ui / Menlo | If Geist fails to load, we accept whatever the OS provides — never Inter as a deliberate choice (Inter is sitting in the body fallback chain just in case). |

**Sizes (body):**
- Body prose: 17px / line-height 1.65
- Lede: 19px
- Inline code: 0.86em (relative)
- Mono microcopy (headers, footers, labels): 11–13px
- Landing headline: `clamp(38px, 5.6vw, 66px)`, Geist 700, **all black**.
  No `<em>`, no accent-coloured word — see §7.
- Landing lede: 19.5px, `--ink-soft`, max 60ch

**Letter-spacing:**
- Tight on big sans (`-0.035em` on the landing `h1`, `-0.025em` on `h1.title`)
- Open on uppercase mono labels (`0.06–0.12em`)
- Default on everything else

---

## 3. Palette

The whole product runs on **black, white, gray, and one red**. The red
appears sparingly — it's a signal, not a treatment.

```css
--bg:        #FFFFFF   /* page background */
--bg-2:      #FAFAFA   /* top bar, footer, inline code */
--bg-3:      #F5F5F5   /* (rarely used, deeper alternate) */

--ink:       #0A0A0A   /* primary text + filled buttons */
--ink-2:     #171717   /* body prose (slightly softer than ink) */
--ink-soft:  #737373   /* secondary text, captions */
--ink-softer:#A3A3A3   /* tertiary text, glyphs, table headers */

--rule:      #E5E5E5   /* hairlines */
--rule-soft: #F0F0F0   /* deeper-nested hairlines (steps, table rows) */

--red:       #D93025   /* THE accent: angle brackets, hover, em, status verb (Gmail/Google red) */
--red-press: #A52714   /* hover-active state on red elements */
--red-bg:    #FCE8E6   /* error background only */
--red-bg-stroke: #F4C7C3

--green-dot: #1F8F4A   /* status indicator dot only — never type */

--code-bg:   #0A0A0A   /* code blocks (the prompt) */
--code-fg:   #FAFAFA
--code-dim:  #A3A3A3
--code-em:   #FF6470   /* a slightly desaturated red on dark */

/* radius scale — three steps, nothing else. Before this existed the
   sheet carried nine ad-hoc radii, which reads as unconsidered. */
--r-sm: 4px    /* inline code, controls, small buttons */
--r-md: 8px    /* blocks, nav button */
--r-lg: 14px   /* the prompt slab, the evidence frame */

/* terminal-syntax colors. Tokenised because they used to be hardcoded
   at each use site, which let a second accent (two different blues)
   leak into a palette this doc calls "one red". */
--ok:            #1F8A3A   /* success on light */
--ok-on-dark:    #34D058   /* success inside code surfaces */
--syn-key:       #3B6EE8   /* command keyword, light surfaces */
--syn-key-dark:  #82B1FF
```

**Landing-only tokens** (scoped to `body.landing`):

```css
--page:   #F4F5F6   /* the tinted surface white cards sit on */
--card:   #FFFFFF
--lshell: 1080px
```

**Rules of thumb:**
- Red is for **emphasis**, **hover**, the **angle brackets** in the
  wordmark, and the **primary CTA fill**. Never for body text. **Never
  for a word inside a headline.**
- Green appears as a small dot or a success state, never as type.
- The dark code block is the only inversion — keep it scarce.
- No shadows above 1px. No glow. Never a coloured shadow under a
  coloured button.
- **No gradients, with two named exceptions**, both functional rather
  than decorative, both landing-only:
  1. The dot texture on `body.landing` is a `radial-gradient`. It
     renders as dots, not a colour wash, and it is what gives white
     cards something to sit on.
  2. The bottom fade on `.shot` is a `linear-gradient`. Without it the
     embedded page crops mid-sentence and reads as broken rather than
     truncated.

  Anything else gradient-shaped is still forbidden. If you want a third
  exception, it has to be load-bearing in the same way.

---

## 4. The wordmark

```
<htmlbin>
```

- Pure mono, weight 500, font-size 13.5px in headers / 14px otherwise
- The two angle brackets (`<` and `>`) are rendered via CSS pseudo-elements
  in `var(--red)` so the brand name itself stays black
- Favicon is the same mark, drawn as inline SVG with the same red angle
  brackets, so favicons across pages always match the wordmark visually
- The OG card (`og-png.ts`) reuses the same composition: red-bracket
  `<htmlbin>` wordmark on white, hairline rule, mono caption — same look
  whether you're seeing it in a tab, an unfurl, or a share sheet
- **Never** use a solid filled square logomark — that was an early attempt
  that copied getadb.com too closely

---

## 5. Components

### 5.1 Top bar — app chrome (`.page-head`)

Used by `/verify`, the viewer, the gate and `/404`. **Not** the landing.

```
   <htmlbin> / GET /verify · v1     ● live · v1  ·  $ npm i -g …  ·  /api/onboard
```

- Mono 12px, transparent background, no hairline — it reads as the
  document's first line rather than a chrome strip
- The install pill and `/api/onboard` link collapse to a single
  `@htmlbin/cli` link under 720px
- We never write "Cloudflare" or any impl detail here — project rule

### 5.1b Landing nav (`.lnav`)

The landing gets a real product header instead, because a mono
breadcrumb reads as terminal output and this page has to look like a
product to someone who has never heard of it.

```
   <htmlbin>   Docs  Patterns  CLI                  ⃝ GitHub   [ Get the CLI ]
```

- Sticky, `rgba(244,245,246,.92)`, hairline below
- Wordmark keeps the red angle brackets (§4) — that is the through-line
  between the two systems
- Exactly **one** solid button. It deep-links to the CLI's `#install`
  anchor, not the repo root: the button names an action, so it should
  land on the command rather than a README to scan
- Nav links hide under 820px; the wordmark and both right-hand items stay

### 5.2 The memo (`details.req`) — app chrome only

Opens `/verify` and the viewer. Reads like the verbose output of
`curl -v`, colour-coded:

```
▾ GET /verify HTTP/1.1
  host:    htmlbin.dev
  to:      any agent reading this
  from:    htmlbin <htmlbin.dev>
  re:      publishing HTML to a public URL
  200 OK   content-type: text/html; charset=utf-8
```

- Mono 13px, line-height 1.85
- HTTP verb in red (`GET`, `POST`)
- Header keys in `--ink-soft` with a colon suffix in `--ink-softer`
- Header values in `--ink` weight 500
- The `re:` value usually highlights one phrase in red (`<span class="em">`)
- The `▸` prefix sits at `left: -22px` (hidden on mobile), rotating to `▾`
- The trailing `200 OK` line uses `--green-dot` for the status code
- **Default it open.** It shipped closed for a while, which meant the
  page announced its whole conceit as one grey line and then abandoned it

**Why it is not on the landing any more.** `to:`, `from:` and `re:` are
not HTTP headers — they are RFC 5322 *email* headers. The component built
to signal protocol-seriousness was displaying invented ones, and the
engineers most worth impressing are exactly the ones who notice. It is
the same failure as fake window chrome: decorative output that isn't
real.

The landing now shows the actual thing instead — a trimmed but literal
`GET /api/onboard` response in `.onb`, captioned "This is the response,
trimmed." That endpoint returns ~13 KB across 21 real sections, so
showing it beats drawing it.

The memo stays on `/verify` and the viewer because there it sits above
genuine request context, and those pages are documents by design. If you
ever restyle it, keep the invented headers out of any *new* surface.

### 5.2b The onboard block (`.onb`) — landing

Dark slab, same family as `.lbox`, holding real JSON from
`GET /api/onboard`. Header strip carries the request line and a count
(`one document · 21 sections`). Syntax colours come from `--syn-*` and
`--ok-on-dark`; the body is `overflow-x: auto` so long lines scroll
inside the block instead of widening the page.

**Every character in it has to be true.** If the API shape changes, this
block changes. A stale fake is worse than no block.

### 5.3 The action block (`.lbox`) — landing

Dark slab holding whatever the visitor is meant to copy, with three tabs
(`agent` / `cli` / `skill`) and a primary CTA below it.

- `--code-bg`, `--r-lg`, one 1px shadow. No large ambient blur.
- **No traffic-light dots.** The old `.prompt` block had them as a
  deliberate exception; they were the most toy-like thing on the fold,
  and none of the pages worth learning from use fake window chrome. The
  exception is withdrawn.
- Tab strip: mono 12.5px, active tab marked by a red bottom border. The
  strip has **no fill or radius of its own** — a rounded filled track
  holding rounded filled tabs inside a rounded card is three nested
  rounded surfaces, and it made a third chip cluster in one small bar.
- Body is a CSS grid with all panes in the same cell, so the slab never
  jumps height when you switch tabs. **The consequence: it sizes to the
  tallest pane.** Keep every payload to the same number of rendered
  lines or the shorter ones show dead black space. This has regressed
  twice; check it after any copy edit.

### 5.3b Primary CTA (`.lcta`)

- Solid `--red`, white, sans 14.5px weight 500, `--r-md`, centred under
  the block. No coloured shadow (§3).
- The label names what the active tab will actually put on the
  clipboard — `Copy the prompt` / `Copy the command` / `Copy the
  install` — and updates on tab change so the verb stays true.
- Success state goes `--ok` with the label `Copied` for ~1.6s.
- Microcopy under it (`.lcta-fine`) carries the risk reducers:
  `Free · no signup · one human click to start`.

**Exactly one copy affordance.** There used to be two — an in-chrome
pill and a big button 40px apart — which read as indecision. There also
used to be *none* with a verb on it, which was worse: the page's whole
job is starting the device-code flow, and it asked for nothing. One
button, one verb.

### 5.3c Works-with strip (`.works`) — landing

Agent marks the CLI already auto-detects, as social proof.

- **No box per item.** Outlined pills read as a tag list, and an empty
  mark slot inside each one reads as an unchecked checkbox. Marks and
  names sit directly on the page; uniform size and one ink colour is
  what makes a logo row read as a single unit.
- Marks are inlined SVG paths from `src/views/logos.ts`, muted to 62%
  opacity, full ink on hover.
- **Only ship a mark whose identity you verified.** That file documents
  which products are deliberately text-only: Aider and Devin are not in
  simple-icons, and its `amp` slug is Google AMP rather than
  Sourcegraph's Amp. A wrong logo reads worse than no logo, and these
  are other companies' trademarks.

### 5.3d Evidence frame (`.frame`) — landing

A real drop, live in an iframe, above the fold.

- White card on the tinted page, `--r-lg`, hairline, one soft shadow
- Header bar carries the real URL, the version, and an
  `open the live page ↗` link that sits **next to the version it acts
  on** and opens in a new tab. It used to be 11.5px in the faintest ink
  on the page, floated hard right, where it read as decoration.
- `.shot::after` fades the bottom so the crop is deliberate (§3)
- Source is `/p/<slug>/raw`, which does **not** bump `view_count`, so
  homepage traffic doesn't inflate that drop's counter. Check that is
  still true before changing the route.
- It is a **real** drop, never a screenshot and never a mockup. Pick a
  light one: the block above it is already dark.

### 5.4 Body prose (`.body`)

- Max width 64ch
- 17px / 1.65 line-height
- `<strong>` is `--ink` weight 600
- `<em>` is **red weight 500**, never italic — italics belong to
  serif design languages we explicitly avoid
- Inline `<code>` has a soft background (`--bg-2`) and a 1px hairline,
  4px radius, font-size 0.86em

### 5.5 Forms (`.form`, `.field`, `button.primary`)

- Input is a borderless field with a single `--ink` underline; underline
  becomes red on focus
- Mono labels (uppercase, letter-spaced)
- Primary button: filled `--ink`, mono uppercase, 12px, 5px radius;
  hovers to red
- Errors: red-tinted background with a 3px red left border, mono 14px

### 5.6 Footer (`footer.tail`)

Two-column mono row at 11.5px in `--ink-soft`:
- Left: `htmlbin v1 · open source · agent-friendly`
- Right: the host (e.g. `htmlbin.dev`)

Background `--bg-2`, 1px top hairline. **No** "powered by" or implementation
references. The hosting platform is an implementation detail.

### 5.7 Landing hero (`.lhero`)

The first thing on the page. No memo above it, no eyebrow pill, nothing
between the nav and the headline.

- `h1` — Geist 700, `clamp(38px, 5.6vw, 66px)`, `-0.035em`, max 17ch,
  centred, **all black**
- Lede — 19.5px, `--ink-soft`, max 60ch, centred
- 96px top padding on desktop, 56px under 820px

**No accent-coloured word in the headline.** One red word in a large
sans headline is the single most templated move in this category, and
none of the pages worth learning from do it. Emphasis comes from scale
and weight. If you want to mark one phrase, an underline is the move
(that is what the one reference doing it well uses) — never coloured
letters.

**No eyebrow pill above the headline.** There was one reading
`v1 · LIVE`. "Live" is tautological — the page rendered, so it is live —
and "v1" is not a version anyone selects. The slot was imported from a
reference page that uses it for a genuine warning. **Only keep a slot if
something true goes in it.**

---

## 6. Page anatomy

### 6a. Landing (`/`) — centred, 1080px shell

Vertical order, top to bottom. Everything is centred.

```
   <htmlbin>  Docs Patterns CLI            ⃝ GitHub  [ Get the CLI ]
   ───────────────────────────────────────────────────────────────────

              Send your agent's work as a link, not a file.
        A URL that survives every revision. Free, no signup, …

              ┌───────────────────────────────────────┐
              │ agent   cli   skill                   │
              │ Explain this as an HTML page — …      │
              └───────────────────────────────────────┘
                      [ Copy the prompt ]
                Free · no signup · one human click

                 Works with the agent you already use
            ✳ Claude Code   ▣ Cursor   ✿ Codex   ▤ Cline
              Also Aider, Amp, Devin. Auto-detected …

                       WHAT YOU SEND SOMEONE
   ┌─────────────────────────────────────────────────────────────┐
   │ htmlbin.dev/p/ztx4J9P · v1  open the live page ↗            │
   ├─────────────────────────────────────────────────────────────┤
   │            [ a real drop, live in an iframe ]               │
   └─────────────────────────────────────────────────────────────┘
                    A real drop, not a screenshot.

                     FOR THE AGENT READING THIS
              ┌───────────────────────────────────────┐
              │ GET htmlbin.dev/api/onboard           │
              │ { "summary": …, "publish": { … } }    │
              └───────────────────────────────────────┘

     versions                        tags
     Revise without breaking …       Find anything you published.
     patterns                        passcodes
     Start from a real structure.    Keep some pages private.

                  A FEW PAGES PEOPLE HAVE PUBLISHED
     /p/gDMy7Vb   how htmlbin works             EXPLAINER
     /p/1Wyf23j   cross-platform gstack …       PR WRITEUP

   ───────────────────────────────────────────────────────────────────
   — htmlbin                      agent-card · /api/onboard · @utsengar
```

**Section rhythm:** `.lsec` carries 92px top padding. The evidence block
gets `.lsec-tight` at 48px instead, because it is a continuation of the
fold rather than a new section — and starting it higher shows more of the
embedded page.

**The four questions the fold has to answer,** in this order. If an edit
breaks one, it is a regression regardless of how it looks:

1. *What is it?* — headline
2. *What problem does it solve?* — headline's second clause
3. *Why is it different?* — lede
4. *What do I do next?* — the CTA, with a verb on it

The page shipped for a while answering only the first, which is how it
ended up with no call to action at all.

**Bottom spacing must be padding, not margin.** `.footer-merged` is the
last child of a `<main>` with `padding: 0`, so a bottom *margin* collapses
through `main` and out of `body` — landing outside the tinted background
box, where `html`'s white shows through as a strip. `min-height: 100vh`
on `body.landing` is the backstop.

### 6b. App chrome — one continuous document, 720px max

`/verify`, the gate and `/404` read as **one continuous document.** No
horizontal rules between sections. No chrome strip with a fill or border.
The breadcrumb is just the document's first line. Whitespace and
typography do the sectioning work hairlines normally would.

```
   ← <htmlbin> / GET /verify · v1     ● live · v1 · $ npm i … · /api/onboard

   ▾ GET /verify HTTP/1.1
     host:    htmlbin.dev
     to:      any agent reading this
     re:      publishing HTML to a public URL
     200 OK   content-type: text/html; charset=utf-8

   Your agent is asking us to mint a token. …

   VERIFICATION CODE
   ( ABCD-EFGH )

   ⃝ Sign in with GitHub
```

The viewer (`/p/:slug`) uses a slim variant: one viewer-bar with the
breadcrumb in front of the title, then a full-bleed iframe. That bar
*does* keep a hairline beneath it, because the iframe below is foreign
content and needs the demarcation.

**Mobile:** 22px gutters, 16px base font, the right-side items in the
breadcrumb collapse (the breadcrumb itself stays).

**The unification rule:** if you are tempted to add an `<hr>` or a
`border-bottom` to "section" these pages, *don't*. Use whitespace and
type weight. `hr.rule` is intentionally `display: none` in the global
stylesheet so legacy markup keeps working without producing a line.

### 6c. The mobile floor applies to us too

The product tells agents to keep drops readable at 360px
(`skills/htmlbin/SKILL.md`). Our own pages are held to the same bar: no
page-level horizontal overflow at 360px or 768px, long lines scrolling
inside their own container rather than widening the document.

**Testing note:** headless Chrome clamps its own window to a 500px
minimum, so `--window-size=360,…` silently renders at 500 and crops into
a 360px canvas. That looks exactly like broken mobile and is not. Render
the page inside an iframe of the width you actually want, or measure
`document.documentElement.scrollWidth` against `clientWidth`.

---

## 7. Hard don'ts

These are not preferences; they're rules. Violating any of them breaks
the design language.

- **No Anthropic editorial italic serif.** No Instrument Serif. No IBM
  Plex Serif. No display-italic h1. No `font-style: italic` anywhere.
- **No warm cream paper.** The app chrome is pure white; the landing is
  the cool grey `--page`. Neither is cream.
- **No orange.** That belongs to getadb.com. Our accent is red.
- **No black square logomark with a letterform inside.** Wordmark only.
- **No fake window chrome. No exceptions any more.** `.prompt` used to
  carry traffic-light dots as a sanctioned exception; they were the most
  toy-like element on the fold and the exception is withdrawn. Tabs and
  a copy button are enough to say "this is a thing you copy".
- **No fake output of any kind.** This is the general rule the traffic
  lights were a special case of. Don't render invented HTTP headers,
  invented terminal transcripts, invented log lines, or a drawing of an
  API response. If a block looks like machine output, every character in
  it has to be real. See §5.2.
- **No accent-coloured word inside a headline.** Emphasis is scale and
  weight. An underline is acceptable; coloured letters are not.
- **No empty imported slots.** If a layout slot came from a reference
  page, it only stays if something true goes in it. An eyebrow pill with
  no news, a subhead that restates the headline, and a status dot with
  no status are all the same mistake.
- **No status indicator without variance to report.** "Live" on a page
  that just rendered is tautological.
- **No "Are you an agent?" callout.** That phrasing is getadb's.
- **No "powered by" / "built on Cloudflare" / "edge:" / impl details
  in user-facing copy.** The platform is an implementation detail.
- **No headline pattern of the form "Give your agent a [X]"** or
  "No [X]. No [Y]." That's getadb's exact rhythm.
- **No emojis** (unless the user explicitly asks). No icon font.
  Inline SVG only, used sparingly.
- **No horizontal rules between sections in the app chrome.** Whitespace
  separates sections. (The landing's nav hairline and the evidence
  frame's internal rule are structural, not sectioning.)
- **No approximated third-party logos.** Ship a mark only if you
  verified its identity against the source asset. Text is the fallback.
- **Motion budget is tight.** Allowed: button hover/click transitions,
  and the memo's 0.18s open reveal. Anything beyond that is a design
  decision needing sign-off, not a CSS PR.

  Current state, verified against the code rather than assumed:

  | Animation | Where | Status |
  |---|---|---|
  | button hover / active | both surfaces | keep |
  | `reqOpen` (memo reveal, 0.18s once) | app chrome | keep |
  | `live-pulse` (infinite, 2.6s) | **still live** on `/verify` + viewer via `pageHead()` | **should go** |
  | `hero-word-in` (staggered H1 fade) | **dead CSS** — no view emits `.wf` any more | delete |

  The pulse is gone from the landing only because the landing stopped
  using `pageHead()`, not because anyone removed it. An infinite pulsing
  dot is a named AI tell and reports no variance (§7, "no status
  indicator without variance"). Retiring it means editing
  `chrome.ts`'s `.live-pill` markup and the `.live-dot::after` rule,
  which touches two pages — worth doing, not done yet.
- **No purple-blue gradients.** Period. See §3 for the only two
  gradients that exist and why.

---

## 8. Single source of truth

All styles live in [`src/styles.ts`](./src/styles.ts) and are served from
`/style.css` with a 5-min edge cache. Every view links via the
content-hashed `STYLE_HREF` constant exported from the same file:

```ts
import { STYLE_HREF } from "../styles";
// → /style.css?v=<short-hash-of-the-css-string>
```

The hash changes the moment you edit the CSS, so the edge cache busts
automatically on deploy — no need to hard-refresh, no manual version
bumps. Every view (landing, verify, viewer) links via `STYLE_HREF`; if
you ever introduce a new view, **don't** hard-code `/style.css` — import
the constant.

Per-page overrides are kept inline in their view file and should remain
*small* (the viewer needs `body { display: flex; flex-direction: column }`
because of its full-bleed iframe — that's the kind of override we accept).

To restyle the whole product:
1. Edit `src/styles.ts`
2. Save — `cf dev` hot-reloads, hash bumps automatically

> **Gotcha: `STYLES_CSS` is a TypeScript template literal.** A backtick
> anywhere inside it — including inside a CSS comment — terminates the
> string and the build fails with a parse error pointing at the comment.
> Don't quote property names in backticks when explaining a rule. This
> has broken the build twice.

---

## 9. Copy

The doc had no copy section for a long time, which is how the landing
shipped with no call to action on it at all.

**Voice: calm, clinical, no hype.** State the mechanic. No "boost your
productivity", no "supercharge", no exclamation marks, no em-dash asides
stacked three deep.

**Lengths**, measured off the pages that do this well rather than
guessed — Vercel ships a 5-word headline; Linear 8 words + a 13-word
subhead; Resend 8 + 12:

| Slot | Budget |
|---|---|
| Landing headline | 5–10 words |
| Landing lede | 12–15 words, one or two short sentences |
| Section eyebrow | 3–5 words |
| Capability heading | one short sentence |
| Capability body | ≤ 2 sentences |

**Rules:**

- **The headline states a job, not a mechanic.** "Your agent writes HTML.
  You get a URL." describes what happens; a reader who does not already
  feel the pain has no reason to care. "Send your agent's work as a link,
  not a file." names the job, and the second clause carries the pain.
- **The lede carries the differentiator, not a risk reducer.** Nobody is
  blocked on auth, so "one human click" does not belong in the highest
  value slot on the page. Risk reducers go under the CTA as microcopy.
- **Every CTA has a verb** and names what actually happens. If the label
  can go stale when state changes (tabs, modes), update it in JS.
- **Parallel structure in any scannable list.** Four capability headings
  in four different grammatical shapes reads as unconsidered.
- **No internal vocabulary on the marketing surface.** "Mints a new
  version", "slug stays put" and "drop" are all words we say to each
  other. `/` says *page*; the API, skill and docs keep the product
  vocabulary (§10).
- **Claims have to be checkable.** "Free" is true because there is no
  billing code. "Works with" lists only agents the CLI actually detects.
  If you cannot verify a claim, cut it.

---

## 10. Vocabulary

Just two words, used as ordinary English (not coined terms):

- **drop** *(verb)* — to publish HTML to htmlbin. *"Drop the dashboard mockup."*
- **a drop** *(noun)* — the published HTML at `/p/<id>`.

We deliberately do **not** define a new format/spec/keyword — we tried
that earlier ("HTMD") and real-user feedback was that it sounded like
overclaim. The product is htmlbin; what you publish there is a drop;
that's the whole vocabulary.

---

## 11. Discoverability surface

These exist for agents, not humans. They follow the same minimalism rule
(no fluff, machine-parseable, content-negotiated where useful):

- `GET /api/onboard` — JSON protocol descriptor by default, markdown via
  `Accept: text/markdown` or `?format=md`
- `GET /openapi.json` — OpenAPI 3.1 spec
- `GET /.well-known/agent-card.json` — capability descriptor
- `GET /.well-known/agent-skills/index.json` — Agent Skills Discovery
  RFC v0.2.0 index, with `htmlbin/SKILL.md` as the entry skill
- `GET /.well-known/api-catalog` — RFC 9727 `linkset+json` pointing at
  the OpenAPI spec and onboard descriptor
- `GET /llms.txt` — agent-friendly site index ([llmstxt.org](https://llmstxt.org))
- `GET /robots.txt` — explicit allow-list of GPTBot, ClaudeBot,
  PerplexityBot, etc.
- `GET /sitemap.xml`
- `Link:` HTTP header on `/` advertising all of the above

If you're adding a public surface, add it to all relevant entries above
in the same change. They're a single contract.

---

## 12. Future taste decisions

Not every aesthetic call has been made. When the moment comes:

- **OG image:** ✅ shipped. `og-png.ts` renders 1200×630 PNGs via
  satori + resvg-wasm — `<htmlbin>` mark on white with a thin red rule
  for the landing card; per-drop cards put the title (Geist 700, up to
  ~120px depending on length) above a mono caption with the slug. KV
  caches per slug+version (`og-png:<slug>:v<n>`). No screenshots, no
  photographs. SVG variants stay around as the `?_=svg` fallback and
  for the redirect when the PNG renderer fails.
- **Dark mode:** if added, keep the same three-color logic. Background
  near-black, text near-white, red unchanged. **No** auto-switch — agent
  tools render in light mode by default and the memo aesthetic depends
  on it.
- **Mobile share sheet:** the OG image is the entire share unit. No
  meta-pile of social tags beyond `og:title`, `og:description`, `og:url`.
- **Settings UI for humans:** there isn't one. If users want self-serve
  mgmt, an agent does it for them via the API. That's the whole product.

---

## 13. Known drift — fix these before adding anything

Everything below is verified against the code, not guessed. This list
exists because the doc once described a page that hadn't shipped, and a
later audit trusted the doc and reached a confidently wrong conclusion.

- **`live-pulse` still runs** on `/verify` and the viewer. §7 explains
  why it should go; retiring it means editing `chrome.ts` and the
  `.live-dot::after` rule.
- **Dead CSS:** `.hero`, `.hero h1 .wf`, `@keyframes hero-word-in`,
  `.hero-sub`, `.prompt*` (`.prompt-chrome`, `.prompt-mark`,
  `.prompt-cue`, `.prompt-aftermath`, `.tabs`, `.tab`, `.tab-panel`),
  `.copy-cta`, `.term-*`, `.caps-cue`, `.examples .cue`. The landing was
  the only consumer and it no longer emits any of it. Deleting is safe
  but it is a large diff, so it wants its own PR with a careful grep.
- **"Open source" is claimed with no LICENSE file to back it.** The
  landing redesign happened to drop the phrase from the nav and footer,
  so it is no longer on any HTML page — but `/llms.txt` still opens with
  "Open source. Edge-hosted." (`discoverability.ts:156`), and there is no
  LICENSE in this repo. The CLI repo is MIT; this one is unlicensed, and
  `package.json` has no `license` field either. Either add a license or
  drop the claim. This is a decision, not a copy edit.
- **The landing hardcodes one showcase slug** (`SHOWCASE_SLUG` in
  `landing.ts`). If that drop is deleted the evidence frame goes blank.
  No fallback.

**When you change a component, change this doc in the same PR.** The
audit trail in git is not a substitute — nobody greps history before
trusting a design doc.
