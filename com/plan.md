# Plan: lmthing.com as Central OAuth Provider & Billing Hub

## Context

`com/` (lmthing.com) is currently a placeholder SPA with stub routes. This plan transforms it into the centralized authentication and billing surface for all lmthing.* domains. The motivation: every lmthing.* app needs auth and billing, and centralizing these in `com/` avoids duplicating login/signup flows across 10+ SPAs.

**Constraints:**
- `cloud/` remains the sole backend (Supabase Edge Functions)
- Supabase Auth is the identity layer (email/password, GitHub OAuth)
- Studio's BYOK mode is preserved as an offline fallback
- Cross-domain SSO uses redirect-based token exchange (different TLDs can't share cookies)

---

## 1. Auth Pages in com/

New routes in `com/src/routes/`:

| Route | Purpose |
|-------|---------|
| `/login` | Email/password sign in + GitHub OAuth button |
| `/signup` | Registration + GitHub OAuth button |
| `/forgot-password` | Request password reset email |
| `/reset-password` | Set new password (from email link) |
| `/callback` | OAuth callback handler (Supabase redirects here) |
| `/auth/sso` | Cross-domain SSO endpoint (see section 3) |

**Supabase client setup:**
- `com/src/lib/supabase.ts` — singleton `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`
- `com/src/lib/auth/AuthProvider.tsx` — React context wrapping `supabase.auth.onAuthStateChange()`, exposes `user`, `session`, `signIn()`, `signUp()`, `signOut()`, `signInWithGitHub()`
- `com/src/routes/__root.tsx` — wrap Outlet with AuthProvider, add nav bar with login/account controls

**Add dependency:** `@supabase/supabase-js` to `com/package.json`

---

## 2. Billing Hub

### Pricing (`/pricing`)
Replace stub with real pricing page. Plan metadata (names, features, Stripe price IDs) in `com/src/config/plans.ts`. Subscribe CTA flow:
- Not logged in → redirect to `/signup?redirect=/pricing&plan={id}`
- Logged in → call `cloud/create-checkout` with `price_id`, redirect to Stripe Checkout URL

### Account & Billing Pages

| Route | Purpose | Cloud Endpoints Used |
|-------|---------|---------------------|
| `/account` | Profile settings (name, email, password) | Supabase Auth |
| `/account/keys` | API key management (list, create, revoke) | `list-api-keys`, `create-api-key`, `revoke-api-key` |
| `/billing` | Subscription status, "Manage" → Stripe Portal | `billing-portal` |
| `/billing/usage` | Token usage dashboard | `get-usage` |

### Route Protection
`/account/*` and `/billing/*` are protected (redirect to `/login` if unauthenticated). Use TanStack Router `beforeLoad` guard.

---

## 3. Cross-Domain SSO Flow

Since lmthing.* domains are different TLDs, SSO uses a redirect-based auth code exchange:

```
1. User visits studio.local, clicks "Sign in"
2. Studio redirects to:
     com.local/auth/sso?redirect_uri=https://studio.local/auth/callback
                       &app=studio&state={random_nonce}
3. com/ checks for active Supabase session:
   - YES → generates single-use auth code via cloud/create-sso-code,
           redirects back: studio.local/auth/callback?code={code}&state={nonce}
   - NO  → redirects to com/login?next=/auth/sso&... (user logs in, then continues)
4. Studio receives code, calls cloud/exchange-sso-code → gets access_token + refresh_token
5. Studio stores session, user is authenticated
```

**Security:** Auth codes are single-use, expire in 60s, stored in `sso_codes` table. `redirect_uri` validated against whitelist. `state` parameter prevents CSRF.

### New Cloud Edge Functions

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `create-sso-code` | POST | JWT | Generate short-lived SSO auth code for authenticated user |
| `exchange-sso-code` | POST | None | Exchange auth code for Supabase session tokens |

### New Database Table

```sql
create table public.sso_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  redirect_uri text not null,
  app text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_sso_codes_code on public.sso_codes(code) where used_at is null;
```

### Shared Auth Client: `@lmthing/auth`

New package in `org/libs/auth/` that any app can import:
- `redirectToLogin()` — builds SSO redirect URL to `com/auth/sso`
- `handleAuthCallback()` — extracts code, verifies state, calls `exchange-sso-code`
- `useAuth()` — React hook with reactive session state
- `AuthProvider` — context provider managing session lifecycle
- `getAuthHeaders()` — returns `{ Authorization: "Bearer <token>" }` for cloud API calls

---

## 4. Implementation Steps

### Step 1: Supabase Client + AuthProvider
1. Add `@supabase/supabase-js` to `com/package.json`
2. Create `com/src/lib/supabase.ts` — singleton client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Create `com/src/lib/auth/AuthProvider.tsx` — React context with `onAuthStateChange()`, exposes `user`, `session`, auth methods
4. Update `com/src/routes/__root.tsx` — wrap Outlet with AuthProvider, add nav bar with login/account controls

### Step 2: Auth Pages
5. Create `com/src/routes/login.tsx` — email/password form + GitHub OAuth button + link to signup
6. Create `com/src/routes/signup.tsx` — registration form + GitHub OAuth button
7. Create `com/src/routes/forgot-password.tsx` — password reset request form
8. Create `com/src/routes/reset-password.tsx` — new password form (handles Supabase `type=recovery` token)
9. Create `com/src/routes/callback.tsx` — OAuth callback handler (exchanges Supabase auth code)

### Step 3: Billing Pages
10. Create `com/src/config/plans.ts` — plan metadata (names, features, Stripe price IDs)
11. Rewrite `com/src/routes/pricing.tsx` — plan comparison with subscribe CTAs (calls `cloud/create-checkout`)
12. Create `com/src/routes/account.tsx` — profile settings (display name, email, password change)
13. Create `com/src/routes/account/keys.tsx` — API key management (list, create, revoke via cloud endpoints)
14. Create `com/src/routes/billing.tsx` — subscription status, "Manage" button (calls `cloud/billing-portal`)
15. Create `com/src/routes/billing/usage.tsx` — token usage dashboard (calls `cloud/get-usage`)

### Step 4: Cross-Domain SSO — Cloud Infrastructure
16. Create `cloud/supabase/migrations/002_sso_codes.sql` — `sso_codes` table with code, user_id, redirect_uri, expires_at
17. Create `cloud/supabase/functions/create-sso-code/index.ts` — JWT-authenticated, generates single-use 60s auth code
18. Create `cloud/supabase/functions/exchange-sso-code/index.ts` — unauthenticated, validates code + redirect_uri whitelist, returns Supabase session tokens

### Step 5: Cross-Domain SSO — com/ Handler
19. Create `com/src/routes/auth/sso.tsx` — checks active session, calls `create-sso-code`, redirects back to requesting app with code + state

### Step 6: Shared Auth Client Library
20. Create `org/libs/auth/` package with `package.json` (`@lmthing/auth`)
21. Implement `redirectToLogin()`, `handleAuthCallback()`, `useAuth()`, `AuthProvider`, `getAuthHeaders()`, `clearSession()`
22. Add to `pnpm-workspace.yaml` if not already covered by glob

---

## 5. Final Route Tree

```
com/src/routes/
├── __root.tsx              # AuthProvider, nav bar, footer
├── index.tsx               # Landing page
├── about.tsx               # About
├── docs.tsx                # Docs
├── pricing.tsx             # Plan comparison + subscribe CTAs
├── login.tsx               # Sign in
├── signup.tsx              # Registration
├── forgot-password.tsx     # Password reset request
├── reset-password.tsx      # Password reset form
├── callback.tsx            # OAuth callback (Supabase redirect)
├── auth/
│   └── sso.tsx             # Cross-domain SSO handler
├── account.tsx             # Profile settings
├── account/
│   └── keys.tsx            # API key management
├── billing.tsx             # Subscription status
└── billing/
    └── usage.tsx           # Usage dashboard
```

---

## 6. Key Files to Modify/Create

**com/ (new files):**
- `com/src/lib/supabase.ts`
- `com/src/lib/auth/AuthProvider.tsx`
- `com/src/config/plans.ts`
- All new route files listed above

**com/ (modify):**
- `com/package.json` — add `@supabase/supabase-js`
- `com/src/routes/__root.tsx` — add AuthProvider, navigation

**cloud/ (new):**
- `cloud/supabase/functions/create-sso-code/index.ts`
- `cloud/supabase/functions/exchange-sso-code/index.ts`
- `cloud/supabase/migrations/002_sso_codes.sql`

**org/libs/ (new package):**
- `org/libs/auth/` — `@lmthing/auth` shared auth client

---

## 7. Verification

- **Auth flow:** Sign up at `com.local/signup`, verify email, log in, confirm session persists across page refreshes
- **Billing flow:** Click subscribe on `/pricing`, complete Stripe test checkout, verify subscription shows on `/billing`
- **API keys:** Create/list/revoke keys on `/account/keys`, verify they work against `cloud/generate-ai`
- **SSO flow:** Visit `com.local/auth/sso?redirect_uri=http://studio.local/auth/callback&app=studio&state=test`, verify it generates a code and redirects correctly

---

## 8. Out of Scope (Future Plans)

These are deferred to separate plans:
- **Studio SSO integration:** Adding `@lmthing/auth` to studio, `/auth/callback` route, "Sign in with lmthing" button alongside BYOK
- **Other app SSO rollout:** chat, blog, space, social, team, store, casa, computer
- **PKCE for SSO:** Adding code_verifier/code_challenge for additional security
- **Additional OAuth providers:** Google OAuth, magic link
- **Enhanced usage endpoint:** Per-model, per-day token breakdown in `cloud/get-usage`
