# CLAUDE.md — Development Guide for @lmthing/cloud

## Project Overview

**@lmthing/cloud** is a tier-based LLM API gateway running on **K3s** (lightweight Kubernetes) on an Azure VM. It provides an OpenAI-compatible API backed by Azure AI Foundry models, with Stripe subscription billing and Supabase authentication.

**Package name:** `@lmthing/cloud`
**Runtime:** K3s on Azure VM (Ubuntu 24.04)
**LLM Proxy:** LiteLLM (OpenAI-compatible, budget enforcement, rate limiting)
**Gateway:** Hono (Node.js) for auth, keys, billing, webhooks
**Database:** Supabase PostgreSQL (LiteLLM tables + profiles)
**Auth:** Supabase Auth (email/password + GitHub OAuth)
**Billing:** Stripe subscriptions
**TLS:** Let's Encrypt via Traefik

## Architecture

```
Users → lmthing.cloud (Traefik + Let's Encrypt)
         ├── /v1/*  → LiteLLM (OpenAI-compatible proxy → Azure Foundry)
         └── /api/* → Gateway (Hono/Node.js)
                       ├── /api/auth/*    → Supabase Auth (register, login, OAuth)
                       ├── /api/keys/*    → LiteLLM Admin API (key CRUD)
                       ├── /api/billing/* → Stripe (checkout, portal, usage)
                       └── /api/stripe/*  → Stripe webhooks (tier changes)

LiteLLM ↔ Supabase PostgreSQL (keys, budgets, usage tracking)
LiteLLM → Azure AI Foundry (model endpoints)
Gateway ↔ Stripe (subscriptions) + Supabase Auth + LiteLLM Admin API
```

### How It Works

1. User authenticates via Supabase (email/password or GitHub OAuth)
2. Gateway provisions a LiteLLM user + Stripe customer + API key (free tier)
3. User calls `/v1/chat/completions` with their API key — LiteLLM routes to Azure Foundry
4. LiteLLM tracks token usage against the user's budget (with 10% markup)
5. User upgrades via Stripe Checkout → webhook fires → Gateway updates LiteLLM key permissions

## Tiers

All token costs include a 10% markup over Azure pricing.

| Tier  | Price     | Budget  | Reset   | Rate Limits          |
|-------|-----------|---------|---------|----------------------|
| Free  | $0        | $1      | 7 days  | 10K tpm / 60 rpm     |
| Basic | $10/month | $10     | 30 days | 50K tpm / 300 rpm    |
| Pro   | $20/month | $20     | 30 days | 100K tpm / 1K rpm    |
| Max   | $100/month| $100    | 30 days | 1M tpm / 5K rpm      |

Tier definitions: `gateway/src/lib/tiers.ts`

## Project Structure

```
cloud/
├── k8s/                              # Kubernetes manifests
│   ├── namespace.yaml                # lmthing namespace
│   ├── litellm.yaml                  # LiteLLM Deployment + Service + ConfigMap (model config)
│   ├── gateway.yaml                  # Gateway Deployment + Service
│   ├── ingress.yaml.tpl              # Traefik IngressRoute template (uses ${DOMAIN})
│   ├── traefik-config.yaml.tpl       # Traefik Helm config template (uses ${ACME_EMAIL})
│   ├── kustomization.yaml            # Kustomize entrypoint + secretGenerator
│   ├── .env.secrets.example          # All env vars template
│   └── .env.secrets                  # Actual secrets (gitignored)
├── gateway/                          # Auth + billing service (Hono/Node.js)
│   ├── Dockerfile                    # Multi-stage build (node:22-slim)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                  # App entrypoint — mounts routes, CORS, serves on :3000
│       ├── types.ts                  # Hono Env type (Variables: { user: AuthUser })
│       ├── middleware/
│       │   └── auth.ts               # Supabase JWT verification middleware
│       ├── routes/
│       │   ├── auth.ts               # Register, login, OAuth, provision, me
│       │   ├── keys.ts               # List, create, revoke API keys
│       │   ├── billing.ts            # Stripe checkout, portal, usage
│       │   └── webhook.ts            # Stripe webhook → tier upgrades/downgrades
│       └── lib/
│           ├── litellm.ts            # LiteLLM admin API client (user/key CRUD)
│           ├── stripe.ts             # Stripe client singleton
│           └── tiers.ts              # Tier definitions (models, budgets, limits)
├── migrations/
│   └── 001_profiles.sql              # profiles table + RLS + auth trigger
├── scripts/
│   ├── setup-vm.sh                   # Install K3s + Docker + psql on VM
│   ├── deploy.sh                     # Full deploy: migration → templates → build → apply → wait
│   └── create-stripe-products.ts     # Create Stripe product + prices (idempotent)
├── package.json                      # Root scripts (setup, deploy, stripe)
├── .env.example                      # Env vars documentation
├── .gitignore
├── README.md                         # User-facing setup + API reference
└── CLAUDE.md                         # This file
```

