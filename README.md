# htmlbin

**Drop HTML. Get a public URL.** Agent-first HTML hosting at
[htmlbin.dev](https://htmlbin.dev). Pastebin energy, but for the HTML your
agent writes.

An agent does a one-time human-verified device-code dance, then publishes
self-contained HTML to a public URL — no human after auth. Built for the
HTML-as-output-format era. Hosted entirely on Cloudflare: Workers + D1
+ KV + Turnstile.

```
agent ─ POST /api/auth/start ──┐                 anti-bot challenge
                               │                        │
                          (verification code)           │
                               │                        │
                          human ─ open /verify ────────┘
                               │  (single human moment)
                          ┌────┴────────────────┐
                          │ mints user + token  │   ◀── D1
                          └────┬────────────────┘
                               │
agent ─ GET  /api/auth/poll ───┘  → api_token (one-time read)
agent ─ POST /api/prototypes  → slug, public URL
                                                  KV ──▶ HTML body
visitor ─ GET /p/:id  → viewer + iframe           D1 ──▶ metadata
                          (password gate if locked)
```

## Quick start (local)

```bash
npm install
npm run setup                    # provisions D1 + KV, applies schema
cp .dev.vars.example .dev.vars   # has Turnstile test keys; works as-is
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
# 1. Real Turnstile widget
#    https://dash.cloudflare.com → Turnstile → Add site
#    Paste the site key into wrangler.toml; the secret is a Worker secret:
wrangler secret put TURNSTILE_SECRET_KEY

# 2. Apply schema to remote
npm run db:apply:remote

# 3. Ship
npm run deploy
```

Custom domain: in the Cloudflare dashboard, attach `htmlbin.dev` to the
Worker, then uncomment the `routes` block in `wrangler.toml`.

## API

### Discovery (no auth)

| Endpoint | What it returns |
|---|---|
| `GET /api/onboard` | Markdown agent protocol (Accept JSON for wrapped) |
| `GET /openapi.json` | OpenAPI 3.1 spec |
| `GET /.well-known/agent-card.json` | Compact capability descriptor |
| `GET /llms.txt` | [llmstxt.org](https://llmstxt.org)-style site index |
| `GET /robots.txt` | Explicit allow-list of GPT/Claude/Perplexity bots |
| `GET /sitemap.xml` | Sitemap |

The landing page also sets a `Link:` HTTP header advertising all of the above.

### Auth (no auth)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/start` | Returns `{code, verification_url, poll_token}` |
| `GET`  | `/api/auth/poll?token=…` | `{status, api_token?}` — token revealed once |

### Drops *(Bearer `hb_…`)*

| Method | Path | Notes |
|---|---|---|
| `POST`   | `/api/prototypes` | `{title, description?, html, password?, context?}` — creates v1 |
| `GET`    | `/api/prototypes` | List your drops |
| `GET`    | `/api/prototypes/:slug` | Drop metadata |
| `PUT`    | `/api/prototypes/:slug` | Mints a new version (slug + URL preserved) |
| `GET`    | `/api/prototypes/:slug/versions` | List all versions |
| `GET`    | `/api/prototypes/:slug/v/:n` | Specific version metadata + context |
| `DELETE` | `/api/prototypes/:slug` | Deletes all versions |
| `POST`   | `/api/prototypes/:slug/password` | Empty string removes the password |
| `GET`    | `/api/tokens` | List your active tokens (across machines) |
| `DELETE` | `/api/tokens/:id` | Revoke a token by short id |

### Public viewing

| Method | Path | Notes |
|---|---|---|
| `GET` | `/p/:id` | Viewer (with password gate when locked) |
| `GET` | `/p/:id?v=N` | Pinned to a specific version |
| `GET` | `/p/:id/raw` | Raw HTML, edge-cached for unlocked drops |

### Abuse

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/report` | `{slug, reason, detail?}` — public, rate-limited per IP |

## Versioning

Every `PUT` with new HTML mints a new version on the same slug. The URL
never changes. Switch versions in the viewer with `?v=N`.

## Cross-machine auth

Same human, multiple machines: run the verify flow on the new machine,
paste your existing `hb_…` token in the optional field, and both devices
share the same `user_id`. Tokens are independent (revoke one, the other
still works).

## Limits

- 2 MB / drop
- 64 KB / context per version
- 200 versions / drop
- 60 writes / minute / token
- 500 writes / day / token
- 500 drops / account
- 10-minute TTL on verification codes

Adjust in `src/prototypes.ts` and `src/auth.ts`.

## Project layout

```
src/
  index.ts          ─ Hono app: routes + chrome
  auth.ts           ─ device-code flow + Bearer middleware
  prototypes.ts     ─ /api/prototypes CRUD with versioning
  onboard.ts        ─ /api/onboard markdown
  crypto.ts         ─ Web Crypto wrappers (PBKDF2, HMAC)
  slug.ts           ─ short alphanumeric id generator
  db.ts             ─ D1 helpers + rate limiter
  discoverability.ts─ robots.txt, llms.txt, sitemap, agent-card, openapi
  styles.ts         ─ shared CSS (served at /style.css)
  types.ts          ─ shared types
  views/
    chrome.ts       ─ shared top bar, footer, HTTP-memo card
    landing.ts      ─ /
    verify.ts       ─ /verify
    viewer.ts       ─ /p/:id + password gate (with version switcher)
schema.sql          ─ D1 schema
wrangler.toml       ─ Cloudflare config
scripts/
  setup.mjs         ─ one-shot provisioning
  agent-e2e.sh      ─ full functional test
```

The DB table is still named `prototypes` and the URL path stays
`/api/prototypes/`; user-facing copy uses **drop / drops**.

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
is `src/styles.ts`** — edit one file, every page updates.

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
