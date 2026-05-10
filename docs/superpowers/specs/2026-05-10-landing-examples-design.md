# Landing redesign — prompt block + examples

Two changes to `/`, scoped to ship together for a Twitter
announcement:

1. **Prompt block redesign** — replace the centered `iterm2` title +
   external red CTA with a two-tab card (`npm` / `claude`), inline
   copy icon, larger radius. Modeled directly on the paperclip
   reference the user shared.
2. **Examples surface** — add a subtle "what people are building"
   list of four hand-picked drops below the prompt block.

Neither touches D1, KV, or any endpoint.

---

## Part 1 — Prompt block redesign

### Goal

Replace the current single-content prompt block with a two-tab card
that mirrors the paperclip reference. Same dark-mode aesthetic, but:

- Title bar's centered `iterm2` label is gone. Two tabs sit
  top-right (`npm`, `claude`).
- Copy icon moves *inside* the card on the right of the body. The
  external red `Copy prompt` CTA is removed.
- Card border-radius bumps up (~14–16px) and the hairline between
  title bar and body goes away — the card reads as one continuous
  surface.
- Three traffic-light dots stay top-left.

This is the **second** intentional fake-mac-chrome moment in the app
(see `DESIGN.md` §5.3 / §7), and it remains the *only* such moment.
Update `DESIGN.md` to reflect the new title-bar pattern.

### Anatomy

```
↓ paste into your agent

┌────────────────────────────────────────────────────┐
│ ● ● ●                            [ npm ] [ claude ]│
├────────────────────────────────────────────────────┤
│                                                    │
│ $ npx htmlbin onboard --yes                    [⧉] │
│                                                    │
└────────────────────────────────────────────────────┘

First publish needs one human click; after that, the agent owns it.
```

Switching tabs swaps the body. Same card, two payloads:

