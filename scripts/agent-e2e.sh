#!/usr/bin/env bash
# End-to-end test as an agent would run it. Exercises every endpoint,
# every state transition, every error path. One pass/fail per check.
#
# Usage: BASE_URL=http://localhost:8787 ./scripts/agent-e2e.sh
set -u
BASE="${BASE_URL:-http://localhost:8787}"
PASS=0
FAIL=0
TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

R="\033[31m"; G="\033[32m"; D="\033[2m"; B="\033[1m"; X="\033[0m"

ok()   { PASS=$((PASS+1)); printf "  ${G}✓${X} %s\n" "$1"; }
fail() { FAIL=$((FAIL+1)); printf "  ${R}✗${X} %s${R} — %s${X}\n" "$1" "$2"; }
section() { printf "\n${B}%s${X}\n" "$1"; }
info()    { printf "    ${D}%s${X}\n" "$1"; }

assert_eq() {
  local got="$1" want="$2" msg="$3"
  if [ "$got" = "$want" ]; then ok "$msg"; else fail "$msg" "got=$got want=$want"; fi
}
assert_contains() {
  local hay="$1" needle="$2" msg="$3"
  if echo "$hay" | grep -q -- "$needle"; then ok "$msg"; else fail "$msg" "missing: $needle"; fi
}
assert_json() {
  local file="$1" jq_filter="$2" want="$3" msg="$4"
  local got
  got=$(jq -r "$jq_filter" < "$file" 2>/dev/null)
  if [ "$got" = "$want" ]; then ok "$msg"; else fail "$msg" "got=$got want=$want"; fi
}

# ---------------------------------------------------------------------------
section "1. discoverability — what an agent sees first"
# ---------------------------------------------------------------------------
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
assert_eq "$CODE" "200" "GET / returns 200"

LINK=$(curl -sI "$BASE/" | tr -d '\r' | grep -i "^link:" | head -1)
assert_contains "$LINK" "agent-card" "Link header advertises agent-card"
assert_contains "$LINK" "openapi"    "Link header advertises openapi"
assert_contains "$LINK" "llms.txt"   "Link header advertises llms.txt"
assert_contains "$LINK" "describedby" "Link header advertises onboarding (describedby)"

ROBOTS=$(curl -s "$BASE/robots.txt")
assert_contains "$ROBOTS" "GPTBot"    "/robots.txt allows GPTBot"
assert_contains "$ROBOTS" "ClaudeBot" "/robots.txt allows ClaudeBot"
assert_contains "$ROBOTS" "Sitemap:"  "/robots.txt points at sitemap"

LLMS=$(curl -s "$BASE/llms.txt")
assert_contains "$LLMS" "/api/onboard"  "/llms.txt references onboard endpoint"
assert_contains "$LLMS" "## API surface" "/llms.txt lists API surface"

SITEMAP=$(curl -s "$BASE/sitemap.xml")
assert_contains "$SITEMAP" "<urlset" "/sitemap.xml is a urlset"
assert_contains "$SITEMAP" "/api/onboard" "/sitemap.xml lists /api/onboard"

curl -s "$BASE/.well-known/agent-card.json" -o "$TMP/card.json"
jq -e . < "$TMP/card.json" > /dev/null && ok "agent-card.json is valid JSON" || fail "agent-card.json valid" "parse error"
assert_json "$TMP/card.json" '.name' 'htmlbin' "agent-card.name == htmlbin"
assert_json "$TMP/card.json" '.capabilities | length > 0' 'true' "agent-card declares capabilities"
assert_json "$TMP/card.json" '.capabilities[] | select(.id=="publish_html") | .id' 'publish_html' "agent-card has publish_html capability"

curl -s "$BASE/openapi.json" -o "$TMP/openapi.json"
jq -e . < "$TMP/openapi.json" > /dev/null && ok "openapi.json is valid JSON" || fail "openapi valid" "parse error"
assert_json "$TMP/openapi.json" '.openapi | startswith("3.")' 'true' "openapi.json is OpenAPI 3.x"
assert_json "$TMP/openapi.json" '.paths | has("/api/drops")' 'true' "openapi declares /api/drops"
assert_json "$TMP/openapi.json" '.components.securitySchemes.bearerAuth.scheme' 'bearer' "openapi declares bearer auth"

