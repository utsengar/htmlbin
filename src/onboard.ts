// Agent onboarding. Returned by GET /api/onboard.
//
// Two shapes:
//   - buildOnboardJson() — the canonical, machine-readable protocol
//     descriptor. JSON. No prose-to-interpret; just endpoints, methods,
//     body schemas. This is what agents should consume by default.
//   - buildOnboardText() — the same protocol as a friendly markdown
//     walkthrough, returned only when Accept: text/markdown is requested.
//
// JSON is the default because "fetch a URL and follow what it says" is the
// shape of a prompt-injection payload — agents are (rightly) trained to be
// wary of it. A structured descriptor with named fields reads as data, not
// as instructions, and slips through the same agents without friction.
//
// This file IS the contract. All other agent surfaces (agent-card.json,
// openapi.json, SKILL.md, llms.txt) must align with what this returns —
// don't introduce divergent claims about request/response shapes elsewhere.

export function buildOnboardJson(publicUrl: string): object {
  return {
    schema_version: "1",
    name: "htmlbin",
    public_url: publicUrl,
    summary:
      "Agent-first HTML hosting. Drop self-contained HTML, get a public URL.",
    naming_convention: "snake_case for all request and response field names",
    spec: {
      openapi: `${publicUrl}/openapi.json`,
      agent_card: `${publicUrl}/.well-known/agent-card.json`,
      api_catalog: `${publicUrl}/.well-known/api-catalog`,
      agent_skills_index: `${publicUrl}/.well-known/agent-skills/index.json`,
      llms_txt: `${publicUrl}/llms.txt`,
      onboard_markdown: `${publicUrl}/api/onboard (Accept: text/markdown)`,
    },
    cli: {
      package: "@htmlbin/cli",
      install: "npm i -g @htmlbin/cli (or: npx -y @htmlbin/cli@latest <subcommand>)",
      runtime: "Node 20+",
      summary:
        "First-party CLI. Wraps every endpoint below, packages the token-resolution order, and auto-emits JSON when invoked from a coding-agent runner (CLAUDE_CODE / CURSOR_AGENT / CODEX / AIDER / ...). Stable exit codes (0=ok, 2=auth, 3=forbidden, 4=not_found, 5=rate_limit, 6=size, 7=bad_input, 8=network). The bracketed `error.code` on stderr mirrors this API's error.code shape.",
      cloud_only_flags:
        "--metadata and --upsert are cloud-only. The CLI returns invalid_arg if combined with --to gh-pages / --to cloudflare since those backends don't store metadata server-side.",
    },
    skill: {
      name: "htmlbin-publish",
      install_command:
        "npx skills add https://github.com/utsengar/htmlbin-cli --skill htmlbin-publish",
      distribution: "skills.sh",
      source: "https://github.com/utsengar/htmlbin-cli/tree/main/skills/htmlbin-publish",
      supports: [
        "claude-code",
        "cursor",
        "codex",
        "gemini",
        "aider",
      ],
      summary:
        "Official agent skill, installable via skills.sh. Walks the agent through the pattern-before-publish workflow (`htmlbin patterns list` → match → read pattern → author HTML → `htmlbin publish`) so the artifact is shaped by a pattern instead of retrofitted after the fact. Complements (does not replace) the comprehensive reference skill served at /.well-known/agent-skills/htmlbin/SKILL.md.",
      see_also: `${publicUrl}/.well-known/agent-skills/htmlbin/SKILL.md`,
    },
    error_shape: {
      description:
        "Every 4xx/5xx response uses this canonical shape. Switch on `code`, not on `message`.",
      example: {
        error: {
          code: "html_too_large",
          message: "HTML exceeds 2097152 bytes.",
          details: { max_bytes: 2097152 },
        },
      },
    },
    auth: {
      type: "device_code",
      header: "Authorization: Bearer <token>",
      token_format: "hb_<base62>",
      token_storage: {
        primary: "./.htmlbin/token",
        fallback: "~/.config/htmlbin/token",
        env_var: "HTMLBIN_TOKEN",
        note:
          "Project-local storage avoids prompting an agent to write outside its working directory.",
      },
      steps: [
        {
          step: 1,
          method: "POST",
          url: `${publicUrl}/api/auth/start`,
          body: { label: "string (optional, e.g. 'claude-code')" },
          returns: {
            code: "string (show this to the human)",
            verification_url: "string (open this in a browser)",
            poll_token: "string (use in step 3)",
            expires_in: "integer (seconds)",
            poll_interval: "integer (seconds, default 2)",
          },
        },
        {
          step: 2,
          human_action:
            "Open verification_url and sign in with GitHub.",
          note:
            "Only human moment. We bind one htmlbin account per GitHub identity (read:user only — public username + id), so quotas and existing drops follow the human across machines. After this the agent is autonomous.",
        },
        {
          step: 3,
          method: "GET",
          url: `${publicUrl}/api/auth/poll`,
          query: { token: "<poll_token from step 1>" },
          returns: {
            status: "'pending' | 'verified' | 'expired' | 'claimed' | 'not_found'",
            api_token: "string (only on first 'verified' read; revealed exactly once)",
            user_id: "string (only on first 'verified' read)",
          },
          note:
            "Poll every poll_interval seconds until status != 'pending'. The api_token is shown once — store it.",
        },
      ],
    },
    drop_shape: {
      description:
        "Every endpoint that creates, reads, or mutates a single drop returns this shape.",
      example: {
        slug: "aB3xK7g",
        title: "My page",
        description: "Optional subtitle",
        url: `${publicUrl}/p/aB3xK7g`,
        raw_url: `${publicUrl}/p/aB3xK7g/raw`,
        locked: false,
        latest_version: 3,
        view_count: 17,
        metadata: { repo: "u/r", pr: "42" },
        created_at: 0,
        updated_at: 0,
      },
    },
    publish: {
      method: "POST",
      url: `${publicUrl}/api/drops`,
      headers: {
        Authorization: "Bearer <api_token>",
        "Content-Type": "application/json",
      },
      body: {
        title: "string (required, ≤200 chars)",
        description: "string (optional, ≤500 chars)",
        html: "string (required, full self-contained HTML document, ≤2 MB)",
        passcode: "string (optional, ≥4 chars; soft gate, not encryption — shown on /p/<slug> before the body)",
        context: "string (optional, ≤64 KB; reasoning trace — opt-in per the human)",
        metadata: "object (optional, ≤10 keys; flat string→string. Owner-side tag bag for lookup via GET /api/drops?metadata.k=v. Not exposed on /p/.)",
      },
      returns: "Drop (see drop_shape)",
      status: 201,
      cli: {
        command: "htmlbin publish <file>",
        flags: {
          "--title <text>": "Sets `title` (defaults to filename).",
          "--description <text>": "Sets `description`.",
          "--metadata <k=v>":
            "Repeatable; up to 10. Sets `metadata`. Cloud only.",
          "--upsert":
            "Lookup-by-metadata first; PUT if a drop matches, POST if not. Requires at least one --metadata pair. Cloud only. Returns `matched: true|false` alongside `slug`/`url` in JSON mode.",
        },
      },
    },
    iterate: {
      description:
        "Two distinct operations on an existing drop: PUT for a new version, PATCH for metadata-only changes.",
      new_version: {
        method: "PUT",
        url: `${publicUrl}/api/drops/<slug>`,
        body: {
          html: "string (required — PUT always mints a new version)",
          title: "string (optional, ≤200 chars)",
          description: "string (optional, ≤500 chars)",
          context: "string (optional, ≤64 KB)",
          metadata: "object (optional; replaces whole metadata map — omit to leave untouched, {} to clear)",
        },
        returns: "Drop (with bumped latest_version)",
        note:
          "Slug + public URL stay stable. Humans switch versions in the viewer with ?v=N.",
      },
      metadata_only: {
        method: "PATCH",
        url: `${publicUrl}/api/drops/<slug>`,
        body: {
          title: "string (optional, ≤200 chars)",
          description: "string (optional, ≤500 chars)",
          metadata: "object (optional; replaces whole metadata map — omit to leave untouched, {} to clear)",
        },
        returns: "Drop (latest_version unchanged)",
        note: "Including `html` here returns 400 metadata_only_on_patch — use PUT.",
      },
      cli: {
        command: "htmlbin update <slug>",
        flags: {
          "--file <path>":
            "New HTML body. Presence of this flag is what selects PUT (new version) vs PATCH (without it: metadata only).",
          "--title <text>": "New title.",
          "--description <text>": "New description.",
          "--metadata <k=v>":
            "Repeatable. Replaces the whole metadata map. Mutually exclusive with --clear-metadata.",
          "--clear-metadata":
            "Explicit clear; sends metadata: {}. Mutually exclusive with --metadata.",
        },
        dispatch:
          "With --file: PUT /api/drops/<slug> (new version). Without --file: PATCH /api/drops/<slug> (metadata-only, latest_version unchanged).",
        cloud_only: true,
      },
    },
    list_my_drops: {
      method: "GET",
      url: `${publicUrl}/api/drops`,
      query: {
        page: "integer (default 1, min 1)",
        pageSize: "integer (default 50, max 200)",
        sortBy: "'created_at' | 'updated_at' | 'view_count' (default 'created_at')",
        sortOrder: "'asc' | 'desc' (default 'desc')",
        "metadata.<key>": "string (optional, repeatable; AND-filters drops where metadata.<key> = value. Conventional keys: repo, pr, sha, agent, ci_run.)",
      },
      returns: {
        data: "Drop[]",
        pagination: {
          page: "integer",
          page_size: "integer",
          total_items: "integer",
          total_pages: "integer",
          sort_by: "string",
          sort_order: "string",
        },
      },
      cli: {
        command: "htmlbin list",
        flags: {
          "--metadata <k=v>":
            "Repeatable. AND-filters by metadata. Cloud only.",
          "--limit <n>": "Cap the row count.",
          "-n <n>": "Alias for --limit.",
        },
      },
      lookup_then_mutate: {
        description:
          "Recipe for finding a drop you previously tagged and updating it without storing slugs client-side: GET filter, then PUT if a drop matches, otherwise POST. Works for any tag combination, not just CI / PR previews — the metadata field is free-form.",
        steps: [
          `GET ${publicUrl}/api/drops?metadata.<k1>=<v1>&metadata.<k2>=<v2>`,
          "if data[0]: PUT /api/drops/<data[0].slug> with the new html",
          "else:       POST /api/drops with html + metadata",
        ],
        cli_one_liner: {
          command:
            "htmlbin publish <file> --upsert --metadata <k1>=<v1> --metadata <k2>=<v2>",
          note:
            "The CLI's --upsert flag packages the entire lookup-then-mutate dance into one command. There is still no server-side upsert endpoint — the CLI just runs the two HTTP calls for you and surfaces `matched: true|false` in JSON mode. Recommended path for stable cloud URLs across CI pushes (use `repo` + `pr` as the tag combination).",
        },
        example_tag_setups: [
          { repo: "u/r", pr: "42" },
          { session_id: "<chat-id>", kind: "deck" },
          { client: "acme", project: "rebrand", status: "draft" },
        ],
        race_note:
          "If two writers can run in parallel for the same tag combination, serialize them at the call site. For CI / PR previews specifically, set `concurrency: group:` on the GitHub Actions workflow. Other shapes (per-session, per-client) usually don't race.",
      },
    },
    other_endpoints: {
      whoami: {
        method: "GET",
        url: `${publicUrl}/api/me`,
        returns: {
          user_id: "string",
          created_at: "integer (unix ms)",
          drop_count: "integer",
          token: { id: "string (12 hex)", label: "string|null", created_at: "integer", last_used_at: "integer|null" },
        },
      },
      get_drop: { method: "GET", url: `${publicUrl}/api/drops/<slug>` },
      list_versions: {
        method: "GET",
        url: `${publicUrl}/api/drops/<slug>/versions`,
      },
      get_version: {
        method: "GET",
        url: `${publicUrl}/api/drops/<slug>/v/<n>`,
      },
      delete_drop: {
        method: "DELETE",
        url: `${publicUrl}/api/drops/<slug>`,
        returns: "204 No Content",
      },
      delete_version: {
        method: "DELETE",
        url: `${publicUrl}/api/drops/<slug>/v/<n>`,
        returns: "Drop (with possibly-updated latest_version)",
        note:
          "Refused with 409 last_version_cannot_be_deleted on the only remaining version.",
      },
      set_passcode: {
        method: "POST",
        url: `${publicUrl}/api/drops/<slug>/passcode`,
        body: { passcode: "string ('' to remove)" },
        returns: "Drop",
      },
      list_my_tokens: { method: "GET", url: `${publicUrl}/api/tokens` },
      revoke_token: {
        method: "DELETE",
        url: `${publicUrl}/api/tokens/<id>`,
        note: "id = first 12 hex chars of the token hash",
        returns: "204 No Content",
      },
    },
    cross_machine: {
      method:
        "On a new machine, run /api/auth/start and sign in with the same GitHub account at /verify. Both machines end up bound to the same htmlbin account.",
      result: "Both machines share the same user_id with independent tokens.",
    },
    limits: {
      max_html_bytes: 2_097_152,
      max_context_bytes: 65_536,
      max_versions_per_drop: 200,
      writes_per_minute: 60,
      writes_per_day: 500,
      drops_per_account: 500,
      verification_ttl_seconds: 600,
    },
    rate_limits: {
      response: "429 with `error.code = rate_limited` (or daily_quota_exceeded / quota_exceeded)",
      retry_after_header: "Set to seconds until the next window opens.",
      retry_after_details: "Also returned as `details.retry_after_seconds` in the body.",
    },
    errors: {
      shape: {
        error: {
          code: "<machine-readable identifier>",
          message: "<human-readable summary>",
          details: "<optional object with context, e.g. { max_bytes: 2097152 }>",
        },
      },
      common_codes: [
        "unauthorized",
        "invalid_token",
        "rate_limited",
        "daily_quota_exceeded",
        "quota_exceeded",
        "html_too_large",
        "html_required",
        "title_required",
        "title_too_long",
        "description_too_long",
        "context_too_large",
        "passcode_required",
        "passcode_too_short",
        "metadata_only_on_patch",
        "forbidden",
        "not_found",
        "version_not_found",
        "last_version_cannot_be_deleted",
        "version_limit_reached",
        "invalid_slug",
        "invalid_arg",
        "invalid_json",
        "token_required",
      ],
    },
    recommendations: {
      mobile_floor: {
        summary:
          "Render at 360px without horizontal scroll. This is the #1 failure mode for agent-authored drops — author mobile-first.",
        must_have: [
          "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> in <head> (server injects if missing).",
          "No fixed pixel widths >360px on layout containers. Use max-width paired with width: 100%.",
          "Long unbreakable strings (URLs, paths, hashes) wrap: overflow-wrap: anywhere on prose, table cells, inline code.",
          "<pre> and wide <table> scroll internally, not the page: overflow-x: auto; max-width: 100%.",
          "Media is fluid: img, svg, video, iframe { max-width: 100% }.",
          "Mentally test at 360px and 768px before publishing.",
        ],
        server_safety_net:
          "Every /p/<slug>/raw response gets a small defensive style appended at the tail of <head>: html,body{max-width:100vw;overflow-x:clip}, plus fluid img/svg/video/iframe and max-width:100% on pre/table. It's a guard against the most common break, not a license to skip mobile design.",
        skill: `${publicUrl}/.well-known/agent-skills/htmlbin/SKILL.md`,
      },
    },
    notes: [
      "Drops are rendered in an iframe — HTML must be standalone (CDN imports OK; no build step).",
      "If the human's agent sandbox blocks new domains, allow htmlbin.dev once before running this flow.",
    ],
  };
}

