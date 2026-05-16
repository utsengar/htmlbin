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
- **GitHub OAuth** — single human checkpoint during device-code auth.
  Replaced Turnstile in May 2026 (see "Auth model" below) so identity
  is bound to a UNIQUE `github_user_id` and cycling tokens no longer
  resets quotas. GitHub is an identity provider, not a paid SaaS — the
  Worker talks directly to `github.com/login/oauth/*`.
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
   *Documented exception:* GitHub OAuth lives inside the device-code
   verify step (May 2026) — it replaces Turnstile, doesn't add a new
   surface. There is still no email, no password, no dashboard, no
   account page. Sign-in happens once at `/verify` and the agent flow
   is unchanged from its side. Do not extend this exception to add a
   user-facing account UI.
5. **Don't introduce a new keyword (formerly "HTMD").** The product is
   called htmlbin; the artifact is "a drop"; "drop" is just casual
   English, not a coined term we own. We do not have authority to define
   a new format spec, so don't act like we do.
6. **Aesthetic stays in DESIGN.md.** Don't drift.
7. **Never deploy to production directly.** No `wrangler deploy` from
   the local shell. No `git push origin main`. Every change ships
   through this exact flow:
     1. Create a new branch (`git checkout -b <name>`).
     2. Commit and `git push -u origin <name>`.
     3. Open a PR. GitHub Actions runs `wrangler versions upload` and
        posts a Cloudflare preview URL as a sticky comment on the PR.
     4. Test against that preview URL. Wait for the user's approval.
     5. After the user approves, merge the PR. The merge-to-`main`
        workflow runs `wrangler deploy` for production — that is the
        only path code reaches `htmlbin.dev`.
   Even for a one-line copy fix. No exceptions.

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

White paper, Geist + Geist Mono, single red accent (`#D93025`, Gmail/Google red), HTTP-style
memo at the top of every page, vim-modeline-style breadcrumb in the top
bar, monochrome dark code blocks. **One** deliberate exception to "no
fake mac chrome": the prompt block on `/` carries traffic-light dots and
a static `claude` pill in the top-right — it's the primary CTA and earns
the visual handle. Everywhere else stays flat. The HTTP-memo is a real
`<details open>` so users can collapse it.

**Single source of truth:** [`src/styles.ts`](./src/styles.ts) →
served at `/style.css`. Every view imports `STYLE_HREF` (=
`/style.css?v=<short-hash>`) from that file — the hash auto-bumps on any
CSS edit, so the edge cache busts on deploy without a manual version
change. Per-page overrides should stay tiny. Don't hard-code
`/style.css` in new views; import the constant.

**Landing examples + prompt copy.** The "what people are building"
list on `/` is hand-curated — edit the `EXAMPLES` array at the top of
[`src/views/landing.ts`](./src/views/landing.ts) and redeploy to
rotate. The single prompt-block payload (`AGENT_PROMPT`) lives in the
same file; we deliberately don't ship a tabbed alternative because we
don't have a CLI and `curl` gets flagged as unsafe by careful agents.

The full design doc with rationale, components, and don'ts is in
[DESIGN.md](./DESIGN.md).

## Auth model — agent-first device-code flow

Modeled on OAuth device-code (think `gh auth login`):

1. `POST /api/auth/start` → `{code, verification_url, poll_token}`
2. Agent prints code + URL to human
3. Human opens URL, signs in with **GitHub** — we ask for `read:user`
   only (public username + numeric id). The Worker upserts a user row
   by `github_user_id` (UNIQUE) and mints a token in the same callback.
4. `GET /api/auth/poll?token=…` → `{api_token}` revealed exactly once
5. `Authorization: Bearer hb_…` thereafter

**Why GitHub, not Turnstile:** Turnstile only proved a human was on the
page. It did nothing about the same human re-running the flow forever
to mint fresh tokens. Binding accounts to a UNIQUE `github_user_id`
means cycling tokens recycles the same account — quotas and drops
stick. Creating a second GitHub account has real friction (rate limits,
email verification, account age) which is the point.

**Cross-machine:** sign in with the same GitHub account on the new
device. The callback finds the existing user by `github_user_id` and
mints a new token attached to the same `user_id`. The old "paste an
existing hb_… token" UX was deleted in the same change.

**Routes:** `/auth/github/start` and `/auth/github/callback` live in
`src/github-oauth.ts`. State binding to the verification row uses the
verify code as the OAuth `state` param — it's already a short-lived,
single-use secret. The callback re-checks `verifications.status` after
GitHub returns, in case the row expired during the round-trip.