## Key Files

### Gateway Routes

| File | Routes | Auth | Purpose |
|------|--------|------|---------|
| `routes/auth.ts` | `POST /register`, `POST /login`, `GET /oauth/url`, `GET /oauth/callback`, `POST /provision`, `GET /me` | Mixed | User registration (email or OAuth), login, LiteLLM+Stripe provisioning |
| `routes/keys.ts` | `GET /`, `POST /`, `DELETE /:token` | JWT | LiteLLM API key CRUD via admin API |
| `routes/billing.ts` | `POST /checkout`, `POST /portal`, `GET /usage` | JWT | Stripe checkout sessions, billing portal, budget usage |
| `routes/webhook.ts` | `POST /` | Stripe sig | Subscription created/updated/deleted → update LiteLLM user tier |

### Gateway Libraries

| File | Purpose |
|------|---------|
| `lib/litellm.ts` | Wraps LiteLLM admin API (`/user/new`, `/key/generate`, `/key/update`, `/key/list`, `/key/delete`, `/user/info`). Uses `LITELLM_MASTER_KEY` for auth. |
| `lib/tiers.ts` | Tier definitions: name, Stripe price ID, budget, duration, allowed models, TPM/RPM limits. `getTierByPriceId()` for webhook lookups. |
| `lib/stripe.ts` | Stripe client singleton from `STRIPE_SECRET_KEY`. |
| `middleware/auth.ts` | Extracts Bearer JWT → `supabase.auth.getUser()` → sets `c.user` with `{ id, email }`. |

### K8s Manifests

| File | What It Deploys |
|------|-----------------|
| `litellm.yaml` | LiteLLM proxy container (`ghcr.io/berriai/litellm:main-latest`). ConfigMap defines model list with Azure endpoints and 10% markup pricing. Env vars from secret: `DATABASE_URL`, `LITELLM_MASTER_KEY`, `AZURE_API_KEY`, `AZURE_API_BASE`. |
| `gateway.yaml` | Gateway container (locally built `lmthing/gateway:latest`, `imagePullPolicy: IfNotPresent`). Env vars from secret: all Stripe, Supabase, LiteLLM vars + `BASE_URL`. |
| `ingress.yaml.tpl` | Traefik IngressRoute: `/v1/*` → litellm:4000, `/api/*` → gateway:3000. TLS via `letsencrypt` cert resolver. No HTTP IngressRoute (breaks ACME challenges). |
| `traefik-config.yaml.tpl` | HelmChartConfig for K3s Traefik: HTTP→HTTPS redirect, Let's Encrypt via `additionalArguments` (not `certResolvers` — K3s ignores that). Persistence enabled for ACME storage. |

## Database

### Supabase PostgreSQL (shared database)

LiteLLM auto-creates ~60 tables (`LiteLLM_VerificationToken`, `LiteLLM_UserTable`, etc.) in the `public` schema via Prisma migrations on first startup.

Our code adds one table:

**`profiles`** — maps Supabase auth users to tiers
```sql
id uuid primary key,          -- matches auth.users.id (no FK — breaks Prisma introspection)
email text not null,
stripe_customer_id text unique,
tier text default 'free',
created_at, updated_at
```

- RLS enabled: users can read/update own row
- Auto-created via `on_auth_user_created` trigger on `auth.users`
- **No FK to `auth.users`** — cross-schema FKs break LiteLLM's Prisma introspection

### Important: DATABASE_URL

- Must use Supabase **session pooler** (port `5432`), NOT transaction mode (`6543`)
- Special characters in password must be URL-encoded (`#` → `%23`, `!` → `%21`)
- No quotes around values in `.env.secrets` (Kustomize reads them literally)

## Authentication

