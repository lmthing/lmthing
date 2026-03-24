---
title: Cloud Backend
description: Supabase Edge Functions in cloud/ — the sole backend for all lmthing products
order: 2
---

# Cloud Backend — `cloud/`

The `cloud/` directory is the **sole backend** for the entire lmthing project. It contains Supabase Edge Functions running on the Deno runtime. There is no separate backend service — all server-side logic lives here.

## Edge Functions

### AI & Models

| Function | Method | Purpose |
|----------|--------|---------|
| `generate-ai` | POST | Streaming LLM proxy via Stripe. Authenticates user, resolves Stripe customer ID, proxies request through `llm.stripe.com` for automatic token metering. Supports all providers. |
| `list-models` | GET | Returns available models from all configured providers. |

### API Keys

| Function | Method | Purpose |
|----------|--------|---------|
| `create-api-key` | POST | Generates `lmt_` prefixed API key. Key is SHA-256 hashed before storage — only the prefix is retrievable after creation. |
| `list-api-keys` | GET | Returns key prefixes and metadata (created date, last used). |
| `revoke-api-key` | POST | Soft-deletes an API key by prefix. |

### Billing

| Function | Method | Purpose |
|----------|--------|---------|
| `create-checkout` | POST | Creates a Stripe checkout session for subscription signup. |
| `billing-portal` | POST | Opens the Stripe customer portal for managing subscriptions. |
| `get-usage` | GET | Returns Stripe balance, usage meters, and subscription status. |
| `stripe-webhook` | POST | Handles Stripe webhooks (payment events, subscription changes). Also triggers computer provisioning on successful payment. **No auth required** — uses Stripe signature verification. |

### SSO

| Function | Method | Purpose |
|----------|--------|---------|
| `create-sso-code` | POST | Generates a single-use SSO authorization code (60s TTL). Called by `com/` after successful GitHub OAuth. |
| `exchange-sso-code` | POST | Exchanges an SSO code for a Supabase session. Called by frontend apps to complete login. **No auth required** — the code itself is the credential. |

### Spaces

| Function | Method | Purpose |
|----------|--------|---------|
| `list-spaces` | GET | Returns user's deployed spaces. |
| `create-space` | POST | Creates a space record and provisions a Fly.io machine. |
| `get-space` | GET | Returns space metadata by slug. Public — no auth required. |
| `update-space` | PATCH | Updates space metadata (name, description, visibility). |
| `start-space` | POST | Starts a space's Fly.io machine. |
| `stop-space` | POST | Stops a space's Fly.io machine. |
| `delete-space` | POST | Destroys space resources (Fly.io machine + database record). |
| `issue-space-token` | POST | Issues a short-lived access token for connecting to a running space. |

### Computer

| Function | Method | Purpose |
|----------|--------|---------|
| `provision-computer` | POST | Provisions a Fly.io machine for the THING agent runtime (1 core, 1 GB). |
| `issue-computer-token` | POST | Issues a short-lived access token for connecting to the computer node. |

## Shared Modules — `cloud/_shared/`

| Module | Purpose |
|--------|---------|
| `auth.ts` | JWT verification (Supabase) + `lmt_` API key resolution. Both resolve to `user_id` + `stripe_customer_id`. |
| `cors.ts` | CORS headers for cross-domain requests from `*.lmthing.*` origins. |
| `stripe.ts` | Stripe client initialization and helper functions. |
| `supabase.ts` | Supabase admin client for database operations (bypasses RLS). |
| `provider.ts` | Multi-backend LLM provider resolution. Maps model prefixes to provider SDKs. |
| `container.ts` | Fly.io Machines API client for provisioning and managing containers. |

## Authentication Pattern

Every edge function (except `stripe-webhook` and `exchange-sso-code`) uses `auth.ts`:

```typescript
const { userId, stripeCustomerId } = await authenticate(req);
```

This accepts either:
- `Authorization: Bearer <JWT>` — Supabase auth token from browser sessions
- `Authorization: Bearer lmt_<key>` — API key from SDK/CLI usage

## Database — Supabase PostgreSQL

Tables are protected by Row-Level Security (RLS):
- `profiles` — user profile data, `github_repo` for workspace sync
- `api_keys` — SHA-256 hashed keys with prefix, user_id, metadata
- `sso_codes` — single-use codes with 60s TTL
- `spaces` — space metadata, Fly.io machine IDs, deployment status
- `computers` — computer node metadata, Fly.io machine IDs

## Adding a New Edge Function

1. Create `cloud/supabase/functions/<function-name>/index.ts`
2. Import shared modules from `../_shared/`
3. Use `authenticate(req)` for auth (skip for public endpoints)
4. Add CORS handling: `if (req.method === 'OPTIONS') return corsResponse()`
5. Test locally: `supabase functions serve`
6. Deploy: `supabase functions deploy <function-name>`
