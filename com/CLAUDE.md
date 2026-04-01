# com/ — lmthing.com

Central auth hub and billing surface for all lmthing.* domains.

## What This Is

`com/` is the commercial landing page and the centralized authentication + billing surface. All lmthing.* apps redirect here for login/signup and cross-domain SSO. It is a static SPA — all server-side logic lives in the `cloud/` gateway API.

## Stack

- React 19 + Vite 7 + TanStack Router (file-based routing)
- Tailwind CSS v4 via `@tailwindcss/vite`
- Cloud gateway API for auth (Supabase Auth proxied through gateway — email/password + GitHub + Google OAuth)
- Shared libs: `@lmthing/ui`, `@lmthing/css`, `@lmthing/state`, `lmthing`
- Vite config uses shared `createViteConfig` from `@lmthing/utils/vite`

## Running Locally

```bash
cd com && pnpm dev    # http://localhost:3002 / com.test
```

Requires `VITE_CLOUD_URL` env var (defaults to `https://lmthing.cloud`).

## Route Structure

```
src/routes/
├── __root.tsx              # AuthProvider wrapper, nav bar
├── index.tsx               # Landing page
├── about.tsx               # About page
├── docs.tsx                # Documentation
├── pricing.tsx             # Plan comparison + subscribe CTAs (5 tiers: Free/Starter/Basic/Pro/Max)
├── login.tsx               # Email/password + GitHub/Google OAuth
├── signup.tsx              # Registration
├── forgot-password.tsx     # Password reset request
├── reset-password.tsx      # Set new password (from email link)
├── callback.tsx            # OAuth callback (extracts tokens from Supabase hash redirect)
├── checkout.tsx            # Stripe Embedded Checkout (uses @stripe/react-stripe-js EmbeddedCheckoutProvider)
├── onboarding.tsx          # Post-signup onboarding (repo name setup + PIN creation)
├── auth/
│   └── sso.tsx             # Cross-domain SSO handler
├── account.tsx             # Profile settings (protected)
├── account/
│   └── keys.tsx            # API key management (protected)
├── billing.tsx             # Subscription status (protected)
└── billing/
    └── usage.tsx           # Token usage dashboard (protected)
```

## Key Modules

- **`src/lib/cloud.ts`** — API client for the cloud gateway. Handles JWT storage, automatic token refresh, and typed wrappers for all API calls (`login`, `register`, `getOAuthUrl`, `provision`, `getMe`, `createSsoCode`, `exchangeSsoCode`, `listApiKeys`, `createApiKey`, `revokeApiKey`, `createCheckout`, `getCheckoutStatus`, `billingPortal`, `getUsage`). Uses `cloudFetch()` (authenticated) and `cloudFetchPublic()` (unauthenticated).
- **`src/lib/auth/AuthProvider.tsx`** — React context with `useAuth()` hook. Exposes `user`, `loading`, `signIn`, `signUp`, `signOut`, `signInWithGitHub`, `signInWithGoogle`, `setSessionFromOAuth`. Uses cloud.ts for all API calls (no direct Supabase client).
- **`src/config/plans.ts`** — Plan metadata for 5 tiers (Free / Starter / Basic / Pro / Max) with pricing, budget, and rate limit info.

## Auth Flow

**Direct login/signup** (on com/ itself):
1. User registers via `/api/auth/register` or logs in via `/api/auth/login` → receives JWT + refresh token
2. OAuth: gateway returns Supabase OAuth URL → user authenticates on GitHub/Google → Supabase redirects to `/callback` with tokens in URL hash
3. `/callback` stores tokens, calls `/api/auth/provision` to create LiteLLM user + Stripe customer + API key (idempotent)
4. Token refresh handled automatically by `cloudFetch()` when JWT expires

**Cross-domain SSO** (other apps redirecting to com/):
1. Other apps redirect to `/auth/sso?redirect_uri=...&app=...&state=...`
2. Checks for active session (redirects to `/login` if none)
3. Calls `/api/auth/sso/create` to generate a single-use auth code (60s TTL)
4. Redirects back to the requesting app with `?code=...&state=...`

## Cloud API Endpoints Used

| Endpoint | Used By |
|----------|---------|
| `POST /api/auth/register` | `/signup` — User registration |
| `POST /api/auth/login` | `/login` — Email/password login |
| `GET /api/auth/oauth/url` | `/login`, `/signup` — OAuth redirect URL |
| `POST /api/auth/provision` | `/callback` — Provision LiteLLM + Stripe |
| `POST /api/auth/refresh` | `cloudFetch()` — Automatic token refresh |
| `GET /api/auth/me` | `AuthProvider` — Get current user info |
| `POST /api/auth/sso/create` | `/auth/sso` — Generate SSO code |
| `POST /api/auth/sso/exchange` | Used by other apps via `@lmthing/auth` |
| `POST /api/billing/checkout` | `/checkout` — Stripe Embedded Checkout session |
| `GET /api/billing/checkout/status` | `/checkout` — Poll checkout session status |
| `POST /api/billing/portal` | `/billing` — Stripe billing portal |
| `GET /api/billing/usage` | `/billing/usage` — Token budget usage |
| `GET /api/keys` | `/account/keys` — List API keys |
| `POST /api/keys` | `/account/keys` — Create API key |
| `DELETE /api/keys/:token` | `/account/keys` — Revoke API key |

## Protected Routes

`/account/*` and `/billing/*` require authentication. Unauthenticated users are redirected to `/login`.

## Adding or Modifying Tiers

The pricing page (`/pricing`) renders plans from `src/config/plans.ts`. This is only the frontend display — the actual tier logic lives in `cloud/gateway/src/lib/tiers.ts`. When adding a new tier, both files must be updated along with ~8 other files across the monorepo. See root `CLAUDE.md` § "Adding a New Tier" for the full checklist.

## Notes

- The login page supports a `?redirect=` query param for post-login navigation (used by SSO and pricing flows)
- No direct Supabase client — all auth goes through the cloud gateway API (`src/lib/cloud.ts`)
- OAuth callback extracts tokens from Supabase implicit grant hash fragment (`#access_token=...&refresh_token=...&expires_at=...`)