# ---------------------------------------------------------------------------
section "1b. pattern catalog — agent-side starter pack"
# ---------------------------------------------------------------------------
# Patterns are markdown files on the user's filesystem; the deployed Worker
# serves the official starter pack as a fallback. See src/patterns.ts.

curl -s "$BASE/.well-known/patterns/index.json" -o "$TMP/patterns.json"
jq -e . < "$TMP/patterns.json" > /dev/null \
  && ok "patterns/index.json is valid JSON" \
  || fail "patterns/index.json valid" "parse error"
assert_json "$TMP/patterns.json" '.patterns | length' '3' "manifest lists three starter patterns"

CT_PJ=$(curl -s -o /dev/null -w "%{content_type}" "$BASE/.well-known/patterns/index.json")
assert_contains "$CT_PJ" "application/json" "patterns/index.json served as application/json"

for name in pr-explainer summary-roundup plan-spec-explainer; do
  assert_json "$TMP/patterns.json" \
    "[.patterns[] | select(.name==\"$name\")] | length" '1' \
    "manifest includes $name"
  assert_json "$TMP/patterns.json" \
    ".patterns[] | select(.name==\"$name\") | (.url | endswith(\"/.well-known/patterns/$name.md\"))" 'true' \
    "$name URL is well-formed"
  assert_json "$TMP/patterns.json" \
    ".patterns[] | select(.name==\"$name\") | (.triggers | length > 0)" 'true' \
    "$name has triggers"

  curl -s "$BASE/.well-known/patterns/$name.md" -o "$TMP/pattern-$name.md"
  CT_PM=$(curl -s -o /dev/null -w "%{content_type}" "$BASE/.well-known/patterns/$name.md")
  assert_contains "$CT_PM" "text/markdown" "$name.md served as text/markdown"
  head -1 "$TMP/pattern-$name.md" | grep -q '^---$' \
    && ok "$name.md has YAML front matter" \
    || fail "$name.md frontmatter" "missing leading ---"
  grep -q "^name: $name$" "$TMP/pattern-$name.md" \
    && ok "$name.md declares name: $name" \
    || fail "$name.md name" "missing"
done

# Unknown pattern → canonical 404 error shape, not an HTML 404
NF_PC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/.well-known/patterns/does-not-exist.md")
assert_eq "$NF_PC" "404" "unknown pattern → 404"
NF_PB=$(curl -s "$BASE/.well-known/patterns/does-not-exist.md")
assert_contains "$NF_PB" '"code":"not_found"' "unknown pattern uses canonical error shape"

# SKILL.md must teach the convention — agents without local patterns rely on it
curl -s "$BASE/.well-known/agent-skills/htmlbin/SKILL.md" -o "$TMP/skill.md"
grep -q "^## Patterns" "$TMP/skill.md" \
  && ok "SKILL.md documents the patterns convention" \
  || fail "skill patterns section" "missing"
grep -q "\\./\\.htmlbin/patterns/" "$TMP/skill.md" \
  && ok "SKILL.md documents the project-local patterns path" \
  || fail "skill local path" "missing"
grep -q "~/.config/htmlbin/patterns/" "$TMP/skill.md" \
  && ok "SKILL.md documents the machine-global patterns path" \
  || fail "skill global path" "missing"
grep -q "^## Quality floor" "$TMP/skill.md" \
  && ok "SKILL.md documents the quality floor" \
  || fail "skill quality floor" "missing"
grep -q "^## Make it feel like" "$TMP/skill.md" \
  && ok "SKILL.md documents brand sensing" \
  || fail "skill brand sensing" "missing"

# ---------------------------------------------------------------------------
section "2. agent onboarding"
# ---------------------------------------------------------------------------
# Default: JSON descriptor (data, not prose). Markdown is opt-in via
# Accept: text/markdown or ?format=md.
CT=$(curl -s -o /dev/null -w "%{content_type}" "$BASE/api/onboard")
assert_contains "$CT" "application/json" "/api/onboard defaults to application/json"

