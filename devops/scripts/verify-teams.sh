#!/usr/bin/env bash
# End-to-end verification of the Teams feature against a live deployment.
#
# Checks the things only a real cluster can prove: that the edge routes a team
# token to the team's pod and refuses a personal one, that a viewer really is
# read-only inside a team workspace, and that THING remembers a channel thread
# across two different members.
#
#   GATEWAY_JWT_SECRET=$(...) ./devops/scripts/verify-teams.sh
#
# Requires: curl, jq, node (to mint the test users' session tokens).
#
# Env:
#   GATEWAY_JWT_SECRET  base64, from the lmthing-secrets k8s secret. REQUIRED —
#                       password login is disabled in prod (.issues/), so the
#                       only way to a session is to mint the JWT by hand.
#   BASE_URL            gateway base            (default https://lmthing.cloud)
#   TEAM_URL            team surface origin     (default https://lmthing.team)
#   USER_A, USER_B      existing Zitadel user ids to act as. If unset, the
#                       script registers two throwaway accounts.
set -euo pipefail

BASE_URL="${BASE_URL:-https://lmthing.cloud}"
TEAM_URL="${TEAM_URL:-https://lmthing.team}"
: "${GATEWAY_JWT_SECRET:?set GATEWAY_JWT_SECRET (base64) — see the header}"

pass=0; fail=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail+1)); }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
# expect <what> <actual> <wanted>
expect() { [ "$2" = "$3" ] && ok "$1" || bad "$1 (got $2, wanted $3)"; }

# Mint a gateway access token. The email claim is required by verifyAccessToken.
mint() {
  node -e '
    const c=require("node:crypto");
    const [sub,email,secret]=process.argv.slice(1);
    const b64=(o)=>Buffer.from(JSON.stringify(o)).toString("base64url");
    const now=Math.floor(Date.now()/1000);
    const body=`${b64({alg:"HS256",typ:"JWT"})}.${b64({sub,email,iat:now,exp:now+3600})}`;
    const sig=c.createHmac("sha256",Buffer.from(secret,"base64")).update(body).digest("base64url");
    process.stdout.write(`${body}.${sig}`);
  ' "$1" "$2" "$GATEWAY_JWT_SECRET"
}

# api <token> <method> <path> [body] → body on stdout, status in $STATUS
api() {
  local token="$1" method="$2" path="$3" body="${4:-}" out
  if [ -n "$body" ]; then
    out=$(curl -sS -w '\n%{http_code}' -X "$method" "${BASE_URL}${path}" \
      -H "authorization: Bearer $token" -H 'content-type: application/json' -d "$body")
  else
    out=$(curl -sS -w '\n%{http_code}' -X "$method" "${BASE_URL}${path}" \
      -H "authorization: Bearer $token")
  fi
  STATUS="${out##*$'\n'}"
  printf '%s' "${out%$'\n'*}"
}

# pod <token> <method> <path> [body] → same, against the TEAM surface's edge
pod() {
  local token="$1" method="$2" path="$3" body="${4:-}" out
  if [ -n "$body" ]; then
    out=$(curl -sS -w '\n%{http_code}' -X "$method" "${TEAM_URL}${path}" \
      -H "authorization: Bearer $token" -H 'content-type: application/json' -d "$body")
  else
    out=$(curl -sS -w '\n%{http_code}' -X "$method" "${TEAM_URL}${path}" \
      -H "authorization: Bearer $token")
  fi
  STATUS="${out##*$'\n'}"
  printf '%s' "${out%$'\n'*}"
}

register() { # email → user id
  curl -sS -X POST "${BASE_URL}/api/auth/register" -H 'content-type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.user_id // empty'
}

# ── 1. Two accounts ──────────────────────────────────────────────────────────
step '1. Test accounts'
STAMP="$(date +%s)"
EMAIL_A="${EMAIL_A:-teams-a-${STAMP}@example.com}"
EMAIL_B="${EMAIL_B:-teams-b-${STAMP}@example.com}"
USER_A="${USER_A:-$(register "$EMAIL_A" "VerifyTeams-Pw1!")}"
USER_B="${USER_B:-$(register "$EMAIL_B" "VerifyTeams-Pw2!")}"
[ -n "$USER_A" ] && [ -n "$USER_B" ] || { echo "could not create test users" >&2; exit 1; }
TOK_A=$(mint "$USER_A" "$EMAIL_A")
TOK_B=$(mint "$USER_B" "$EMAIL_B")
echo "  A=$USER_A  B=$USER_B"

