---
title: Authentication
description: Cross-domain SSO flow, GitHub/Google OAuth, JWT and API key auth, session management
order: 3
---

# Authentication Patterns

Authentication in lmthing uses a centralized model — `com/` is the auth hub with its own login/signup UI, while other apps use cross-domain SSO via `com/`. All auth goes through the cloud gateway API (which proxies Supabase Auth).

## com/ Direct Auth Flow

`com/` has its own login/signup UI and talks directly to the cloud gateway:

```
1. User signs up: POST /api/auth/register → returns user_id + API key
2. User logs in: POST /api/auth/login → returns JWT + refresh token
3. OAuth: GET /api/auth/oauth/url → Supabase OAuth URL → user authenticates
   → Supabase redirects to com/callback with tokens in hash fragment
   → com/callback stores tokens, calls POST /api/auth/provision
   → provision creates LiteLLM user + Stripe customer + API key (idempotent)
4. Token refresh: POST /api/auth/refresh (automatic via cloudFetch)
```

Auth state is managed by `com/src/lib/cloud.ts` (token storage, refresh) and `com/src/lib/auth/AuthProvider.tsx` (React context).

## Cross-Domain SSO Flow

Other lmthing.* apps redirect to `com/` for authentication:

```
1. App detects no session → redirect to com/auth/sso?app=studio&redirect_uri=...&state=...
2. com/ checks for active session (redirects to /login if none)
3. com/ calls /api/auth/sso/create → gets single-use code (60s TTL)
4. com/ redirects back: app.local/?code=<code>&state=<state>
5. App calls /api/auth/sso/exchange → gets session (accessToken, user info)
6. App stores session in localStorage
```

## Frontend Auth Integration

### Setup (for apps other than com/)

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
// session.accessToken → JWT for cloud API calls
```

### Calling Cloud API

```typescript
const response = await fetch('https://lmthing.cloud/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  },
})
```

### Calling LLM API

```typescript
const response = await fetch('https://lmthing.cloud/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,  // LiteLLM API key (sk-...)
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model, messages, tools }),
})
```

## Backend Auth

The gateway middleware (`cloud/gateway/src/middleware/auth.ts`) verifies Supabase JWTs:

```typescript
import { authMiddleware } from '../middleware/auth.js'

app.use('/*', authMiddleware)
// c.get('user') → { id, email }
```

### Two Auth Methods

1. **JWT (Browser sessions)**: `Authorization: Bearer <supabase-jwt>`
   - Verified via `supabase.auth.getUser()` in gateway middleware
   - Used for gateway API calls (`/api/*`)

2. **API Key (SDK/CLI)**: `Authorization: Bearer sk-<key>`
   - LiteLLM API key, verified by LiteLLM directly
   - Used for LLM API calls (`/v1/*`)

### Public Endpoints (No Auth)

- `POST /api/auth/register` — registration
- `POST /api/auth/login` — login
- `GET /api/auth/oauth/url` — OAuth URL
- `POST /api/auth/refresh` — token refresh
- `POST /api/auth/sso/exchange` — SSO code exchange
- `POST /api/stripe/webhook` — uses Stripe signature verification

## Session Storage

- **com/**: JWT + refresh token + expiry in localStorage (via `cloud.ts`)
- **Other apps**: Session object in localStorage (via `@lmthing/auth` client)
- **No cookies**: All auth is token-based via `Authorization` header
- **Refresh**: com/ handles automatic token refresh; other apps get long-lived SSO sessions

## OAuth Providers

- **GitHub OAuth**: Configured in Supabase dashboard with `repo` scope for workspace repo access
- **Google OAuth**: Configured in Supabase dashboard

## Adding Auth to a New App

1. Add dependency: `pnpm add @lmthing/auth@workspace:*`
2. Wrap root with `AuthProvider appName="your-app"`
3. Add `AuthGate` component to require login
4. Ensure Vite alias in `org/libs/utils/src/vite.mjs`
5. Optional env vars: `VITE_COM_URL`, `VITE_CLOUD_URL` (defaults auto-resolve by environment)