**Bindings:** `GITHUB_CLIENT_ID` is a public `[vars]` entry in
`wrangler.toml`. `GITHUB_CLIENT_SECRET` is a Worker secret
(`wrangler secret put GITHUB_CLIENT_SECRET`). The OAuth app's
"Authorization callback URL" must be `https://htmlbin.dev/auth/github/callback`.

**Dev mock:** when `GITHUB_CLIENT_ID === "dev-mock"` (the value in
`.dev.vars.example`), `/auth/github/start` skips the round-trip to
github.com and redirects straight to `/auth/github/callback` with a
synthesized github identity derived from `?mock_login=<x>`. The
deterministic id (`stableMockId()`) is a SHA-256-based int so two
different mock logins create two different accounts. **The mock path is
only reachable when the dev sentinel is set — in production it's
unreachable.** `scripts/agent-e2e.sh` relies on this.

Tokens are stored as `sha256(pepper || token)` where pepper is in env
(`TOKEN_PEPPER`). Plaintext is never persisted.

**Legacy users (pre-OAuth):** `users.github_user_id` is NULLABLE on
purpose. Existing tokens minted before this change still work, but no
new account can be created with `github_user_id = NULL`. The UNIQUE
index uses a partial-index `WHERE github_user_id IS NOT NULL` so the
legacy rows don't collide.

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

## API design conventions (locked pre-launch)

Reviewed against the `api-and-interface-design` skill (Hyrum's Law,
contract-first, etc.). These are the rules — apply them on every new
endpoint and never silently break them.

1. **snake_case for every field name.** Request and response. Examples:
   `raw_url`, `latest_version`, `created_at`, `view_count`, `is_latest`,
   `retry_after_seconds`. Deliberate choice — agent-first APIs (parsed,
   not destructured in JS) read better in snake_case, matching Stripe /
   GitHub.

2. **One error shape — and only one.** Every 4xx/5xx response uses
   `src/errors.ts` → `apiError(c, code, message, status, details?)`:

   ```jsonc
   {
     "error": {
       "code": "<machine_readable_snake_case>",
       "message": "<human readable>",
       "details"?: { /* optional context */ }
     }
   }
   ```

   Agents switch on `error.code`. The set of valid codes is the
   `ErrorCode` union in `src/errors.ts`.

3. **Mutating endpoints return the full Drop** (`serializeDrop()` in
   `drops.ts`). Consumers should never have to re-fetch. The one
   exception is full-drop `DELETE`, which returns `204 No Content`.

4. **PUT vs PATCH split.** `PUT /api/drops/:slug` mints a new version
   and requires `html`. `PATCH /api/drops/:slug` updates metadata only
   (title / description) and forbids `html` (`400 metadata_only_on_patch`).

5. **List endpoints paginate.** `GET /api/drops` accepts `page`,
   `pageSize` (max 200), `sortBy`, `sortOrder` and returns
   `{ data, pagination }`.

6. **429 carries `Retry-After`.** Both header (RFC 9110) and
   `details.retry_after_seconds` in the body. Quota errors
   (`quota_exceeded`, `daily_quota_exceeded`, `version_limit_reached`)
   are 429, not 403.

7. **HEAD support on read endpoints.** `app.on(["GET", "HEAD"], …)`
   everywhere. Agents and CDNs probe with HEAD.

