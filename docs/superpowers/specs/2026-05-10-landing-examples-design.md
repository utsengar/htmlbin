# Landing examples — design

A subtle "what people are building" surface on `/`, showing four
hand-picked drops as a mono index list. Authored for a Twitter
announcement; lives on the homepage afterward.

## Goal

Give visitors four concrete artifacts to look at without redesigning
the landing page or breaking the document feel. The list should read
as a continuation of the page, not a new module bolted on.

## Placement

Inserted between `.prompt-aftermath` and `.signoff` in
`src/views/landing.ts`. New `<section class="examples">` with the same
720px column and the same vertical rhythm the rest of the page uses
(no `<hr>`, no border — whitespace separates).

## Anatomy

```
First publish needs one human click; after that, the agent owns it.

  ↓ a few drops people have made

  /p/aB3xK7g   a budget calculator
  /p/x7nL2pQ   a live ascii clock
  /p/m4ZqR8v   a typing speed test
  /p/kT9bN3w   a tiny snake game

— htmlbin              agent-card · /api/onboard
```

Two parts:

**Cue line** — `↓ a few drops people have made`. Same treatment as the
existing `.prompt-cue` (mono, 12.5px, `--ink-soft`, leading arrow). It
mirrors the prompt-block's "↓ paste this prompt…" so the page reads
consistently. Lowercase deliberately — matches the rest of the
document's voice.

**Index list** — four `<a>` rows, each row laid out as
`slug<gap>caption`:

- Row is the link target (whole row clickable, opens same tab).
- Slug column is monospace at fixed width so all four slugs left-align
  (e.g. `width: 12ch` so any 7-char slug-with-`/p/`-prefix lines up).
- Caption is **also mono** (the row reads as `ls -l` output, not as
  prose). 13px, `--ink` weight 500.
- Default underline transparent; on hover the whole row turns red,
  matching the global `a:hover` rule. No background fill, no box.
- Row spacing: ~6px between rows. Tight, listy.

No section heading. No box. No icons. The cue line is the heading.

Each row's HTML, for clarity:

```html
<a href="/p/aB3xK7g">
  <span class="slug">/p/aB3xK7g</span>
  <span class="caption">a budget calculator</span>
</a>
```

## Source of truth

Hardcoded `EXAMPLES` constant at the top of `landing.ts`:

```ts
const EXAMPLES: Array<{ slug: string; caption: string }> = [
  { slug: "aB3xK7g", caption: "a budget calculator" },
  { slug: "x7nL2pQ", caption: "a live ascii clock" },
  { slug: "m4ZqR8v", caption: "a typing speed test" },
  { slug: "kT9bN3w", caption: "a tiny snake game" },
];
```

Captions are hand-curated next to the slug — independent of the drop's
stored title, so the landing copy can stay editorial without coupling
to whatever was in the original publish.

When the user replaces a drop they edit this array and redeploy.
Trivial cost; no D1 schema change, no `featured` flag.

## CSS

Lives in `src/styles.ts` (the design rule says shared components go
there, even if used once). Roughly:

```css
.examples {
  max-width: 720px;
  margin: 56px auto 0;
  padding: 0 28px;
}
.examples .cue {
  font-family: var(--mono);
  font-size: 12.5px;
  color: var(--ink-soft);
  margin-bottom: 16px;
}
.examples ul {
  list-style: none;
  display: grid;
  gap: 6px;
}
.examples a {
  display: grid;
  grid-template-columns: 12ch 1fr;
  gap: 16px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--ink);
  text-decoration: none;
  padding: 4px 0;
}
.examples a:hover { color: var(--red); }
.examples a .slug { color: var(--ink-soft); }
.examples a:hover .slug { color: var(--red); }
```

The slug column gets a softer color by default so the caption reads as
the primary text and the slug reads as the address — same hierarchy
the HTTP-memo uses (key in `--ink-soft`, value in `--ink`).

## Mobile

At <600px the slug column shrinks but the layout stays two-column;
captions wrap below their column on overflow. No layout switch — a
narrow phone still reads it as a directory listing. If a caption is
genuinely too long, shorten the caption (this is hand-curated copy).

## Accessibility

- Whole row is one `<a>` with the slug + caption as its accessible
  text — screen readers read "P aB3xK7g, a budget calculator".
- No new ARIA. The cue line is plain text, not a heading; if a `<h2>`
  is wanted later for landmark navigation, add a visually-hidden one.

## Out of scope

- No screenshots, no iframes, no OG-png thumbnails. (Considered and
  rejected — heavier visually than the document feel allows.)
- No "see all examples" link, no `/examples` page, no D1 query.
- No analytics on individual rows beyond whatever is already global.
- No rotation/randomization. Four fixed picks; rotate by editing the
  array.

## Don'ts (design-language guardrails)

- No box, card, border, or background fill on the section.
- No `<hr>` above or below it.
- No emoji or icons in the rows.
- No "Featured drops" / "Examples" heading in title case — the cue
  line is lowercase mono and that is the heading.
- No marketing copy ("See what agents are building with htmlbin!").
  The cue line stays terse and editorial.

## Files touched

- `src/views/landing.ts` — add `EXAMPLES` constant, render the section
  between `.prompt-aftermath` and `.signoff`.
- `src/styles.ts` — add the `.examples` block.
- `CLAUDE.md` — short note under "Files" or under the landing section
  explaining where examples are edited (one or two sentences).

No DB, no KV, no new endpoint, no new env var.
