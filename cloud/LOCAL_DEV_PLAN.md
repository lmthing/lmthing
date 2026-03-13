# LOCAL_DEV_PLAN — Fully Offline Development Environment

## Goal

Run the entire lmthing cloud backend locally with **zero internet dependency**. Introduce an abstracted AI provider layer (`provider.ts`) so the LLM backend can be swapped between Stripe, Ollama, or any OpenAI-compatible endpoint via a single env var.

---

## Current State

All LLM calls go through `@stripe/ai-sdk` → `llm.stripe.com`. The Stripe provider is hardcoded in `generate-ai/index.ts`. Four edge functions also call the Stripe API directly (`create-checkout`, `billing-portal`, `get-usage`, `stripe-webhook`).

**External dependencies requiring internet:**

| Component | Calls | Used by |
|-----------|-------|---------|
| `@stripe/ai-sdk` | `llm.stripe.com` | `generate-ai` |
| Stripe API | `api.stripe.com` | `stripe.ts`, `create-checkout`, `billing-portal`, `get-usage`, `stripe-webhook` |
| GitHub OAuth | `github.com` | Frontend only (BYOK mode already works offline) |

**Already offline:**

- Supabase local stack (Postgres, Auth, Studio) — runs in Docker
- All `_shared/` modules — talk to local Supabase only
- `create-api-key`, `list-api-keys`, `revoke-api-key` — DB-only, no Stripe

---

## Plan

### Step 1 — Create `_shared/provider.ts` (AI Provider Abstraction)

Create a new shared module that abstracts model resolution away from any specific billing/routing backend. This is the key architectural change — `generate-ai` will import from `provider.ts` instead of directly using `@stripe/ai-sdk`.

**File:** `supabase/functions/_shared/provider.ts`

```typescript
import type { LanguageModelV2 } from "npm:ai@5";

/**
 * Resolve a model string (e.g. "openai/gpt-4o") into an AI SDK LanguageModelV2.
 *
 * The backend is selected by the LLM_PROVIDER env var:
 *   - "stripe"  → @stripe/ai-sdk (production, routes through llm.stripe.com)
 *   - "ollama"  → @ai-sdk/openai-compatible pointed at Ollama (fully offline)
 *   - "openai"  → @ai-sdk/openai with a direct API key (no Stripe metering)
 *
 * Default: "stripe" (production behavior unchanged)
 */
export function resolveModel(
  modelId: string,
  opts?: { stripeCustomerId?: string }
): LanguageModelV2;
```

**Implementation logic:**

```
LLM_PROVIDER env var
├── "stripe" (default / production)
│   └── createStripe({ apiKey: STRIPE_SECRET_KEY, customerId }) → stripeLLM(modelId)
│
├── "ollama" (fully offline)
│   └── createOpenAICompatible({ baseURL: OLLAMA_BASE_URL ?? "http://localhost:11434/v1" })
│   └── Maps modelId: strip provider prefix → e.g. "openai/gpt-4o" becomes just the local model name
│   └── OLLAMA_MODEL env var overrides the model name (useful when you only have one model pulled)
│
└── "openai" (direct, no billing)
    └── createOpenAI({ apiKey: OPENAI_API_KEY }) → openai(modelId)
```

**Why this design:**
- `generate-ai` calls `resolveModel(model, { stripeCustomerId })` — one line, provider-agnostic
- Adding a new provider = adding one more branch in `provider.ts`
- Production behavior is unchanged (Stripe is the default)
- No conditional logic leaks into edge functions

### Step 2 — Update `generate-ai/index.ts`
<!-- It should use the resolveModel of org/libs/core -->
Replace the direct `@stripe/ai-sdk` usage with `resolveModel()`.

**Before:**
```typescript
import { createStripe } from "npm:@stripe/ai-sdk@0.1/provider";
// ...
const stripeLLM = createStripe({ apiKey, customerId: stripeCustomerId });
// ...
model: stripeLLM(model),
```

**After:**
```typescript
import { resolveModel } from "../_shared/provider.ts";
// ...
model: resolveModel(model, { stripeCustomerId }),
```

Also: when `LOCAL_DEV=true`, skip the `ensureStripeCustomer()` call entirely (no Stripe account needed). Use a dummy customer ID or `null`.

### Step 3 — Stub billing endpoints in local dev mode

When `LOCAL_DEV=true`, the four Stripe-dependent billing endpoints return mock responses instead of calling `api.stripe.com`.

| Function | Mock behavior |
|----------|--------------|
| `create-checkout` | Return `{ checkout_url: "http://localhost:54323/#local-dev-no-billing" }` |
| `billing-portal` | Return `{ portal_url: "http://localhost:54323/#local-dev-no-billing" }` |
| `get-usage` | Return `{ balance_cents: 0, balance_display: "$0.00", has_credit: true, local_dev: true }` |
| `stripe-webhook` | Return `{ received: true, local_dev: true }` (no signature verification) |

Implementation: add a small helper to `_shared/stripe.ts`:

```typescript
export const isLocalDev = Deno.env.get("LOCAL_DEV") === "true";
```

