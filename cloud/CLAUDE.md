# cloud/ — API Gateway + LiteLLM

The **sole backend** for all lmthing products. Runs on Kubernetes (Kubespray) on an Azure VM.

## Structure

```
cloud/
├── package.json                    # @lmthing/cloud — scripts for Stripe setup and gateway dev/build
├── gateway/
│   ├── Dockerfile                  # Multi-stage Node 22 build, production image on port 3000
│   ├── package.json                # @lmthing/gateway — hono, stripe, jose, postgres
│   └── src/
│       ├── index.ts                # Hono app entry — CORS, health check, route modules
│       ├── types.ts                # Env type (Variables: { user: AuthUser })
│       ├── middleware/
│       │   └── auth.ts             # JWT auth middleware — verifies gateway JWTs first, falls back to Zitadel introspection
│       ├── lib/
│       │   ├── tiers.ts            # Tier definitions (free/basic/pro/max) + budget windows
│       │   ├── litellm.ts          # LiteLLM admin API client (user CRUD, key CRUD, tier updates)
│       │   ├── stripe.ts           # Stripe client init
│       │   ├── tokens.ts           # Gateway-issued HS256 JWTs — signTokens, verifyAccessToken, verifyRefreshToken
│       │   ├── zitadel.ts          # Zitadel v2 API client — user CRUD, IDP Intent (GitHub OAuth), password login
│       │   ├── db.ts               # Postgres client for sso_codes table
│       │   ├── compute.ts          # K8s API client — per-user namespaces, deployments, services, secrets
│       │   ├── github-app.ts       # GitHub App client — installation tokens for workspace backup
│       │   └── github-issues.ts    # GitHub Issues client — PAT-based, files bug reports + uploads artifacts
│       └── routes/
│           ├── auth.ts             # Register, login, OAuth, provision, me, refresh, SSO
│           ├── billing.ts          # Checkout, portal, usage, checkout status
│           ├── keys.ts             # List, create, revoke API keys
│           ├── webhook.ts          # Stripe webhook — tier changes, compute pod lifecycle
│           ├── compute.ts          # Pod status, env var get/set
│           └── issues.ts           # File a GitHub issue (bug report) in the org repo
├── migrations/                     # applied by Ansible cloud_secrets; also self-healed
│   │                               # on gateway boot via db.ts ensureSchema()
│   ├── 001_profiles.sql            # profiles table (plain Postgres, no RLS)
│   ├── 002_sso_codes.sql           # sso_codes table for cross-domain SSO (user_id text)
│   ├── 003_drop_supabase_objects.sql  # drops any legacy Supabase triggers/functions
│   └── 004_sso_codes_user_id_text.sql # idempotent: alters user_id uuid→text if needed
└── scripts/
    └── create-stripe-products.ts   # Idempotent Stripe product/price creation
```

## Auth Architecture

The gateway issues its own **HS256 JWTs** (via `lib/tokens.ts`) signed with `GATEWAY_JWT_SECRET`. Zitadel handles identity (user storage, GitHub OAuth via IDP Intent API, password verification) but does **not** issue the tokens that clients use — the gateway does.

**Token flow:**
1. Login/OAuth callback → gateway verifies identity via Zitadel → calls `signTokens(userId, email)` → returns `access_token` (12h) + `refresh_token` (30d)
2. Authenticated requests → `authMiddleware` verifies the gateway JWT locally (no network call). Falls back to Zitadel introspection for any legacy tokens.
3. Refresh → verify refresh JWT → re-issue new pair

**GitHub OAuth flow (IDP Intent):**
1. `GET /api/auth/oauth/url?redirect_to=...` → gateway calls Zitadel `POST /v2/idp_intents` → returns GitHub OAuth URL directly (no Zitadel UI shown)
2. User authenticates on GitHub → Zitadel redirects to `GET /api/auth/oauth/callback?id=...&token=...`
3. Gateway calls `POST /v2/idp_intents/{id}` to resolve intent → gets/creates Zitadel user → calls `signTokens()` → redirects with tokens in hash fragment

## Routes

### Auth (`/api/auth/*`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/register` | POST | Public | Email+password signup, auto-provisions LiteLLM user + Stripe customer + API key |
| `/api/auth/login` | POST | Public | Email+password login — verifies via Zitadel, returns gateway JWT + refresh token |
| `/api/auth/oauth/url` | GET | Public | Start GitHub OAuth via Zitadel IDP Intent — returns GitHub URL directly |
| `/api/auth/oauth/callback` | GET | Public | Zitadel IDP Intent callback — resolves intent, issues gateway tokens, redirects |
| `/api/auth/provision` | POST | JWT | Provisions LiteLLM user + Stripe customer + API key (idempotent) |
| `/api/auth/me` | GET | JWT | Returns user info (id, email, tier, budget, spend) |
| `/api/auth/refresh` | POST | Public | Exchanges refresh token for new access token |
| `/api/auth/sso/create` | POST | JWT | Generates single-use SSO code (60s TTL) stored in Postgres |
| `/api/auth/sso/exchange` | POST | Public | Exchanges SSO code for gateway JWT session |

