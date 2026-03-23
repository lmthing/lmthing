# @lmthing/cloud — LLM API Gateway

Tier-based LLM API gateway running on K3s with LiteLLM, Stripe billing, and Supabase auth.

## Architecture

```
Users → lmthing.cloud (Traefik + Let's Encrypt TLS)
         ├── /v1/*  → LiteLLM (OpenAI-compatible proxy → Azure Foundry)
         └── /api/* → Gateway (auth, keys, billing, Stripe webhooks)

LiteLLM ↔ Supabase PostgreSQL (keys, budgets, usage)
Gateway ↔ Stripe (subscriptions) + Supabase Auth + LiteLLM Admin API
```

## Tiers

All token costs include a 10% markup over Azure pricing.

| Tier    | Price      | Budget  | Reset   | Rate Limits          |
|---------|------------|---------|---------|----------------------|
| Free    | $0         | $1      | 7 days  | 10K tpm / 60 rpm     |
| Starter | $5/month   | $5      | 30 days | 25K tpm / 150 rpm    |
| Basic   | $10/month  | $10     | 30 days | 50K tpm / 300 rpm    |
| Pro     | $20/month  | $20     | 30 days | 100K tpm / 1K rpm    |
| Max     | $100/month | $100    | 30 days | 1M tpm / 5K rpm      |

## Prerequisites

- Azure VM with Ubuntu 24.04, ports 22/80/443 open in NSG
- Supabase project (free tier works)
- Stripe account (live mode)
- Azure AI Foundry endpoint with deployed models
- Domain with A record pointing to VM IP

## Setup (from scratch)

### 1. DNS

Create an A record: `your-domain` → `VM_IP` (no proxy, DNS only).

### 2. Supabase

Create a project and note:
- **Project URL** (Settings → API)
- **Service role key** (Settings → API Keys → Secret keys)
- **Database URI** (Settings → Database → Connection string → URI → **Session mode port 5432**)

Special characters in the database password must be URL-encoded:
`#` → `%23`, `!` → `%21`, `@` → `%40`

### 3. Stripe

Get your **Secret key** (Developers → API keys).

Create products and prices:
```bash
STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/create-stripe-products.ts
```

Create a webhook endpoint at `https://your-domain/api/stripe/webhook` for:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the **Signing secret** from the endpoint.

### 4. Configure

```bash
cp k8s/.env.secrets.example k8s/.env.secrets
# Fill in all values — no quotes around values!
```

### 5. VM Setup + Deploy

```bash
# SSH into VM and run setup
ssh -i KEY user@VM_IP 'bash -s' < scripts/setup-vm.sh

# Copy files to VM
rsync -avz --exclude='node_modules' -e "ssh -i KEY" cloud/ user@VM_IP:~/cloud/

# Deploy (on the VM)
cd ~/cloud && bash scripts/deploy.sh
```

The deploy script handles everything: migration, template rendering, Traefik TLS, image build, K8s apply, and rollout wait.

### 6. Verify

```bash
# Health check
curl https://your-domain/api/health

# Register
curl -X POST https://your-domain/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}'

# Chat (use the returned API key)
curl -X POST https://your-domain/v1/chat/completions \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.4-nano","messages":[{"role":"user","content":"hello"}]}'
```

## API Reference

### Public

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register → returns API key |
| POST | `/api/auth/login` | Login → returns JWT |
| POST | `/api/stripe/webhook` | Stripe events |

### Authenticated (JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | User info + tier |
| GET/POST | `/api/keys` | List / create API keys |
| DELETE | `/api/keys/:token` | Revoke key |
| POST | `/api/billing/checkout` | Stripe checkout `{tier}` |
| POST | `/api/billing/portal` | Billing portal |
| GET | `/api/billing/usage` | Usage + budget |

### LiteLLM (API key)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | OpenAI-compatible chat |
| GET | `/v1/models` | Available models |

## LiteLLM Admin UI

Access via SSH port-forward (not publicly exposed):
```bash
ssh -L 4000:localhost:4000 user@VM_IP \
  "sudo k3s kubectl -n lmthing port-forward deployment/litellm 4000:4000"
```
Then open `http://localhost:4000/ui` and login with `LITELLM_MASTER_KEY`.

## Adding Models

Edit `k8s/litellm.yaml` ConfigMap → add to `model_list` with 10% markup pricing.
Update tier model lists in `gateway/src/lib/tiers.ts`. Redeploy.

## Redeploying

```bash
bash scripts/deploy.sh                                          # full redeploy
sudo k3s kubectl -n lmthing rollout restart deployment/litellm  # config change
sudo k3s kubectl -n lmthing rollout restart deployment/gateway  # code change
```

## Gotchas

- **DATABASE_URL**: Must use session pooler (port 5432), not transaction (6543). URL-encode special chars in password.
- **No quotes in .env.secrets**: Kustomize reads values literally — quotes become part of the value.
- **No HTTP IngressRoute**: Traefik handles ACME challenges on the web entrypoint internally. Adding an HTTP catch-all route blocks Let's Encrypt validation.
- **LiteLLM first startup**: Takes 2-3 minutes as Prisma runs ~110 migrations. Subsequent restarts are fast.
- **Profiles table**: No FK to `auth.users` — cross-schema FKs break LiteLLM's Prisma introspection.
