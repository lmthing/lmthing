# cloud/ — API Gateway + LiteLLM

`cloud/` is the **sole backend** for the entire monorepo: a Hono/Node **gateway** (`/api/*` —
auth, API keys, billing, compute-pod lifecycle, webhooks) plus **LiteLLM** (`/v1/*` — an
OpenAI-compatible proxy to Azure AI Foundry). Backed by PostgreSQL + Stripe, running on
Kubernetes. Every product SPA and every user compute pod is a client of it — there is no
other server-side code in the repo. Any new endpoint, DB operation, or webhook handler
lands **here** or as K8s config.

> ## Docs are the source of truth
>
> **[org/docs/](../org/docs/README.md) (published at lmthing.org) is the single source of
> truth for this codebase.** Every sentence there is cited to the implementation. This file is
> an orientation index and pointer — it holds no knowledge of its own.
>
> **A code change is not done until the matching org/docs page is updated in the same change.**
> Not later, not a follow-up ticket. See **[org/docs/SYNC.md](../org/docs/SYNC.md)**.
>
> Start at **[org/docs/cloud/README.md](../org/docs/cloud/README.md)** for the gateway/LiteLLM
> split and the backend overview.

## Run it

```bash
cd cloud/gateway && pnpm dev      # Hono server, port 3000 (PORT env)
cd cloud/gateway && pnpm build    # tsc → dist/
```

From `cloud/` (package `@lmthing/cloud`):

```bash
pnpm stripe:create-products    # idempotent Stripe product/price creation
pnpm litellm:generate-models   # regenerate the marked-up model_list for litellm.yaml
pnpm litellm:resync-budgets    # re-apply tier budget windows to existing LiteLLM keys
```

Images are built by GitHub Actions CI and pushed to `lmthingacr.azurecr.io`; deployment is
ArgoCD-managed. Running the full local stack (ports, `*.test` nginx proxy, demo auth) →
[org/docs/devops/local-dev.md](../org/docs/devops/local-dev.md).

## Layout

- `gateway/src/routes/` — one Hono router per feature area, mounted under `/api/*`.
- `gateway/src/lib/` — tiers, LiteLLM/Stripe/Zitadel/K8s clients, JWT signing, Postgres.
- `gateway/src/middleware/auth.ts` — the JWT/API-key auth schemes.
- `migrations/*.sql` — applied by Ansible; also self-healed on boot by `lib/db.ts` `ensureSchema()`.
- `scripts/` — Stripe + LiteLLM config generators.

The authoritative, cited breakdown of every file, route, table, and env var is in org/docs —
**do not** re-document it here.

## Task Index

| Working on… | Read |
|---|---|
| the backend as a whole — gateway vs. LiteLLM split, what belongs where | [org/docs/cloud/README.md](../org/docs/cloud/README.md) |
| **any gateway route** — the full `/api/*` table, mounts, auth model per route, CORS, health | [org/docs/cloud/routes.md](../org/docs/cloud/routes.md) |
| auth — gateway HS256 JWTs, Zitadel identity, GitHub OAuth (IDP Intent), SSO codes, API keys, service tokens | [org/docs/cloud/auth.md](../org/docs/cloud/auth.md) |
| tiers, budget windows, Stripe checkout/portal/webhook, the token markup, usage surfaces | [org/docs/cloud/billing-and-tiers.md](../org/docs/cloud/billing-and-tiers.md) |
| LiteLLM — enabled models, the `model_list`, virtual keys, Azure Foundry config | [org/docs/cloud/litellm.md](../org/docs/cloud/litellm.md) |
| the render service + agent `webSearch`/`webFetch` | [org/docs/cloud/render.md](../org/docs/cloud/render.md) |
| **adding a pricing tier** (cross-cutting checklist) | [org/docs/contributing/add-a-tier.md](../org/docs/contributing/add-a-tier.md) |
| the pod's own `/api/*` surface (a *different* server — the `lmthing serve` CLI) | [org/docs/cli-api/rest/README.md](../org/docs/cli-api/rest/README.md) |
| K8s, ArgoCD, cluster topology, deploys | [org/docs/devops/infrastructure.md](../org/docs/devops/infrastructure.md) · [org/docs/devops/deploy.md](../org/docs/devops/deploy.md) |
| running the local stack | [org/docs/devops/local-dev.md](../org/docs/devops/local-dev.md) |
