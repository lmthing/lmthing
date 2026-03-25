#!/usr/bin/env bash
# Creates lmthing tier products + prices in Stripe, and registers the webhook endpoint.
# Usage: STRIPE_KEY=sk_test_... DOMAIN=lmthing.cloud ./create-stripe-prices.sh
#
# Prints vault variable lines ready to paste into vault.yml.

set -euo pipefail

STRIPE_KEY="${STRIPE_KEY:-}"
DOMAIN="${DOMAIN:-lmthing.cloud}"
if [[ -z "$STRIPE_KEY" ]]; then
  echo "Error: STRIPE_KEY is required" >&2
  echo "Usage: STRIPE_KEY=sk_test_... DOMAIN=lmthing.cloud $0" >&2
  exit 1
fi

stripe_post() {
  local path="$1"
  shift
  curl -sf "https://api.stripe.com/v1${path}" \
    -u "${STRIPE_KEY}:" \
    "$@"
}

create_price() {
  local name="$1"
  local amount_cents="$2"   # in cents

  local product_id
  product_id=$(stripe_post /products \
    -d "name=lmthing ${name}" \
    -d "description=lmthing ${name} tier" \
    | jq -r '.id')

  local price_id
  price_id=$(stripe_post /prices \
    -d "product=${product_id}" \
    -d "unit_amount=${amount_cents}" \
    -d "currency=usd" \
    -d "recurring[interval]=month" \
    | jq -r '.id')

  echo "$price_id"
}

echo "Creating Stripe prices..." >&2

STARTER=$(create_price "Starter" 500)
BASIC=$(create_price "Basic" 1000)
PRO=$(create_price "Pro" 2000)
MAX=$(create_price "Max" 10000)

echo "Creating webhook endpoint..." >&2

WEBHOOK_SECRET=$(stripe_post /webhook_endpoints \
  -d "url=https://${DOMAIN}/api/stripe/webhook" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  | jq -r '.secret')

echo "" >&2
echo "Done. Add these to vault.yml:" >&2
echo "─────────────────────────────────────────"
echo "vault_stripe_price_starter: \"${STARTER}\""
echo "vault_stripe_price_basic: \"${BASIC}\""
echo "vault_stripe_price_pro: \"${PRO}\""
echo "vault_stripe_price_max: \"${MAX}\""
echo "vault_stripe_webhook_secret: \"${WEBHOOK_SECRET}\""
echo "─────────────────────────────────────────"
