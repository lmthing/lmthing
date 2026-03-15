# @lmthing/cloud

A serverless backend for AI token billing, built on **Supabase Edge Functions** and **Stripe Token Billing** (`@stripe/ai-sdk`).

Users authenticate, get API keys, and consume LLM tokens through OpenAI-compatible endpoints. Stripe handles all token metering, pricing, and billing automatically via its proxy at `llm.stripe.com`.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Step 1: Stripe Setup](#step-1-stripe-setup)
  - [1.1 Enable Token Billing](#11-enable-token-billing)
  - [1.2 Configure Pricing](#12-configure-pricing)
  - [1.3 Get Your API Keys](#13-get-your-api-keys)
  - [1.4 Set Up Webhooks](#14-set-up-webhooks)
- [Step 2: Supabase Setup](#step-2-supabase-setup)
  - [2.1 Create a Supabase Project](#21-create-a-supabase-project)
  - [2.2 Install the CLI](#22-install-the-cli)
  - [2.3 Link Your Project](#23-link-your-project)
  - [2.4 Run the Database Migration](#24-run-the-database-migration)
  - [2.5 Set Edge Function Secrets](#25-set-edge-function-secrets)
- [Step 3: Deploy Edge Functions](#step-3-deploy-edge-functions)
- [Step 4: Frontend Integration](#step-4-frontend-integration)
  - [4.1 User Signup and Login](#41-user-signup-and-login)
  - [4.2 Create an API Key](#42-create-an-api-key)
  - [4.3 Call the AI Endpoint](#43-call-the-ai-endpoint)
  - [4.4 Streaming Responses](#44-streaming-responses)
  - [4.5 Subscribe to a Plan](#45-subscribe-to-a-plan)
  - [4.6 Check Usage / Balance](#46-check-usage--balance)
  - [4.7 Manage Billing](#47-manage-billing)
- [Local Development](#local-development)
- [API Reference](#api-reference)
  - [generate-ai](#generate-ai)
  - [list-models](#list-models)
  - [create-api-key](#create-api-key)
  - [list-api-keys](#list-api-keys)
  - [revoke-api-key](#revoke-api-key)
  - [create-checkout](#create-checkout)
  - [billing-portal](#billing-portal)
  - [get-usage](#get-usage)
  - [stripe-webhook](#stripe-webhook)
  - [create-sso-code](#create-sso-code)
  - [exchange-sso-code](#exchange-sso-code)
  - [list-spaces](#list-spaces)
  - [create-space](#create-space)
  - [get-space](#get-space)
  - [update-space](#update-space)
  - [start-space](#start-space)
  - [stop-space](#stop-space)
  - [delete-space](#delete-space)
  - [issue-space-token](#issue-space-token)
  - [provision-computer](#provision-computer)
  - [issue-computer-token](#issue-computer-token)
- [Authentication](#authentication)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Supported Models](#supported-models)
- [How Billing Works](#how-billing-works)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                          ┌─────────────────────────────────┐
                          │        Stripe Dashboard         │
                          │  Token Billing, Pricing, Alerts │
                          └────────────┬────────────────────┘
                                       │ webhooks
                                       ▼
┌──────────┐   JWT / API Key   ┌──────────────────┐   @stripe/ai-sdk   ┌─────────────────┐
│ Frontend │ ─────────────────▶│ Supabase Edge    │ ──────────────────▶│ llm.stripe.com  │
│  (App)   │ ◀─────────────── │ Functions        │ ◀────────────────── │ (Stripe Proxy)  │
└──────────┘   JSON / SSE      └──────────────────┘   stream / JSON     └────────┬────────┘
                                       │                                         │
                                       ▼                                         ▼
                               ┌──────────────┐                         ┌────────────────┐
                               │   Supabase   │                         │  OpenAI        │
                               │   Postgres   │                         │  Anthropic     │
                               │  (profiles,  │                         │  Google        │
                               │   api_keys)  │                         └────────────────┘
                               └──────────────┘
```

**Key principle**: You never talk to OpenAI, Anthropic, or Google directly. `@stripe/ai-sdk` routes all LLM requests through Stripe's proxy, which automatically meters token usage and bills the customer. No usage tables, no token counting, no per-provider API keys.

---

## Prerequisites

- [Supabase account](https://supabase.com) (free tier works for development)
- [Stripe account](https://stripe.com) with access to **Token Billing** (private preview)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`v1.187+`)
- [Deno](https://deno.land/) (for local Edge Function development)
- Node.js 18+ (for frontend integration)

---

## Step 1: Stripe Setup

### 1.1 Enable Token Billing

1. Go to [Stripe Token Billing](https://docs.stripe.com/billing/token-billing) and request access to the private preview if you haven't already.
2. Once approved, navigate to **Billing > Token Billing** in your Stripe Dashboard.
3. Click **Get Started** to enable it for your account.

### 1.2 Configure Pricing

In the Token Billing dashboard:

1. **Set your markup**: Enter a percentage (e.g., `30%`) that you want to charge on top of the base LLM provider costs. Stripe automatically tracks the underlying model prices.
2. **Choose a pricing model**:

   | Model | Description |
   |-------|-------------|
   | **Prepaid Credits** | Customers buy credit packs upfront (e.g., $10 for N tokens) |
   | **Monthly Subscription** | Fixed monthly fee with included token allowance |
   | **Pay-as-you-go** | Customers are billed based on actual usage at the end of the billing period |
   | **Hybrid** | Combine a base subscription with overage charges |

3. **Create your product and price**: Stripe auto-configures the meters, prices, and rate configuration for you. Note the **Price ID** (`price_xxx`) — you'll need it for checkout sessions.

4. **(Optional) Set up billing alerts**: Configure alerts for when a customer's credit balance reaches zero. These fire a `billing.alert.triggered` webhook event.

### 1.3 Get Your API Keys

From the [Stripe Developer Dashboard](https://dashboard.stripe.com/apikeys):

- **Secret Key**: `sk_test_...` (for development) or `sk_live_...` (for production)
  - This key is used both for Stripe API calls AND as the `@stripe/ai-sdk` provider key
  - It authorizes your requests to `llm.stripe.com`

> **Important**: You do NOT need separate API keys for OpenAI, Anthropic, or Google. Stripe's proxy handles provider authentication.

### 1.4 Set Up Webhooks

1. Go to **Developers > Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Set the endpoint URL to your deployed function:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
   ```
4. Select these events:
   - `billing.alert.triggered` — credit balance exhausted
   - `checkout.session.completed` — customer completed purchase
   - `customer.subscription.created` — new subscription
   - `customer.subscription.updated` — plan change
   - `customer.subscription.deleted` — cancellation
5. Copy the **Webhook Signing Secret** (`whsec_...`)

---

## Step 2: Supabase Setup

### 2.1 Create a Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Note these values from **Settings > API**:
   - **Project URL**: `https://<ref>.supabase.co`
   - **Anon Key**: `eyJhbG...` (public, safe for frontend)
   - **Service Role Key**: `eyJhbG...` (secret, only for Edge Functions)

### 2.2 Install the CLI

The Supabase CLI is already included as a devDependency. Install it with:

```bash
cd cloud
pnpm install
```

### 2.3 Link Your Project

```bash
cd cloud

# Login to Supabase
pnpx supabase login

# Link to your remote project
pnpx supabase link --project-ref <your-project-ref>
```

Update `supabase/config.toml` with your project ID (top-level field, not a section):

```toml
project_id = "your-project-ref"
```

### 2.4 Run the Database Migrations

The migrations create all required tables: `profiles`, `api_keys`, `sso_codes`, `spaces`, and `computers`.

```bash
# Push all migrations to your remote database
pnpx supabase db push
```

Or run them manually in the SQL Editor (**Dashboard > SQL Editor**) by pasting the contents of each migration file.

**What the migrations do:**

- **`001_initial.sql`** — `profiles` + `api_keys` tables. Profiles are linked to `auth.users` via a trigger that auto-creates a row on signup. Stores `stripe_customer_id` for billing. API keys use SHA-256 hashes with `lmt_` display prefix.
- **`002_sso_codes.sql`** — `sso_codes` table for cross-domain SSO authorization codes (60s TTL, single-use).
- **`003_spaces.sql`** — `spaces` table for Fly.io container metadata, config, custom domains, and per-space DB schema isolation. Includes RLS policies for owner management and public read of running spaces.
- **`004_computers.sql`** — `computers` table for per-user Fly.io computer machines (one per user, paid tier).

### 2.5 Set Edge Function Secrets

```bash
pnpx supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key \
  STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

> The `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions — you don't need to set them.

---

## Step 3: Deploy Edge Functions

Deploy all functions at once:

```bash
pnpx supabase functions deploy
```

Or deploy individually:

```bash
# AI & Models
pnpx supabase functions deploy generate-ai
pnpx supabase functions deploy list-models

# API Keys
pnpx supabase functions deploy create-api-key
pnpx supabase functions deploy list-api-keys
pnpx supabase functions deploy revoke-api-key

# Billing
pnpx supabase functions deploy create-checkout
pnpx supabase functions deploy billing-portal
pnpx supabase functions deploy get-usage
pnpx supabase functions deploy stripe-webhook

# SSO
pnpx supabase functions deploy create-sso-code
pnpx supabase functions deploy exchange-sso-code

# Spaces
pnpx supabase functions deploy list-spaces
pnpx supabase functions deploy create-space
pnpx supabase functions deploy get-space
pnpx supabase functions deploy update-space
pnpx supabase functions deploy start-space
pnpx supabase functions deploy stop-space
pnpx supabase functions deploy delete-space
pnpx supabase functions deploy issue-space-token

# Computer
pnpx supabase functions deploy provision-computer
pnpx supabase functions deploy issue-computer-token
```

After deployment, your functions are available at:

```
https://<your-project-ref>.supabase.co/functions/v1/<function-name>
```

> **Webhook note**: The `stripe-webhook` function must be publicly accessible (no auth). Set it to not require JWT verification:
> ```bash
> pnpx supabase functions deploy stripe-webhook --no-verify-jwt
> ```

---

## Step 4: Frontend Integration

### Base URL

All examples use this base URL:

```typescript
const SUPABASE_URL = "https://<your-project-ref>.supabase.co";
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
```

### 4.1 User Signup and Login

Use the Supabase client library directly — no Edge Function needed for auth:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "securepassword",
});

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "securepassword",
});

// The session token is at:
const token = data.session.access_token;
```

### 4.2 Create an API Key

```typescript
const res = await fetch(`${FUNCTIONS_URL}/create-api-key`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name: "My App" }),
});

const { key, prefix, id } = await res.json();
// key = "lmt_a1b2c3d4e5f6..." (save this — shown only once!)
// prefix = "lmt_a1b2c3d4" (for display)
```

### 4.3 Call the AI Endpoint

Use either a Supabase JWT or an API key:

```typescript
// With JWT (from supabase.auth)
const res = await fetch(`${FUNCTIONS_URL}/generate-ai`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "Hello, world!" }],
  }),
});

// With API key (for programmatic access)
const res = await fetch(`${FUNCTIONS_URL}/generate-ai`, {
  method: "POST",
  headers: {
    Authorization: `Bearer lmt_your_api_key_here`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "anthropic/claude-sonnet-4",
    messages: [{ role: "user", content: "Explain quantum computing" }],
    temperature: 0.7,
    max_tokens: 1024,
  }),
});

const data = await res.json();
console.log(data.choices[0].message.content);
```

### 4.4 Streaming Responses

```typescript
const res = await fetch(`${FUNCTIONS_URL}/generate-ai`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "openai/gpt-4o",
    messages: [{ role: "user", content: "Write a poem" }],
    stream: true,
  }),
});

// Read the SSE stream
const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  process.stdout.write(decoder.decode(value));
}
```

**With Vercel AI SDK's `useChat` (React):**

```tsx
import { useChat } from "ai/react";

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    api: `${FUNCTIONS_URL}/generate-ai`,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: {
      model: "openai/gpt-4o-mini",
    },
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

### 4.5 Subscribe to a Plan

```typescript
const res = await fetch(`${FUNCTIONS_URL}/create-checkout`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    price_id: "price_xxx", // from Stripe Dashboard
    success_url: "https://yourapp.com/billing?success=true",
    cancel_url: "https://yourapp.com/billing?canceled=true",
  }),
});

const { checkout_url } = await res.json();
// Redirect the user to Stripe Checkout
window.location.href = checkout_url;
```

### 4.6 Check Usage / Balance

```typescript
const res = await fetch(`${FUNCTIONS_URL}/get-usage`, {
  headers: { Authorization: `Bearer ${token}` },
});

const usage = await res.json();
// {
//   stripe_customer_id: "cus_xxx",
//   balance_cents: -500,         // negative = $5.00 credit remaining
//   balance_display: "$5.00",
//   has_credit: true
// }
```

### 4.7 Manage Billing

Open the Stripe Customer Portal to let users manage their subscription:

```typescript
const res = await fetch(`${FUNCTIONS_URL}/billing-portal`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    return_url: "https://yourapp.com/settings",
  }),
});

const { portal_url } = await res.json();
window.location.href = portal_url;
```

---

## Local Development

### Start Supabase locally

```bash
cd cloud

# Start the local Supabase stack (Postgres, Auth, Edge Functions runtime)
pnpm start

# This prints your local credentials:
# API URL:   http://localhost:54321
# Anon Key:  eyJhbG...
# Service Role Key: eyJhbG...
```

### Set local secrets

Create a `.env` file in `cloud/`:

```bash
cp .env.example .env
# Edit .env with your Stripe keys
```

Or create `cloud/supabase/.env` with:

```
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Serve Edge Functions locally

```bash
pnpm functions:serve --env-file .env
```

Functions are now available at `http://localhost:54321/functions/v1/<name>`.

### Test with curl

```bash
# Get an auth token
TOKEN=$(curl -s http://localhost:54321/auth/v1/token?grant_type=password \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testtest"}' \
  | jq -r '.access_token')

# Call the AI endpoint
curl -X POST http://localhost:54321/functions/v1/generate-ai \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Test Stripe webhooks locally

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

---

## API Reference

All endpoints are at `https://<ref>.supabase.co/functions/v1/<function>`.

### generate-ai

The core AI endpoint. Accepts OpenAI-compatible request format.

```
POST /functions/v1/generate-ai
Authorization: Bearer <jwt_or_api_key>
```

**Request body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | `"openai/gpt-4o-mini"` | Model ID in `provider/model` format |
| `messages` | array | (required) | Array of `{role, content}` message objects |
| `temperature` | number | - | Sampling temperature (0-2) |
| `max_tokens` | number | - | Maximum tokens to generate |
| `stream` | boolean | `false` | Enable SSE streaming |

**Non-streaming response** (OpenAI-compatible):

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "openai/gpt-4o-mini",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello! How can I help?" },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

**Streaming response**: Returns a Vercel AI SDK data stream (SSE).

---

### list-models

```
GET /functions/v1/list-models
Authorization: Bearer <jwt_or_api_key>
```

**Response:**

```json
{
  "object": "list",
  "data": [
    { "id": "openai/gpt-4o", "object": "model", "created": 1710000000, "owned_by": "openai" },
    { "id": "anthropic/claude-sonnet-4", "object": "model", "created": 1710000000, "owned_by": "anthropic" }
  ]
}
```

---

### create-api-key

```
POST /functions/v1/create-api-key
Authorization: Bearer <jwt>
```

**Request body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | `"Default"` | Display name for the key |

**Response** (`201`):

```json
{
  "id": "uuid",
  "key": "lmt_a1b2c3d4e5f6...",
  "prefix": "lmt_a1b2c3d4",
  "name": "My App",
  "message": "Save this key — it will not be shown again."
}
```

---

### list-api-keys

```
GET /functions/v1/list-api-keys
Authorization: Bearer <jwt>
```

**Response:**

```json
{
  "keys": [
    {
      "id": "uuid",
      "prefix": "lmt_a1b2c3d4",
      "name": "My App",
      "created_at": "2025-01-01T00:00:00Z",
      "revoked_at": null
    }
  ]
}
```

---

### revoke-api-key

```
POST /functions/v1/revoke-api-key
Authorization: Bearer <jwt>
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `key_id` | string | UUID of the key to revoke |

**Response:**

```json
{ "success": true }
```

---

### create-checkout

Create a Stripe Checkout session for subscribing to a plan.

```
POST /functions/v1/create-checkout
Authorization: Bearer <jwt>
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `price_id` | string | Stripe Price ID from your Token Billing configuration |
| `success_url` | string | Redirect URL after successful checkout |
| `cancel_url` | string | Redirect URL if user cancels |

**Response:**

```json
{ "checkout_url": "https://checkout.stripe.com/c/pay/..." }
```

---

### billing-portal

Create a Stripe Billing Portal session for managing subscriptions.

```
POST /functions/v1/billing-portal
Authorization: Bearer <jwt>
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `return_url` | string | URL to redirect back to after portal |

**Response:**

```json
{ "portal_url": "https://billing.stripe.com/p/session/..." }
```

---

### get-usage

Query the customer's current Stripe balance (credit remaining or amount owed).

```
GET /functions/v1/get-usage
Authorization: Bearer <jwt_or_api_key>
```

**Response:**

```json
{
  "stripe_customer_id": "cus_xxx",
  "balance_cents": -500,
  "balance_display": "$5.00",
  "has_credit": true
}
```

- `balance_cents` negative = credit remaining
- `balance_cents` positive = amount owed
- `balance_cents` zero = no balance

---

### stripe-webhook

Handles incoming Stripe webhook events. **No auth required** (verified by Stripe signature).

```
POST /functions/v1/stripe-webhook
stripe-signature: <signature>
```

**Handled events:**

| Event | Action |
|-------|--------|
| `billing.alert.triggered` | Logs when customer credit is exhausted |
| `checkout.session.completed` | Logs successful purchase |
| `customer.subscription.created` | Auto-provisions Fly.io computer for Computer tier subscriptions |
| `customer.subscription.updated` | Auto-provisions Fly.io computer for Computer tier subscriptions |
| `customer.subscription.deleted` | Auto-destroys Fly.io computer for canceled Computer tier subscriptions |

---

### create-sso-code

Generate a single-use SSO authorization code for cross-domain authentication.

```
POST /functions/v1/create-sso-code
Authorization: Bearer <jwt>
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `redirect_uri` | string | URL to redirect back to after code exchange |
| `app` | string | Name of the requesting app (e.g. "studio") |

**Response** (`201`):

```json
{ "code": "random-code-string" }
```

---

### exchange-sso-code

Exchange a valid SSO code for a Supabase session. **No auth required.**

```
POST /functions/v1/exchange-sso-code
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | The SSO code received from `create-sso-code` |
| `redirect_uri` | string | Must match the original redirect URI |

**Response:**

```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

---

### list-spaces

List all non-destroyed spaces for the authenticated user.

```
GET /functions/v1/list-spaces
Authorization: Bearer <jwt>
```

**Response:**

```json
{ "spaces": [{ "id": "uuid", "slug": "my-space", "name": "My Space", "status": "running", ... }] }
```

---

### create-space

Create a new space and provision a Fly.io container.

```
POST /functions/v1/create-space
Authorization: Bearer <jwt>
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `slug` | string | URL-safe identifier (unique) |
| `description` | string | Optional description |
| `region` | string | Fly.io region (default: `iad`) |

**Response** (`201`): Space object with `status: "provisioning"`.

---

### get-space

Get a single space by slug. **No auth required** (public for running spaces).

```
GET /functions/v1/get-space?slug=my-space
```

**Response:** Space object.

---

### update-space

Update space metadata.

```
PATCH /functions/v1/update-space
Authorization: Bearer <jwt>
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Space UUID |
| `name` | string | Optional new name |
| `description` | string | Optional new description |
| `app_config` | object | Optional app configuration |
| `auth_enabled` | boolean | Optional auth toggle |
| `custom_domain` | string | Optional custom domain |

**Response:** Updated space object.

---

### start-space

Start a stopped space's Fly.io machine.

```
POST /functions/v1/start-space
Authorization: Bearer <jwt>
```

**Request body:** `{ "id": "space-uuid" }`

**Response:** `{ "success": true, "status": "running" }`

---

### stop-space

Stop a running space's Fly.io machine.

```
POST /functions/v1/stop-space
Authorization: Bearer <jwt>
```

**Request body:** `{ "id": "space-uuid" }`

**Response:** `{ "success": true, "status": "stopped" }`

---

### delete-space

Destroy a space's Fly.io resources and mark as destroyed.

```
POST /functions/v1/delete-space
Authorization: Bearer <jwt>
```

**Request body:** `{ "id": "space-uuid" }`

**Response:** `{ "success": true }`

---

### issue-space-token

Issue a short-lived access token (5-minute TTL) for an authenticated space connection.

```
POST /functions/v1/issue-space-token
Authorization: Bearer <jwt>
```

**Request body:** `{ "spaceId": "space-uuid" }`

**Response:**

```json
{ "token": "hmac-signed-token", "appHost": "lmt-space-slug-abc12345.fly.dev", "expiresAt": 1710000300 }
```

---

### provision-computer

Provision a personal THING agent runtime on Fly.io (one per user).

```
POST /functions/v1/provision-computer
Authorization: Bearer <jwt>
```

**Request body:**

| Field | Type | Description |
|-------|------|-------------|
| `region` | string | Fly.io region (default: `iad`) |

**Response** (`201`): Computer object with `status: "provisioning"`.

---

### issue-computer-token

Issue a short-lived access token (5-minute TTL) for computer access. Requires active Computer tier subscription.

```
POST /functions/v1/issue-computer-token
Authorization: Bearer <jwt>
```

**Response:**

```json
{ "token": "hmac-signed-token", "appHost": "lmt-computer-abc123456789.fly.dev", "expiresAt": 1710000300 }
```

---

## Authentication

Every Edge Function (except `stripe-webhook`) accepts one of two auth methods:

### JWT (Supabase Auth)

For browser/frontend clients. Obtained via Supabase Auth (GitHub OAuth through com/).

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### API Key

For programmatic/SDK access. Created via the `create-api-key` function. Keys are prefixed with `lmt_`.

```
Authorization: Bearer lmt_a1b2c3d4e5f6...
```

Both methods resolve to the same user and `stripe_customer_id`.

---

## Database Schema

Five tables across four migrations. Stripe handles all usage/billing data.

### `profiles` (001_initial.sql)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | References `auth.users(id)` |
| `email` | text | User's email |
| `display_name` | text | Optional display name |
| `stripe_customer_id` | text (unique) | Auto-created on first AI call |
| `github_repo` | text | User's private workspace repo (`owner/repo`), created during onboarding |
| `github_username` | text | GitHub username, set during onboarding |
| `created_at` | timestamptz | Auto-set |
| `updated_at` | timestamptz | Auto-set |

Auto-created via a Postgres trigger when a user signs up through Supabase Auth (GitHub OAuth). On first login, users complete onboarding which creates a private GitHub repo and stores it in `github_repo`.

### `api_keys` (001_initial.sql)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK) | References `auth.users(id)` |
| `key_hash` | text (unique) | SHA-256 hash of the raw key |
| `prefix` | text | First 12 chars for display (`lmt_a1b2c3d4`) |
| `name` | text | User-provided label |
| `created_at` | timestamptz | Auto-set |
| `revoked_at` | timestamptz | Set when key is revoked (soft delete) |

### `sso_codes` (002_sso_codes.sql)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK) | References `auth.users(id)` |
| `code` | text (unique) | Single-use authorization code |
| `redirect_uri` | text | Target app redirect URL |
| `app` | text | Requesting app name |
| `expires_at` | timestamptz | Code expiry (60s from creation) |
| `used_at` | timestamptz | Set when code is exchanged |
| `created_at` | timestamptz | Auto-set |

No direct user access — only service role can read/write.

### `spaces` (003_spaces.sql)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK) | References `auth.users(id)` |
| `slug` | text (unique) | URL-safe identifier |
| `name` | text | Display name |
| `description` | text | Optional |
| `fly_machine_id` | text (unique) | Fly.io machine ID |
| `fly_app_name` | text | Fly.io app name |
| `fly_volume_id` | text | Fly.io volume ID |
| `region` | text | Fly.io region (default: `iad`) |
| `status` | text | `created\|provisioning\|running\|stopped\|failed\|destroyed` |
| `app_config` | jsonb | Space app configuration |
| `auth_enabled` | boolean | Per-space auth toggle |
| `custom_domain` | text (unique) | Optional custom domain |
| `db_schema` | text | Per-space PostgreSQL schema name |
| `internal_key_id` | uuid (FK) | References `api_keys(id)` |
| `created_at` | timestamptz | Auto-set |
| `updated_at` | timestamptz | Auto-set |

RLS: owners can manage their own spaces; public can read running spaces.

### `computers` (004_computers.sql)

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (unique FK) | References `auth.users(id)` — one per user |
| `fly_machine_id` | text (unique) | Fly.io machine ID |
| `fly_app_name` | text | Fly.io app name |
| `fly_volume_id` | text | Fly.io volume ID |
| `region` | text | Fly.io region (default: `iad`) |
| `status` | text | `created\|provisioning\|running\|stopped\|failed\|destroyed` |
| `created_at` | timestamptz | Auto-set |
| `updated_at` | timestamptz | Auto-set |

All tables have Row Level Security enabled. Users can only access their own rows.

---

## Project Structure

```
cloud/
  package.json                              # Workspace package (scripts only)
  .env.example                              # Template for local secrets
  .gitignore
  README.md
  supabase/
    config.toml                             # Supabase project configuration
    migrations/
      001_initial.sql                       # profiles + api_keys tables, RLS, triggers
      002_sso_codes.sql                     # SSO authorization codes table
      003_spaces.sql                        # Spaces table (Fly.io metadata, config, RLS)
      004_computers.sql                     # Computers table (per-user Fly.io machines)
    functions/
      _shared/                              # Shared utilities (imported by all functions)
        auth.ts                             # JWT + API key verification
        cors.ts                             # CORS headers
        stripe.ts                           # Stripe client + customer helper
        supabase.ts                         # Supabase client factories
        provider.ts                         # LLM provider abstraction (Stripe/Ollama/OpenAI)
        container.ts                        # Fly.io container management (specs, tokens, app naming)
      generate-ai/index.ts                  # Core AI endpoint (streaming + non-streaming)
      list-models/index.ts                  # Available models list
      create-api-key/index.ts               # Generate new API key
      list-api-keys/index.ts                # List user's keys
      revoke-api-key/index.ts               # Revoke (soft-delete) a key
      create-checkout/index.ts              # Stripe Checkout session
      billing-portal/index.ts               # Stripe Customer Portal
      get-usage/index.ts                    # Query Stripe balance
      stripe-webhook/index.ts               # Stripe webhook handler (+ computer provisioning)
      create-sso-code/index.ts              # Generate SSO authorization code
      exchange-sso-code/index.ts            # Exchange SSO code for session
      list-spaces/index.ts                  # List user's spaces
      create-space/index.ts                 # Create + provision Fly.io space
      get-space/index.ts                    # Get space by slug (public)
      update-space/index.ts                 # Update space metadata
      start-space/index.ts                  # Start space's Fly.io machine
      stop-space/index.ts                   # Stop space's Fly.io machine
      delete-space/index.ts                 # Destroy space resources
      issue-space-token/index.ts            # Issue short-lived space access token
      provision-computer/index.ts           # Provision Fly.io computer machine
      issue-computer-token/index.ts         # Issue short-lived computer access token
```

---

## Supported Models

All models are accessed through Stripe's proxy at `llm.stripe.com`. Use the `provider/model` format.

### OpenAI

| Model ID | Description |
|----------|-------------|
| `openai/gpt-4o` | GPT-4o (latest) |
| `openai/gpt-4o-mini` | GPT-4o Mini (fast, cheap) |
| `openai/gpt-4.1` | GPT-4.1 |
| `openai/gpt-4.1-mini` | GPT-4.1 Mini |
| `openai/o3` | o3 reasoning model |
| `openai/o3-mini` | o3 Mini |

### Anthropic

| Model ID | Description |
|----------|-------------|
| `anthropic/claude-opus-4` | Claude Opus 4 (most capable) |
| `anthropic/claude-sonnet-4` | Claude Sonnet 4 (balanced) |
| `anthropic/claude-3-5-haiku` | Claude 3.5 Haiku (fast) |

### Google

| Model ID | Description |
|----------|-------------|
| `google/gemini-2.5-pro` | Gemini 2.5 Pro |
| `google/gemini-2.5-flash` | Gemini 2.5 Flash (fast) |

> Stripe automatically keeps model pricing up to date. New models are added as providers release them.

---

## How Billing Works

### The Flow

1. **User signs up** via Supabase Auth. A `profiles` row is auto-created.
2. **First AI call**: The `generate-ai` function checks if the user has a `stripe_customer_id`. If not, it creates a Stripe Customer and saves the ID.
3. **Every AI call**: `@stripe/ai-sdk`'s `createStripe()` is initialized with the customer's Stripe ID. When the LLM responds, Stripe automatically sends **meter events** recording the token usage:
   ```json
   { "event_name": "token-billing-tokens", "payload": { "stripe_customer_id": "cus_xxx", "value": "150", "model": "openai/gpt-4o-mini", "token_type": "input" } }
   { "event_name": "token-billing-tokens", "payload": { "stripe_customer_id": "cus_xxx", "value": "42", "model": "openai/gpt-4o-mini", "token_type": "output" } }
   ```
4. **Stripe bills the customer** based on your configured pricing model (prepaid credits, subscription, pay-as-you-go, or hybrid).

### What you DON'T manage

- Token counting (Stripe does it)
- Usage tables (Stripe meter events)
- Provider API keys (Stripe's proxy authenticates with providers)
- Price updates (Stripe tracks provider pricing automatically)

### What you DO manage

- User authentication (Supabase Auth)
- API key issuance (your Edge Functions)
- Checkout and portal flows (your Edge Functions + Stripe Checkout)
- Webhook handling (your Edge Functions)

---

## Troubleshooting

### "Missing or invalid Authorization header"

Every request (except `stripe-webhook`) requires a `Bearer` token. Ensure you're sending:
```
Authorization: Bearer <supabase_jwt_or_lmt_api_key>
```

### "Invalid or expired token"

Supabase JWTs expire after 1 hour by default. Use `supabase.auth.refreshSession()` or the Supabase client's auto-refresh feature.

### "Invalid API key"

The API key may have been revoked, or you may be using an incorrect key. List your active keys with `list-api-keys`.

### Stripe webhook returns 400

- Verify the `STRIPE_WEBHOOK_SECRET` matches the signing secret from your Stripe Dashboard.
- Ensure the `stripe-webhook` function is deployed with `--no-verify-jwt`.
- Check that the webhook URL in Stripe points to the correct function URL.

### Edge Function timeout

Supabase Edge Functions have a default timeout of 60 seconds. For long-running LLM calls, streaming (`"stream": true`) is strongly recommended — it starts returning data immediately.

### "No billing account. Subscribe to a plan first."

The `billing-portal` function requires the user to have a `stripe_customer_id`. This is auto-created on the first `generate-ai` call or `create-checkout` call. If the user has never made an AI call or subscribed, they won't have one yet.

### CORS errors from the browser

All functions include CORS headers allowing any origin. If you still see CORS errors, ensure your request includes the correct `Content-Type` header and that the preflight `OPTIONS` request is reaching the function.

### Local development: functions can't reach Stripe

Ensure your `.env` file has valid Stripe keys and is passed to the serve command:
```bash
pnpx supabase functions serve --env-file .env
```
