#!/bin/bash
# Health check for all lmthing.* domains
# Checks: DNS A records, TLS certificate, HTTPS response, hosting config

set -euo pipefail

GHPAGES_IPS=("185.199.108.153" "185.199.109.153" "185.199.110.153" "185.199.111.153")
VM_IP="4.223.83.5"

# GitHub Pages domains — app:repo:domain
GHPAGES_DOMAINS=(
  "studio:lmthing/studio:lmthing.studio"
  "chat:lmthing/chat:lmthing.chat"
  "com:lmthing/com:lmthing.com"
  "store:lmthing/store:lmthing.store"
  "team:lmthing/team:lmthing.team"
  "social:lmthing/social:lmthing.social"
  "space:lmthing/space:lmthing.space"
)

# VM-hosted domains (served via K3s on Azure VM) — app:domain
VM_DOMAINS=(
  "computer:lmthing.computer"
)

# Cloud API domains — domain:path:expected_status
CLOUD_DOMAINS=(
  "lmthing.cloud:/api/auth/me:401"
  "lmthing.cloud:/v1/models:401"
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
TOTAL=0

echo -e "${BOLD}lmthing domain health check${NC}"
echo ""

# Check required tools
for cmd in dig curl openssl gh; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}Missing required tool: $cmd${NC}"
    exit 1
  fi
done

# --- Shared checks (DNS, TLS, HTTPS) ---
check_dns_tls_https() {
  local domain="$1"
  local expected_ip="$2"  # single IP or "ghpages"

  # DNS A records
  a_records=$(dig +short A "$domain" 2>/dev/null | sort)
  if [ -z "$a_records" ]; then
    fail "No A records found"
  elif [ "$expected_ip" = "ghpages" ]; then
    missing=0
    for ip in "${GHPAGES_IPS[@]}"; do
      if ! echo "$a_records" | grep -q "$ip"; then
        missing=1
        break
      fi
    done
    if [ "$missing" -eq 0 ]; then
      pass "DNS A records correct (4 GitHub Pages IPs)"
    else
      fail "DNS A records incomplete — expected: ${GHPAGES_IPS[*]}, got: $(echo $a_records | tr '\n' ' ')"
    fi
  else
    if echo "$a_records" | grep -q "^${expected_ip}$"; then
      pass "DNS A record correct ($expected_ip)"
    else
      fail "DNS A record wrong — expected: $expected_ip, got: $(echo $a_records | tr '\n' ' ')"
    fi
  fi

  # TLS certificate
  cert_san=$(echo | openssl s_client -servername "$domain" -connect "$domain":443 2>/dev/null \
    | openssl x509 -noout -text 2>/dev/null \
    | grep -oP 'DNS:\K[^,]+' | head -5 || true)
  if echo "$cert_san" | grep -q "^${domain}$"; then
    pass "TLS certificate valid for $domain"
  else
    fail "TLS certificate mismatch — cert covers: $(echo $cert_san | tr '\n' ', ')"
  fi

  # HTTPS response
  http_code=$(curl -sI -o /dev/null -w "%{http_code}" --max-time 10 "https://$domain" 2>/dev/null; true)
  if [ "$http_code" = "200" ]; then
    pass "HTTPS responds 200"
  elif [ "$http_code" = "404" ]; then
    warn "HTTPS responds 404 — site not deployed yet"; WARNINGS=$((WARNINGS + 1))
  elif [ "$http_code" = "000" ]; then
    fail "HTTPS connection failed (TLS or timeout)"
  else
    warn "HTTPS responds $http_code"; WARNINGS=$((WARNINGS + 1))
  fi
}

# --- GitHub Pages domains ---
for entry in "${GHPAGES_DOMAINS[@]}"; do
  IFS=: read -r app repo domain <<< "$entry"
  echo -e "${CYAN}${BOLD}$domain${NC} ($repo) [GitHub Pages]"
  TOTAL=$((TOTAL + 1))

  check_dns_tls_https "$domain" "ghpages"

  # GitHub Pages config
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

  # Dispatch workflow in monorepo
  dispatch_file=".github/workflows/dispatch-${app}.yml"
  if [ -f "$dispatch_file" ]; then
    pass "Dispatch workflow exists ($dispatch_file)"
  else
    fail "Dispatch workflow missing ($dispatch_file)"
  fi

  echo ""
done

# --- VM-hosted domains ---
for entry in "${VM_DOMAINS[@]}"; do
  IFS=: read -r app domain <<< "$entry"
  echo -e "${CYAN}${BOLD}$domain${NC} [VM-hosted @ $VM_IP]"
  TOTAL=$((TOTAL + 1))

  check_dns_tls_https "$domain" "$VM_IP"

  # Check cross-origin isolation headers (required for WebContainer)
  headers=$(curl -sI --max-time 10 "https://$domain" 2>/dev/null || true)
  coep=$(echo "$headers" | grep -i 'cross-origin-embedder-policy' | tr -d '\r' || true)
  coop=$(echo "$headers" | grep -i 'cross-origin-opener-policy' | tr -d '\r' || true)
  if echo "$coep" | grep -qi 'credentialless\|require-corp'; then
    pass "Cross-Origin-Embedder-Policy header present"
  else
    fail "Cross-Origin-Embedder-Policy header missing (required for WebContainer)"
  fi
  if echo "$coop" | grep -qi 'same-origin'; then
    pass "Cross-Origin-Opener-Policy header present"
  else
    fail "Cross-Origin-Opener-Policy header missing (required for WebContainer)"
  fi

  echo ""
done

# --- Cloud API ---
echo -e "${CYAN}${BOLD}lmthing.cloud${NC} [API gateway @ $VM_IP]"
TOTAL=$((TOTAL + 1))

check_dns_tls_https "lmthing.cloud" "$VM_IP"

# Check API endpoints are reachable (expect 401 for unauthenticated requests)
for entry in "${CLOUD_DOMAINS[@]}"; do
  IFS=: read -r domain path expected_status <<< "$entry"
  actual=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${domain}${path}" 2>/dev/null || echo "000")
  if [ "$actual" = "$expected_status" ]; then
    pass "${path} responds $actual (expected)"
  elif [ "$actual" = "000" ]; then
    fail "${path} connection failed"
  else
    fail "${path} responds $actual (expected $expected_status)"
  fi
done

echo ""

# --- Summary ---
echo -e "${BOLD}Summary${NC}"
echo -e "  Domains checked: $TOTAL (${#GHPAGES_DOMAINS[@]} GitHub Pages, ${#VM_DOMAINS[@]} VM-hosted, 1 cloud API)"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "  ${GREEN}All checks passed${NC}"
elif [ "$ERRORS" -eq 0 ]; then
  echo -e "  ${YELLOW}$WARNINGS warning(s)${NC}, ${GREEN}0 errors${NC}"
else
  echo -e "  ${RED}$ERRORS error(s)${NC}, ${YELLOW}$WARNINGS warning(s)${NC}"
fi
exit "$ERRORS"
