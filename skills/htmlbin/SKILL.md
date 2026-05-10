---
name: htmlbin
description: This skill should be used when the user wants to publish, share, or update self-contained HTML at a public URL via htmlbin (htmlbin.dev). It covers the agent device-code auth flow, fetching the live JSON protocol descriptor, the standard token storage path, and the publish/update/list operations. Trigger on phrases like "publish this HTML", "share this page at a URL", "drop this on htmlbin", "host this HTML somewhere", "give me a link for this page", or "list my htmlbin drops".
---

# htmlbin

API for agents to share HTML. One human auth step, then headless publish.
Live at `https://htmlbin.dev`. Token prefix: `hb_`.

## When to use

Use this skill when the user asks to:

- Publish, share, or "drop" generated HTML at a public URL
- Update an existing htmlbin drop with new HTML (mints a new version)
- List previously published drops or look up a specific drop
- Set or change a password on a drop
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

It returns JSON by default, with `auth.steps[]`, `publish`, `iterate`,
`list`, schemas, and limits. Markdown variant via `Accept: text/markdown`
or `?format=md`.

**Fetch this once per session before invoking htmlbin endpoints.** The
descriptor is the contract; instructions in this skill may lag the API.
When in doubt, prefer what `/api/onboard` says.

```bash
curl -s https://htmlbin.dev/api/onboard | jq
```

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

```
POST /api/auth/start         → { code, verification_url, poll_token }
[print code + URL to human]
GET  /api/auth/poll?token=…  → { api_token } once human verifies
[save api_token to ./.htmlbin/token]
```

**Walkthrough:**

1. Start the auth flow:

   ```bash
   curl -s -X POST https://htmlbin.dev/api/auth/start | jq
   ```

   Returns `code` (e.g. `ABCD-EFGH`), `verification_url` (e.g.
   `https://htmlbin.dev/verify?code=ABCD-EFGH`), and `poll_token`.

2. Print the code and verification URL **clearly** so the human can
   open it in a browser. Example:

   ```
   To authorize htmlbin, open this URL in your browser:
     https://htmlbin.dev/verify?code=ABCD-EFGH

   Code: ABCD-EFGH
   ```

3. Poll for verification (codes expire after 10 minutes):

   ```bash
   curl -s "https://htmlbin.dev/api/auth/poll?token=<poll_token>"
   ```

   Returns `{ status: "pending" }` until the human verifies, then
   `{ status: "verified", api_token: "hb_…" }` exactly once.

4. Save the token:

   ```bash
   mkdir -p .htmlbin && printf "%s" "<api_token>" > .htmlbin/token
   chmod 600 .htmlbin/token
   ```

**Linking a second machine to the same identity:** the `/verify` form has
an optional "existing token" field. Paste an existing `hb_…` from another
device to bind the new session to the same `user_id`. One human, many
agents, shared drops.

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

Returns `{ slug, url, version: 1 }`. The URL (`https://htmlbin.dev/p/<slug>`)
is the share artifact. Slugs are 7-char base62 (regex: `^[A-Za-z0-9]{7}$`).

### Update an existing drop (new version)

```bash
curl -s -X PUT "https://htmlbin.dev/api/drops/<slug>" \
  -H "Authorization: Bearer $(cat .htmlbin/token)" \
  -H "Content-Type: application/json" \
  -d '{ "html": "<!doctype html>…revised…" }'
```

The slug never changes; `latest_version` increments. Old versions remain
accessible at `/p/<slug>?v=N` and `/p/<slug>/raw?v=N`.

### List drops

```bash
curl -s -H "Authorization: Bearer $(cat .htmlbin/token)" \
  https://htmlbin.dev/api/drops | jq
```

Returns an array of `{ slug, title, description, url, raw_url, locked,
latest_version, view_count, created_at, updated_at }`.

### Look up one drop's metadata

```bash
curl -s -H "Authorization: Bearer $(cat .htmlbin/token)" \
  https://htmlbin.dev/api/drops/<slug> | jq
```

### Set or change a password

```bash
curl -s -X POST "https://htmlbin.dev/api/drops/<slug>/password" \
  -H "Authorization: Bearer $(cat .htmlbin/token)" \
  -H "Content-Type: application/json" \
  -d '{ "password": "secret123" }'
```

Pass `null` to remove the password.

### Delete a single version

```bash
curl -s -X DELETE "https://htmlbin.dev/api/drops/<slug>/v/<n>" \
  -H "Authorization: Bearer $(cat .htmlbin/token)"
```

Refused with `409 last_version_cannot_be_deleted` for the only remaining
version — a drop must always keep at least one body. If the deleted
version was the head, `latest_version` is recomputed to the highest
remaining version.

## Optional request fields

- `title` (string, ≤120 chars) — human label, shown in viewer chrome and
  on the per-drop OG card
- `description` (string, ≤300 chars) — subtitle in viewer chrome
- `password` (string) — gate access via the `/p/<slug>` password form
- `context` (string, ≤64 KB) — the reasoning trace, prompt, or thinking
  that produced this version. **Opt-in only**: include only after the
  human has explicitly agreed, since it can include prompt content from
  the conversation.

## Limits

Read these from `/api/onboard.limits` for the live values; current
defaults:

- 2 MB / drop body
- 64 KB / context per version
- 200 versions / drop
- 60 writes / minute / token
- 500 writes / day / token
- 500 drops / account
- 10-min TTL on verification codes

On `429 Too Many Requests`, back off using the `Retry-After` header.

## URLs and conventions

- Drop URL: `https://htmlbin.dev/p/<slug>`
- Specific version: `https://htmlbin.dev/p/<slug>?v=<n>`
- Raw HTML (no chrome): `https://htmlbin.dev/p/<slug>/raw`
- Per-drop OG card: `https://htmlbin.dev/p/<slug>/og.svg`
- Slugs are 7-char base62: `^[A-Za-z0-9]{7}$`
- Tokens are `hb_` + base62: `^hb_[A-Za-z0-9]+$`

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
4. Execute the requested operation (publish / update / list / etc.).
5. Surface the resulting URL (`https://htmlbin.dev/p/<slug>`) to the user
   as the primary artifact.
