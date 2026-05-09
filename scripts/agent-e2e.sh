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
assert_json "$TMP/openapi.json" '.paths | has("/api/prototypes")' 'true' "openapi declares /api/prototypes"
assert_json "$TMP/openapi.json" '.components.securitySchemes.bearerAuth.scheme' 'bearer' "openapi declares bearer auth"

# ---------------------------------------------------------------------------
section "2. agent onboarding"
# ---------------------------------------------------------------------------
ONBOARD=$(curl -s "$BASE/api/onboard")
CT=$(curl -s -o /dev/null -w "%{content_type}" "$BASE/api/onboard")
assert_contains "$CT" "text/markdown" "/api/onboard defaults to text/markdown"
assert_contains "$ONBOARD" "POST /api/auth/start" "onboard documents auth start"
assert_contains "$ONBOARD" "POST /api/prototypes" "onboard documents drop creation"

curl -s -H "Accept: application/json" "$BASE/api/onboard" -o "$TMP/onboard.json"
jq -e .instructions < "$TMP/onboard.json" > /dev/null \
  && ok "/api/onboard with Accept: application/json returns JSON wrapper" \
  || fail "/api/onboard JSON variant" "no instructions field"

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

# Human verifies (test Turnstile secret auto-passes locally)
VRESP=$(curl -s -o "$TMP/verify.html" -w "%{http_code}" -X POST "$BASE/verify" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "code=$VCODE" \
  --data-urlencode "cf-turnstile-response=fake")
assert_eq "$VRESP" "200" "human POST /verify returns 200"
grep -q -i "done\|verified\|complete" "$TMP/verify.html" \
  && ok "verify page shows success" || fail "verify success" "no confirmation text"

# Poll AFTER → verified, returns api_token (one-time read)
curl -s "$BASE/api/auth/poll?token=$POLL" -o "$TMP/verified.json"
TOKEN=$(jq -r .api_token < "$TMP/verified.json")
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] && ok "poll after verify returns api_token" || fail "api_token" "$TOKEN"
[[ "$TOKEN" == hb_* ]] && ok "token has hb_ prefix" || fail "token prefix" "got=${TOKEN:0:6}"
info "token=${TOKEN:0:14}…"

SECOND=$(curl -s "$BASE/api/auth/poll?token=$POLL")
assert_contains "$SECOND" '"claimed"' "second poll returns claimed (one-time read enforced)"

B401=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/prototypes" -H "Authorization: Bearer hb_nope")
assert_eq "$B401" "401" "bad token → 401"

N401=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/prototypes")
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
| curl -s -X POST "$BASE/api/prototypes" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @- -o "$TMP/created.json"

SLUG=$(jq -r .slug < "$TMP/created.json")
URL=$(jq -r .url < "$TMP/created.json")
[ -n "$SLUG" ] && [ "$SLUG" != "null" ] && ok "POST /api/prototypes returns slug" || fail "create slug" "$SLUG"
[ -n "$URL" ]  && [ "$URL" != "null" ]  && ok "POST /api/prototypes returns url"  || fail "create url" "$URL"
info "slug=$SLUG"
info "url=$URL"

VC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG")
assert_eq "$VC" "200" "GET /p/$SLUG returns 200 (public viewer)"

RAW=$(curl -s "$BASE/p/$SLUG/raw")
assert_contains "$RAW" "e2e drop" "GET /p/$SLUG/raw serves the HTML body"
RC=$(curl -s -o /dev/null -w "%{content_type}" "$BASE/p/$SLUG/raw")
assert_contains "$RC" "text/html" "raw is served as text/html"

curl -s "$BASE/api/prototypes/$SLUG" -H "Authorization: Bearer $TOKEN" -o "$TMP/meta.json"
assert_json "$TMP/meta.json" '.slug' "$SLUG" "GET /api/prototypes/:slug returns own metadata"
assert_json "$TMP/meta.json" '.locked' 'false' "fresh drop is not locked"

curl -s "$BASE/api/prototypes" -H "Authorization: Bearer $TOKEN" -o "$TMP/list.json"
assert_json "$TMP/list.json" "[.[] | select(.slug==\"$SLUG\")] | length" '1' "GET /api/prototypes lists my drop"

# Update
jq -n '{html:"<h1>updated by agent</h1>"}' \
| curl -s -X PUT "$BASE/api/prototypes/$SLUG" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d @- -o "$TMP/updated.json"
assert_json "$TMP/updated.json" '.slug' "$SLUG" "PUT /api/prototypes/:slug returns slug"
RAW2=$(curl -s "$BASE/p/$SLUG/raw")
assert_contains "$RAW2" "updated by agent" "raw HTML reflects update"

