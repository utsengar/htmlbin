---
name: htmlbin
description: This skill should be used when the user wants to publish, share, or update self-contained HTML at a public URL via htmlbin (htmlbin.dev). It covers the agent device-code auth flow, the live /api/onboard protocol descriptor, the standard token storage path, and the publish/update/list/delete operations. Trigger on phrases like "publish this HTML", "share this page at a URL", "drop this on htmlbin", "host this HTML somewhere", "give me a link for this page", or "list my htmlbin drops".
---

# htmlbin

API for agents to share HTML. One human auth step, then headless publish.
Live at `https://htmlbin.dev`. Token prefix: `hb_`.

## When to use

Use this skill when the user asks to:

- Publish, share, or "drop" generated HTML at a public URL
- Update an existing htmlbin drop with new HTML (mints a new version)
- Update title or description without re-uploading HTML
- List previously published drops or look up a specific drop
- Set or change a passcode on a drop
- Delete a single version or the whole drop
- Authorize a new machine against an existing identity

Do **not** use this skill for:

- Generating the HTML itself — htmlbin only hosts; produce HTML the usual way
- Hosting non-HTML files (no JS bundles, no images at the public URL)
- Backends, databases, or persistent server-side state

## Source of truth: `/api/onboard`

The live, authoritative protocol descriptor lives at:

```
https://htmlbin.dev/api/onboard
```

It returns JSON by default with `auth.steps[]`, `publish`, `iterate`,
`list_my_drops`, `other_endpoints`, `error_shape`, `drop_shape`, and `limits`.
Markdown variant via `Accept: text/markdown` or `?format=md`.

**Fetch this once per session before invoking htmlbin endpoints.** The
descriptor is the contract; instructions in this skill may lag the API.
When in doubt, prefer what `/api/onboard` says.

## Conventions

- **All field names are snake_case** — `raw_url`, `latest_version`, `created_at`, `view_count`, etc.
- **All 4xx/5xx responses share one shape.** Switch on `error.code` (not on `error.message`):

```json
{
  "error": {
    "code": "html_too_large",
    "message": "HTML exceeds 2097152 bytes.",
    "details": { "max_bytes": 2097152 }
  }
}
```

- **All mutating endpoints return the full Drop object** (or 204 No Content for full-drop delete). No need to re-fetch.
- **Rate-limited responses (429)** carry a `Retry-After` header and `details.retry_after_seconds`.

## Token storage

Look for the API token in this order:

1. `./.htmlbin/token` — project-local, **preferred** (no permission prompt
   for agents that don't write outside cwd)
2. `HTMLBIN_TOKEN` env var
3. `~/.config/htmlbin/token` — machine-global fallback

If no token is found in any of these locations, run the auth flow.

Token format: `hb_` followed by base62 characters. Validation regex:
`^hb_[A-Za-z0-9]+$`.

## Auth: device-code flow (one-time, human-in-the-loop)

The human moment is a **Sign in with GitHub** click — htmlbin binds one
account per GitHub identity (`read:user` scope only: public username +
numeric id). Cycling tokens recycles the same account, so quotas and
existing drops follow the human across devices.

```
POST /api/auth/start         → { code, verification_url, poll_token, expires_in, poll_interval }
[print verification_url to human → they open it and sign in with GitHub]
GET  /api/auth/poll?token=…  → { status, api_token? } once GitHub returns
[save api_token to ./.htmlbin/token]
```

Walkthrough:

1. Start the auth flow:

   ```bash
   curl -s -X POST https://htmlbin.dev/api/auth/start | jq
   ```

   Returns `code` (e.g. `ABCD-EFGH`), `verification_url` (e.g.
   `https://htmlbin.dev/verify?code=ABCD-EFGH`), `poll_token`,
   `expires_in` (seconds), and `poll_interval` (seconds).

2. Print the verification URL (and the code, for confirmation) so the
   human can open it in a browser. They'll see a single "Sign in with
   GitHub" button — that's the only thing they have to click. Example:

   ```
   To authorize htmlbin, open this URL and sign in with GitHub:
     https://htmlbin.dev/verify?code=ABCD-EFGH

   Code: ABCD-EFGH
   ```

3. Poll for verification (codes expire after 10 minutes):

   ```bash
   curl -s "https://htmlbin.dev/api/auth/poll?token=<poll_token>"
   ```

   Returns `{ status: "pending" }` until the human verifies, then
   `{ status: "verified", api_token: "hb_…", user_id: "..." }` exactly once.

4. Save the token:

   ```bash
   mkdir -p .htmlbin && printf "%s" "<api_token>" > .htmlbin/token
   chmod 600 .htmlbin/token
   ```

**Linking a second machine to the same identity:** open `/verify` on the
new machine and sign in with the same GitHub account. We bind one htmlbin
account per GitHub identity, so the new device's token attaches to the
same `user_id` automatically. One human, many agents, shared drops.

## Common operations

All authenticated requests use `Authorization: Bearer <token>`.

### Publish a new drop

```bash
curl -s -X POST https://htmlbin.dev/api/drops \
  -H "Authorization: Bearer $(cat .htmlbin/token)" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My page",
    "description": "Optional subtitle",
    "html": "<!doctype html><html>…</html>"
  }'
```

Returns the full Drop (HTTP 201):

```json
{
  "slug": "aB3xK7g",
  "title": "My page",
  "description": "Optional subtitle",
  "url": "https://htmlbin.dev/p/aB3xK7g",
  "raw_url": "https://htmlbin.dev/p/aB3xK7g/raw",
  "locked": false,
  "latest_version": 1,
  "view_count": 0,
  "created_at": 0,
  "updated_at": 0
}
```

### Update HTML — mint a new version (PUT)

```bash
curl -s -X PUT "https://htmlbin.dev/api/drops/<slug>" \
  -H "Authorization: Bearer $(cat .htmlbin/token)" \
  -H "Content-Type: application/json" \
  -d '{ "html": "<!doctype html>…revised…" }'
```

**PUT requires `html`.** The slug never changes; `latest_version`
increments. Old versions remain at `/p/<slug>?v=N`. Returns the full Drop.

### Update title/description only (PATCH)

```bash
curl -s -X PATCH "https://htmlbin.dev/api/drops/<slug>" \
  -H "Authorization: Bearer $(cat .htmlbin/token)" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Better title" }'
```

PATCH never mints a new version. Including `html` in the body returns
`400 metadata_only_on_patch` — use PUT instead.

### List drops (paginated)

```bash
curl -s -H "Authorization: Bearer $(cat .htmlbin/token)" \
  "https://htmlbin.dev/api/drops?page=1&pageSize=50&sortBy=updated_at&sortOrder=desc"
```

Response:

```json
{
  "data": [ /* Drop[] */ ],
  "pagination": {
    "page": 1, "page_size": 50,
    "total_items": 142, "total_pages": 3,
    "sort_by": "updated_at", "sort_order": "desc"
  }
}
```

Query params: `page` (default 1), `pageSize` (default 50, max 200),
`sortBy` (`created_at` | `updated_at` | `view_count`, default `created_at`),
`sortOrder` (`asc` | `desc`, default `desc`).

### Look up one drop

```bash
curl -s -H "Authorization: Bearer $(cat .htmlbin/token)" \
  https://htmlbin.dev/api/drops/<slug> | jq
```

### Set or change a passcode

```bash
curl -s -X POST "https://htmlbin.dev/api/drops/<slug>/passcode" \
  -H "Authorization: Bearer $(cat .htmlbin/token)" \
  -H "Content-Type: application/json" \
  -d '{ "passcode": "secret123" }'
```

Pass `"passcode": ""` to remove. Returns the full updated Drop. The
passcode is a soft share gate, not encryption.

### Delete a single version

```bash
curl -s -X DELETE "https://htmlbin.dev/api/drops/<slug>/v/<n>" \
  -H "Authorization: Bearer $(cat .htmlbin/token)"
```

Refused with `409 last_version_cannot_be_deleted` for the only remaining
version — a drop must always keep at least one body. Returns the full
updated Drop (with possibly-recomputed `latest_version`).

### Delete the whole drop

```bash
curl -s -X DELETE "https://htmlbin.dev/api/drops/<slug>" \
  -H "Authorization: Bearer $(cat .htmlbin/token)"
```

Returns `204 No Content`.

### Who am I

```bash
curl -s -H "Authorization: Bearer $(cat .htmlbin/token)" \
  https://htmlbin.dev/api/me | jq
```

Returns `user_id`, `created_at`, `drop_count`, and the calling token's
`{ id, label, created_at, last_used_at }`.

## Optional request fields

- `title` (string, ≤200 chars) — human label, shown in viewer chrome and
  on the per-drop OG card
- `description` (string, ≤500 chars) — subtitle in viewer chrome
- `passcode` (string, ≥4 chars) — soft share gate, shown on `/p/<slug>` before the body
- `context` (string, ≤64 KB) — the reasoning trace, prompt, or thinking
  that produced this version. **Opt-in only**: include only after the
  human has explicitly agreed, since it can include prompt content from
  the conversation.

## Rate limiting

429 responses carry a `Retry-After` header and `details.retry_after_seconds`.
Codes:

- `rate_limited` — 60 writes/min/token
- `daily_quota_exceeded` — 500 writes/day/token
- `quota_exceeded` — 500 drops/account
- `version_limit_reached` — 200 versions/drop

## Limits

Read live values from `/api/onboard.limits`; current defaults:

- 2 MB / drop body
- 64 KB / context per version
- 200 versions / drop
- 60 writes / minute / token
- 500 writes / day / token
- 500 drops / account
- 10-min TTL on verification codes

## URLs and conventions

- Drop URL: `https://htmlbin.dev/p/<slug>`
- Specific version: `https://htmlbin.dev/p/<slug>?v=<n>`
- Raw HTML (no chrome): `https://htmlbin.dev/p/<slug>/raw`
- Per-drop OG card: `https://htmlbin.dev/p/<slug>/og.svg` (or `.png`)
- Slugs are 7-char base62: `^[A-Za-z0-9]{7}$`
- Tokens are `hb_` + base62: `^hb_[A-Za-z0-9]+$`

## Quality floor

These apply to every drop regardless of pattern or brand context. They're not pluggable — htmlbin's stance on what a good drop is.

- Mobile-OK — single column at <640px.
- Semantic HTML — real `<h1>`, real `<details>`, real `<table>` when tabular.
- `prefers-color-scheme` aware (light + dark).
- Inline `<style>`; external deps limited to well-known CDNs (Google Fonts, esm.sh, Tailwind CDN).
- No fake mac chrome (traffic-light dots etc.) — the htmlbin landing prompt is the *one* product-wide exception; user drops don't get it.
- No stock illustrations, no AI-generated photos.
- No emoji unless the user's brand uses them.
- Footer line: small mono, "published via htmlbin.dev". Keep it understated.

## Make it feel like the user's own

Drops should look like they belong to the human publishing them, not like a generic htmlbin template. Read brand signals from the cwd in this order — first non-empty source wins:

1. **Design doc** — `DESIGN.md`, `STYLE.md`, `BRAND.md`, `docs/DESIGN.md`, `docs/design-system.md`. Skim for palette, typography, mood, voice. Highest-signal because it's deliberate.
2. **Allowlist signals** — `package.json` (name, description, keywords, homepage), `README.md` first paragraph, the git remote host/org, any public website URL surfaced in the above.
3. **Heuristic** — look around the cwd at the kind of metadata you'd cite to a code reviewer. Apply taste from that.
4. **`.htmlbin/brand.json`** — optional explicit override: `{ palette?, type?, mood?, reference_url? }`. All fields optional.
5. **Neutral fallback** — when nothing else is available: "editorial cream", "technical mono", or "blueprint navy". Pick one per drop, don't mix.

**Do not read** `.env*`, `~/.ssh/*`, `.git/credentials`, or any file path containing `secret`, `credential`, `token`, or `key`. Read-only signals; never quote private content into the drop body.

**Derive taste, don't impersonate.** If the user works at a company with a well-known visual language, capture the *energy* (playful, monochrome, gradient-heavy, whatever it is) without copying their public website pixel-for-pixel. Drops that look like a copy of someone else's site are the wrong outcome.

**The human's prompt always wins.** Natural-language overrides ("make it dark", "match Stripe's vibe", "use serifs") trump everything above. Patterns and brand sensing are floors, not ceilings.

## Patterns — local first, official as fallback

Common drop kinds (PR explainers, summary roundups, plan/spec writeups, …) ship as small markdown files anyone can author. Each pattern names triggers, a content checklist, layout directions, and a "don't" list. Read patterns to decide *structure*; use brand sensing (above) to decide *look*.

**Where patterns live.** Resolve in this order — first match wins per pattern name:

1. `./.htmlbin/patterns/*.md` — project-local. Highest priority.
2. `~/.config/htmlbin/patterns/*.md` — machine-global (same dir as the token fallback).
3. **Official catalog** — fetch from `https://htmlbin.dev/.well-known/patterns/index.json` for the list, or `https://htmlbin.dev/.well-known/patterns/<name>.md` for a specific one. Cache once per session.
4. **No pattern at all** — freestyle within the quality floor. Always valid; patterns are starting floors, not requirements.

**Pattern file schema.** YAML front matter + markdown body. Authors write these in any text editor; no tooling required.

```markdown
---
name: pr-explainer
description: One-line summary of what this pattern is for.
triggers:
  - explain this pr
  - summarize this diff
brand_sensing: true
---

# Title

## When to use
## Content checklist
## Layout directions
## How to pick
## Don't
```

**Picking a pattern.** Match the human's request against each installed pattern's `triggers` (case-insensitive substring or near-paraphrase). On multiple matches: project-local beats machine-global beats official; more-specific trigger beats less-specific. On no match: freestyle.

**Authoring your own.** Drop a markdown file in `./.htmlbin/patterns/` (project-local) or `~/.config/htmlbin/patterns/` (machine-global). Share by pushing to a gist or repo; the htmlbin CLI's `patterns add <source>` will install from any URL or shorthand (`github:user/repo/path`, `gist:hash`).

**Why this shape.** Patterns are guidance the *agent* reads and applies — not server-rendered templates the platform serves. htmlbin's server stays thin; the long tail of drop kinds lives in user-space, where it belongs.

## What htmlbin won't do (don't suggest these)

- **No login UI, no signup, no email, no dashboard.** The device-code
  flow is the entire human-facing surface. Don't tell the user to "go
  to your dashboard" or "sign in" — there is none.
- **No build pipeline, no SSR, no backend.** HTML uploads exactly as
  posted. Inline `<script>` runs client-side; that's the limit.
- **No file types other than HTML.** No raw JS endpoints, no image
  hosting, no JSON serving. The viewer iframes the HTML; everything
  the page needs must be inline or remote.

## Recommended workflow when invoked

1. Check for an existing token in the standard locations.
2. If no token, run the device-code flow (print code + URL clearly).
3. Fetch `/api/onboard` once to confirm endpoint shapes for this session.
4. **If generating new HTML:** pick a pattern (see "Patterns — local first, official as fallback") for structure; apply brand sensing (see "Make it feel like the user's own") for look. Both are floors, not ceilings — the human's prompt wins. Render within the quality floor.
5. Execute the requested operation (publish / update / list / etc.).
6. Surface the resulting URL (`https://htmlbin.dev/p/<slug>`) to the user
   as the primary artifact.