```
Email/password:
  POST /api/auth/register → supabase.auth.admin.createUser() → provisionUser()
  POST /api/auth/login    → supabase.auth.signInWithPassword() → JWT

GitHub OAuth:
  GET /api/auth/oauth/url?provider=github → returns Supabase OAuth URL
  → User authenticates on GitHub
  → Supabase redirects to /api/auth/oauth/callback#access_token=...
  → Client-side JS extracts token, calls POST /api/auth/provision
  → provisionUser() creates Stripe customer + LiteLLM user + API key
```

`provisionUser()` is idempotent — if user already exists in LiteLLM, returns existing keys.

API key aliases are unique globally in LiteLLM, so they use format `key-{userId:8}-{timestamp}`.

## Billing Flow

```
User → POST /api/billing/checkout { tier: "pro" }
  → Gateway creates Stripe Checkout session with price ID
  → User pays on Stripe
  → Stripe fires webhook → POST /api/stripe/webhook
  → Gateway calls getTierByPriceId(priceId)
  → Gateway calls litellm.updateUserTier(userId, tier)
    → Updates LiteLLM user budget, models, rate limits
    → Updates all user's API keys with new permissions

User cancels subscription:
  → customer.subscription.deleted webhook
  → Gateway downgrades to free tier
```

## Development

### Prerequisites

- Azure VM with K3s (setup: `scripts/setup-vm.sh`)
- Supabase project (auth + PostgreSQL)
- Stripe account with products/prices (`scripts/create-stripe-products.ts`)
- Azure AI Foundry endpoint with deployed models

### Deploy

```bash
# First time: set up VM
ssh user@VM 'bash -s' < scripts/setup-vm.sh

# Copy files + deploy
rsync -avz --exclude='node_modules' -e "ssh -i KEY" cloud/ user@VM:~/cloud/
ssh user@VM "cd ~/cloud && bash scripts/deploy.sh"
```

`deploy.sh` handles: migration → template rendering → Traefik config → Docker build → K8s apply → rollout wait. Idempotent — safe to re-run.

### Quick redeploy (gateway code change)

```bash
rsync gateway/src/ user@VM:~/cloud/gateway/src/
ssh user@VM "cd ~/cloud/gateway && sudo docker build -t lmthing/gateway:latest . \
  && sudo docker save lmthing/gateway:latest | sudo k3s ctr images import - \
  && sudo k3s kubectl -n lmthing rollout restart deployment/gateway"
```

### Quick redeploy (LiteLLM config change)

Edit `k8s/litellm.yaml` ConfigMap, then:
```bash
scp k8s/litellm.yaml user@VM:~/cloud/k8s/
ssh user@VM "sudo k3s kubectl apply -f ~/cloud/k8s/litellm.yaml \
  && sudo k3s kubectl -n lmthing rollout restart deployment/litellm"
```

### LiteLLM Admin UI

```bash
ssh -L 4001:localhost:4001 user@VM \
  "sudo k3s kubectl -n lmthing port-forward deployment/litellm 4001:4000"
# Open http://localhost:4001/ui — login with LITELLM_MASTER_KEY
```

### Logs

```bash
ssh user@VM "sudo k3s kubectl -n lmthing logs deployment/gateway --tail=50"
ssh user@VM "sudo k3s kubectl -n lmthing logs deployment/litellm --tail=50"
ssh user@VM "sudo k3s kubectl -n kube-system logs deployment/traefik --tail=50"
```

## Adding Models

1. Edit `k8s/litellm.yaml` ConfigMap — add to `model_list`:
```yaml
- model_name: your-model
  litellm_params:
    model: azure/your-deployment-name
    api_base: os.environ/AZURE_API_BASE
    api_key: os.environ/AZURE_API_KEY
    api_version: "2024-12-01-preview"
  model_info:
    input_cost_per_token: 0.000000XXX   # azure_cost * 1.1
    output_cost_per_token: 0.000000XXX  # azure_cost * 1.1
```

2. Update `gateway/src/lib/tiers.ts` — add model to appropriate tier's `models` array (empty array = all models for Max tier).

3. Redeploy both LiteLLM (config change) and gateway (code change).

## Gotchas

