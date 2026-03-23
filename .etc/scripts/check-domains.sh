#!/bin/bash
# Health check for all lmthing.* GitHub Pages domains
# Checks: DNS A records, TLS certificate, HTTPS response, GitHub Pages config

set -euo pipefail

EXPECTED_IPS=("185.199.108.153" "185.199.109.153" "185.199.110.153" "185.199.111.153")

DOMAINS=(
  "studio:lmthing/studio:lmthing.studio"
  "chat:lmthing/chat:lmthing.chat"
  "com:lmthing/com:lmthing.com"
  "store:lmthing/store:lmthing.store"
  "team:lmthing/team:lmthing.team"
  "social:lmthing/social:lmthing.social"
  "space:lmthing/space:lmthing.space"
  "computer:lmthing/computer:lmthing.computer"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }

ERRORS=0
WARNINGS=0

echo -e "${BOLD}lmthing domain health check${NC}"
echo ""

# Check required tools
for cmd in dig curl openssl gh; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}Missing required tool: $cmd${NC}"
    exit 1
  fi
done

for entry in "${DOMAINS[@]}"; do
  IFS=: read -r app repo domain <<< "$entry"
  echo -e "${CYAN}${BOLD}$domain${NC} ($repo)"

  # --- DNS A records ---
  a_records=$(dig +short A "$domain" 2>/dev/null | sort)
  if [ -z "$a_records" ]; then
    fail "No A records found"
  else
    missing=0
    for ip in "${EXPECTED_IPS[@]}"; do
      if ! echo "$a_records" | grep -q "$ip"; then
        missing=1
        break
      fi
    done
    if [ "$missing" -eq 0 ]; then
      pass "DNS A records correct (4 GitHub Pages IPs)"
    else
      fail "DNS A records incomplete — expected: ${EXPECTED_IPS[*]}, got: $(echo $a_records | tr '\n' ' ')"
    fi
  fi

  # --- TLS certificate ---
  cert_san=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null \
    | openssl x509 -noout -text 2>/dev/null \
    | grep -oP 'DNS:\K[^,]+' | head -5)
  if echo "$cert_san" | grep -q "^${domain}$"; then
    pass "TLS certificate valid for $domain"
  else
    fail "TLS certificate mismatch — cert covers: $(echo $cert_san | tr '\n' ', ')"
  fi

  # --- HTTPS response ---
  http_code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "https://$domain" 2>/dev/null || echo "000")
  if [ "$http_code" = "200" ]; then
    pass "HTTPS responds 200"
  elif [ "$http_code" = "404" ]; then
    warn "HTTPS responds 404 — site not deployed yet"; WARNINGS=$((WARNINGS + 1))
  elif [ "$http_code" = "000" ]; then
    fail "HTTPS connection failed (TLS or timeout)"
  else
    warn "HTTPS responds $http_code"; WARNINGS=$((WARNINGS + 1))
  fi

  # --- GitHub Pages config ---
  pages_json=$(gh api "repos/$repo/pages" 2>/dev/null || echo '{}')
  gh_cname=$(echo "$pages_json" | jq -r '.cname // empty')
  gh_https=$(echo "$pages_json" | jq -r '.https_enforced // false')
  gh_build=$(echo "$pages_json" | jq -r '.build_type // empty')

  if [ "$gh_cname" = "$domain" ]; then
    pass "GitHub Pages custom domain set"
  elif [ -z "$gh_cname" ]; then
    fail "GitHub Pages custom domain not configured"
  else
    fail "GitHub Pages custom domain mismatch — set to '$gh_cname', expected '$domain'"
  fi

  if [ "$gh_build" = "workflow" ]; then
    pass "GitHub Pages source: Actions workflow"
  else
    fail "GitHub Pages source: '$gh_build' (expected 'workflow')"
  fi

  if [ "$gh_https" = "true" ]; then
    pass "HTTPS enforcement enabled"
  else
    warn "HTTPS enforcement not enabled"; WARNINGS=$((WARNINGS + 1))
  fi

  # --- Dispatch workflow in monorepo ---
  dispatch_file=".github/workflows/dispatch-${app}.yml"
  if [ -f "$dispatch_file" ]; then
    pass "Dispatch workflow exists ($dispatch_file)"
  else
    fail "Dispatch workflow missing ($dispatch_file)"
  fi

  echo ""
done

# --- Summary ---
echo -e "${BOLD}Summary${NC}"
echo -e "  Domains checked: ${#DOMAINS[@]}"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "  ${GREEN}All checks passed${NC}"
elif [ "$ERRORS" -eq 0 ]; then
  echo -e "  ${YELLOW}$WARNINGS warning(s)${NC}, ${GREEN}0 errors${NC}"
else
  echo -e "  ${RED}$ERRORS error(s)${NC}, ${YELLOW}$WARNINGS warning(s)${NC}"
fi
exit "$ERRORS"
