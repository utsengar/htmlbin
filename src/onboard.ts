// Agent onboarding instructions. Returned by GET /api/onboard.
// Designed to be pasted directly into an agent's context, or fetched at
// runtime by an agent that's been told "go to htmlbin.dev/api/onboard".

export function buildOnboardText(publicUrl: string): string {
  return `# htmlbin — Agent Onboarding

You are deploying an HTML artifact to htmlbin. Anyone with the URL can view it.
htmlbin is built for agents: the workflow below is the canonical, fastest path.

## TL;DR

1. POST /api/auth/start         → get a code + verification_url + poll_token
2. Print the URL + code to the human; ask them to verify (one-time)
3. GET /api/auth/poll?token=…   → poll until you receive an api_token
4. POST /api/prototypes (Bearer api_token) → upload HTML, receive a public URL

The api_token is shown exactly once. Store it for reuse on this machine.

## Step 1: Authenticate (one-time per agent install)

Check for an existing token first. The convention is to read it from the
environment variable HTMLBIN_TOKEN, or from \`~/.config/htmlbin/token\` if present.

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

mkdir -p ~/.config/htmlbin && echo "$HTMLBIN_TOKEN" > ~/.config/htmlbin/token
chmod 600 ~/.config/htmlbin/token
\`\`\`

The verification URL drops the human onto a simple page with an anti-bot
challenge — that's the only human step, and it exists to keep bots from
minting tokens. Your token is yours after that; reuse it.

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
| curl -s -X POST ${publicUrl}/api/prototypes \\
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
| curl -s -X PUT ${publicUrl}/api/prototypes/<slug> \\
    -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d @-

# List all versions of a drop
curl -s ${publicUrl}/api/prototypes/<slug>/versions \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"

# Get specific version metadata (incl. context)
curl -s ${publicUrl}/api/prototypes/<slug>/v/3 \\
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
curl -s -X POST ${publicUrl}/api/prototypes/<slug>/password \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"password":"correct horse battery staple"}'
\`\`\`

Pass \`"password": ""\` to unlock.

## Update / delete / list

\`\`\`bash
# Update HTML on the same slug (URL doesn't change)
curl -s -X PUT ${publicUrl}/api/prototypes/<slug> \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d "$(jq -n --rawfile html /tmp/htmlbin.html '{html:$html}')"

# Delete
curl -s -X DELETE ${publicUrl}/api/prototypes/<slug> \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"

# List your own
curl -s ${publicUrl}/api/prototypes \\
  -H "Authorization: Bearer $HTMLBIN_TOKEN"
\`\`\`

## Limits

- 2 MB per HTML
- 60 writes / minute / token
- 500 prototypes per account (delete old ones to free space)

## Errors

All errors are JSON: \`{ "error": "<code>", ... }\`.
Common codes: \`unauthorized\`, \`invalid_token\`, \`rate_limited\`,
\`html_too_large\`, \`forbidden\`, \`not_found\`, \`expired_code\`.

That's the whole API. Build something good.
`;
}
