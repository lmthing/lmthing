# com/ — lmthing.com

Central OAuth provider and billing hub for all lmthing.* domains.

## What This Is

`com/` is the commercial landing page and the centralized authentication + billing surface. All lmthing.* apps redirect here for login/signup and cross-domain SSO. It is a static SPA — all server-side logic lives in `cloud/` edge functions.

## Stack

- React 19 + Vite 7 + TanStack Router (file-based routing)
- Tailwind CSS v4 via `@tailwindcss/vite`
- Supabase Auth (email/password + GitHub OAuth)
- Shared libs: `@lmthing/ui`, `@lmthing/css`, `@lmthing/state`, `lmthing`
- Vite config uses shared `createViteConfig` from `@lmthing/utils/vite`

## Running Locally

```bash
cd com && pnpm dev    # http://localhost:3002 / com.local
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars. Cloud URL defaults to `http://localhost:54321/functions/v1`.

## Route Structure

```
src/routes/
├── __root.tsx              # AuthProvider wrapper, nav bar
├── index.tsx               # Landing page
├── about.tsx               # About page
├── docs.tsx                # Documentation
├── pricing.tsx             # Plan comparison + subscribe CTAs
├── login.tsx               # Email/password + GitHub OAuth
├── signup.tsx              # Registration
├── forgot-password.tsx     # Password reset request
├── reset-password.tsx      # Set new password (from email link)
├── callback.tsx            # OAuth callback (Supabase redirect)
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

- **`src/lib/supabase.ts`** — Singleton Supabase client
- **`src/lib/auth/AuthProvider.tsx`** — React context with `useAuth()` hook. Exposes `user`, `session`, `signIn`, `signUp`, `signOut`, `signInWithGitHub`, `resetPassword`, `updatePassword`
- **`src/lib/cloud.ts`** — Typed wrappers for cloud edge function calls (`createCheckout`, `billingPortal`, `getUsage`, `listApiKeys`, `createApiKey`, `revokeApiKey`, `createSsoCode`). All calls attach the Supabase JWT automatically
- **`src/config/plans.ts`** — Plan metadata (Free / Pro / Team) with Stripe price IDs

## Cross-Domain SSO Flow

Other lmthing.* apps redirect to `/auth/sso?redirect_uri=...&app=...&state=...`. The handler:
1. Checks for active Supabase session (redirects to `/login` if none)
2. Calls `cloud/create-sso-code` to generate a single-use auth code (60s TTL)
3. Redirects back to the requesting app with `?code=...&state=...`

## Cloud Endpoints Used

| Endpoint | Used By |
|----------|---------|
| `create-checkout` | `/pricing` — Stripe checkout session |
| `billing-portal` | `/billing` — Stripe customer portal |
| `get-usage` | `/billing/usage` — Token usage |
| `list-api-keys` | `/account/keys` — List keys |
| `create-api-key` | `/account/keys` — Generate key |
| `revoke-api-key` | `/account/keys` — Revoke key |
| `create-sso-code` | `/auth/sso` — Cross-domain SSO |

## Protected Routes

`/account/*` and `/billing/*` require authentication. Unauthenticated users are redirected to `/login`.

## Notes

- The login page supports a `?redirect=` query param for post-login navigation (used by SSO and pricing flows)
- Plan price IDs in `plans.ts` are placeholders (`price_pro`, `price_team`) — replace with real Stripe price IDs for production
