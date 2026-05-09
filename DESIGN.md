# DESIGN — htmd

The visual and tonal system for htmd.sh. One source of truth for typography,
palette, components, page anatomy, and (just as importantly) what we
deliberately don't do. Touch [`src/styles.ts`](./src/styles.ts) and every
page in this app reflects the change.

---

## 1. Philosophy

htmd is a **document, not a marketing site**. Every page reads like the
output of a curl that an agent ran — formal, terse, unembellished. The
whole product is one paragraph, one URL, and a Bearer token; the design
should match that economy.

The aesthetic borrows from three places:
- **Vercel** (geometric sans, sharp hairlines, white-on-white density)
- **Sentry** (single saturated red as the only color; everything else
  near-monochrome)
- **HTTP itself** (the memo on every page is literally an HTTP request)

What we **avoid**:
- Anthropic editorial / italic display serif
- Warm cream paper, IBM Plex Serif, deep forest greens
- Generic AI-slop aesthetics (purple-blue gradients, generic Inter, etc.)
- Marketing hero patterns ("Give your X a Y", subhead-with-period, etc.)
- Anything that overlaps with [getadb.com](https://getadb.com)'s composition
  — that was an early near-clone we course-corrected away from

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
- Headlines: only on `/htmd` (44–52px). The landing page has **no marketing
  headline** — the HTTP-request memo replaces it.

**Letter-spacing:**
- Tight on big sans (`-0.025em` on h1.title)
- Open on uppercase mono labels (`0.06–0.08em`)
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

--red:       #E11D2C   /* THE accent: angle brackets, hover, em, status verb */
--red-press: #B91624   /* hover-active state on red elements */
--red-bg:    #FEF2F3   /* error background only */
--red-bg-stroke: #F4C7CB

--green-dot: #1F8F4A   /* status indicator dot only — never type */

--code-bg:   #0A0A0A   /* code blocks (the prompt) */
--code-fg:   #FAFAFA
--code-dim:  #A3A3A3
--code-em:   #FF6470   /* a slightly desaturated red on dark */
```

**Rules of thumb:**
- Red is for **emphasis**, **hover**, and the **angle brackets** in the
  wordmark. Never for body text. Never for headlines.
- Green appears as a 6×6px dot on the status pill, that's it.
- The dark code block is the only inversion on the page — keep it scarce.
- No gradients. No shadows above 1px. No glow.

---

## 4. The wordmark

```
<htmd>
```

- Pure mono, weight 500, font-size 13.5px in headers / 14px otherwise
- The two angle brackets (`<` and `>`) are rendered via CSS pseudo-elements
  in `var(--red)` so the brand name itself stays black
- Favicon is the same mark, drawn as inline SVG with the same red angle
  brackets, so favicons across pages always match the wordmark visually
- **Never** use a solid filled square logomark — that was an early attempt
  that copied getadb.com too closely

---

## 5. Components

### 5.1 Top bar (`.page-head`)

```
┌──────────────────────────────────────────────────────────────────┐
│  <htmd>  ● live · v1                /htmd  /llms.txt  /api/onboard│
└──────────────────────────────────────────────────────────────────┘
```

- 12px vertical padding, monospace 12px text
- Background `--bg-2` so it sits slightly back from the page
- Hairline below
- Status pill: green-dot + `live · v1` (we never write "Cloudflare" or
  any impl detail here — that's a project rule)

### 5.2 The memo (`.req`)

The most important component. Every public page opens with this. Reads
exactly like the verbose output of `curl -v`, color-coded:

```
▸ GET / HTTP/1.1
  host:    htmd.sh
  to:      any agent reading this
  from:    htmd <htmd.sh>
  re:      publishing HTML to a public URL
  date:    May 9, 2026
  accept:  text/agent-friendly, text/markdown, application/json
  200 OK   content-type: text/html; charset=utf-8
```

- Mono 13px, line-height 1.85
- HTTP verb in red (`GET`, `POST`)
- Header keys in `--ink-soft` with a colon suffix in `--ink-softer`
- Header values in `--ink` weight 500
- The `re:` value usually highlights one phrase in red (`<span class="em">`)
- The `▸` prefix sits at `left: -22px` (hidden on mobile)
- The trailing `200 OK` line uses `--green-dot` for the status code

The memo replaces the marketing headline pattern entirely. **No "Drop HTML.
Get a URL." pitch above it. The memo is the pitch.**

### 5.3 Prompt block (`.prompt`)

Single dark code card holding the prompt the human pastes into their agent.

- Background `--code-bg` (`#0A0A0A`)
- Pure mono, 13.5px
- 6px border-radius, no chrome (no fake macOS dots, no title bar)
- Copy button **inside** the block, top-right corner
  - Outlined in `#2A2A2A` until hover
  - Hovers to filled red (`--red`)
  - "Copied" state goes neutral with a tiny green text accent
- Placeholder text (`<your html idea here>`) in `--code-dim`
- Emphasis text in `--code-em`

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
- Left: `htmd v1 · open source · agent-friendly`
- Right: the host (e.g. `htmd.sh`)

Background `--bg-2`, 1px top hairline. **No** "powered by" or implementation
references. The hosting platform is an implementation detail.

### 5.7 Numbered list (`ol.principles`) and table (`table.types`)

Used only on `/htmd` (the manifesto). Both lean on hairlines (`--rule-soft`)
between rows. The number prefix on the principles list is `decimal-leading-zero`
in red.

### 5.8 Manifesto headlines (`/htmd` only)

- `h1.title` — Geist 700, 36–52px, with `<em>` showing the word in red
  (still upright, not italic)
- `h2.section` — mono 12px, uppercase, letter-spaced, in red. Used as
  section headings throughout the manifesto.

---

## 6. Page anatomy (single-column, 720px max)

The whole page reads as **one continuous document.** No horizontal rules
between sections. No chrome strip on top with a fill or a border. The
breadcrumb at the top is just the document's first line; everything
flows from there. Whitespace + typography do the sectioning work that
hairlines normally would.

```
                                                                    
   <htmd> / GET / · v1                       /htmd  /api/onboard    
                                                                    
   ▸ GET / HTTP/1.1                                                 
     host:    htmd.sh                                               
     to:      any agent reading this                                
     from:    htmd <htmd.sh>                                        
     re:      publishing HTML to a public URL                       
     200 OK   content-type: text/html; charset=utf-8                
                                                                    
   body prose flows directly from the memo, no rule between them    
                                                                    
   ┌─ prompt block (dark) ─────────────────────[Copy]┐              
   │  monospace …                                     │              
   └────────────────────────────────────────────────┘              
                                                                    
   more body prose                                                  
                                                                    
   — htmd            read the thinking · /api/onboard               
                                                                    
   htmd v1 · open source · agent-friendly       htmd.sh             
```

The viewer page (`/p/:slug`) uses a slim variant of this — a single
viewer-bar with the breadcrumb in front of the title, then full-bleed
iframe. The viewer-bar *does* keep one hairline beneath, because there
the iframe is foreign content and we need the visual demarcation.

**Mobile:** 22px gutters, 16px base font, the right-side nav links in
the breadcrumb collapse away (the breadcrumb itself remains).

**The unification rule:** if you're tempted to add an `<hr>` or a
`border-bottom` to "section" the document, *don't*. Use whitespace and
type weight instead. The class `hr.rule` is intentionally `display:none`
in the global stylesheet so legacy markup keeps working without
producing a line.

---

## 7. Hard don'ts

These are not preferences; they're rules. Violating any of them breaks
the design language.

- **No Anthropic editorial italic serif.** No Instrument Serif. No IBM
  Plex Serif. No display-italic h1.
- **No warm cream paper.** Background is pure white.
- **No orange.** That belongs to getadb.com. Our accent is red.
- **No black square logomark with a letterform inside.** Wordmark only.
- **No fake macOS terminal chrome.** No traffic-light dots. No
  "Your agent" tab labels. No window decorations on code blocks.
- **No "Are you an agent?" callout.** That phrasing is getadb's. We
  address agents through the *whole* memo, not through a sidebar.
- **No "powered by" / "built on Cloudflare" / "edge:" / impl details
  in user-facing copy.** Status pill says `live · v1`. Footer says
  `htmd v1 · open source · agent-friendly`. The platform is an
  implementation detail.
- **No headline pattern of the form "Give your agent a [X]"** or
  "No [X]. No [Y]." That's getadb's exact rhythm.
- **No marketing prose above the fold.** The memo is the hero.
- **No emojis** (unless the user explicitly asks). No icon font.
  Inline SVG only, used very sparingly.
- **No horizontal rules between sections.** No `<hr>`, no
  `border-bottom` on the page-head, no top border on the footer. The
  page is one document; whitespace separates sections.
- **No animations beyond status-dot pulse + button hover transitions.**
- **No purple-blue gradients.** Period.

---

## 8. Single source of truth

All styles live in [`src/styles.ts`](./src/styles.ts) and are served from
`/style.css` with a 5-min edge cache. Every view links to that one file:

```html
<link rel="stylesheet" href="/style.css" />
```

Per-page overrides are kept inline in their view file and should remain
*small* (the viewer needs `body { display: flex; flex-direction: column }`
because of its full-bleed iframe — that's the kind of override we accept).

To restyle the whole product:
1. Edit `src/styles.ts`
2. Save — wrangler hot-reloads
3. Hard-refresh any open tab to bust the 300s edge cache

---

## 9. Vocabulary

Just two words, used as ordinary English (not coined terms):

- **drop** *(verb)* — to publish HTML to htmlbin. *"Drop the dashboard mockup."*
- **a drop** *(noun)* — the published HTML at `/p/<id>`.

We deliberately do **not** define a new format/spec/keyword — we tried
that earlier ("HTMD") and real-user feedback was that it sounded like
overclaim. The product is htmlbin; what you publish there is a drop;
that's the whole vocabulary.

---

## 10. Discoverability surface

These exist for agents, not humans. They follow the same minimalism rule
(no fluff, machine-parseable, content-negotiated where useful):

- `GET /api/onboard` — markdown by default, JSON via `Accept`
- `GET /openapi.json` — OpenAPI 3.1 spec
- `GET /.well-known/agent-card.json` — capability descriptor
- `GET /llms.txt` — agent-friendly site index ([llmstxt.org](https://llmstxt.org))
- `GET /robots.txt` — explicit allow-list of GPTBot, ClaudeBot,
  PerplexityBot, etc.
- `GET /sitemap.xml`
- `Link:` HTTP header on `/` advertising all of the above

If you're adding a public surface, add it to all relevant entries above
in the same change. They're a single contract.

---

## 11. Future taste decisions

Not every aesthetic call has been made. When the moment comes:

- **OG image:** keep the `<htmd>` mark on white with a thin red rule.
  No screenshots. No photographs.
- **Dark mode:** if added, keep the same three-color logic. Background
  near-black, text near-white, red unchanged. **No** auto-switch — agent
  tools render in light mode by default and the memo aesthetic depends
  on it.
- **Mobile share sheet:** the OG image is the entire share unit. No
  meta-pile of social tags beyond `og:title`, `og:description`, `og:url`.
- **Settings UI for humans:** there isn't one. If users want self-serve
  mgmt, an agent does it for them via the API. That's the whole product.
