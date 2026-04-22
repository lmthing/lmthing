# Adding a New Tier

## Overview

Tiers are a cross-cutting concern spanning backend, frontend, infra, knowledge base, and documentation. This is the complete checklist of every file that must be updated.

## Current Tiers

| Tier    | Price      | Budget  | Reset   | Rate Limits          |
|---------|------------|---------|---------|----------------------|
| Free    | $0         | $1      | 7 days  | 10K tpm / 60 rpm     |
| Starter | $5/month   | $5      | 30 days | 25K tpm / 150 rpm    |
| Basic   | $10/month  | $10     | 30 days | 50K tpm / 300 rpm    |
| Pro     | $20/month  | $20     | 30 days | 100K tpm / 1K rpm    |
| Max     | $100/month | $100    | 30 days | 1M tpm / 5K rpm      |

## Checklist

### 1. Backend — `cloud/gateway/src/lib/tiers.ts`

Add the tier to the `TIERS` object in order. Define `name`, `stripePriceId` (env var), `budget`, `budgetDuration`, `models`, `tpmLimit`, `rpmLimit`. No other backend code changes needed — routes and helpers iterate `TIERS` dynamically.

### 2. Backend — `cloud/scripts/create-stripe-products.ts`

Add to the `TIERS` array with `lookupKey`, `amount` (cents), `label`. Add the `console.log` line for the env var output. Run the script to create the Stripe price.

### 3. Backend — Env var placeholders

Add `STRIPE_PRICE_YOURTIER=price_xxx` to both:
- `cloud/.env.example`
- `cloud/k8s/.env.secrets.example`

### 4. Backend — `cloud/k8s/gateway.yaml`

Add `STRIPE_PRICE_YOURTIER` env var entry referencing the `lmthing-secrets` secret.

### 5. Frontend — `com/src/config/plans.ts`

Add the plan to the `plans` array (renders left to right on the pricing page). Set `highlighted: true` on the recommended plan.

### 6. Knowledge Base — Tier knowledge file

Create `sdk/libs/thing/spaces/space-ecosystem/knowledge/billing-context/plan-tier/yourtier.md` with frontmatter (`title`, `description`, `order`) describing the tier.

### 7. Knowledge Base — Tier config

Add the tier slug to the `options` array in `sdk/libs/thing/spaces/space-ecosystem/knowledge/billing-context/plan-tier/config.json`.

### 8. Knowledge Base — Reorder existing tiers

Bump `order` in any existing tier `.md` files that come after the new one. Update adjacent tiers' upgrade/downgrade text if needed.

### 9. Documentation

Update tier tables and `(Free/Starter/Basic/Pro/Max)` references in:
- `CLAUDE.md` (root)
- `cloud/CLAUDE.md` — tier table + env var table
- `cloud/README.md`
- `com/CLAUDE.md` — tier count
- `sdk/org/repl/spaces/codebase/knowledge/stack/layer/backend.md`

### 10. Deploy

1. Run `create-stripe-products.ts` to create the Stripe price
2. Add price ID to `.env.secrets`
3. Sync secrets, `gateway.yaml`, and gateway code to VM
4. `kubectl apply` the updated manifest (a restart alone won't pick up new env var entries)
5. Rebuild and restart gateway

For detailed code examples and deploy commands, see `cloud/CLAUDE.md` section "Adding a New Tier".