### Keys (`/api/keys/*`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/keys` | GET | JWT | List all API keys for user |
| `/api/keys` | POST | JWT | Create new API key (inherits tier limits) |
| `/api/keys/:token` | DELETE | JWT | Revoke API key |

### Billing (`/api/billing/*`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/billing/checkout` | POST | JWT | Creates Stripe Embedded Checkout session |
| `/api/billing/portal` | POST | JWT | Creates Stripe Customer Portal session |
| `/api/billing/usage` | GET | JWT | Current spend, budget, tier, models |
| `/api/billing/checkout/status` | GET | JWT | Check Stripe checkout session status |

### Compute (`/api/compute/*`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/compute/version` | GET | none | Latest built compute image tag (`COMPUTE_IMAGE_TAG`) |
| `/api/compute/ensure` | POST | JWT | Lazily provision/wake the user's pod; returns status incl. running `computeTag` |
| `/api/compute/status` | GET | JWT | Pod status (exists, ready, phase, `computeTag`) — requires pro/max tier |
| `/api/compute/upgrade` | POST | JWT | Rolling restart onto the latest compute image (frontend prompts before calling this) |
| `/api/compute/env` | GET | JWT | List user pod env vars — requires pro/max tier |
| `/api/compute/env` | PUT | JWT | Set env vars + trigger pod restart — requires pro/max tier |

### Issues (`/api/issues`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/issues` | POST | JWT | Files a GitHub issue in `GITHUB_ISSUES_REPO` (prod: `lmthing/bug-reports`) from a pod's UI bug reporter; uploads trace/screenshot artifacts to `GITHUB_BUGREPORT_REPO` via the Contents API. 501 if `GITHUB_ISSUES_TOKEN` unset. |

### Webhook

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/stripe/webhook` | POST | Stripe sig | Handles subscription created/updated/deleted, triggers tier changes + compute pod lifecycle |

## Lib Modules

- **`tokens.ts`** — Gateway JWT issuance and verification. `signTokens(userId, email)` issues HS256 access (12h) + refresh (30d) tokens signed with `GATEWAY_JWT_SECRET`. `verifyAccessToken` / `verifyRefreshToken` verify locally via `jose`.
- **`tiers.ts`** — `TIERS` record with `budgetLimits` (an array of 1d/7d/30d `{duration, maxBudget}` windows), `models`, `tpmLimit`, `rpmLimit`, and `pod` sizing per tier. Helpers: `getTierByPriceId()`, `getTierByName()`, `monthlyBudget()`, `toBudgetLimits()` (maps to LiteLLM's `budget_limits` payload).
- **`litellm.ts`** — HTTP client for LiteLLM admin API (`http://litellm:4000`). Functions: `createUser`, `generateKey`, `updateUserTier`, `listKeys`, `deleteKey`, `getUserInfo`, `getKeyInfo`.
- **`stripe.ts`** — Stripe client init from `STRIPE_SECRET_KEY`.
- **`zitadel.ts`** — Zitadel v2 API client using a machine user Personal Access Token (`ZITADEL_SERVICE_PAT`). Functions: `createUser`, `getUserById`, `getUserByEmail`, `loginWithPassword`, `startIdpIntent`, `resolveIdpIntent`. GitHub IDP ID is auto-discovered from Zitadel on first call and cached (override with `ZITADEL_GITHUB_IDP_ID`).
- **`db.ts`** — Postgres client (`postgres` package) for the `sso_codes` table. Functions: `insertSsoCode`, `findAndConsumeSsoCode`, and `ensureSchema()` — called on gateway startup (`index.ts`) to idempotently create the gateway's own tables (`profiles`, `sso_codes`), so a fresh or half-migrated DB self-heals without depending on the Ansible migration step. Keep it in sync with `migrations/*.sql`.
- **`compute.ts`** — K8s in-cluster API client. Creates per-user namespaces (`user-{userId}`), ACR pull secrets, deployments (image from `lmthingacr.azurecr.io/compute`, tier-sized via `pod`), services (port 8080), and `user-env` secrets. Into `user-env` it injects the `lmthingcloud` provider config (`litellmEnvDefaults`): `LMTHINGCLOUD_API_KEY` = the user's own LiteLLM key (carries their tier budget windows), `LMTHINGCLOUD_BASE_URL` = in-cluster LiteLLM `/v1`, and the size/role model aliases `LM_MODEL_{XS,S,M,L,M_R,L_R}` → `lmthingcloud:<model>` (XS/S=DeepSeek-V4-Flash, M/M_R=DeepSeek-V4-Pro, L=gpt-5.5, L_R=Kimi-K2.6). The merge preserves user-set vars but always refreshes the API key.

