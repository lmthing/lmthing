---
name: cloud-backend
description: Load when touching the cloud gateway, LiteLLM, billing, tiers, API routes, webhooks, or K8s/Envoy config.
---

# Skill: Cloud Backend (Gateway + LiteLLM)

Use this when you are changing anything server-side: a gateway route, auth/tokens, tiers or
Stripe, the LiteLLM proxy/model list, the render service, or the Envoy routing in front of them.

**`cloud/` is the only backend in the monorepo.** Every frontend is a static SPA that calls it.
Any new endpoint, DB operation or webhook handler belongs in `cloud/gateway/` or in K8s config —
never in a new service. (The one other thing serving `/api/*` is the user's *compute pod*, a
different process on a different origin — see `org/docs/cli-api/rest/README.md`.)

## Read first — the grounded truth lives in org/docs

Do not trust any route/tier/model list you remember. Read the page before you edit:

- `org/docs/cloud/README.md` — the two services, the gateway↔LiteLLM split, Postgres + migrations, Stripe
- `org/docs/cloud/routes.md` — **every** gateway route and its auth scheme (there are more routers than auth/keys/billing/webhook: also `compute`, `backup`, `inbound`, `status`, `issues`)
- `org/docs/cloud/auth.md` — token types, Zitadel identity, GitHub OAuth, cross-domain SSO, scoped pod JWTs
- `org/docs/cloud/billing-and-tiers.md` — the tier table, budget windows, where each tier field is enforced, Stripe flows
- `org/docs/cloud/litellm.md` — the `/v1/*` proxy, the enabled model list, the 15% markup, tier enforcement
- `org/docs/cloud/render.md` — the headless-Chromium render service behind `webSearch`/`webFetch`

Related: `org/docs/contributing/add-a-tier.md` (tier checklist) ·
`org/docs/devops/infrastructure.md` (the cluster) · `org/docs/devops/deploy.md`.

## Procedure

Local dev:

```bash
pnpm --filter @lmthing/gateway dev      # tsx watch src/index.ts, port 3000
```

Operational scripts (run from `cloud/`):

```bash
pnpm stripe:create-products     # idempotent Stripe product/price creation
pnpm litellm:generate-models    # emit the marked-up model_list for devops/argocd/core/litellm.yaml
pnpm litellm:resync-budgets     # backfill changed budget windows onto existing keys
```

Deploy — K8s manifests live in `devops/argocd/` and are auto-synced by ArgoCD:

```bash
cd devops/ansible && make deploy
```

Order of operations when changing a tier or a model: edit `cloud/gateway/src/lib/tiers.ts`
(the single source of truth) → regenerate/resync with the scripts above → update the pages listed
in `org/docs/contributing/add-a-tier.md`. Changing the model list means the gateway's
`ENABLED_MODELS` and `cloud/scripts/generate-litellm-models.ts` must stay in sync.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in
the same change (see `org/docs/SYNC.md`).
