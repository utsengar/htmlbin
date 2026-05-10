// Agent onboarding. Returned by GET /api/onboard.
//
// Two shapes:
//   - buildOnboardJson() — the canonical, machine-readable protocol
//     descriptor. JSON. No prose-to-interpret; just endpoints, methods,
//     body schemas. This is what agents should consume by default.
//   - buildOnboardText() — the same protocol as a friendly markdown
//     walkthrough, returned only when Accept: text/markdown is requested.
//     Useful for humans previewing the API and for debug output.
//
// We default to JSON because "fetch a URL and follow what it says" is the
// shape of a prompt-injection payload — agents are (rightly) trained to
// be wary of it. A structured descriptor with named fields reads as data,
// not as instructions, and slips through the same agents without friction.

export function buildOnboardJson(publicUrl: string): object {
  return {
    schema_version: "1",
    name: "htmlbin",
    public_url: publicUrl,
    summary:
      "Agent-first HTML hosting. Drop self-contained HTML, get a public URL.",
    spec: {
      openapi: `${publicUrl}/openapi.json`,
      agent_card: `${publicUrl}/.well-known/agent-card.json`,
      llms_txt: `${publicUrl}/llms.txt`,
      onboard_markdown: `${publicUrl}/api/onboard (Accept: text/markdown)`,
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
            code: "string (8 chars; show this to the human)",
            verification_url: "string (open this in a browser)",
            poll_token: "string (use in step 3)",
            expires_in: "integer (seconds)",
            poll_interval: "integer (seconds, default 2)",
          },
        },
        {
          step: 2,
          human_action:
            "Open verification_url, complete the Cloudflare Turnstile challenge, click verify.",
          note:
            "This is the only human moment. After this the agent is autonomous.",
        },
        {
          step: 3,
          method: "GET",
          url: `${publicUrl}/api/auth/poll`,
          query: { token: "<poll_token from step 1>" },
          returns: {
            status: "'pending' | 'verified' | 'expired' | 'claimed'",
            api_token: "string (only on first 'verified' read; revealed exactly once)",
            user_id: "string (only on first 'verified' read)",
          },
          note:
            "Poll every poll_interval seconds until status != 'pending'. The api_token is shown once — store it.",
        },
      ],
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
        password: "string (optional, ≥4 chars; sets a viewer password gate)",
        context: "string (optional, ≤64 KB; reasoning trace — opt-in per the human)",
      },
      returns: {
        slug: "string",
        url: `string (e.g. ${publicUrl}/p/<slug>)`,
        raw_url: `string (e.g. ${publicUrl}/p/<slug>/raw)`,
        version: "integer (1 on create)",
      },
    },
    iterate: {
      method: "PUT",
      url: `${publicUrl}/api/drops/<slug>`,
      body: {
        html: "string (optional; if present, mints a new version)",
        title: "string (optional)",
        description: "string (optional)",
        context: "string (optional, ≤64 KB)",
      },
      note:
        "Each PUT with a new html body increments the version. Slug + URL stay stable. Humans switch versions in the viewer with ?v=N.",
    },
    other_endpoints: {
      list_my_drops: { method: "GET", url: `${publicUrl}/api/drops` },
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
      },
      delete_version: {
        method: "DELETE",
        url: `${publicUrl}/api/drops/<slug>/v/<n>`,
        note:
          "Refused for the last remaining version. If the deleted version was the head, latest_version is recomputed.",
      },
      set_password: {
        method: "POST",
        url: `${publicUrl}/api/drops/<slug>/password`,
        body: { password: "string ('' to remove)" },
      },
      list_my_tokens: { method: "GET", url: `${publicUrl}/api/tokens` },
      revoke_token: {
        method: "DELETE",
        url: `${publicUrl}/api/tokens/<id>`,
        note: "id = first 12 hex chars of the token hash",
      },
    },
    cross_machine: {
      method:
        "On a new machine, run /api/auth/start, then paste an existing hb_… token in the optional field on /verify.",
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
    errors: {
      shape: { error: "<code>" },
      common: [
        "unauthorized",
        "invalid_token",
        "rate_limited",
        "html_too_large",
        "forbidden",
        "not_found",
        "expired_code",
        "password_too_short",
      ],
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

The verification URL drops the human onto a Cloudflare Turnstile widget —
the same anti-bot checkbox that protects countless other sites. That click
is the only human step. It exists so bots can't mint tokens; your token
is yours after that, and it doesn't expire (revocable via /api/tokens).

## Step 2: Generate HTML

Author a complete, self-contained HTML document. The file is rendered in an
iframe, so it must look right standalone.

- All CSS in \`<style>\` (CDNs OK — Tailwind, Alpine, esm.sh, etc.)
- All JS in \`<script>\` (CDNs OK)
- No build step on our side — what you upload is what's served
- Up to 2 MB per file
- For React, use ES module imports + esm.sh; do NOT use Babel standalone

If the user asked for several variants, upload each as its own prototype with
clearly distinct titles ("Dashboard — A: cards", "Dashboard — B: table").

## Step 3: Upload (creates v1)

\`\`\`bash
cat > /tmp/htmlbin.html <<'HTMLEOF'
<!doctype html>
<html>...</html>
HTMLEOF

jq -n --arg title "My Prototype" \\
       --arg description "What this is showing" \\
       --arg context "Optional: the prompt or reasoning that produced this drop." \\
       --rawfile html /tmp/htmlbin.html \\
       '{title:$title, description:$description, html:$html, context:$context}' \\
| curl -s -X POST ${publicUrl}/api/drops \\
    -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d @-
\`\`\`

Response: \`{ "slug": "...", "version": 1, "url": "${publicUrl}/p/...", ... }\`.
Print the \`url\` to the user.

## Versioning

Each PUT with a new \`html\` body creates a **new version** at the same slug.
The URL never changes. Iterate freely:

\`\`\`bash
# Mint v2 of an existing drop (URL stays the same)
jq -n --rawfile html /tmp/htmlbin.html \\
       --arg context "Tweaked color contrast based on user feedback" \\
       '{html:$html, context:$context}' \\
| curl -s -X PUT ${publicUrl}/api/drops/<slug> \\
    -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d @-

# List all versions of a drop
curl -s ${publicUrl}/api/drops/<slug>/versions \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"

# Get specific version metadata (incl. context)
curl -s ${publicUrl}/api/drops/<slug>/v/3 \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"
\`\`\`

Humans can switch versions in the viewer with \`?v=N\`. Default = latest.

## Context (optional, opt-in)

The \`context\` field on create/update lets you record the prompt, reasoning,
or thinking trace that produced the HTML. **It is opt-in and may be
sensitive — only include it if the human has agreed.** When present, the
viewer exposes it under a discreet "context" toggle.

## Password protection

To upload locked content, include \`"password": "…"\` in the create body. Visitors
will see a password gate before the iframe renders.

To change a password later:
\`\`\`bash
curl -s -X POST ${publicUrl}/api/drops/<slug>/password \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"password":"correct horse battery staple"}'
\`\`\`

Pass \`"password": ""\` to unlock.

## Update / delete / list

\`\`\`bash
# Update HTML on the same slug (URL doesn't change)
curl -s -X PUT ${publicUrl}/api/drops/<slug> \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d "$(jq -n --rawfile html /tmp/htmlbin.html '{html:$html}')"

# Delete
curl -s -X DELETE ${publicUrl}/api/drops/<slug> \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"

# List your own
curl -s ${publicUrl}/api/drops \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"
\`\`\`

## Limits

- 2 MB per HTML
- 60 writes / minute / token
- 500 drops per account (delete old ones to free space)

## Errors

All errors are JSON: \`{ "error": "<code>", ... }\`.
Common codes: \`unauthorized\`, \`invalid_token\`, \`rate_limited\`,
\`html_too_large\`, \`forbidden\`, \`not_found\`, \`expired_code\`.

That's the whole API. Build something good.
`;
}