- **No quotes in `.env.secrets`** — Kustomize reads values literally, quotes become part of the value.
- **Session pooler only** — LiteLLM needs port `5432` (session mode), not `6543` (transaction).
- **URL-encode passwords** — `#` → `%23`, `!` → `%21` in DATABASE_URL.
- **No HTTP IngressRoute** — a catch-all HTTP route blocks Let's Encrypt ACME challenges. Traefik handles them internally on the web entrypoint.
- **LiteLLM first startup** — takes 2-3 minutes (Prisma runs ~110 migrations). Subsequent restarts are fast.
- **No FK on profiles** — `profiles.id` has no FK to `auth.users` because cross-schema references break LiteLLM's Prisma introspection.
- **LiteLLM key aliases** — must be globally unique (not per-user). Use `key-{userId:8}-{timestamp}` format.
- **Traefik cert resolvers** — must use `additionalArguments` in HelmChartConfig, not the `certResolvers` Helm value (K3s Traefik ignores it).
- **Profiles table fragility** — LiteLLM's Prisma baseline migration can drop the profiles table on first start. The deploy script runs the migration before LiteLLM starts.

## Environment Variables

All stored in `k8s/.env.secrets` (gitignored), loaded via Kustomize `secretGenerator`.

| Variable | Used By | Purpose |
|----------|---------|---------|
| `DOMAIN` | templates | Domain for Traefik routing |
| `ACME_EMAIL` | templates | Let's Encrypt contact email |
| `BASE_URL` | gateway | Full URL for Stripe redirect URLs |
| `VM_HOST`, `VM_USER`, `SSH_KEY_PATH` | scripts | SSH access to VM |
| `AZURE_API_KEY` | litellm | Azure Foundry authentication |
| `AZURE_API_BASE` | litellm | Azure Foundry endpoint URL |
| `SUPABASE_URL` | gateway | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | gateway | Supabase admin access (bypasses RLS) |
| `DATABASE_URL` | litellm | PostgreSQL connection (session pooler, port 5432) |
| `STRIPE_SECRET_KEY` | gateway | Stripe API access |
| `STRIPE_WEBHOOK_SECRET` | gateway | Stripe webhook signature verification |
| `STRIPE_PRICE_BASIC/PRO/MAX` | gateway | Stripe price IDs for tier lookup |
| `LITELLM_MASTER_KEY` | both | LiteLLM admin API authentication |

## VM Operations

### SSH Access

All VM access uses the SSH key at `~/LMTHING/litellm_key.pem`. The VM host and user are in `.env.secrets`.

```bash
# Interactive shell
ssh -i ~/LMTHING/litellm_key.pem azureuser@135.116.57.95

# Run a single command
ssh -i ~/LMTHING/litellm_key.pem azureuser@135.116.57.95 "command here"
```

Cloud files are at `~/cloud/` on the VM.

### Common Operations