# ── 2. Create a team, add B as a viewer ──────────────────────────────────────
step '2. Team + membership'
TEAM=$(api "$TOK_A" POST /api/teams '{"name":"Verify Teams"}')
TEAM_ID=$(printf '%s' "$TEAM" | jq -r '.id')
expect 'A creates a team and is its editor' "$(printf '%s' "$TEAM" | jq -r '.role')" 'editor'

ADD=$(api "$TOK_A" POST "/api/teams/${TEAM_ID}/members" \
  "{\"email\":\"${EMAIL_B}\",\"role\":\"viewer\"}")
expect 'B (has an account) joins immediately' "$(printf '%s' "$ADD" | jq -r '.status')" 'added'

EMAIL_C="nobody-${STAMP}@example.com"
INV=$(api "$TOK_A" POST "/api/teams/${TEAM_ID}/members" \
  "{\"email\":\"${EMAIL_C}\",\"role\":\"viewer\"}")
expect 'an unknown email becomes a pending invite' "$(printf '%s' "$INV" | jq -r '.status')" 'invited'
INVITE_ID=$(printf '%s' "$INV" | jq -r '.invite_id')

api "$TOK_B" GET /api/teams >/dev/null
expect 'B can list teams' "$STATUS" '200'

# ── 2b. That invite is claimable once the person actually signs up ───────────
# There is no mailer: an invite is claimed on next login, so this is the whole
# of the invite flow and the only thing that proves the pending row is usable.
step '2b. Claiming an invitation'
USER_C=$(register "$EMAIL_C" 'VerifyTeams-Pw3!')
[ -n "$USER_C" ] || { echo "could not register the invited user" >&2; exit 1; }
TOK_C=$(mint "$USER_C" "$EMAIL_C")

PENDING=$(api "$TOK_C" GET /api/teams)
expect 'C sees the invitation waiting' \
  "$(printf '%s' "$PENDING" | jq -r --arg i "$INVITE_ID" '[.invites[]? | select(.id==$i)] | length')" '1'

api "$TOK_B" POST "/api/teams/invites/${INVITE_ID}/accept" >/dev/null
expect "someone else's invite is not claimable" "$STATUS" '403'

ACC=$(api "$TOK_C" POST "/api/teams/invites/${INVITE_ID}/accept")
expect 'C claims the invitation' "$STATUS" '200'
expect 'and lands in the right team' "$(printf '%s' "$ACC" | jq -r '.team_id')" "$TEAM_ID"

ROSTER=$(api "$TOK_A" GET "/api/teams/${TEAM_ID}")
expect 'the roster now holds all three' \
  "$(printf '%s' "$ROSTER" | jq -r '.members | length')" '3'
expect 'and the invite is no longer pending' \
  "$(printf '%s' "$ROSTER" | jq -r '[.invites[]? | select(.id=="'"$INVITE_ID"'")] | length')" '0'