export function buildOnboardText(publicUrl: string): string {
  return `# htmlbin — Agent Protocol (markdown)

> The canonical, machine-readable form of this is at the same URL with
> \`Accept: application/json\`. This markdown variant is the same protocol
> rendered for humans previewing the API.

You are deploying an HTML artifact to htmlbin. Anyone with the URL can view it.
htmlbin is built for agents: the workflow below is the canonical, fastest path.

## TL;DR

1. POST /api/auth/start         → get a code + verification_url + poll_token
2. Print the URL + code to the human; ask them to verify (one-time)
3. GET /api/auth/poll?token=…   → poll until you receive an api_token
4. POST /api/drops (Bearer api_token) → upload HTML, receive a public URL

The api_token is shown exactly once. Store it for reuse on this machine.

## Install as an agent skill (one command)

If your agent runtime supports [skills.sh](https://skills.sh) — Claude
Code, Cursor, Codex, Gemini, Aider, and others — install the official
\`htmlbin-publish\` skill once and the workflow is ambient from then on:

\`\`\`bash
npx skills add https://github.com/utsengar/htmlbin-cli --skill htmlbin-publish
\`\`\`

The skill teaches the agent the pattern-before-publish workflow
(\`htmlbin patterns list\` → match → read the pattern → author HTML →
\`htmlbin publish\`) so each drop is shaped by an explicit pattern
instead of retrofitted after the fact. After install, the agent
responds to phrases like "publish a drop to htmlbin", "share this as a
page", or "make a preview for this PR".

The skill complements (does not replace) this onboarding descriptor.
The descriptor is the protocol contract; the skill is the workflow
opinion. Either is fine on its own.

## Using the CLI

\`@htmlbin/cli\` (Node 20+) wraps every endpoint here. It auto-detects
coding-agent runners (\`CLAUDE_CODE\`, \`CURSOR_AGENT\`, \`CODEX\`, \`AIDER\`,
…) and switches to JSON output without a flag. Exit codes are stable
(0=ok, 2=auth, 3=forbidden, 4=not_found, 5=rate_limit, 6=size, 7=bad_input,
8=network); the bracketed \`error.code\` on stderr mirrors this API's
\`error.code\`. Prefer it to hand-rolled curl when reachable.

\`\`\`bash
npx -y @htmlbin/cli@latest publish ./out.html --title "PR #42 preview"
npx -y @htmlbin/cli@latest publish ./out.html --upsert --metadata repo=u/r --metadata pr=42
npx -y @htmlbin/cli@latest update <slug> --file ./newer.html       # PUT (new version)
npx -y @htmlbin/cli@latest update <slug> --title "Renamed"         # PATCH (metadata only)
npx -y @htmlbin/cli@latest list --metadata kind=spec --metadata status=draft
\`\`\`

\`--metadata\` and \`--upsert\` are cloud-only — the CLI returns
\`invalid_arg\` when combined with \`--to gh-pages\` / \`--to cloudflare\`.

## Naming + error conventions

- All request and response field names are **snake_case** (\`raw_url\`, \`latest_version\`, \`created_at\`, etc.).
- All 4xx/5xx responses share this shape:

\`\`\`json
{
  "error": {
    "code": "html_too_large",
    "message": "HTML exceeds 2097152 bytes.",
    "details": { "max_bytes": 2097152 }
  }
}
\`\`\`

Switch on \`error.code\`. \`error.message\` is for human display. \`details\` is optional.

## Step 1: Authenticate (one-time per agent install)

Check for an existing token first. The convention, in order of preference:
1. \`./.htmlbin/token\` (project-local — preferred; no permission prompt)
2. \`HTMLBIN_TOKEN\` environment variable
3. \`~/.config/htmlbin/token\` (machine-global fallback)

If you don't have a token, run the device-code flow:

\`\`\`bash
START=$(curl -s -X POST ${publicUrl}/api/auth/start \\
  -H "Content-Type: application/json" \\
  -d '{"label":"claude-code"}')

CODE=$(echo "$START"        | jq -r .code)
URL=$(echo "$START"         | jq -r .verification_url)
POLL=$(echo "$START"        | jq -r .poll_token)
INTERVAL=$(echo "$START"    | jq -r .poll_interval)

echo ""
echo "  Open this URL and verify:"
echo "    ${'$'}URL"
echo ""
echo "  Code:  ${'$'}CODE"
echo ""

while true; do
  RESP=$(curl -s "${publicUrl}/api/auth/poll?token=${'$'}POLL")
  STATUS=$(echo "$RESP" | jq -r .status)
  case "$STATUS" in
    pending)  sleep "$INTERVAL" ;;
    verified) export HTMLBIN_TOKEN=$(echo "$RESP" | jq -r .api_token); break ;;
    *)        echo "auth failed: $STATUS" >&2; exit 1 ;;
  esac
done

mkdir -p ./.htmlbin && echo "$HTMLBIN_TOKEN" > ./.htmlbin/token
chmod 600 ./.htmlbin/token
\`\`\`

The verification URL drops the human onto a "Sign in with GitHub" page. We
ask for the \`read:user\` scope only (public username + id) and bind one
htmlbin account per GitHub identity, so quotas and existing drops stick
across devices. That click is the only human step.

## Step 2: Generate HTML

Author a complete, self-contained HTML document. The file is rendered in an
iframe, so it must look right standalone.

- All CSS in \`<style>\` (CDNs OK — Tailwind, Alpine, esm.sh, etc.)
- All JS in \`<script>\` (CDNs OK)
- No build step on our side — what you upload is what's served
- Up to 2 MB per file
- **Mobile-OK at 360px.** Single column, no fixed pixel widths, long strings
  wrap (\`overflow-wrap: anywhere\`), \`<pre>\` / wide \`<table>\` scroll
  internally (\`overflow-x: auto\`). The server injects a tail-of-\`<head>\`
  safety net (\`html,body{overflow-x:clip}\`, fluid media) on every served
  drop, but well-authored drops shouldn't rely on it.

## Step 3: Upload (creates v1)

\`\`\`bash
cat > /tmp/htmlbin.html <<'HTMLEOF'
<!doctype html>
<html>...</html>
HTMLEOF

jq -n --arg title "My Prototype" \\
       --arg description "What this is showing" \\
       --rawfile html /tmp/htmlbin.html \\
       '{title:$title, description:$description, html:$html}' \\
| curl -s -X POST ${publicUrl}/api/drops \\
    -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d @-
\`\`\`

Response (HTTP 201): the full \`Drop\` object:
\`\`\`json
{
  "slug": "aB3xK7g",
  "title": "My Prototype",
  "description": "What this is showing",
  "url": "${publicUrl}/p/aB3xK7g",
  "raw_url": "${publicUrl}/p/aB3xK7g/raw",
  "locked": false,
  "latest_version": 1,
  "view_count": 0,
  "created_at": 0,
  "updated_at": 0
}
\`\`\`

Print the \`url\` to the user.

## Iterating: PUT for new versions, PATCH for metadata

**\`PUT /api/drops/<slug>\`** mints a new version (html required):

\`\`\`bash
jq -n --rawfile html /tmp/htmlbin.html \\
       --arg context "Tweaked colors after user feedback" \\
       '{html:$html, context:$context}' \\
| curl -s -X PUT ${publicUrl}/api/drops/<slug> \\
    -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d @-
\`\`\`

**\`PATCH /api/drops/<slug>\`** updates title/description without minting a version:

\`\`\`bash
curl -s -X PATCH ${publicUrl}/api/drops/<slug> \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Better title"}'
\`\`\`

Including \`html\` in a PATCH returns \`400 metadata_only_on_patch\`.

Humans switch versions in the viewer with \`?v=N\`. Default = latest.

The CLI collapses both into one subcommand — \`htmlbin update <slug>\`
dispatches PUT when \`--file\` is present, PATCH otherwise:

\`\`\`bash
htmlbin update <slug> --file /tmp/htmlbin.html      # PUT — mints v(n+1)
htmlbin update <slug> --title "Better title"        # PATCH — metadata only
htmlbin update <slug> --metadata status=merged      # PATCH — replace map
htmlbin update <slug> --clear-metadata              # PATCH — metadata = {}
\`\`\`

## Context (optional, opt-in)

The \`context\` field on POST/PUT lets you record the prompt, reasoning,
or thinking trace that produced the HTML. **It is opt-in and may be
sensitive — only include it if the human has agreed.** When present, the
viewer exposes it under a discreet "context" toggle.

## Metadata (owner-side tag bag)

Every drop has a \`metadata\` field: a flat object of \`string → string\`
that you can attach on POST and replace on PUT/PATCH. It's **free-form**
— tag drops with whatever lets you find them later. Filterable on the
list endpoint via \`metadata.<key>=<value>\` (AND across pairs). Owner-only —
the public viewer at \`/p/<slug>\` never sees it.

A few example tag setups to spark ideas (the server has no opinion
about your keys):

- \`{repo: "foo/bar", pr: "42"}\` — stable preview URL across CI pushes
  for one PR.
- \`{session_id: "<chat-id>", kind: "deck"}\` — the artifact this
  conversation produced, so the next turn can iterate the same drop.
- \`{client: "acme", project: "rebrand", status: "draft"}\` — an agent
  maintaining a portfolio of in-progress work for an end-user.
- \`{kind: "spec", topic: "auth-rewrite"}\` — buckets you can list later.

The canonical recipe is **lookup → mutate**: GET with metadata filters,
then PUT to the slug if a drop matches, otherwise POST a fresh one. The
CLI's \`--upsert\` flag packages those two HTTP calls into one command:

\`\`\`bash
# One-shot: stable URL across pushes for one PR
htmlbin publish ./out.html --upsert \\
  --metadata repo=u/r --metadata pr=42 \\
  --title "PR #42 preview"
\`\`\`

There is intentionally no server-side upsert endpoint — the CLI is
running the same two HTTP calls below. Either path is fine.

\`\`\`bash
# Publish with tags
jq -n --rawfile html /tmp/artifact.html '{
  title: "Q3 plan",
  html: $html,
  metadata: { client: "acme", project: "rebrand", status: "draft" }
}' | curl -s -X POST ${publicUrl}/api/drops \\
       -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
       -H "Content-Type: application/json" -d @-

# Lookup → mutate (find your earlier drop and update it)
EXISTING=$(curl -s -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
  "${publicUrl}/api/drops?metadata.client=acme&metadata.project=rebrand" \\
  | jq -r '.data[0].slug // empty')

if [ -n "$EXISTING" ]; then
  jq -n --rawfile html /tmp/artifact.html '{html: $html}' \\
  | curl -s -X PUT "${publicUrl}/api/drops/$EXISTING" \\
      -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
      -H "Content-Type: application/json" -d @-
else
  jq -n --rawfile html /tmp/artifact.html '{
    title: "Q3 plan",
    html: $html,
    metadata: { client: "acme", project: "rebrand", status: "draft" }
  }' | curl -s -X POST ${publicUrl}/api/drops \\
         -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
         -H "Content-Type: application/json" -d @-
fi
\`\`\`

If your shape can write in parallel for the same tag combination,
serialize at the call site. In GitHub Actions, set
\`concurrency: group: pr-\${{ github.event.pull_request.number }}\`
on the workflow. The CLI's \`--upsert\` flag races the same way the
hand-rolled lookup → mutate does, since it runs the same two HTTP calls.

Limits: ≤10 keys, ≤64 chars per key (alphanumerics, \`_\`, \`.\`, \`-\`;
no leading or trailing punctuation), ≤256 chars per value. Values must
be strings — stringify numbers and booleans agent-side. PATCH/PUT
metadata replaces the whole map; omit to leave untouched, send \`{}\` to
clear.

## Listing your drops (paginated, filterable)

\`\`\`bash
curl -s "${publicUrl}/api/drops?page=1&pageSize=50&sortBy=updated_at&sortOrder=desc" \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"

# Filter by metadata — AND across pairs
curl -s "${publicUrl}/api/drops?metadata.repo=u%2Fr&metadata.pr=42" \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"
\`\`\`

Response:
\`\`\`json
{
  "data": [ /* Drop[] */ ],
  "pagination": {
    "page": 1, "page_size": 50, "total_items": 142, "total_pages": 3,
    "sort_by": "updated_at", "sort_order": "desc"
  }
}
\`\`\`

## Delete

\`\`\`bash
# Delete a single version (refused on the only remaining one) — returns the updated Drop
curl -s -X DELETE ${publicUrl}/api/drops/<slug>/v/<n> \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"

# Delete the whole drop — returns 204 No Content
curl -s -X DELETE ${publicUrl}/api/drops/<slug> \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"
\`\`\`

## Passcode (soft gate)

Set, change, or remove a passcode via \`POST /api/drops/<slug>/passcode\` with
\`{ "passcode": "..." }\`. Pass \`"passcode": ""\` to remove. This is a soft
share gate — not encryption.

## Rate limiting

429 responses carry a \`Retry-After\` header and a
\`details.retry_after_seconds\` field. Back off accordingly.

Limits: 60 writes/min, 500 writes/day, 500 drops/account, 200 versions/drop, 2 MB / drop.

## Errors

All errors share \`{ "error": { "code, message, details? } }\`.
Switch on \`error.code\`. Common codes: \`unauthorized\`, \`invalid_token\`,
\`rate_limited\`, \`daily_quota_exceeded\`, \`quota_exceeded\`,
\`html_too_large\`, \`html_required\`, \`title_required\`, \`forbidden\`,
\`not_found\`, \`version_not_found\`, \`metadata_only_on_patch\`,
\`last_version_cannot_be_deleted\`, \`token_required\`.

That's the whole API. Build something good.
`;
}
