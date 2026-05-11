# htmlbin

**Drop HTML. Get a public URL.** Agent-first HTML hosting at
[htmlbin.dev](https://htmlbin.dev) — pastebin energy, for the HTML your
agent writes.

An agent does a one-time human-verified device-code dance (humans sign in
with GitHub — one htmlbin account per GitHub identity), then publishes
self-contained HTML to a public URL — no human after auth. Built for the
HTML-as-output-format era. Hosted entirely on Cloudflare: Workers + D1
+ KV.

```
agent ─ POST /api/auth/start ──┐               sign in with GitHub
                               │                       │
                          (verification code)          │
                               │                       │
                          human ─ open /verify ───────┘
                               │  (single human moment)
                          ┌────┴────────────────────┐
                          │ upsert by github_user_id│  ◀── D1
                          │ mint token              │
                          └────┬────────────────────┘
                               │
agent ─ GET  /api/auth/poll ───┘  → api_token (one-time read)
agent ─ POST /api/drops  → slug, public URL
                                                  KV ──▶ HTML body
visitor ─ GET /p/:id  → viewer + iframe           D1 ──▶ metadata
                          (password gate if locked)
```

## Quick start (local)

```bash
npm install
npm run setup                    # provisions D1 + KV, applies schema
cp .dev.vars.example .dev.vars   # uses dev-mock GitHub OAuth; works as-is
npm run dev                      # http://localhost:8787
```

Once the dev server is up, exercise the whole protocol with the agent
test runner:

```bash
npm run test:e2e
```

72+ checks across discovery, auth, drop CRUD, versioning, password
lifecycle, ownership, validation, abuse-report, and cleanup. All should
pass.

## Deploy

```bash
# 1. Real GitHub OAuth app
#    https://github.com/settings/applications/new
#    - Authorization callback URL: https://htmlbin.dev/auth/github/callback
#    Paste the client id into wrangler.toml; the secret is a Worker secret:
wrangler secret put GITHUB_CLIENT_SECRET

# 2. Apply schema (fresh DB) or migrations (existing DB) to remote
npm run db:apply:remote        # fresh DB only
npm run db:migrate:remote      # existing DB — applies migrations/

# 3. Ship
npm run deploy
```

Custom domain: in the Cloudflare dashboard, attach `htmlbin.dev` to the
Worker, then uncomment the `routes` block in `wrangler.toml`.

### Continuous deploy (GitHub Actions)

`.github/workflows/deploy.yml` ships every push to `main` and posts a
versioned preview URL on each PR.

One-time setup:

1. Create a Cloudflare API token with **"Edit Cloudflare Workers"**
   template scope: <https://dash.cloudflare.com/profile/api-tokens>.
2. In GitHub: repo → Settings → Secrets and variables → Actions →
   `New repository secret` → name `CLOUDFLARE_API_TOKEN`, paste the
   token value.

That's it. PRs automatically get a Cloudflare preview URL commented
back; merges to `main` deploy to production.

> Bindings (D1, KV, AI) are shared between previews and production.
> Add an `[env.preview]` block in `wrangler.toml` with separate IDs if
> you want isolated preview data — see
> <https://developers.cloudflare.com/workers/wrangler/environments/>.

## API

### Discovery (no auth)

| Endpoint | What it returns |
|---|---|
| `GET /api/onboard` | JSON protocol descriptor (default). `Accept: text/markdown` or `?format=md` returns the same protocol as a markdown walkthrough. |
| `GET /openapi.json` | OpenAPI 3.1 spec |
| `GET /.well-known/agent-card.json` | Compact capability descriptor |
| `GET /.well-known/agent-skills/index.json` | [Agent Skills Discovery](https://github.com/cloudflare/agent-skills-discovery-rfc) RFC v0.2.0 index (entry skill: `htmlbin/SKILL.md`) |
| `GET /.well-known/api-catalog` | [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) `linkset+json` |
| `GET /llms.txt` | [llmstxt.org](https://llmstxt.org)-style site index |
| `GET /robots.txt` | Explicit allow-list of GPT/Claude/Perplexity bots |
| `GET /sitemap.xml` | Sitemap |
| `GET /index.md` | Landing rendered as Markdown via Workers AI (`Accept: text/markdown` on `/` works too) |
| `GET /favicon.svg` | Single source-of-truth favicon (auto-adapts to light/dark) |
| `GET /og.png`, `GET /og.svg` | Open Graph card for the landing, 1200×630. PNG is what unfurlers consume; SVG is the lightweight fallback. |
| `GET /p/:id/og.png`, `GET /p/:id/og.svg` | Per-drop OG card (title-focused). Same PNG/SVG split. |

The landing page also sets a `Link:` HTTP header advertising all of the above.

### Auth (no auth)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/start` | Returns `{code, verification_url, poll_token}` |
| `GET`  | `/api/auth/poll?token=…` | `{status, api_token?}` — token revealed once |

### Drops *(Bearer `hb_…`)*

| Method | Path | Notes |
|---|---|---|
| `POST`   | `/api/drops` | `{title, description?, html, password?, context?}` — creates v1 |
| `GET`    | `/api/drops` | List your drops |
| `GET`    | `/api/drops/:slug` | Drop metadata |
| `PUT`    | `/api/drops/:slug` | Mints a new version (slug + URL preserved) |
| `GET`    | `/api/drops/:slug/versions` | List all versions |
| `GET`    | `/api/drops/:slug/v/:n` | Specific version metadata + context |
| `DELETE` | `/api/drops/:slug` | Deletes all versions |
| `POST`   | `/api/drops/:slug/password` | Empty string removes the password |
| `GET`    | `/api/tokens` | List your active tokens (across machines) |
| `DELETE` | `/api/tokens/:id` | Revoke a token by short id |

### Public viewing

| Method | Path | Notes |
|---|---|---|
| `GET` | `/p/:id` | Viewer (with password gate when locked) |
| `GET` | `/p/:id?v=N` | Pinned to a specific version |
| `GET` | `/p/:id/raw` | Raw HTML, edge-cached for unlocked drops |

## Versioning

Every `PUT` with new HTML mints a new version on the same slug. The URL
never changes. Switch versions in the viewer with `?v=N`.

## Cross-machine auth

Same human, multiple machines: run the verify flow on the new machine
and sign in with the same GitHub account. We bind one htmlbin account
per GitHub identity (UNIQUE `github_user_id`), so both devices share the
same `user_id`. Tokens are independent — revoke one, the other still
works.

## Limits

- 2 MB / drop
- 64 KB / context per version
- 200 versions / drop
- 60 writes / minute / token
- 500 writes / day / token
- 500 drops / account
- 10-minute TTL on verification codes

Adjust in `src/drops.ts` and `src/auth.ts`.

## Project layout

```
src/
  index.ts          ─ Hono app: routes + chrome
  auth.ts           ─ device-code flow + Bearer middleware
  drops.ts          ─ /api/drops CRUD with versioning
  onboard.ts        ─ /api/onboard JSON descriptor + markdown walkthrough
  skill.ts          ─ /.well-known/agent-skills/* (RFC v0.2.0)
  crypto.ts         ─ Web Crypto wrappers (PBKDF2, HMAC)
  slug.ts           ─ short alphanumeric id generator
  db.ts             ─ D1 helpers + rate limiter
  discoverability.ts─ robots.txt, llms.txt, sitemap, agent-card, openapi, api-catalog
  styles.ts         ─ shared CSS + STYLE_HREF (auto-bumping cache buster)
  types.ts          ─ shared types
  views/
    chrome.ts       ─ shared top bar, footer, HTTP-memo card
    favicon.ts      ─ inline SVG favicon
    og-image.ts     ─ inline SVG OG card (fallback / per-tab source)
    og-png.ts       ─ satori + resvg-wasm PNG renderer (1200×630)
    landing.ts      ─ /
    verify.ts       ─ /verify
    viewer.ts       ─ /p/:id + password gate (with version switcher)
skills/htmlbin/
  SKILL.md          ─ human-browsable mirror of src/skill.ts
.github/workflows/
  deploy.yml        ─ production deploy on main, versioned preview on PR
schema.sql          ─ D1 schema
wrangler.toml       ─ Cloudflare config (incl. [[rules]] CompiledWasm for OG fonts)
scripts/
  setup.mjs         ─ one-shot provisioning
  agent-e2e.sh      ─ full functional test
```

DB table, URL path, and user-facing copy all align: **drops**.

## Security notes

- API tokens are stored only as `sha256(pepper || token)`. Plaintext is
  shown to the agent once via the device-code flow and never again.
- Password-protected drops use PBKDF2-SHA-256 (100k iterations, 16-byte
  random salt). Unlock cookie is HMAC-SHA-256-signed and scoped to the
  slug; it does not contain the password.
- Iframe sandbox + CSP `frame-ancestors 'self'` on `/p/:id/raw` to
  prevent UI redress / clickjacking from external sites.
- Rate limiting is single-region D1 (best-effort). For higher-traffic
  deployments, swap in
  [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/).

## Design

Visual system documented in [DESIGN.md](./DESIGN.md). Short version:
white paper, Geist + Geist Mono, single red accent, HTTP-style memo on
every page, vim-modeline breadcrumb top bar. **Single source of truth
is `src/styles.ts`** — edit one file, every page updates. The link is
content-hashed (`/style.css?v=<hash>`) so the edge cache busts itself
on every CSS change.

## Why HTML?

> Markdown has become a restricting format. HTML can convey almost any
> information an agent can read — and the chance of someone actually
> reading your spec, report or PR writeup is much, much higher if it's
> HTML.
>
> — Thariq, "The Unreasonable Effectiveness of HTML"

htmlbin is a place to put it.

## License

MIT.