# ── 3. Team tokens ───────────────────────────────────────────────────────────
step '3. Team-scoped tokens'
TEAM_TOK_A=$(api "$TOK_A" POST "/api/teams/${TEAM_ID}/token" | jq -r '.access_token')
TEAM_TOK_B=$(api "$TOK_B" POST "/api/teams/${TEAM_ID}/token" | jq -r '.access_token')
# Decode a JWT claim. The payload is base64URL, so translate the alphabet and
# re-pad before handing it to base64(1).
claim() {
  local p; p=$(printf '%s' "$1" | cut -d. -f2 | tr '_-' '/+')
  while [ $(( ${#p} % 4 )) -ne 0 ]; do p="${p}="; done
  printf '%s' "$p" | base64 -d 2>/dev/null | jq -r "$2"
}
expect "A's token carries the team"  "$(claim "$TEAM_TOK_A" .team)" "$TEAM_ID"
expect "A's token says editor"       "$(claim "$TEAM_TOK_A" .role)" 'editor'
expect "B's token says viewer"       "$(claim "$TEAM_TOK_B" .role)" 'viewer'

api "$TOK_B" GET "/api/teams/${TEAM_ID}/compute/env" >/dev/null
expect 'a viewer cannot read the team credentials' "$STATUS" '403'

# ── 4. The pod, and the edge ─────────────────────────────────────────────────
step '4. Team pod + edge routing'
api "$TOK_A" POST "/api/teams/${TEAM_ID}/compute/ensure" >/dev/null
expect 'the team pod provisions' "$STATUS" '200'

for _ in $(seq 1 40); do
  pod "$TEAM_TOK_A" GET /api/projects >/dev/null
  [ "$STATUS" = '200' ] && break
  sleep 3          # cold boot, or Envoy's waking response — retry
done
expect 'a team token reaches the team pod' "$STATUS" '200'

pod "$TOK_A" GET /api/projects >/dev/null
expect 'a PERSONAL token is refused at lmthing.team' "$STATUS" '401'

# ── 5. The role matrix, inside the workspace ─────────────────────────────────
step '5. Viewer vs editor inside the workspace'
pod "$TEAM_TOK_B" GET /api/projects >/dev/null
expect 'a viewer reads the projects' "$STATUS" '200'

pod "$TEAM_TOK_B" PUT /api/env '{"content":"HACKED=1"}' >/dev/null
expect 'a viewer cannot write the pod env' "$STATUS" '403'

pod "$TEAM_TOK_B" POST /api/projects '{"name":"viewer-made-this"}' >/dev/null
expect 'a viewer cannot create a project' "$STATUS" '403'

pod "$TEAM_TOK_A" POST /api/projects '{"name":"team-project"}' >/dev/null
[ "$STATUS" = '200' ] || [ "$STATUS" = '201' ] \
  && ok 'an editor creates a project' \
  || bad "an editor creates a project (got $STATUS)"

# Creating a channel is configuring the team, so it is an editor's act; talking
# in one is every member's. This is the seam between the two roles in the chat.
pod "$TEAM_TOK_B" POST /api/team/channels '{"name":"viewer-channel"}' >/dev/null
expect 'a viewer cannot create a channel' "$STATUS" '403'
pod "$TEAM_TOK_A" POST /api/team/channels '{"name":"standup"}' >/dev/null
[ "$STATUS" = '200' ] || [ "$STATUS" = '201' ] \
  && ok 'an editor creates a channel' || bad "an editor creates a channel (got $STATUS)"

# ── 6. Channels, and THING's memory across members ───────────────────────────
step '6. Channels + THING in a thread'
CH=$(pod "$TEAM_TOK_A" GET /api/team/channels)
expect 'channels are served, seeded with #general' \
  "$(printf '%s' "$CH" | jq -r '.channels[0].id')" 'general'

WORD="pineapple-${STAMP}"
MSG=$(pod "$TEAM_TOK_A" POST /api/team/channels/general/messages \
  "{\"text\":\"@thing please remember the word ${WORD}\"}")
ROOT=$(printf '%s' "$MSG" | jq -r '.message.id')
expect 'A posts a mention' "$STATUS" '201'

# THING answers out-of-band; poll the transcript for its reply.
for _ in $(seq 1 60); do
  HIST=$(pod "$TEAM_TOK_A" GET /api/team/channels/general/messages)
  [ "$(printf '%s' "$HIST" | jq '[.messages[] | select(.kind=="thing")] | length')" -ge 1 ] && break
  sleep 5
done
[ "$(printf '%s' "$HIST" | jq '[.messages[] | select(.kind=="thing")] | length')" -ge 1 ] \
  && ok 'THING answers in the thread' || bad 'THING answers in the thread'

# The VIEWER replies in the same thread — same session, so THING has the context.
pod "$TEAM_TOK_B" POST /api/team/channels/general/messages \
  "{\"text\":\"@thing what word did you just remember?\",\"threadId\":\"${ROOT}\"}" >/dev/null
expect 'a viewer may talk in a channel' "$STATUS" '201'

for _ in $(seq 1 60); do
  HIST=$(pod "$TEAM_TOK_A" GET /api/team/channels/general/messages)
  [ "$(printf '%s' "$HIST" | jq '[.messages[] | select(.kind=="thing")] | length')" -ge 2 ] && break
  sleep 5
done
LAST=$(printf '%s' "$HIST" | jq -r '[.messages[] | select(.kind=="thing")] | last | .text')
case "$LAST" in
  *"$WORD"*) ok 'THING remembers the thread ACROSS MEMBERS' ;;
  *)         bad "THING remembers the thread across members (last reply: ${LAST:0:80})" ;;
esac

# ── 7. Promotion takes effect on the next mint ───────────────────────────────
step '7. Role change'
api "$TOK_A" PUT "/api/teams/${TEAM_ID}/members/${USER_B}" '{"role":"editor"}' >/dev/null
expect 'A promotes B to editor' "$STATUS" '200'
TEAM_TOK_B2=$(api "$TOK_B" POST "/api/teams/${TEAM_ID}/token" | jq -r '.access_token')
expect "B's re-minted token says editor" "$(claim "$TEAM_TOK_B2" .role)" 'editor'
pod "$TEAM_TOK_B2" POST /api/projects '{"name":"now-an-editor"}' >/dev/null
[ "$STATUS" = '200' ] || [ "$STATUS" = '201' ] \
  && ok 'B can now write' || bad "B can now write (got $STATUS)"

api "$TOK_A" PUT "/api/teams/${TEAM_ID}/members/${USER_A}" '{"role":"viewer"}' >/dev/null
[ "$STATUS" = '200' ] && ok 'A may step down while B is an editor' \
  || bad "A may step down while B is an editor (got $STATUS)"
api "$TOK_B" PUT "/api/teams/${TEAM_ID}/members/${USER_B}" '{"role":"viewer"}' >/dev/null
expect 'the LAST editor cannot be demoted' "$STATUS" '409'
api "$TOK_B" PUT "/api/teams/${TEAM_ID}/members/${USER_A}" '{"role":"editor"}' >/dev/null

# ── 7b. The team pays for itself ─────────────────────────────────────────────
# A team's budget is its own LiteLLM principal (team-<id>), never a member's.
step '7b. Billing'
USAGE=$(api "$TOK_A" GET "/api/teams/${TEAM_ID}/billing/usage")
expect 'a member can read the team usage' "$STATUS" '200'
expect 'a fresh team is on the free tier' "$(printf '%s' "$USAGE" | jq -r '.tier')" 'free'

api "$TOK_C" POST "/api/teams/${TEAM_ID}/billing/checkout" '{"tier":"basic"}' >/dev/null
expect 'a viewer cannot start a checkout' "$STATUS" '403'
CO=$(api "$TOK_A" POST "/api/teams/${TEAM_ID}/billing/checkout" '{"tier":"basic"}')
expect 'an editor gets a checkout url' "$STATUS" '200'
case "$(printf '%s' "$CO" | jq -r '.url')" in
  https://*) ok 'and it points at Stripe' ;;
  *)         bad "and it points at Stripe (got $(printf '%s' "$CO" | jq -r '.url'))" ;;
esac

# ── 8. Wake from scale-to-zero ───────────────────────────────────────────────
# Only meaningful with cluster access; skipped otherwise.
if [ -x "$(dirname "${BASH_SOURCE[0]}")/cluster-kubectl.sh" ] && [ "${SKIP_WAKE:-}" != '1' ]; then
  step '8. Wake a scaled-to-zero team pod'
  "$(dirname "${BASH_SOURCE[0]}")/cluster-kubectl.sh" \
    scale deploy/lmthing -n "team-${TEAM_ID}" --replicas=0 >/dev/null 2>&1 || true
  sleep 5
  for _ in $(seq 1 40); do
    pod "$TEAM_TOK_A" GET /api/projects >/dev/null
    [ "$STATUS" = '200' ] && break
    sleep 3
  done
  expect 'the activator wakes the team pod' "$STATUS" '200'
fi

# ── 9. Teardown ──────────────────────────────────────────────────────────────
# Deleting a team removes its pod and its namespace — the test leaves no
# workspace running. Do it last, and only if nothing above needed it.
if [ "${KEEP_TEAM:-}" != '1' ]; then
  step '9. Deleting the team'
  api "$TOK_C" DELETE "/api/teams/${TEAM_ID}" >/dev/null
  expect 'a viewer cannot delete the team' "$STATUS" '403'
  api "$TOK_A" DELETE "/api/teams/${TEAM_ID}" >/dev/null
  expect 'an editor deletes it' "$STATUS" '200'
  api "$TOK_A" GET "/api/teams/${TEAM_ID}" >/dev/null
  expect 'and it is gone' "$STATUS" '404'
else
  step "9. Teardown skipped — team ${TEAM_ID} left running"
fi

step "Result: ${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
