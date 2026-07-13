# cloud/ — the backend

`cloud/` is the **only** backend in the entire monorepo. Every product SPA
(`com/social/team/store/space/blog/casa`, the `sdk/org` studio/chat/computer app) and every
user compute pod is a client of it; there is no other server-side code anywhere in the repo.
It is two cooperating services on Kubernetes:

- a **Hono/Node gateway** — the `/api/*` control plane (auth, API keys, billing, compute-pod
  lifecycle, webhooks) — `cloud/gateway/`, package `@lmthing/gateway` (`cloud/gateway/package.json:2`);
- **LiteLLM** — an OpenAI-compatible LLM proxy serving `/v1/*`, a *separate* container the
  gateway provisions users into but never fronts (`cloud/gateway/src/lib/litellm.ts:1`,
  `LITELLM_URL || "http://litellm:4000"`).

Backed by **PostgreSQL** (gateway's own tables + LiteLLM's) and **Stripe** (subscriptions,
checkout, billing portal). Runs on Kubernetes (Kubespray on an Azure VM) — see
[../devops/infrastructure.md](../devops/infrastructure.md).

## There is no other backend

All server-side logic — new HTTP endpoints, DB operations, webhook handling — must land in the
gateway (`cloud/gateway/`) or as K8s config. The frontend SPAs are static; they call `cloud/`.
The **only** other thing that serves `/api/*` is the user's **compute pod** (the `lmthing serve`
CLI server, a *different* process on a *different* origin — see
[../cli-api/rest/README.md](../cli-api/rest/README.md)); the pod itself is a gateway client for
auth/billing/compute concerns and reaches LiteLLM for model calls.

## Gateway vs. LiteLLM — the split

On `lmthing.cloud`, Envoy Gateway routes by path prefix: `/api` → the `gateway` Service on port
`3000`, `/v1` → the `litellm` Service on port `4000` (see [routes.md](./routes.md), grounded in
`devops/argocd/envoy/cloud-routes.yaml`). So **chat completions (`/v1/*`) never touch the
gateway**, and every gateway route lives under `/api`.

| | Gateway (`/api/*`) | LiteLLM (`/v1/*`) |
|---|---|---|
| Code | `cloud/gateway/` (this repo) | upstream LiteLLM image + config `devops/argocd/core/litellm.yaml` |
| Language | Hono on Node 24 (`cloud/gateway/Dockerfile:1,9`) | Python (upstream) |
| Port | `PORT` default `3000` (`cloud/gateway/src/index.ts#port`, `Dockerfile:15`) | `4000` |
| Role | control plane: identity, keys, billing, pods | data plane: OpenAI-compatible model proxy to Azure AI Foundry |
| Auth | gateway HS256 JWT / API key (`middleware/auth.ts`) | LiteLLM virtual key = the user's own key, tier budgets enforced |

The gateway is LiteLLM's **admin client**: it creates the LiteLLM user + virtual key on signup,
updates budget windows on tier change, and lists/revokes keys — all via the LiteLLM admin API
(`cloud/gateway/src/lib/litellm.ts`, functions `createUser`/`generateKey`/`updateUserTier`/
`listKeys`/`deleteKey`/`getUserInfo`). Detail → [litellm.md](./litellm.md).

## The gateway app

`cloud/gateway/src/index.ts` is a single Hono app: CORS on `/api/*` (`origin: "*"`,
`GET/POST/PUT/DELETE/OPTIONS`, headers `Content-Type`/`Authorization` — `index.ts:19-26`), a
`GET /api/health` liveness probe (`index.ts:28`), then nine mounted route modules
(`index.ts:30-38`):

| Mount | Module | Purpose | Doc |
|---|---|---|---|
| `/api/auth` | `routes/auth.ts` | register, login, GitHub OAuth (Zitadel IDP Intent), provision, me, refresh, SSO | [auth.md](./auth.md) |
| `/api/keys` | `routes/keys.ts` | list / create / revoke the user's LiteLLM API keys | [routes.md](./routes.md) |
| `/api/billing` | `routes/billing.ts` | Stripe checkout, customer portal, usage, checkout status | [billing-and-tiers.md](./billing-and-tiers.md) |
| `/api/stripe/webhook` | `routes/webhook.ts` | Stripe subscription webhook → tier changes + pod lifecycle | [billing-and-tiers.md](./billing-and-tiers.md) |
| `/api/compute` | `routes/compute.ts` | per-user pod: version, ensure/wake, status, upgrade, env get/set | [routes.md](./routes.md) |
| `/api/backup` | `routes/backup.ts` | GitHub workspace backup config | [routes.md](./routes.md) |
| `/api/inbound` | `routes/inbound.ts` | inbound-webhook broker → dispatch to the user's pod | [routes.md](./routes.md) |
| `/api/status` | `routes/status.ts` | cluster/fleet status SSE stream (rate-limited) | [routes.md](./routes.md) |
| `/api/issues` | `routes/issues.ts` | file a GitHub bug-report issue + upload artifacts | [routes.md](./routes.md) |

