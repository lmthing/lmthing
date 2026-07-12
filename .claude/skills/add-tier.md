---
name: add-tier
description: Load when adding or modifying a pricing tier (the cross-cutting backend/frontend/infra/docs checklist).
---

# Adding a New Tier

Load this when you are adding a pricing tier, changing an existing tier's numbers (budgets,
models, rate limits, pod sizing, cron policy), or touching the Stripe subscription flow. A tier is
one entry in the `TIERS` record in `cloud/gateway/src/lib/tiers.ts`, but it is genuinely
cross-cutting: the gateway, the Stripe account, the Ansible vault, the ArgoCD manifest and the
marketing pricing page all have to agree.

## Read first (these hold the grounded truth — this skill holds none)

- `org/docs/contributing/add-a-tier.md` — **the checklist**: every file, field-by-field rules
  (incl. the `name.toLowerCase() === key` trap and the required `cron` policy), and the deploy
  sequence. Follow it, not memory.
- `org/docs/cloud/billing-and-tiers.md` — **the reference**: the current tier table, what each
  field does and where it is enforced, the Stripe flow (checkout → webhook → tier change), the
  15% markup, the budget/usage endpoints.
- `org/docs/cloud/litellm.md` — how the tier reaches LiteLLM keys, if you touch models.
- `org/docs/contributing/add-a-provider.md` — if what you actually want is a new *model*, not a
  new tier.

Do not trust any tier numbers, rate limits, model counts or file paths you remember from an older
version of this skill or from `com/src/config/plans.ts` marketing copy — several were wrong. The
table in `org/docs/cloud/billing-and-tiers.md` §2 is cited line-by-line to `tiers.ts`.

## Procedure (order matters)

1. **Define the tier** in `cloud/gateway/src/lib/tiers.ts`. All fields are required; `tsc` in
   `cloud/gateway/Dockerfile` is the first gate. Field rules → `org/docs/contributing/add-a-tier.md` §1.
2. **Create the Stripe price** — either script prints the env lines you need next:
   ```bash
   STRIPE_SECRET_KEY=sk_… pnpm --filter @lmthing/cloud stripe:create-products
   # or: STRIPE_KEY=sk_… DOMAIN=lmthing.cloud devops/ansible/scripts/setup/create-stripe-prices.sh
   ```
   The two scripts diverge — read `org/docs/cloud/billing-and-tiers.md` §4.1 before picking one.
3. **Plumb `STRIPE_PRICE_<TIER>`** through the four files listed in
   `org/docs/contributing/add-a-tier.md` §3 (`.env.example` → ansible vault → `cloud_secrets` role
   → `devops/argocd/core/gateway.yaml`). Miss the last two and the subscription is paid but the
   tier never changes.
4. **Add the pricing card** in `com/src/config/plans.ts` (`plan.id` must equal the `TIERS` key).
5. **Ship**: secrets are not in git, so push them first, then merge — CI builds the image and
   ArgoCD syncs the manifest (no manual `kubectl apply`):
   ```bash
   make -C devops deploy-secrets
   ```
6. **Backfill existing users** only if you changed an *existing* tier's numbers (they are written
   at provisioning time and on Stripe tier changes, never retroactively):
   ```bash
   kubectl -n lmthing port-forward svc/litellm 4000:4000 &
   LITELLM_MASTER_KEY=$(kubectl -n lmthing get secret lmthing-secrets \
       -o jsonpath='{.data.LITELLM_MASTER_KEY}' | base64 -d) \
     LITELLM_URL=http://127.0.0.1:4000 APPLY=1 \
     pnpm --filter @lmthing/cloud litellm:resync-budgets
   ```
   (dry-run without `APPLY=1`; `TIER=<key>` narrows it.)
7. **Verify** end to end: subscribe on `/pricing`, then `GET /api/billing/usage` should report the
   new tier and its budget windows.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in
the same change (see `org/docs/SYNC.md`). For a tier change that means
`org/docs/cloud/billing-and-tiers.md` (tier table §2, enforcement §3, operations §7) and, if the
procedure itself changed, `org/docs/contributing/add-a-tier.md`.