8. **CORS is intentionally NOT set.** htmlbin is an agent-side API
   (CLI, server-side scripts). Disallowing browser cross-origin XHR
   is a *feature* — random third-party sites can't `fetch(htmlbin.dev
   /api/…)` with the user's token. Don't "fix" missing CORS without
   talking to the user. If a browser-based agent ever needs access,
   that's a conscious decision, not a copy-paste of `app.use(cors())`.

9. **Security headers on every response.** A global middleware in
   `src/index.ts` sets HSTS, X-Content-Type-Options, Referrer-Policy,
   Permissions-Policy on every response; X-Frame-Options + CSP on
   text/html (unless the handler already set CSP — `/p/:slug/raw`
   sets its own for iframe embedding); CSP `default-src 'none'` on
   JSON. Don't bypass the middleware.

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

## Passcode (soft share gate)

Drops can be gated by a **passcode** (renamed from "password" in May 2026 —
1Password autofill kept triggering on `type="password"` and the credential
framing oversold what it actually is). The API field is `passcode`, endpoint
is `POST /api/drops/:slug/passcode`, error codes are `passcode_required` and
`passcode_too_short`.

It's a *share gate, not encryption*. The HTML body sits in KV unencrypted;
the gate only blocks the viewer route and the signed unlock cookie. If you
ever add a "real" zero-knowledge tier, that's a different surface — don't
overload `passcode` with it.

**Internal DB columns are still `password_hash` and `password_salt`** —
SQLite-rename is doable but unnecessary for an internal name, so the
TypeScript-side mismatch (`Drop.password_hash` / `Drop.password_salt` typed
fields, snake_case `passcode` on the API) is intentional.

Gate page uses `<input type="text">` + CSS `-webkit-text-security: disc` so
the value masks like a password field but autofill doesn't fire. A tiny
inline script flips text-security on a "show/hide" toggle.

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

## Discoverability surfaces (one contract)

These endpoints exist for agents and crawlers; treat them as a single
contract — when you add or rename a public surface, update **all** of
them in the same change so they don't drift:

- `GET /api/onboard` — JSON descriptor (default), markdown via `Accept`
- `GET /openapi.json` — OpenAPI 3.1 spec
- `GET /.well-known/agent-card.json` — capability descriptor
- `GET /.well-known/agent-skills/index.json` — Agent Skills Discovery
  RFC v0.2.0 index. Entry skill is `htmlbin/SKILL.md`, served from
  `.well-known/agent-skills/htmlbin/SKILL.md`. Skill content lives in
  `src/skill.ts` (deployed copy) and `skills/htmlbin/SKILL.md`
  (human-browsable mirror) — they must stay in sync.
- `GET /.well-known/api-catalog` — RFC 9727 `linkset+json`
- `GET /llms.txt` — agent-friendly site index
- `GET /robots.txt` — explicit allow-list of GPTBot, ClaudeBot,
  PerplexityBot, etc.
- `GET /sitemap.xml`
- `Link:` HTTP header on `/` advertising all of the above

`src/discoverability.ts` is the source of truth for everything except
the skill (`src/skill.ts`).

## OG card rendering (PNG)

Slack, Twitter, iMessage, and most unfurlers don't render SVG OG cards
— they need PNG. `src/views/og-png.ts` produces 1200×630 PNGs via
**satori + resvg-wasm** inside the Worker:

- `GET /og.png` — landing card (red-bracket `<htmlbin>` wordmark)
- `GET /p/:slug/og.png` — per-drop card (title up top, mono caption
  with the slug)

WASM gotchas (don't relitigate):
- Workers block `WebAssembly.compile`. We use `satori/standalone` and
  call `init(yogaWasmModule)` with a precompiled `WebAssembly.Module`
  imported via wrangler's `[[rules]] type = "CompiledWasm"` glob. Same
  trick for `@resvg/resvg-wasm/index_bg.wasm`.
- `satori-html` was removed because it doesn't decode HTML entities
  (the `<htmlbin>` wordmark rendered literally as `&lt;htmlbin&gt;`).
  We build the satori AST directly with small `el/div/span` helpers and
  real `<` / `>` characters as text children.
- Geist + Geist Mono are fetched once from jsDelivr `@fontsource/geist`,
  cached in module memory, then bundled into a single KV blob
  (`og-fonts:v1`) so cold starts only do the network fetch once per
  edge node lifetime.
- Rendered PNGs are KV-cached per slug+version
  (`og-png:<slug>:v<n>:<rev>`) and per landing
  (`og-png:landing:v<rev>`). Bump the `:rev` suffix to invalidate.
- If satori or resvg fail at request time, the route redirects to the
  SVG variant so social cards never hard-fail. `?debug=1` on the route
  surfaces the underlying error.

`og-image.ts` (SVG) and `og-png.ts` are **both** in tree on purpose:
the SVG is the lightweight fallback + per-tab rendering source; the
PNG is what social platforms actually consume.

## Bundling non-JS assets in the Worker — the wrangler gotcha

**`wrangler 4 + ES module Workers does not reliably honor `[[rules]]`
for imports of non-JS files outside `src/`.`** We've now hit this twice:

- `import SKILL_MD from "../skills/htmlbin/SKILL.md"` with
  `[[rules]] type = "Text"` → esbuild reports
  *"No loader is configured for `.md` files"*.
- `import geist400 from "../assets/fonts/Geist-400.woff2"` with
  `[[rules]] type = "Data"` → same error for `.woff2`.

Both worked locally during `wrangler dev` (sometimes) but failed on
production `wrangler versions upload`. Don't burn time on it again.
Use one of the two patterns we've already settled on:

| Asset type | Pattern | Where |
|---|---|---|
| Markdown / text | Inline as TypeScript template literal | `src/skill.ts` |
| Binary (woff2 etc.) | Base64-inline via a generator script | `src/fonts-data.ts` + `scripts/build-fonts.mjs` |

To add new fonts: drop the `.woff2` into `assets/fonts/`, add it to
`FILES` in `scripts/build-fonts.mjs`, re-run the script, add an
`@font-face` entry in `src/fonts.ts`. Workflow is documented inside
that script.

### The long-term fix: Workers Static Assets

Cloudflare's recommended path for serving static files from a Worker
is the `[assets]` config block (separate from `[[rules]]`):

```toml
[assets]
directory = "./public"
binding = "ASSETS"
# Optional: keep specific paths Worker-routed
# run_worker_first = ["/fonts/*"]
```

Static files in `./public/` get served at the edge automatically,
bypass the Worker entirely (faster, smaller bundle, no cold-start
decode), and integrate cleanly with Hono since they intercept before
the Worker fires.

We haven't migrated because: (a) the base64 path works today and
ships ~107 KB total which is comfortably under Worker limits, (b)
migration requires moving the woff2 files, ripping out
`src/fonts.ts` + `src/fonts-data.ts`, dropping the `/fonts/:name`
route handler in `src/index.ts`, and adding a `public/` directory
served via `[assets]`.

When we do migrate (good follow-up, especially if we ever want to
serve more static files), the steps:

1. `mv assets/fonts public/fonts`
2. Add `[assets] directory = "./public"` to `wrangler.toml`
3. Delete `src/fonts.ts` and `src/fonts-data.ts`
4. Remove the `/fonts/:name` route + `FONTS` import in `src/index.ts`
5. Move `FONT_FACE_CSS` into `src/styles.ts` as an inline string
   (or keep it where it is in a renamed file)

Spec: https://developers.cloudflare.com/workers/static-assets/

## Viewer page title format

`src/views/viewer.ts` formats `<title>` and `og:title` as:

```
<drop title, truncated to 15 words> - <slug> - htmlbin.dev
```

`truncateWords()` adds `…` if the title was longer. Both `<title>` and
`og:title` use the same string so the unfurled card matches the tab.

## CI / continuous deploy — the *only* deploy path

`.github/workflows/deploy.yml` is the **single way** code reaches
production. Hard rule #7 above: never `wrangler deploy` locally and
never push directly to `main`. Both bypass review.

The workflow:

- **PR opened or pushed to** — type-check, `wrangler versions upload`,
  post the Cloudflare preview URL as a sticky comment on the PR
  (`https://<version-id>-htmlbin.<account>.workers.dev`).
