# AGENTS.md - htmlbin

Codex operating guide for this repo. This is additive to the existing
Claude Code setup: **do not edit, remove, rename, or reinterpret
`CLAUDE.md` or `.claude/*` behavior unless the user explicitly asks for
Claude changes.** Claude Code should continue to use `CLAUDE.md`; Codex
should use this file.

For deeper project history and rationale, read `CLAUDE.md`. For visual
direction, read `DESIGN.md`.

## What this is

**htmlbin** - agent-first HTML hosting. Pastebin-energy product. An
agent does a one-time human-verified device-code dance, then publishes
self-contained HTML to a public URL. No human after auth. Live at
**htmlbin.dev**.

Public reinvention of an internal Webflow tool ("wrop"). The Webflow
codebase at `/Users/utkarshsengar/dev/prototypes/Prototypes` is
reference-only and must not ship in the public version.

## Stack

- **Cloudflare Workers + Hono** - single Worker, no Next.js.
- **D1** - relational data.
- **KV** - HTML bodies, keyed by `html:<slug>:v<n>`.
- **GitHub OAuth** - the human checkpoint during device-code auth.
- **Web Crypto** - PBKDF2/HMAC. Do not use Node crypto in Worker code.

## Hard Rules

1. Do not clone competitor designs. Take sensibility from references,
   but invent the composition.
2. Do not over-index user-facing copy on Cloudflare. It is an
   implementation detail.
3. No Webflow in the public version.
4. Do not add signup, login, email, dashboard, account, or password
   surfaces. GitHub OAuth exists only inside the device-code verify
   flow.
5. Do not introduce a new format keyword or relitigate the old HTMD
   naming. Product is `htmlbin`; artifacts are "drops".
6. Keep the aesthetic aligned with `DESIGN.md`.
7. Never deploy production directly. No local `wrangler deploy`. No
   `git push origin main`. Ship through branch -> PR -> preview URL ->
   user approval -> merge to `main`.

## Local Workflow

```bash
npm install
npm run setup
cp .dev.vars.example .dev.vars
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm run test:e2e
```

`npm run test:e2e` expects a dev server at `http://localhost:8787`
unless `BASE_URL` is overridden.

For meaningful code changes, run `npm run typecheck`. Run the e2e suite
when API/auth/drop behavior, discoverability, routing, rendering, or
security behavior changes.

## Deployment

The only production path is `.github/workflows/deploy.yml`:

1. Create a branch from `main`.
2. Commit and push the branch.
3. Open a PR.
4. GitHub Actions type-checks, audits production deps, uploads a
   Cloudflare preview version, and comments the preview URL on the PR.
5. Test the preview URL and wait for explicit user approval.
6. Merge to `main`; the workflow deploys production.

Do not bypass this with local Wrangler deploys or direct pushes.

## API Conventions

- Use `snake_case` for every request and response field.
- Every error response must use `apiError()` from `src/errors.ts`.
- Mutating endpoints return the full serialized Drop, except full-drop
  `DELETE`, which returns `204 No Content`.
- `PUT /api/drops/:slug` mints a new version and requires `html`.
- `PATCH /api/drops/:slug` is metadata-only and forbids `html`.
- List endpoints paginate and return `{ data, pagination }`.
- 429 responses carry both `Retry-After` and
  `details.retry_after_seconds`.
- Read endpoints should support `HEAD`.
- Do not add CORS casually. Browser cross-origin XHR with user tokens is
  intentionally blocked.
- Preserve global security headers in `src/index.ts`.

## Discoverability Contract

Treat these as one public contract. If a public agent/crawler surface
changes, update all relevant pieces together:

- `GET /api/onboard`
- `GET /openapi.json`
- `GET /.well-known/agent-card.json`
- `GET /.well-known/agent-skills/index.json`
- `GET /.well-known/agent-skills/htmlbin/SKILL.md`
- `GET /.well-known/api-catalog`
- `GET /llms.txt`
- `GET /robots.txt`
- `GET /sitemap.xml`
- `Link:` header on `/`

`src/discoverability.ts` is the source of truth for most of these.
Agent skill content lives in both `src/skill.ts` and
`skills/htmlbin/SKILL.md`; keep them in sync.

## Design Rules

White paper, Geist + Geist Mono, single red accent (`#D93025`),
HTTP-style memo, vim-modeline breadcrumb top bar, monochrome dark code
blocks.

`src/styles.ts` is the single source of truth for shared CSS and exports
`STYLE_HREF`. New views must import `STYLE_HREF`; do not hard-code
`/style.css`.

Landing examples and the prompt payload live in `src/views/landing.ts`.
Do not add a tabbed CLI/curl alternative without user direction.

## Auth Model

Device-code flow:

1. `POST /api/auth/start` -> `{code, verification_url, poll_token}`
2. Human opens `/verify` and signs in with GitHub.
3. Worker upserts by `github_user_id` and mints a token.
4. `GET /api/auth/poll?token=...` reveals `{api_token}` exactly once.
5. Later calls use `Authorization: Bearer hb_...`.

`./.htmlbin/token` is the preferred agent-side token path, followed by
`HTMLBIN_TOKEN`, then `~/.config/htmlbin/token`.

In local dev, `.dev.vars.example` uses `dev-mock` GitHub OAuth. With
that sentinel, `/auth/github/start` skips GitHub and redirects to the
callback with a synthesized identity.

## Asset Gotchas

Wrangler 4 + ES module Workers has been unreliable for importing
non-JS files outside `src/` through `[[rules]]`.

Use established patterns:

- Markdown/text: inline TypeScript template literal (`src/skill.ts`).
- Binary font data: generator script into base64 TypeScript
  (`src/fonts-data.ts` via `scripts/build-fonts.mjs`).

Do not reintroduce direct `.md` or `.woff2` imports from outside `src/`
without first proving Cloudflare upload works.

## File Map

```text
src/index.ts           Hono app and routes
src/auth.ts            device-code flow and Bearer middleware
src/github-oauth.ts    GitHub OAuth routes
src/drops.ts           /api/drops CRUD, versioning, context
src/onboard.ts         /api/onboard JSON and markdown
src/skill.ts           deployed Agent Skills content
src/discoverability.ts robots, llms.txt, sitemap, agent-card, OpenAPI
src/styles.ts          shared CSS and STYLE_HREF
src/views/             landing, verify, viewer, favicon, OG views
skills/htmlbin/SKILL.md human-browsable mirror of src/skill.ts
schema.sql             D1 schema
migrations/            D1 migrations
wrangler.toml          Cloudflare config
scripts/setup.mjs      provisioning
scripts/agent-e2e.sh   full functional test
```

## Knowledge Capture

At the end of meaningful work:

- Update `AGENTS.md` if Codex operating guidance changed.
- Update `DESIGN.md` if visual behavior changed.
- Update `README.md` if setup, API, deployment, limits, or user-facing
  project behavior changed.
- Leave `CLAUDE.md` unchanged unless the user explicitly asks to change
  Claude instructions.