curl -s "$BASE/api/onboard" -o "$TMP/onboard.json"
jq -e '.auth.steps | length >= 3' < "$TMP/onboard.json" > /dev/null \
  && ok "/api/onboard JSON descriptor lists auth steps" \
  || fail "/api/onboard JSON descriptor" "auth.steps missing or empty"
assert_json "$TMP/onboard.json" '.publish.method' 'POST' "onboard descriptor names publish method"
assert_json "$TMP/onboard.json" '.auth.token_storage.primary' './.htmlbin/token' "onboard recommends project-local token path"

ONBOARD_MD=$(curl -s -H "Accept: text/markdown" "$BASE/api/onboard")
CT_MD=$(curl -s -o /dev/null -w "%{content_type}" -H "Accept: text/markdown" "$BASE/api/onboard")
assert_contains "$CT_MD" "text/markdown" "/api/onboard with Accept: text/markdown returns markdown"
assert_contains "$ONBOARD_MD" "POST /api/auth/start" "markdown variant documents auth start"
assert_contains "$ONBOARD_MD" "POST /api/drops" "markdown variant documents drop creation"

# ---------------------------------------------------------------------------
section "3. auth — device-code flow"
# ---------------------------------------------------------------------------
curl -s -X POST "$BASE/api/auth/start" \
  -H "Content-Type: application/json" \
  -d '{"label":"agent-e2e"}' -o "$TMP/start.json"

VCODE=$(jq -r .code < "$TMP/start.json")
POLL=$(jq -r .poll_token < "$TMP/start.json")
EXPIRES=$(jq -r .expires_in < "$TMP/start.json")
[ -n "$VCODE" ] && [ "$VCODE" != "null" ] && ok "auth/start returns a code" || fail "auth/start code" "$VCODE"
[ -n "$POLL" ]  && ok "auth/start returns a poll_token" || fail "poll_token" "empty"
assert_eq "$EXPIRES" "600" "auth/start expires_in == 600"
info "code=$VCODE  poll=${POLL:0:12}…"

PEND=$(curl -s "$BASE/api/auth/poll?token=$POLL")
assert_contains "$PEND" '"pending"' "poll before verify returns pending"

NF=$(curl -s "$BASE/api/auth/poll?token=does-not-exist")
assert_contains "$NF" '"not_found"' "poll with bad token returns not_found"

# Human signs in with GitHub (dev-mock short-circuits github.com so the
# script doesn't need a browser or a real OAuth app — see
# src/github-oauth.ts). Each run picks a unique mock login so successive
# test runs against the same local D1 don't collide on github_user_id.
GH_LOGIN_1="e2e-$RANDOM-$RANDOM"
VRESP=$(curl -sL -o "$TMP/verify.html" -w "%{http_code}" \
  "$BASE/auth/github/start?code=$VCODE&mock_login=$GH_LOGIN_1")
assert_eq "$VRESP" "200" "GET /auth/github/start returns 200 after callback"
grep -q -i "done\|verified\|complete" "$TMP/verify.html" \
  && ok "verify page shows success" || fail "verify success" "no confirmation text"
grep -q "$GH_LOGIN_1" "$TMP/verify.html" \
  && ok "verify page shows the github login" || fail "github login on success" "missing $GH_LOGIN_1"

# Poll AFTER → verified, returns api_token (one-time read)
curl -s "$BASE/api/auth/poll?token=$POLL" -o "$TMP/verified.json"
TOKEN=$(jq -r .api_token < "$TMP/verified.json")
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && ok "poll after verify returns api_token" || fail "api_token" "$TOKEN"
[[ "$TOKEN" == hb_* ]] && ok "token has hb_ prefix" || fail "token prefix" "got=${TOKEN:0:6}"
info "token=${TOKEN:0:14}…"

SECOND=$(curl -s "$BASE/api/auth/poll?token=$POLL")
assert_contains "$SECOND" '"claimed"' "second poll returns claimed (one-time read enforced)"

B401=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/drops" -H "Authorization: Bearer hb_nope")
assert_eq "$B401" "401" "bad token → 401"

N401=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/drops")
assert_eq "$N401" "401" "no auth → 401"

