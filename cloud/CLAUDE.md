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
│       │   └── auth.ts             # JWT auth middleware (Zitadel JWKS verification via jose)
│       ├── lib/
│       │   ├── tiers.ts            # Tier definitions (free/starter/basic/pro/max) + helpers
│       │   ├── litellm.ts          # LiteLLM admin API client (user CRUD, key CRUD, tier updates)
│       │   ├── stripe.ts           # Stripe client init
│       │   ├── zitadel.ts          # Zitadel Management API client (user CRUD, OAuth, token exchange)
│       │   ├── db.ts               # Postgres client for sso_codes table
│       │   └── compute.ts          # K8s API client — per-user namespaces, deployments, services, secrets
│       └── routes/
│           ├── auth.ts             # Register, login, OAuth, provision, me, refresh, SSO
│           ├── billing.ts          # Checkout, portal, usage, checkout status
│           ├── keys.ts             # List, create, revoke API keys
│           ├── webhook.ts          # Stripe webhook — tier changes, compute pod lifecycle
│           └── compute.ts          # Pod status, env var get/set
├── migrations/
│   ├── 001_profiles.sql            # profiles table (plain Postgres, no RLS)
│   ├── 002_sso_codes.sql           # sso_codes table for cross-domain SSO
│   └── 003_drop_supabase_objects.sql  # drops any legacy Supabase triggers/functions
└── scripts/
    └── create-stripe-products.ts   # Idempotent Stripe product/price creation
```

## Routes

### Auth (`/api/auth/*`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/register` | POST | Public | Email+password signup, auto-provisions LiteLLM user + Stripe customer + API key |
| `/api/auth/login` | POST | Public | Email+password login, returns Zitadel JWT + refresh token |
| `/api/auth/oauth/url` | GET | Public | Returns Zitadel OAuth authorization URL (GitHub/Google) |
| `/api/auth/oauth/callback` | GET | Public | Exchanges OAuth code for tokens, redirects to original app |
| `/api/auth/provision` | POST | JWT | Provisions LiteLLM user + Stripe customer + API key (idempotent) |
| `/api/auth/me` | GET | JWT | Returns user info (id, email, tier, budget, spend) |
| `/api/auth/refresh` | POST | Public | Exchanges refresh token for new tokens |
| `/api/auth/sso/create` | POST | JWT | Generates single-use SSO code (60s TTL) |
| `/api/auth/sso/exchange` | POST | Public | Exchanges SSO code for Zitadel session via token exchange |

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
| `/api/compute/status` | GET | JWT | Pod status (exists, ready, phase) — requires pro/max tier |
| `/api/compute/env` | GET | JWT | List user pod env vars — requires pro/max tier |
| `/api/compute/env` | PUT | JWT | Set env vars + trigger pod restart — requires pro/max tier |

### Webhook

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/stripe/webhook` | POST | Stripe sig | Handles subscription created/updated/deleted, triggers tier changes + compute pod lifecycle |

## Lib Modules

- **`tiers.ts`** — `TIERS` record with budget, budgetDuration, models, tpmLimit, rpmLimit, compute flag per tier. Helpers: `getTierByPriceId()`, `getTierByName()`.
- **`litellm.ts`** — HTTP client for LiteLLM admin API (`http://litellm:4000`). Functions: `createUser`, `generateKey`, `updateUserTier`, `listKeys`, `deleteKey`, `getUserInfo`, `getKeyInfo`.
- **`stripe.ts`** — Stripe client init from `STRIPE_SECRET_KEY`.
- **`zitadel.ts`** — Zitadel Management API + OIDC client. Uses service account (client credentials) for admin operations. Functions: `createUser`, `getUserById`, `loginWithPassword`, `getOAuthUrl`, `exchangeOAuthCode`, `refreshTokens`, `exchangeTokenForUser` (RFC 8693 token exchange for SSO).
- **`db.ts`** — Postgres client (`postgres` package) for `sso_codes` table. Functions: `insertSsoCode`, `findAndConsumeSsoCode`.
- **`compute.ts`** — K8s in-cluster API client. Creates per-user namespaces (`user-{userId}`), ACR pull secrets, deployments (0.5 CPU / 1Gi, image from `lmthingacr.azurecr.io/compute`), services (port 8080), and `user-env` secrets.

## Middleware

- **CORS** — Applied to all `/api/*` routes: `origin: "*"`, allows standard methods + Content-Type/Authorization headers.
- **Auth** (`middleware/auth.ts`) — Extracts Bearer token, verifies against Zitadel JWKS using `jose` (cached, no network call on hot path), sets `user` (id + email) on Hono context.

## External Services

| Service | Connection | Purpose |
|---------|-----------|---------|
| Zitadel | `ZITADEL_URL` (internal) + service account credentials | User management, JWT issuance, OAuth |
| PostgreSQL | `DATABASE_URL` (`postgres:5432`) | SSO codes, profiles, LiteLLM tables |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Checkout, billing portal, subscription webhooks |
| LiteLLM | `http://litellm:4000` + `LITELLM_MASTER_KEY` | User/key provisioning, tier enforcement |
| K8s API | In-cluster service account token | Per-user compute pod management |
| ACR | `ACR_REGISTRY/USERNAME/PASSWORD` env vars | Image pull secrets for user pods |

## Tiers

| Tier | Price | Budget | Reset | Rate Limits | Compute |
|------|-------|--------|-------|-------------|---------|
| Free | $0 | $1 | 7 days | 10K tpm / 60 rpm | No |
| Starter | $5/mo | $5 | 30 days | 25K tpm / 150 rpm | No |
| Basic | $10/mo | $10 | 30 days | 50K tpm / 300 rpm | No |
| Pro | $20/mo | $20 | 30 days | 100K tpm / 1K rpm | Yes |
| Max | $100/mo | $100 | 30 days | 1M tpm / 5K rpm | Yes |

## Development

```bash
cd cloud/gateway && pnpm dev    # Runs Hono server on port 3000
```

Images are built by GitHub Actions CI and pushed to `lmthingacr.azurecr.io`. See `devops/CLAUDE.md` for deployment details.