## Middleware

- **CORS** — Applied to all `/api/*` routes: `origin: "*"`, allows standard methods + Content-Type/Authorization headers.
- **Auth** (`middleware/auth.ts`) — Extracts Bearer token. First tries `verifyAccessToken` (local, no network). Falls back to Zitadel `POST /oauth/v2/introspect` (Basic auth with `ZITADEL_CLIENT_ID/SECRET`) for any legacy tokens. Sets `user` (id + email) on Hono context.

## External Services

| Service | Connection | Purpose |
|---------|-----------|---------|
| Zitadel | `ZITADEL_URL` + `ZITADEL_SERVICE_PAT` (machine user PAT) | User management, GitHub IDP Intent OAuth |
| Zitadel OIDC | `ZITADEL_CLIENT_ID` + `ZITADEL_CLIENT_SECRET` | Password login, token introspection fallback |
| PostgreSQL | `DATABASE_URL` (`postgres:5432`) | SSO codes, profiles, LiteLLM tables |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout, billing portal, subscription webhooks |
| LiteLLM | `http://litellm:4000` + `LITELLM_MASTER_KEY` | User/key provisioning, tier enforcement |
| K8s API | In-cluster service account token | Per-user compute pod management |
| ACR | `ACR_REGISTRY/USERNAME/PASSWORD` env vars | Image pull secrets for user pods |

## Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `GATEWAY_JWT_SECRET` | `lmthing-secrets` | Base64-encoded 32-byte secret for signing HS256 JWTs |
| `ZITADEL_URL` | hardcoded `https://auth.lmthing.cloud` | Zitadel instance URL |
| `ZITADEL_SERVICE_PAT` | `lmthing-secrets` | Machine user Personal Access Token for Zitadel admin API |
| `ZITADEL_CLIENT_ID` | `lmthing-secrets` | Web app client ID (OIDC — password login + introspection) |
| `ZITADEL_CLIENT_SECRET` | `lmthing-secrets` | Web app client secret |
| `ZITADEL_GITHUB_IDP_ID` | `lmthing-secrets` (optional) | GitHub IDP ID — auto-discovered if blank |
| `DATABASE_URL` | `lmthing-secrets` | `postgresql://lmthing:PASSWORD@postgres:5432/lmthing` |
| `LITELLM_MASTER_KEY` | `lmthing-secrets` | LiteLLM admin key |
| `BASE_URL` | `lmthing-secrets` | `https://lmthing.cloud` — used for OAuth redirect URIs |
| `GITHUB_ISSUES_TOKEN` | `lmthing-secrets` | GitHub PAT (`repo` scope, or fine-grained Issues:write + Contents:write) for filing bug-report issues; unset disables `/api/issues` (501) |
| `GITHUB_ISSUES_REPO` | plain value (prod `lmthing/bug-reports`; code default `lmthing/org`) | Repo issues are filed in |
| `GITHUB_BUGREPORT_REPO` | plain value, default = `GITHUB_ISSUES_REPO` | Repo trace/screenshot artifacts are committed to |

## Tiers

Every tier can call all four enabled models (DeepSeek-V4-Flash, DeepSeek-V4-Pro,
Kimi-K2.6, gpt-5.5). Tiers differ only by their **budget windows** — three independent
rolling spend caps (1d / 7d / 30d) enforced on the user's single API key via LiteLLM's
multiple-budget-windows feature. A request is rejected once any window is exhausted.

| Tier | Price | Budget (1d / 7d / 30d) | Rate Limits | Compute |
|------|-------|------------------------|-------------|---------|
| Free | $0 | $10 / $50 / $150 | 10K tpm / 60 rpm | Yes |
| Basic | $10/mo | $1 / $4 / $10 | 50K tpm / 300 rpm | Yes |
| Pro | $20/mo | $3 / $10 / $20 | 100K tpm / 1K rpm | Yes |
| Max | $100/mo | $10 / $30 / $100 | 1M tpm / 5K rpm | Yes |

Pricing carries a **15% markup** over Azure base cost, set per-model in
`devops/argocd/core/litellm.yaml` (regenerate with `pnpm litellm:generate-models`).

## Development

```bash
cd cloud/gateway && pnpm dev    # Runs Hono server on port 3000
```

Images are built by GitHub Actions CI and pushed to `lmthingacr.azurecr.io`. See `devops/CLAUDE.md` for deployment details.