In **local dev only** (`LOCAL_DEV === "true"`), the app additionally mounts `podProxy` on `/api`
and attaches a WebSocket proxy to reach the user's minikube pod; in production Envoy Gateway does
this routing (`index.ts:40-44,58-60`). Before serving, the gateway self-heals its own DB schema
via `ensureSchema()` (idempotent, logs-and-continues — `index.ts:48-51`), and
`startRefresher()` kicks off the background cluster-status / idle-pod-sweep / cron loop
(`index.ts:62`, `lib/cluster-status.ts`).

Full route-by-route table with auth schemes → [routes.md](./routes.md).

## PostgreSQL

One Postgres instance (`DATABASE_URL`, in-cluster `postgres:5432`) holds both LiteLLM's tables
and the gateway's own. The gateway accesses its tables through `cloud/gateway/src/lib/db.ts`
(the `postgres` package). `migrations/*.sql` are the source of record; `ensureSchema()` mirrors
them so a fresh DB self-heals. Current migrations (`cloud/migrations/`):

- `001_profiles.sql` — `profiles`
- `002_sso_codes.sql` / `004_sso_codes_user_id_text.sql` — `sso_codes` (cross-domain SSO, single-use codes)
- `003_drop_supabase_objects.sql` — drops legacy Supabase triggers/functions
- `005_backup_config.sql` — `backup_config` (GitHub workspace backup)
- `006_user_cron_jobs.sql` — `user_cron_jobs` (externalized cron for scale-to-zero pods)
- `007_connections.sql` — `connections`, **dropped again** by `009_drop_connections.sql` (BYO-token model, no gateway broker)
- `008_webhook_bindings.sql` — `webhook_bindings` (inbound-webhook routing)

## Stripe

Subscriptions drive tiers. The gateway creates Embedded Checkout / Customer Portal sessions
(`routes/billing.ts`) via the Stripe client (`cloud/gateway/src/lib/stripe.ts`, from
`STRIPE_SECRET_KEY`), and the `POST /api/stripe/webhook` handler (`routes/webhook.ts`, verified
with `STRIPE_WEBHOOK_SECRET`) reacts to `subscription.created/updated/deleted` by changing the
user's LiteLLM tier and compute-pod lifecycle. Products/prices are created idempotently by
`cloud/scripts/create-stripe-products.ts`. Detail → [billing-and-tiers.md](./billing-and-tiers.md).

## Related in-cluster service: render

`webSearch`/`webFetch` for agents is served by a **separate** in-cluster headless-Chromium
service (`render`, `devops/argocd/core/render.yaml`) — not part of `cloud/gateway`, but a
backend piece of the platform. Detail → [render.md](./render.md).

## Development

```bash
# from repo root
pnpm --filter @lmthing/gateway dev   # or: cd cloud/gateway && pnpm dev
```

`pnpm dev` runs `tsx watch src/index.ts` (`cloud/gateway/package.json:7`) on port 3000. The
production image is a two-stage `node:24-slim` build (`cloud/gateway/Dockerfile`) pushed to
`lmthingacr.azurecr.io` by CI. `cloud/package.json` (`@lmthing/cloud`) carries the operational
scripts: `stripe:create-products`, `litellm:generate-models`, `litellm:resync-budgets`.

## Sub-docs

- [routes.md](./routes.md) — every gateway HTTP route + its auth scheme
- [auth.md](./auth.md) — token types, Zitadel identity, GitHub OAuth, SSO
- [billing-and-tiers.md](./billing-and-tiers.md) — tiers, budget windows, Stripe flows
- [litellm.md](./litellm.md) — the `/v1/*` LLM proxy, models, tier enforcement
- [render.md](./render.md) — headless-Chromium render service + `webSearch`/`webFetch`
- [../devops/infrastructure.md](../devops/infrastructure.md) — the K8s cluster this runs on
