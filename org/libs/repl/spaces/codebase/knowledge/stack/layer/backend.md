---
title: Backend Stack
description: Supabase Edge Functions (Deno), PostgreSQL with RLS, Stripe billing integration
order: 2
---

# Backend Stack

All server-side logic runs as Supabase Edge Functions in `cloud/`. There is no separate backend service.

## Core Technologies

### Supabase Edge Functions (Deno Runtime)

- **Language**: TypeScript running on Deno (not Node.js — no `node_modules`, uses URL imports)
- **Deployment**: Hosted on Supabase infrastructure, auto-scaled
- **Pattern**: Each function is a standalone HTTP handler in `cloud/supabase/functions/<name>/index.ts`
- **Shared code**: Modules in `cloud/supabase/functions/_shared/` imported by all functions

```typescript
// Typical edge function structure
import { serve } from 'https://deno.land/std/http/server.ts'
import { authenticate } from '../_shared/auth.ts'
import { corsHeaders, corsResponse } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse()

  const { userId, stripeCustomerId } = await authenticate(req)

  // Business logic here

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

### Supabase PostgreSQL

- **Primary database** for all server-side data
- **Row-Level Security (RLS)** — every table has policies ensuring users can only access their own data
- **Tables**: `profiles`, `api_keys`, `sso_codes`, `spaces`, `computers`
- **Admin client**: Edge functions use `supabase.ts` shared module (service role key, bypasses RLS for server operations)

### Stripe Integration

- **Billing**: Checkout sessions, customer portal, webhook handling
- **LLM Proxy**: `llm.stripe.com` — all LLM requests are proxied through Stripe for automatic token metering and billing
- **Pattern**: Edge functions use `@stripe/ai-sdk` to create streaming LLM requests via Stripe's meter proxy
- **Webhooks**: `stripe-webhook` function handles payment events and triggers provisioning

### Authentication Flow

Two auth methods, both resolved by `_shared/auth.ts`:

1. **JWT (Browser)**: Supabase Auth JWT in `Authorization: Bearer <token>` header. Verified against Supabase's JWT secret.
2. **API Key (SDK/CLI)**: `lmt_` prefixed key in `Authorization: Bearer lmt_<key>` header. SHA-256 hashed and looked up in `api_keys` table.

Both resolve to `{ userId, stripeCustomerId }` for downstream use.

### LLM Provider Resolution

`_shared/provider.ts` maps model prefixes to provider SDKs:

| Prefix | Provider | SDK |
|--------|----------|-----|
| `openai/*` | OpenAI | `@ai-sdk/openai` |
| `anthropic/*` | Anthropic | `@ai-sdk/anthropic` |
| `google/*` | Google | `@ai-sdk/google` |
| `mistral/*` | Mistral | `@ai-sdk/mistral` |
| `azure/*` | Azure OpenAI | `@ai-sdk/azure` |
| `groq/*` | Groq | `@ai-sdk/groq` |
| Custom | OpenAI-compatible | `@ai-sdk/openai` with custom `baseURL` |

All requests go through Stripe's LLM meter proxy for unified billing.

## Local Development

```bash
# Start Supabase locally (includes PostgreSQL, Auth, Storage)
supabase start

# Serve edge functions with hot reload
supabase functions serve

# Access at http://localhost:54321/functions/v1/<function-name>
# Or via proxy at http://cloud.local/functions/v1/<function-name>
```

## Adding a New Edge Function

1. Create the function directory and entry file:
   ```
   cloud/supabase/functions/my-function/index.ts
   ```

2. Import shared modules:
   ```typescript
   import { authenticate } from '../_shared/auth.ts'
   import { corsHeaders, corsResponse } from '../_shared/cors.ts'
   import { supabaseAdmin } from '../_shared/supabase.ts'
   ```

3. Handle CORS preflight + authentication:
   ```typescript
   if (req.method === 'OPTIONS') return corsResponse()
   const { userId } = await authenticate(req)
   ```

4. Implement business logic using `supabaseAdmin` for database operations

5. Test: `supabase functions serve` then `curl http://localhost:54321/functions/v1/my-function`

6. Deploy: `supabase functions deploy my-function`

## Database Migrations

- Managed via Supabase CLI: `supabase migration new <name>`
- Migration files in `cloud/supabase/migrations/`
- Always include RLS policies for new tables
- Apply locally: `supabase db reset` (destructive) or `supabase migration up`