- **Merge to `main`** — type-check, `wrangler deploy` to production.
  Triggered by the merge, never by a human running wrangler.

Mandatory loop for every change:

1. `git checkout -b <branch>` from `main`.
2. Make changes, commit, `git push -u origin <branch>`.
3. Open a PR. Wait for the CI comment with the preview URL.
4. Test on the preview URL. Iterate by pushing more commits to the
   same branch — each push refreshes the same sticky comment.
5. Hand the preview URL to the user, wait for explicit approval.
6. Merge the PR → production deploys automatically.

Concurrency cancels superseded PR runs but never cancels a mid-flight
`main` deploy. The only secret in GitHub is `CLOUDFLARE_API_TOKEN`
(template "Edit Cloudflare Workers"). Worker secrets (`TOKEN_PEPPER`,
`GITHUB_CLIENT_SECRET`) are managed via `wrangler secret put` against
production; preview versions share the same bindings because they
live on the same Worker.

## Local dev gotchas

- **GitHub OAuth dev mock.** `.dev.vars` sets
  `GITHUB_CLIENT_ID=GITHUB_CLIENT_SECRET="dev-mock"`. With that sentinel,
  `/auth/github/start` skips github.com and redirects straight to the
  callback with `?mock_login=<x>`. The deterministic mock id derives
  from SHA-256 of the login. Production uses real OAuth app credentials
  from `github.com/settings/applications/new`.
- **D1** in local mode is in `.wrangler/state/`. Run
  `npm run db:apply:local` after schema changes. For column-only
  changes against an existing DB, write a new file in `migrations/`
  and run `npm run db:migrate:local` / `:remote`.
- **Token prefix is `hb_`.** If you change it, update both
  `src/auth.ts` (regex) AND `src/crypto.ts:newApiToken` AND
  `src/index.ts` (existing-token validation regex).
- **Style cache busts itself.** `STYLE_HREF` in `src/styles.ts` is
  `/style.css?v=<hash-of-css>`; the hash auto-bumps on any CSS edit so
  you don't need to hard-refresh after a deploy. New views must import
  the constant rather than hard-coding `/style.css`.