ME=$(curl -s "$BASE/api/me" -H "Authorization: Bearer $TOKEN")
assert_contains "$ME" '"user_id"' "/api/me returns user_id with valid token"

# ---------------------------------------------------------------------------
section "4. drops — create / read / update / list"
# ---------------------------------------------------------------------------
cat > "$TMP/drop.html" <<'HTML'
<!doctype html>
<html><body style="font-family:system-ui;padding:48px">
<h1>e2e drop</h1><p>created by agent</p>
</body></html>
HTML

jq -n --arg t "e2e: agent test" \
       --arg d "created by automated test" \
       --rawfile h "$TMP/drop.html" \
       '{title:$t, description:$d, html:$h}' \
| curl -s -X POST "$BASE/api/drops" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @- -o "$TMP/created.json"

SLUG=$(jq -r .slug < "$TMP/created.json")
URL=$(jq -r .url < "$TMP/created.json")
[ -n "$SLUG" ] && [ "$SLUG" != "null" ] && ok "POST /api/drops returns slug" || fail "create slug" "$SLUG"
[ -n "$URL" ]  && [ "$URL" != "null" ]  && ok "POST /api/drops returns url"  || fail "create url" "$URL"
info "slug=$SLUG"
info "url=$URL"

VC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG")
assert_eq "$VC" "200" "GET /p/$SLUG returns 200 (public viewer)"

RAW=$(curl -s "$BASE/p/$SLUG/raw")
assert_contains "$RAW" "e2e drop" "GET /p/$SLUG/raw serves the HTML body"
RC=$(curl -s -o /dev/null -w "%{content_type}" "$BASE/p/$SLUG/raw")
assert_contains "$RC" "text/html" "raw is served as text/html"

curl -s "$BASE/api/drops/$SLUG" -H "Authorization: Bearer $TOKEN" -o "$TMP/meta.json"
assert_json "$TMP/meta.json" '.slug' "$SLUG" "GET /api/drops/:slug returns own metadata"
assert_json "$TMP/meta.json" '.locked' 'false' "fresh drop is not locked"

curl -s "$BASE/api/drops" -H "Authorization: Bearer $TOKEN" -o "$TMP/list.json"
assert_json "$TMP/list.json" "[.data[] | select(.slug==\"$SLUG\")] | length" '1' "GET /api/drops lists my drop"
assert_json "$TMP/list.json" '.pagination.page' '1' "GET /api/drops returns pagination block"

# Update
jq -n '{html:"<h1>updated by agent</h1>"}' \
| curl -s -X PUT "$BASE/api/drops/$SLUG" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d @- -o "$TMP/updated.json"
assert_json "$TMP/updated.json" '.slug' "$SLUG" "PUT /api/drops/:slug returns slug"
RAW2=$(curl -s "$BASE/p/$SLUG/raw")
assert_contains "$RAW2" "updated by agent" "raw HTML reflects update"

# ---------------------------------------------------------------------------
section "5. passcode lifecycle"
# ---------------------------------------------------------------------------
curl -s -X POST "$BASE/api/drops/$SLUG/passcode" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"passcode":"e2e-secret"}' -o "$TMP/lock.json"
assert_json "$TMP/lock.json" '.locked' 'true' "POST /passcode locks the drop"

LC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG/raw")
assert_eq "$LC" "302" "locked /raw returns 302"

GATE=$(curl -s "$BASE/p/$SLUG")
assert_contains "$GATE" "locked" "viewer shows passcode gate when locked"
assert_contains "$GATE" "soft gate" "gate explains the lock"

WRONG=$(curl -s -X POST "$BASE/p/$SLUG/unlock" \
  -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "passcode=nope")
assert_contains "$WRONG" "incorrect" "wrong passcode is rejected"

RIGHT_HEAD=$(curl -s -i -c "$TMP/cookies" -X POST "$BASE/p/$SLUG/unlock" \
  -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "passcode=e2e-secret")
RIGHT_CODE=$(echo "$RIGHT_HEAD" | head -1 | awk '{print $2}')
assert_eq "$RIGHT_CODE" "302" "correct passcode returns 302"
grep -q "wu_$SLUG" "$TMP/cookies" && ok "unlock sets wu_$SLUG cookie" || fail "unlock cookie" "missing"