# ---------------------------------------------------------------------------
section "5. password lifecycle"
# ---------------------------------------------------------------------------
curl -s -X POST "$BASE/api/prototypes/$SLUG/password" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"password":"e2e-secret"}' -o "$TMP/lock.json"
assert_json "$TMP/lock.json" '.locked' 'true' "POST /password locks the drop"

LC=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG/raw")
assert_eq "$LC" "302" "locked /raw returns 302"

GATE=$(curl -s "$BASE/p/$SLUG")
assert_contains "$GATE" "locked" "viewer shows password gate when locked"
assert_contains "$GATE" "needs a password" "gate explains the lock"

WRONG=$(curl -s -X POST "$BASE/p/$SLUG/unlock" \
  -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "password=nope")
assert_contains "$WRONG" "incorrect" "wrong password is rejected"

RIGHT_HEAD=$(curl -s -i -c "$TMP/cookies" -X POST "$BASE/p/$SLUG/unlock" \
  -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "password=e2e-secret")
RIGHT_CODE=$(echo "$RIGHT_HEAD" | head -1 | awk '{print $2}')
assert_eq "$RIGHT_CODE" "302" "correct password returns 302"
grep -q "wu_$SLUG" "$TMP/cookies" && ok "unlock sets wu_$SLUG cookie" || fail "unlock cookie" "missing"

WRAW=$(curl -s -b "$TMP/cookies" "$BASE/p/$SLUG/raw")
assert_contains "$WRAW" "updated by agent" "with cookie, raw HTML loads"

NOCOOKIE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG/raw")
assert_eq "$NOCOOKIE" "302" "without cookie, still locked"

curl -s -X POST "$BASE/api/prototypes/$SLUG/password" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"password":""}' -o "$TMP/unlock.json"
assert_json "$TMP/unlock.json" '.locked' 'false' "POST /password with empty unlocks"
PUB=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG/raw")
assert_eq "$PUB" "200" "after unlock, /raw is 200 again"

SHORT=$(curl -s -X POST "$BASE/api/prototypes/$SLUG/password" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"password":"ab"}')
assert_contains "$SHORT" "password_too_short" "password < 4 chars rejected"

# ---------------------------------------------------------------------------
section "6. ownership + validation (second user)"
# ---------------------------------------------------------------------------
curl -s -X POST "$BASE/api/auth/start" -H "Content-Type: application/json" \
  -d '{"label":"agent-2"}' -o "$TMP/start2.json"
C2=$(jq -r .code < "$TMP/start2.json")
P2=$(jq -r .poll_token < "$TMP/start2.json")
curl -s -o /dev/null -X POST "$BASE/verify" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "code=$C2" --data-urlencode "cf-turnstile-response=x"
curl -s "$BASE/api/auth/poll?token=$P2" -o "$TMP/verified2.json"
TOKEN2=$(jq -r .api_token < "$TMP/verified2.json")
[[ "$TOKEN2" == hb_* ]] && ok "second agent gets its own token" || fail "second token" "$TOKEN2"

# Other user can't read my drop's metadata
OTHER=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/prototypes/$SLUG" -H "Authorization: Bearer $TOKEN2")
assert_eq "$OTHER" "403" "other user → 403 on GET metadata"

OUPD=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/api/prototypes/$SLUG" \
  -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d '{"html":"<h1>pwned</h1>"}')
assert_eq "$OUPD" "403" "other user → 403 on PUT"

ODEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/prototypes/$SLUG" \
  -H "Authorization: Bearer $TOKEN2")
assert_eq "$ODEL" "403" "other user → 403 on DELETE"

ANYONE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/$SLUG")
assert_eq "$ANYONE" "200" "public view works for anyone (drop is unlocked)"

# Validation
EBAD=$(curl -s -X POST "$BASE/api/prototypes" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"","html":"<h1>x</h1>"}')
assert_contains "$EBAD" "title_required" "empty title rejected"

MBAD=$(curl -s -X POST "$BASE/api/prototypes" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"x"}')
assert_contains "$MBAD" "html_required" "missing html rejected"

ISL=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/!!")
assert_eq "$ISL" "404" "invalid slug → 404"

NS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/p/totally-fake-slug-12345")
assert_eq "$NS" "404" "nonexistent slug → 404"

# Second user's list is empty
curl -s "$BASE/api/prototypes" -H "Authorization: Bearer $TOKEN2" -o "$TMP/list2.json"
assert_json "$TMP/list2.json" 'length' '0' "second agent's list is empty"

# ---------------------------------------------------------------------------
section "7. cleanup"
# ---------------------------------------------------------------------------
curl -s -X DELETE "$BASE/api/prototypes/$SLUG" \
  -H "Authorization: Bearer $TOKEN" -o "$TMP/del.json"
assert_json "$TMP/del.json" '.deleted' "$SLUG" "DELETE returns deleted=$SLUG"

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
