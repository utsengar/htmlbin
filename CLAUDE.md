# CLAUDE.md — htmlbin

Quick-reference for any future Claude Code session in this repo. The
deep dive on visual design lives in [DESIGN.md](./DESIGN.md); this file
is the operating manual.

## What this is

**htmlbin** — agent-first HTML hosting. Pastebin-energy product. An agent
does a one-time human-verified device-code dance, then publishes
self-contained HTML to a public URL. No human after auth. Live at
**htmlbin.dev**.

Public reinvention of an internal Webflow tool ("wrop"). The Webflow
codebase lives at `/Users/utkarshsengar/dev/prototypes/Prototypes` for
reference only — none of it ships in the public version.

## Stack (and why)

- **Cloudflare Workers + Hono** — single Worker, no Next.js.
  User explicitly asked for pure Cloudflare. Hono is the lightest
  Workers framework. Don't reach for Next.js.
- **D1** — relational data (users, tokens, drops, versions, reports).
- **KV** — HTML bodies, keyed by `html:<slug>:v<n>`.
- **Turnstile** — single human checkpoint during device-code auth.
- **Web Crypto** — PBKDF2/HMAC. Not Node crypto.

## Hard rules from the user

These came up across sessions and are not preferences — violating any of
them ships something the user will reject:

1. **Don't clone competitors.** The user pointed at getadb.com for "vibe";
   an early landing borrowed too literally. The user called it out as
   unethical. *Take sensibility, invent composition.* Same applies to
   any future reference shared.
2. **Don't over-index on Cloudflare.** It's an implementation detail.
   Status pill says `live · v1`. Footer says
   `htmlbin v1 · open source · agent-friendly`. Internal code comments
   can name Cloudflare; user-facing copy cannot.
3. **No Webflow.** Off-limits in the public version.
4. **Don't add signup/login/email/dashboard.** The device-code flow is
   the entire UX. Adding auth surfaces breaks the product thesis.
5. **Don't introduce a new keyword (formerly "HTMD").** The product is
   called htmlbin; the artifact is "a drop"; "drop" is just casual
   English, not a coined term we own. We do not have authority to define
   a new format spec, so don't act like we do.
6. **Aesthetic stays in DESIGN.md.** Don't drift.

## Naming history (so future sessions don't relitigate)