WRAW=$(curl -s -b "$TMP/cookies" "$BASE/p/$SLUG/raw")
assert_contains "$WRAW" "updated by agent" "with cookie, raw HTML loads"

NOCOOKIE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG/raw")
assert_eq "$NOCOOKIE" "302" "without cookie, still locked"

curl -s -X POST "$BASE/api/drops/$SLUG/passcode" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"passcode":""}' -o "$TMP/unlock.json"
assert_json "$TMP/unlock.json" '.locked' 'false' "POST /passcode with empty unlocks"
PUB=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG/raw")
assert_eq "$PUB" "200" "after unlock, /raw is 200 again"

SHORT=$(curl -s -X POST "$BASE/api/drops/$SLUG/passcode" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"passcode":"ab"}')
assert_contains "$SHORT" "passcode_too_short" "passcode < 4 chars rejected"

# ---------------------------------------------------------------------------
section "6. ownership + validation (second user)"
# ---------------------------------------------------------------------------
curl -s -X POST "$BASE/api/auth/start" -H "Content-Type: application/json" \
  -d '{"label":"agent-2"}' -o "$TMP/start2.json"
C2=$(jq -r .code < "$TMP/start2.json")
P2=$(jq -r .poll_token < "$TMP/start2.json")
GH_LOGIN_2="e2e2-$RANDOM-$RANDOM"
curl -sL -o /dev/null "$BASE/auth/github/start?code=$C2&mock_login=$GH_LOGIN_2"
curl -s "$BASE/api/auth/poll?token=$P2" -o "$TMP/verified2.json"
TOKEN2=$(jq -r .api_token < "$TMP/verified2.json")
[[ "$TOKEN2" == hb_* ]] && ok "second agent gets its own token" || fail "second token" "$TOKEN2"

# Other user can't read my drop's metadata
OTHER=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/drops/$SLUG" -H "Authorization: Bearer $TOKEN2")
assert_eq "$OTHER" "403" "other user → 403 on GET metadata"

OUPD=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/drops/$SLUG" \
  -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d '{"html":"<h1>pwned</h1>"}')
assert_eq "$OUPD" "403" "other user → 403 on PUT"

ODEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/drops/$SLUG" \
  -H "Authorization: Bearer $TOKEN2")
assert_eq "$ODEL" "403" "other user → 403 on DELETE"

ANYONE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG")
assert_eq "$ANYONE" "200" "public view works for anyone (drop is unlocked)"

# Validation
EBAD=$(curl -s -X POST "$BASE/api/drops" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"","html":"<h1>x</h1>"}')
assert_contains "$EBAD" "title_required" "empty title rejected"

MBAD=$(curl -s -X POST "$BASE/api/drops" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"x"}')
assert_contains "$MBAD" "html_required" "missing html rejected"

ISL=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/!!")
assert_eq "$ISL" "404" "invalid slug → 404"

NS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/totally-fake-slug-12345")
assert_eq "$NS" "404" "nonexistent slug → 404"

# Second user's list is empty
curl -s "$BASE/api/drops" -H "Authorization: Bearer $TOKEN2" -o "$TMP/list2.json"
assert_json "$TMP/list2.json" '.data | length' '0' "second agent's list is empty"

# ---------------------------------------------------------------------------
section "7. cleanup"
# ---------------------------------------------------------------------------
DCODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/drops/$SLUG" \
  -H "Authorization: Bearer $TOKEN")
assert_eq "$DCODE" "204" "DELETE /api/drops/:slug returns 204 No Content"

GONE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG")
assert_eq "$GONE" "404" "after delete, /p/:slug is 404"

GONE_RAW=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG/raw")
assert_eq "$GONE_RAW" "404" "after delete, /raw is 404"

# ---------------------------------------------------------------------------
section "results"
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  printf "${G}${B}all %d checks passed${X}\n" "$TOTAL"
  exit 0
else
  printf "${R}${B}%d/%d failed${X}\n" "$FAIL" "$TOTAL"
  exit 1
fi