**`npm` tab** (default — matches paperclip's default):

```
$ npx htmlbin onboard --yes
```

**`claude` tab:**

```
Please publish to htmlbin
https://htmlbin.dev/llms.txt
```

Two short lines, just like the paperclip reference. The agent reads
`/llms.txt`, finds `/api/onboard`, and follows the device-code flow.
This replaces the current longer "Make a delightful HTML page…"
prompt — paperclip's split shows that two short lines outperform
prose for paste-and-go ergonomics.

### Note on the npm tab content

`npx htmlbin onboard --yes` advertises a CLI we don't ship today.
The user has chosen this UI deliberately (matching the paperclip
reference). Two ways forward, **out of scope for this spec but worth
flagging:**

- Ship a thin `htmlbin` npm package whose `onboard` command does the
  device-code dance and writes `./.htmlbin/token`. Mirrors `gh auth
  login`. Small effort.
- Or change the npm-tab body to a no-CLI command that works today
  (e.g. `curl https://htmlbin.dev/api/onboard`).

The spec assumes the first path will be taken before the
announcement; if not, the npm-tab body string is a one-line edit.

### Tab interaction

- Tabs are buttons (`<button role="tab">`) inside a `role="tablist"`.
- Active tab: filled `--ink-soft-on-dark` background, `--code-fg`
  text. Inactive: transparent, `--code-dim` text.
- Click switches `aria-selected` and toggles a hidden class on the
  two body `<pre>` blocks. No animation; instant swap.
- Default selected tab is `npm`. Persisted to `localStorage`
  (`htmlbin:promptTab`) so a returning visitor lands on whatever they
  last picked.
- Keyboard: ←/→ moves focus between tabs (standard tablist
  behavior).

### Inline copy icon

- 16×16 SVG (the existing `copy-cta` glyph), positioned absolute in
  the top-right of the body area.
- Click copies the *currently visible* tab's text to the clipboard.
- "Copied" state: icon morphs to a check for 1.6s; same timing as
  the current `.copy-cta`.
- Title attribute `Copy` for tooltip; `aria-label="Copy prompt"`.

### Removed

- `<p class="prompt-cue">↓ paste this prompt into Claude, Codex,
  Cursor, or any agent</p>` — replaced with shorter
  `↓ paste into your agent` (the tab labels say which agent).
- The external `<button class="copy-cta">` and its accompanying
  click handler. The inline icon replaces it.
- The `<span class="title">iterm2</span>` element.
- The hairline border under `.prompt-chrome`.

### Kept

- Dark `--code-bg` background and overall card geometry.
- Three traffic-light dots (red/yellow/green, 11px) — top-left.
- `.prompt-aftermath` line below the card. Same copy.

### CSS sketch (new `src/styles.ts` block)

```css
.prompt {
  background: var(--code-bg);
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(0,0,0,0.06);
  overflow: hidden;
}
.prompt-chrome {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px;
}
.prompt-chrome .dots { display: inline-flex; gap: 6px; }
.prompt-chrome .dot { width: 11px; height: 11px; border-radius: 50%; }
/* dot.r/.y/.g colors unchanged */

.prompt-tabs { display: inline-flex; gap: 4px; }
.prompt-tabs button {
  font-family: var(--mono); font-size: 12px;
  padding: 4px 10px; border-radius: 6px;
  background: transparent; color: var(--code-dim);
  border: 0; cursor: pointer;
}
.prompt-tabs button[aria-selected="true"] {
  background: rgba(255,255,255,0.08);
  color: var(--code-fg);
}

.prompt-body { position: relative; padding: 22px 56px 22px 22px; }
.prompt-body pre {
  font-family: var(--mono); font-size: 13.5px;
  color: var(--code-fg); line-height: 1.55;
  white-space: pre-wrap;
}
.prompt-body pre[hidden] { display: none; }

.prompt-copy {
  position: absolute; top: 14px; right: 14px;
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 6px; border: 0; cursor: pointer;
  background: transparent; color: var(--code-dim);
}
.prompt-copy:hover { background: rgba(255,255,255,0.06); color: var(--code-fg); }
.prompt-copy.ok { color: #4ade80; }
```

### HTML sketch

```html
<div class="prompt">
  <div class="prompt-chrome">
    <span class="dots" aria-hidden="true">
      <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
    </span>
    <div class="prompt-tabs" role="tablist" aria-label="Onboarding method">
      <button role="tab" aria-selected="true"  data-tab="npm">npm</button>
      <button role="tab" aria-selected="false" data-tab="claude">claude</button>
    </div>
  </div>
  <div class="prompt-body">
    <pre data-pane="npm">$ npx htmlbin onboard --yes</pre>
    <pre data-pane="claude" hidden>Please publish to htmlbin
https://htmlbin.dev/llms.txt</pre>
    <button class="prompt-copy" id="copyPrompt" aria-label="Copy prompt">
      <!-- 16×16 copy/clipboard SVG -->
    </button>
  </div>
</div>
```

### Tiny client script

```ts
const tabs = document.querySelectorAll('.prompt-tabs button');
const panes = document.querySelectorAll('.prompt-body pre');
const remembered = localStorage.getItem('htmlbin:promptTab') || 'npm';
function activate(tab: string) {
  tabs.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  panes.forEach(p => p.toggleAttribute('hidden', p.dataset.pane !== tab));
  localStorage.setItem('htmlbin:promptTab', tab);
}
activate(remembered);
tabs.forEach(b => b.addEventListener('click', () => activate(b.dataset.tab!)));

document.getElementById('copyPrompt')!.addEventListener('click', async () => {
  const visible = document.querySelector<HTMLElement>('.prompt-body pre:not([hidden])');
  if (!visible) return;
  await navigator.clipboard.writeText(visible.innerText);
  // brief 'ok' state, mirrors current behavior
});
```

### Don'ts

- **No** real terminal-window faux-screenshot flair beyond the dots
  and tabs (no fake URL bar, no "minimize" button, etc.).
- **No** animation on tab switch beyond instant swap.
- **No** third tab. Two only — keeps the visual rhythm tight.
- **No** colored tabs. Active tab is a soft white-on-dark pill;
  inactive is dim gray. Red is reserved for the rest of the page.

---

## Part 2 — Examples surface

### Goal

Give visitors four concrete artifacts to look at without redesigning
the rest of the landing page. Reads as a continuation of the
document, not a new module.

### Placement

Inserted between `.prompt-aftermath` and `.signoff` in
`src/views/landing.ts`. New `<section class="examples">` with the
same 720px column and the same vertical rhythm the rest of the page
uses (no `<hr>`, no border — whitespace separates).

### Anatomy

```
First publish needs one human click; after that, the agent owns it.

  ↓ a few drops people have made

  /p/gDMy7Vb   how htmlbin works
  /p/1Wyf23j   cross-platform gstack — pr #1111
  /p/ztx4J9P   workers nav — three redesigns
  /p/i2taphP   google logo — animation playground

— htmlbin              agent-card · /api/onboard
```

Two parts:

**Cue line** — `↓ a few drops people have made`. Mono, 12.5px,
`--ink-soft`, leading arrow. Mirrors the prompt block's
`↓ paste into your agent` so the page reads consistently. Lowercase
deliberately.

**Index list** — four `<a>` rows, each laid out as
`slug<gap>caption`:

- Row is the link target (whole row clickable, opens same tab).
- Slug column is monospace at fixed width so all four slugs
  left-align (e.g. `width: 12ch`).
- Caption is also mono — the row reads as `ls -l` output, not as
  prose. 13px, `--ink` weight 500.
- Default underline transparent; on hover the whole row turns red,
  matching the global `a:hover` rule. No background fill, no box.
- Row spacing: ~6px between rows.

No section heading. No box. No icons. The cue line is the heading.

Each row's HTML, for clarity:

```html
<a href="/p/gDMy7Vb">
  <span class="slug">/p/gDMy7Vb</span>
  <span class="caption">how htmlbin works</span>
</a>
```

### Source of truth

Hardcoded `EXAMPLES` constant at the top of `landing.ts`:

```ts
const EXAMPLES: Array<{ slug: string; caption: string }> = [
  { slug: "gDMy7Vb", caption: "how htmlbin works" },
  { slug: "1Wyf23j", caption: "cross-platform gstack — pr #1111" },
  { slug: "ztx4J9P", caption: "workers nav — three redesigns" },
  { slug: "i2taphP", caption: "google logo — animation playground" },
];
```

Captions are hand-curated — independent of the drop's stored title.
Edit the array and redeploy to rotate. No D1 schema change, no
`featured` flag.

### CSS

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

### Mobile

At <600px the slug column shrinks but the layout stays two-column;
captions wrap below their column on overflow. No layout switch.
Caption #2 (`cross-platform gstack — pr #1111`) is the longest and
should still fit at 360px viewport width — verify during
implementation.

### Accessibility

- Whole row is one `<a>` with slug + caption as its accessible text.
- Cue line is plain text, not a heading.

### Out of scope (examples)

- No screenshots, iframes, OG-png thumbnails.
- No `/examples` page, no D1 query, no rotation.
- No per-row analytics beyond whatever's global.

---

## Files touched

- `src/views/landing.ts`
  - Replace prompt block markup (Part 1).
  - Add `EXAMPLES` constant + render examples section (Part 2).
  - Update inline `<script>` to handle tab switching + new copy
    button.
- `src/styles.ts`
  - Replace `.prompt`, `.prompt-chrome`, `.copy-cta` rules with the
    new tabbed-card rules.
  - Remove `.copy-cta` and `.prompt-cue` rules that are no longer
    used (the cue text changes; the class can be reused).
  - Add `.examples` block.
- `DESIGN.md`
  - Update §5.3 (prompt block): document tabs, inline copy icon,
    14px radius, no hairline. Note `iterm2` label is retired.
  - Update §6 anatomy diagram if the tab pair shows in the ASCII
    sketch.
- `CLAUDE.md`
  - Note where the `EXAMPLES` array lives and how to rotate.
  - Note the new prompt-tab `localStorage` key
    (`htmlbin:promptTab`).

No DB, no KV, no new endpoint, no new env var.

## Open question (out of scope, but flagged)

The `npm` tab body advertises `npx htmlbin onboard --yes`. We don't
ship that CLI today. Either:

- (a) Build a thin `htmlbin` npm package with an `onboard` command,
  or
- (b) Change the npm-tab body to something that works today (e.g.
  `curl https://htmlbin.dev/api/onboard`).

This spec assumes (a) lands before the announcement. If not, the
single-string change in (b) is trivial.