```bash
# ── Status ────────────────────────────────────────────────────
kubectl get pods -n lmthing                    # Pod status
kubectl get svc -n lmthing                     # Services
kubectl top pods -n lmthing                    # Resource usage
kubectl -n kube-system get pods                # Traefik + K3s system pods

# ── Logs ──────────────────────────────────────────────────────
kubectl logs deployment/gateway -n lmthing --tail=50
kubectl logs deployment/litellm -n lmthing --tail=50
kubectl logs deployment/traefik -n kube-system --tail=50

# Follow logs in real time
kubectl logs -f deployment/gateway -n lmthing
kubectl logs -f deployment/litellm -n lmthing

# ── Restart Services ──────────────────────────────────────────
kubectl rollout restart deployment/gateway -n lmthing    # Gateway only
kubectl rollout restart deployment/litellm -n lmthing    # LiteLLM only
kubectl rollout restart deployment/traefik -n kube-system # Traefik

# ── Deploy (on VM) ────────────────────────────────────────────
cd ~/cloud && bash scripts/deploy.sh           # Full redeploy (migration + build + apply)

# Gateway-only quick redeploy (after syncing code)
cd ~/cloud/gateway && \
  sudo docker build -t lmthing/gateway:latest . && \
  sudo docker save lmthing/gateway:latest | sudo k3s ctr images import - && \
  sudo k3s kubectl -n lmthing rollout restart deployment/gateway

# LiteLLM config-only redeploy (after editing litellm.yaml)
sudo k3s kubectl apply -f ~/cloud/k8s/litellm.yaml && \
  sudo k3s kubectl -n lmthing rollout restart deployment/litellm

# ── Sync files from local to VM ──────────────────────────────
# All cloud files
rsync -avz --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/LMTHING/litellm_key.pem" \
  cloud/ azureuser@135.116.57.95:~/cloud/

# Gateway code only
rsync -avz --exclude='node_modules' \
  -e "ssh -i ~/LMTHING/litellm_key.pem" \
  cloud/gateway/src/ azureuser@135.116.57.95:~/cloud/gateway/src/

# Secrets only
rsync -avz --include='.env.secrets' --exclude='*' \
  -e "ssh -i ~/LMTHING/litellm_key.pem" \
  cloud/k8s/ azureuser@135.116.57.95:~/cloud/k8s/

# ── Update secrets (after editing .env.secrets) ───────────────
# Sync the file first, then:
sudo k3s kubectl create secret generic lmthing-secrets \
  --from-env-file=~/cloud/k8s/.env.secrets \
  --namespace=lmthing \
  --dry-run=client -o yaml | sudo k3s kubectl apply -f -
# Then restart the affected deployment(s)

# ── Database ──────────────────────────────────────────────────
source ~/cloud/k8s/.env.secrets
psql "$DATABASE_URL"                           # Interactive SQL shell
psql "$DATABASE_URL" -c "SELECT * FROM public.profiles;"
psql "$DATABASE_URL" -f ~/cloud/migrations/001_profiles.sql

# ── LiteLLM Admin UI ─────────────────────────────────────────
# From your LOCAL machine (not the VM):
ssh -i ~/LMTHING/litellm_key.pem -L 4001:localhost:4001 azureuser@135.116.57.95 \
  "sudo k3s kubectl -n lmthing port-forward deployment/litellm 4001:4000"
# Then open http://localhost:4001/ui — login with LITELLM_MASTER_KEY

# ── Debug ─────────────────────────────────────────────────────
kubectl describe pod -l app=gateway -n lmthing   # Events, crash reasons
kubectl describe pod -l app=litellm -n lmthing
kubectl exec -it deployment/gateway -n lmthing -- sh  # Shell into container

# ── TLS / Traefik ────────────────────────────────────────────
kubectl logs deployment/traefik -n kube-system | grep -i 'acme\|cert\|error'
kubectl get ingressroute -n lmthing            # Routing rules
```

### Typical Workflows

**"I changed gateway code"**
```bash
rsync -avz --exclude='node_modules' -e "ssh -i ~/LMTHING/litellm_key.pem" \
  cloud/gateway/src/ azureuser@135.116.57.95:~/cloud/gateway/src/
ssh -i ~/LMTHING/litellm_key.pem azureuser@135.116.57.95 \
  "cd ~/cloud/gateway && sudo docker build -t lmthing/gateway:latest . && \
   sudo docker save lmthing/gateway:latest | sudo k3s ctr images import - && \
   sudo k3s kubectl -n lmthing rollout restart deployment/gateway"
```

**"I added a new model to litellm.yaml"**
```bash
scp -i ~/LMTHING/litellm_key.pem cloud/k8s/litellm.yaml azureuser@135.116.57.95:~/cloud/k8s/
ssh -i ~/LMTHING/litellm_key.pem azureuser@135.116.57.95 \
  "sudo k3s kubectl apply -f ~/cloud/k8s/litellm.yaml && \
   sudo k3s kubectl -n lmthing rollout restart deployment/litellm"
```

**"I changed .env.secrets"**
```bash
rsync -avz --include='.env.secrets' --exclude='*' \
  -e "ssh -i ~/LMTHING/litellm_key.pem" cloud/k8s/ azureuser@135.116.57.95:~/cloud/k8s/
ssh -i ~/LMTHING/litellm_key.pem azureuser@135.116.57.95 \
  "cd ~/cloud/k8s && sudo k3s kubectl create secret generic lmthing-secrets \
   --from-env-file=.env.secrets --namespace=lmthing \
   --dry-run=client -o yaml | sudo k3s kubectl apply -f - && \
   sudo k3s kubectl -n lmthing rollout restart deployment/gateway && \
   sudo k3s kubectl -n lmthing rollout restart deployment/litellm"
```

**"Something is broken, show me everything"**
```bash
ssh -i ~/LMTHING/litellm_key.pem azureuser@135.116.57.95 \
  "sudo k3s kubectl get pods -n lmthing && echo '---' && \
   sudo k3s kubectl logs deployment/gateway -n lmthing --tail=20 && echo '---' && \
   sudo k3s kubectl logs deployment/litellm -n lmthing --tail=20"
```
