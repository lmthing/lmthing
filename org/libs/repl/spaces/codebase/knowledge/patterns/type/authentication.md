---
title: Authentication
description: Cross-domain SSO flow, GitHub OAuth, JWT and API key auth, session management
order: 3
---

# Authentication Patterns

Authentication in lmthing uses a centralized SSO model — all apps authenticate through `com/` (the auth hub), and backend calls use either JWT or API key auth.

## SSO Flow

No app has its own login UI. All authentication redirects through `com/`:

```
1. App detects no session → redirect to com/auth/sso?app=studio&redirect=...
2. com/ authenticates via GitHub OAuth (Supabase Auth, repo scope)
3. com/ checks onboarding status (has github_repo in profile?)
   → If not onboarded: redirect to /onboarding (creates private GitHub repo)
4. com/ calls cloud/create-sso-code → gets single-use code (60s TTL)
5. com/ redirects back: app.local/auth/callback?code=<code>&state=<state>
6. App calls cloud/exchange-sso-code → gets Supabase session
7. App stores session in localStorage (encrypted)
```

## Frontend Auth Integration

### Setup

```tsx
// src/routes/__root.tsx
import { AuthProvider, useAuth } from '@lmthing/auth'

function RootComponent() {
  return (
    <AuthProvider appName="studio">
      <AuthGate>
        <Outlet />
      </AuthGate>
    </AuthProvider>
  )
}

function AuthGate({ children }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <LoginScreen />
  return <>{children}</>
}
```

### Using Auth

```tsx
const { username, isAuthenticated, isLoading, login, logout, session } = useAuth()

// login() → redirects to com/ for SSO
// logout() → clears local session
// session.accessToken → JWT for cloud function calls
```

### Calling Cloud Functions

```typescript
const response = await fetch('https://cloud.local/functions/v1/generate-ai', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model, messages, tools }),
})
```

## Backend Auth

Every edge function (except public endpoints) uses `_shared/auth.ts`:

```typescript
import { authenticate } from '../_shared/auth.ts'

const { userId, stripeCustomerId } = await authenticate(req)
```

### Two Auth Methods

1. **JWT (Browser sessions)**: `Authorization: Bearer <supabase-jwt>`
   - Verified against Supabase's JWT secret
   - Contains `sub` (user ID) and custom claims

2. **API Key (SDK/CLI)**: `Authorization: Bearer lmt_<key>`
   - SHA-256 hashed and looked up in `api_keys` table
   - Returns associated `user_id` and `stripe_customer_id`

Both resolve to the same `{ userId, stripeCustomerId }` shape.

### Public Endpoints (No Auth)

Two endpoints skip authentication:
- `stripe-webhook` — uses Stripe signature verification instead
- `exchange-sso-code` — the SSO code itself is the credential

## Session Storage

- **localStorage**: Encrypted Supabase session (access token, refresh token, expiry)
- **No cookies**: All auth is token-based via `Authorization` header
- **Refresh**: Supabase client auto-refreshes expired tokens using the refresh token

## GitHub OAuth Scope

The OAuth app requests `repo` scope because:
- Users need to read/write their private workspace repo
- The onboarding flow creates a new private repo via GitHub API
- Workspace sync (push/pull) requires repo access

## Adding Auth to a New App

1. Add dependency: `pnpm add @lmthing/auth@workspace:*`
2. Wrap root with `AuthProvider appName="your-app"`
3. Add `AuthGate` component to require login
4. Ensure Vite alias in `org/libs/utils/src/vite.mjs`
5. Optional env vars: `VITE_COM_URL`, `VITE_CLOUD_URL` (defaults auto-resolve by environment)