- **Slack/Twitter unfurl cache.** ~24h TTL per URL. To force a re-fetch
  during development, append a throwaway query string (`?_=2`).

## Observability (Sentry)

Both Worker (server) and browser (chrome pages) are wired to Sentry.
Both no-op when `SENTRY_DSN` is unset, so dev and pre-config preview
URLs work without any DSN.

- **Server (Worker):** `src/index.ts` wraps the default export with
  `Sentry.withSentry(...)` from `@sentry/cloudflare`. `tracesSampleRate:
  0.1` (10% performance traces). `sendDefaultPii: false`. DSN read from
  `env.SENTRY_DSN` at request time.
- **Browser:** `/sentry.js` is a Worker-served loader. When DSN is set,
  it injects Sentry's CDN script (`js.sentry-cdn.com/<publicKey>.min.js`)
  and runs `Sentry.init`. When unset, returns a no-op comment so the
  `<script src="/sentry.js" defer>` tags in landing/verify/viewer chrome
  stay harmless. **We never inject Sentry into user-published drop
  HTML at `/p/:slug/raw`** — that's the user's content, served in an
  iframe; we don't touch it.
- **CSP:** the global middleware in `src/index.ts` conditionally
  appends `https://js.sentry-cdn.com` to `script-src` and
  `https://*.ingest.sentry.io` (+ `.us.`) to `connect-src` *only when
  `SENTRY_DSN` is set*. Policy stays tight when Sentry is off.
- **Config:** `SENTRY_DSN` is a Worker secret. Set with:
  `wrangler secret put SENTRY_DSN`. Local dev: copy
  `.dev.vars.example` and uncomment the `SENTRY_DSN` line. The DSN is
  *public* by Sentry's design — embedding it in client JS is intended.
- **CLI:** `sentry-cli` is for source-map upload + release tagging.
  We don't currently upload source maps (Worker is bundled; cold-path
  acceptable). Add later via the deploy workflow if stack-trace
  symbolication becomes painful.

## Files

```
src/
  index.ts          ─ Hono routes (/, /verify, /p/:slug, +discoverability)
  auth.ts           ─ device-code flow + Bearer middleware
  github-oauth.ts   ─ /auth/github/start + /auth/github/callback
  drops.ts          ─ /api/drops CRUD with versioning + context
  onboard.ts        ─ /api/onboard JSON descriptor + markdown walkthrough
  skill.ts          ─ /.well-known/agent-skills/* (Agent Skills RFC v0.2.0)
  crypto.ts         ─ Web Crypto wrappers
  slug.ts           ─ 7-char base62 id generator
  db.ts             ─ D1 helpers + rate limiter
  discoverability.ts─ robots.txt, llms.txt, sitemap, agent-card, openapi, api-catalog
  styles.ts         ─ THE stylesheet + STYLE_HREF (auto-bumping cache buster)
  types.ts          ─ shared types
  views/
    chrome.ts       ─ shared top-bar, footer, httpMemo() helper
    favicon.ts      ─ inline SVG favicon (light/dark adaptive)
    og-image.ts     ─ inline SVG OG card (1200×630) — fallback / per-tab source
    og-png.ts       ─ satori + resvg-wasm PNG renderer (landing + per-drop)
    landing.ts      ─ /
    verify.ts       ─ /verify — single "Sign in with GitHub" button
    viewer.ts       ─ /p/:slug viewer + passcode gate (soft share gate, not encryption)

skills/
  htmlbin/SKILL.md  ─ human-browsable mirror of src/skill.ts (must stay in sync)

.github/workflows/
  deploy.yml        ─ production deploy on main, versioned preview on PR

schema.sql          ─ D1 schema (idempotent for fresh installs)
migrations/         ─ ALTER-style migrations against an existing D1
wrangler.toml       ─ Cloudflare config (Worker name, D1, KV, AI, [[rules]] CompiledWasm)
scripts/
  setup.mjs         ─ provisions D1 + KV, applies schema, sets pepper
  agent-e2e.sh      ─ full functional test
.dev.vars.example   ─ TOKEN_PEPPER + GITHUB_CLIENT_ID/SECRET (dev-mock)
```

DB table, URL path, and user-facing copy are all aligned: **drops**
(`drops` table, `/api/drops/...`). The historical "prototypes" naming
came from an internal Webflow tool and was retired in this codebase.

## Testing

```
npm run test:e2e
```

Walks discovery → onboarding → device-code auth → CRUD → versioning →
context → passcode lifecycle → ownership → cleanup. Same script works
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