Each billing function checks `isLocalDev` at the top and returns the stub immediately.

### Step 4 — Skip Stripe customer creation in local dev

In `_shared/stripe.ts`, `ensureStripeCustomer()` should return a placeholder when `LOCAL_DEV=true`:

```typescript
export async function ensureStripeCustomer(...): Promise<string> {
  if (isLocalDev) return "cus_local_dev";
  // ... existing Stripe logic
}
```

This means `generate-ai` still flows through auth → model resolution normally, just without any Stripe calls.

### Step 5 — Update `list-models` for local dev

When `LOCAL_DEV=true` and `LLM_PROVIDER=ollama`, query Ollama's `/api/tags` endpoint to return actually available local models instead of the hardcoded cloud model list.

Fallback: if Ollama is unreachable, return the hardcoded list as-is (graceful degradation).

### Step 6 — Update `.env.example`

Add the new env vars:

```env
# --- Local Development (offline mode) ---
# Set to "true" to run without Stripe or any external services
LOCAL_DEV=false

# LLM Provider: "stripe" (default), "ollama" (offline), "openai" (direct)
LLM_PROVIDER=stripe

# Ollama settings (only when LLM_PROVIDER=ollama)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=                # optional: force a specific model name (e.g. "llama3.2")

# Direct OpenAI (only when LLM_PROVIDER=openai)
OPENAI_API_KEY=
```

### Step 7 — Add `.env.local` template

Create a ready-to-use `.env.local` file for offline development:

```env
LOCAL_DEV=true
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434/v1
STRIPE_SECRET_KEY=sk_not_needed
STRIPE_WEBHOOK_SECRET=whsec_not_needed
```

> Note: `host.docker.internal` is needed because Supabase edge functions run inside Docker, while Ollama runs on the host.

---

## File Change Summary

| File | Change |
|------|--------|
| `_shared/provider.ts` | **NEW** — AI provider abstraction (`resolveModel()`) |
| `_shared/stripe.ts` | Add `isLocalDev` flag, stub `ensureStripeCustomer()` in dev mode |
| `generate-ai/index.ts` | Replace `@stripe/ai-sdk` import with `resolveModel()` from `provider.ts` |
| `list-models/index.ts` | Query Ollama `/api/tags` when `LOCAL_DEV + ollama` |
| `create-checkout/index.ts` | Early return mock when `isLocalDev` |
| `billing-portal/index.ts` | Early return mock when `isLocalDev` |
| `get-usage/index.ts` | Early return mock when `isLocalDev` |
| `stripe-webhook/index.ts` | Early return mock when `isLocalDev` |
| `.env.example` | Add `LOCAL_DEV`, `LLM_PROVIDER`, `OLLAMA_*`, `OPENAI_API_KEY` vars |
| `.env.local` | **NEW** — Ready-to-use offline config |

**No changes to:** `auth.ts`, `cors.ts`, `supabase.ts`, `create-api-key`, `list-api-keys`, `revoke-api-key`

---

## Dependency Additions

| Package | Specifier | Used when |
|---------|-----------|-----------|
| `@ai-sdk/openai-compatible` | `npm:@ai-sdk/openai-compatible` | `LLM_PROVIDER=ollama` |
| `@ai-sdk/openai` | `npm:@ai-sdk/openai` | `LLM_PROVIDER=openai` |

These are only imported dynamically in the relevant branch of `provider.ts` — no impact on the Stripe production path.

---

## How to Use

```bash
# 1. Install and start Ollama with a model
ollama pull llama3.2
ollama serve

# 2. Start local Supabase
cd cloud
pnpm start

# 3. Serve functions in offline mode
pnpm functions:serve --env-file .env.local

# 4. Test it
curl -X POST http://localhost:54321/functions/v1/generate-ai \
  -H "Authorization: Bearer <local-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"model": "llama3.2", "messages": [{"role": "user", "content": "hello"}]}'
```

---

## Design Decisions

1. **`provider.ts` as the single abstraction point** — All model resolution goes through one file. Edge functions never import provider SDKs directly. This makes it trivial to add new providers (e.g. Anthropic direct, Azure, Groq) without touching any edge function.

2. **`LOCAL_DEV` is separate from `LLM_PROVIDER`** — You might want to use Ollama in production (self-hosted), or use direct OpenAI while still needing Stripe billing stubs. Keeping them independent gives full flexibility.

3. **Dynamic imports for non-Stripe providers** — The `ollama` and `openai` branches use dynamic `import()` so the Stripe production path never loads unnecessary dependencies.

4. **`host.docker.internal` for Ollama URL** — Edge functions run inside Docker (via Supabase CLI). Ollama runs on the host. This is the standard Docker bridge address. On Linux without Docker Desktop, users may need `--add-host=host.docker.internal:host-gateway` or use the host's LAN IP instead.

5. **Mock billing returns Supabase Studio URL** — The stub checkout/portal URLs point to the local Studio dashboard, making it obvious you're in dev mode without breaking any frontend redirect flows.