The brand evolved: `wrop` (internal Webflow tool) → `htmd` (early public
attempt with the "HTMD = HyperText Markup Document" framework) →
**`htmlbin`** (current). The framework was dropped because real-user
feedback (Allan in the user's Slack) said `htmlbin.dev` lands faster than
`htmd.sh` — too much explanation tax for "trying to be an HTML-like
standard." The product can be a clear pastebin-for-agents without owning
a category.

Token prefix is **`hb_`** (short for htmlbin).

## Design — one-liner

White paper, Geist + Geist Mono, single red accent (`#E11D2C`), HTTP-style
memo at the top of every page, vim-modeline-style breadcrumb in the top
bar, monochrome dark code blocks with no fake macOS chrome. The HTTP-memo
is a real `<details open>` so users can collapse it.

**Single source of truth:** [`src/styles.ts`](./src/styles.ts) →
served at `/style.css`. Every page links to it. Touch that file → every
page updates. Per-page overrides should stay tiny.

The full design doc with rationale, components, and don'ts is in
[DESIGN.md](./DESIGN.md).

## Auth model — agent-first device-code flow

Modeled on OAuth device-code (think `gh auth login`):

1. `POST /api/auth/start` → `{code, verification_url, poll_token}`
2. Agent prints code + URL to human
3. Human opens URL, clears Turnstile, clicks verify
4. `GET /api/auth/poll?token=…` → `{api_token}` revealed exactly once
5. `Authorization: Bearer hb_…` thereafter

**Cross-machine:** the verify form has an optional "existing token"
field. Paste an `hb_…` from another device → the new session is bound to
the same `user_id`. One human, many devices, many tokens, shared drops.

Tokens are stored as `sha256(pepper || token)` where pepper is in env
(`TOKEN_PEPPER`). Plaintext is never persisted.

**Token storage convention (agent-side):**
1. `./.htmlbin/token` — project-local, preferred (no permission prompt for
   agents that won't write outside cwd)
2. `HTMLBIN_TOKEN` env var
3. `~/.config/htmlbin/token` — machine-global fallback

`./.htmlbin/token` is the primary. The protocol descriptor at
`/api/onboard` advertises this order.

## /api/onboard is JSON by default

Default content type is **application/json** — a structured protocol
descriptor (`auth.steps[]`, `publish`, `iterate`, schemas, limits).
Markdown variant is opt-in via `Accept: text/markdown` or
`?format=md`.

Why: "fetch a URL and follow what it returns" is the shape of a
prompt-injection payload, and agents (rightly) refuse it. A structured
descriptor reads as data, not as instructions, and slips through the
same agents without friction. The recommended user prompt on the
landing page no longer says "follow what it returns" — it directly
lists the three endpoints and the token path.

`buildOnboardJson()` and `buildOnboardText()` both live in `onboard.ts`
and must stay in sync when the protocol changes.

## URL conventions

- Slugs are 7-char base62 random IDs (e.g. `aB3xK7g`). No title prefix.
- Drop URL: `htmlbin.dev/p/aB3xK7g`
- Specific version: `htmlbin.dev/p/aB3xK7g?v=2`
- Raw HTML: `htmlbin.dev/p/aB3xK7g/raw`

If you change the slug generator, also update the validation regex in
`src/slug.ts` and the e2e test expectations.

## Versioning

Every `PUT /api/drops/:slug` with a new `html` body mints a new
version. Slug + URL never change. The DB has a `versions` table; KV
keys are `html:<slug>:v<n>`. `drops.latest_version` points at the
current head.

`?v=N` query param on the viewer + raw routes pins to a specific
version. Default = latest.

## Context metadata

Each version can carry an optional `context` field (text, ≤64KB) — the
agent's reasoning trace, prompt, or thinking that produced the version.
The viewer exposes it under a discreet "context" disclosure when present.
**Opt-in per request — agents must only include it when the human has
agreed; it can be sensitive.**

## Markdown for agents

The landing page is also available as Markdown via Workers AI:

- `GET /index.md` — explicit URL
- `GET /` with `Accept: text/markdown` — content negotiation
- `GET /?format=md` — querystring fallback

Result is cached in KV (`md:landing`, 1h). Requires Workers AI binding
(`[ai]` block in wrangler.toml — already set up). See
https://blog.cloudflare.com/markdown-for-agents/ for the underlying API.

User-uploaded drops at `/p/:id` are **not** auto-converted — agents
own their HTML; the markdown variant is only for our own pages.

## Local dev gotchas

- **Turnstile test secret.** `.dev.vars` uses Cloudflare's published
  test secret `1x0000000000000000000000000000000AA` (always passes).
  `src/index.ts` short-circuits the network call for that exact value
  because the local dev proxy 500'd on the multipart fetch to
  `challenges.cloudflare.com`. Production uses the real secret.
- **D1** in local mode is in `.wrangler/state/`. Run
  `npm run db:apply:local` after schema changes.
- **Token prefix is `hb_`.** If you change it, update both
  `src/auth.ts` (regex) AND `src/crypto.ts:newApiToken` AND
  `src/index.ts` (existing-token validation regex).
- **Hot reload** picks up most edits; if pages look stale, hard-refresh
  to bust the 300s `/style.css` edge cache.

## Files

```
src/
  index.ts          ─ Hono routes (/, /verify, /p/:slug, +discoverability)
  auth.ts           ─ device-code flow + Bearer middleware
  drops.ts          ─ /api/drops CRUD with versioning + context
  onboard.ts        ─ JSON descriptor (default) + markdown walkthrough for /api/onboard
  crypto.ts         ─ Web Crypto wrappers
  slug.ts           ─ 7-char base62 id generator
  db.ts             ─ D1 helpers + rate limiter
  discoverability.ts─ robots.txt, llms.txt, sitemap, agent-card, openapi
  styles.ts         ─ THE stylesheet (single source of truth)
  types.ts          ─ shared types
  views/
    chrome.ts       ─ shared top-bar, footer, httpMemo() helper
    favicon.ts      ─ inline SVG favicon (light/dark adaptive)
    og-image.ts     ─ inline SVG OG card (1200×630, served at /og.svg)
    landing.ts      ─ /
    verify.ts       ─ /verify (with cross-machine token transfer)
    viewer.ts       ─ /p/:slug viewer + password gate

schema.sql          ─ D1 schema (idempotent)
wrangler.toml       ─ Cloudflare config (name=htmlbin, db=htmlbin-db)
scripts/
  setup.mjs         ─ provisions D1 + KV, applies schema, sets pepper
  agent-e2e.sh      ─ full functional test
.dev.vars.example   ─ TOKEN_PEPPER + TURNSTILE_SECRET_KEY (test value)
```

DB table, URL path, and user-facing copy are all aligned: **drops**
(`drops` table, `/api/drops/...`). The historical "prototypes" naming
came from an internal Webflow tool and was retired in this codebase.

## Testing

```
npm run test:e2e
```

Walks discovery → onboarding → device-code auth → CRUD → versioning →
context → password lifecycle → ownership → cleanup. Same script works
against deployed `htmlbin.dev` if you change `BASE_URL`.

When you finish meaningful work, re-run that script before claiming the
system works.

## Limits (all configurable)

- 2 MB / drop (`MAX_HTML_BYTES` in `drops.ts`)
- 64 KB / context per version
- 200 versions / drop
- 60 writes / minute / token
- 500 writes / day / token
- 500 drops / account
- 10-min TTL on verification codes

## Knowledge capture rule

Per the user's global rule, at end of every meaningful session, update:
- This file (operating manual)
- DESIGN.md (if anything visual changed)
- README.md (if API/setup/limits changed)

If you touched code without updating any of the above, ask before closing.
