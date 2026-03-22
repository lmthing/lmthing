---
title: Backend Stack
description: K3s API gateway (Hono/Node.js) + LiteLLM proxy, Supabase PostgreSQL, Stripe billing
order: 2
---

# Backend Stack

All server-side logic runs in `cloud/` on a K3s (lightweight Kubernetes) cluster on an Azure VM. There is no separate backend service.

## Core Technologies

### Gateway (Hono/Node.js)

- **Language**: TypeScript running on Node.js
- **Framework**: Hono — lightweight HTTP framework
- **Routes**: `cloud/gateway/src/routes/` — `auth.ts`, `keys.ts`, `billing.ts`, `webhook.ts`
- **Middleware**: `cloud/gateway/src/middleware/auth.ts` — Supabase JWT verification
- **Libraries**: `cloud/gateway/src/lib/` — `litellm.ts`, `stripe.ts`, `tiers.ts`

```typescript
// Typical gateway route structure (Hono)
import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'

const app = new Hono()

app.use('/*', authMiddleware)

app.get('/me', async (c) => {
  const user = c.get('user')
  return c.json({ user_id: user.id, email: user.email })
})
```

### LiteLLM (OpenAI-Compatible Proxy)

- **Purpose**: Routes LLM requests to Azure AI Foundry with per-user budgets and rate limits
- **API**: OpenAI-compatible at `/v1/chat/completions` and `/v1/models`
- **Config**: Model list defined in `k8s/litellm.yaml` ConfigMap with 10% markup pricing
- **Auth**: API keys managed through LiteLLM admin API (not Supabase)

### Supabase PostgreSQL

- **Primary database** for user profiles and LiteLLM tables
- **Tables**: `profiles` (user tier, stripe customer ID), plus ~60 LiteLLM auto-created tables
- **Auth**: Supabase Auth for email/password + GitHub/Google OAuth

### Stripe Integration

- **Billing**: Subscription-based tiers (Free/Basic/Pro/Max)
- **Webhooks**: `webhook.ts` handles subscription created/updated/deleted → updates LiteLLM user tier
- **No LLM proxy**: LLM metering is handled by LiteLLM budgets, not Stripe meter proxy

### Tiers

| Tier  | Price      | Budget  | Reset   | Rate Limits          |
|-------|------------|---------|---------|----------------------|
| Free  | $0         | $1      | 7 days  | 10K tpm / 60 rpm     |
| Basic | $10/month  | $10     | 30 days | 50K tpm / 300 rpm    |
| Pro   | $20/month  | $20     | 30 days | 100K tpm / 1K rpm    |
| Max   | $100/month | $100    | 30 days | 1M tpm / 5K rpm      |

### Authentication Flow

Two auth methods:

1. **JWT (Browser)**: Supabase Auth JWT in `Authorization: Bearer <token>` header. Verified by gateway middleware via `supabase.auth.getUser()`.
2. **API Key (SDK/CLI)**: LiteLLM API key (`sk-...`) in `Authorization: Bearer sk-<key>` header. Verified by LiteLLM directly.

### LLM Provider Resolution

LiteLLM routes all requests to Azure AI Foundry. Model names are mapped in `k8s/litellm.yaml` ConfigMap. Each tier has access to different model sets, defined in `gateway/src/lib/tiers.ts`.

## Deployment

```bash
# Deploy to Azure VM
rsync -avz --exclude='node_modules' -e "ssh -i KEY" cloud/ user@VM:~/cloud/
ssh user@VM "cd ~/cloud && bash scripts/deploy.sh"
```

`deploy.sh` handles: migration → template rendering → Docker build → K8s apply → rollout wait.

## Adding a New API Route

1. Create or edit route file in `cloud/gateway/src/routes/`:
   ```typescript
   import { Hono } from 'hono'
   import type { Env } from '../types.js'

   const myRoute = new Hono<Env>()
   myRoute.get('/', async (c) => {
     const user = c.get('user')
     // Business logic here
     return c.json(result)
   })
   export default myRoute
   ```

2. Mount in `cloud/gateway/src/index.ts`:
   ```typescript
   app.route('/api/my-route', myRoute)
   ```

3. Redeploy gateway:
   ```bash
   ssh user@VM "cd ~/cloud/gateway && sudo docker build -t lmthing/gateway:latest . \
     && sudo docker save lmthing/gateway:latest | sudo k3s ctr images import - \
     && sudo k3s kubectl -n lmthing rollout restart deployment/gateway"
   ```

## Database Migrations

- Migration files in `cloud/migrations/`
- Applied by `scripts/deploy.sh` before K8s deployment
- No FK from `profiles` to `auth.users` — cross-schema FKs break LiteLLM's Prisma introspection
