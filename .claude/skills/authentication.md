# Authentication

## Overview

Authentication is handled through **com/** (the central auth hub) which talks to the **cloud gateway API**. com/ has its own login/signup UI and uses the cloud gateway's auth routes (which proxy Supabase Auth). Other lmthing.\* apps use cross-domain SSO via com/.

**Auth providers**: Email/password, GitHub OAuth, and Google OAuth (all via Supabase Auth, proxied through the gateway).

## Auth Flows

### Direct auth (com/)

1. User visits com/ and signs up or logs in via `/api/auth/register`, `/api/auth/login`, or OAuth
2. OAuth flow: gateway returns Supabase OAuth URL, user authenticates, Supabase redirects to com/callback with tokens in hash fragment
3. com/callback stores JWT + refresh token, calls `/api/auth/provision` to create LiteLLM user + Stripe customer + API key
4. Token refresh handled automatically via `cloudFetch()` in `com/src/lib/cloud.ts`

### Cross-domain SSO (other apps via `@lmthing/auth`)

1. App detects no session and redirects to `com/auth/sso`
2. com/ checks for active session (redirects to `/login` if none)
3. com/ calls `/api/auth/sso/create` to generate a single-use auth code (60s TTL)
4. Redirects back to the app with `?code=...&state=...`
5. App exchanges the code for a session via `/api/auth/sso/exchange`

### Backend auth

- **Supabase JWT** (browser) — verified by gateway middleware (`gateway/src/middleware/auth.ts`)
- **LiteLLM API key** (`sk-*`) — verified by LiteLLM directly

## Gateway Auth Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/register` | POST | Public | Register, returns API key |
| `/api/auth/login` | POST | Public | Login, returns JWT + refresh token |
| `/api/auth/oauth/url` | GET | Public | Get Supabase OAuth URL (GitHub/Google) |
| `/api/auth/oauth/callback` | GET | Public | OAuth callback (Supabase redirect) |
| `/api/auth/provision` | POST | JWT | Provision LiteLLM user + Stripe customer |
| `/api/auth/refresh` | POST | Public | Refresh access token |
| `/api/auth/me` | GET | JWT | User info + tier |
| `/api/auth/sso/create` | POST | JWT | Generate SSO authorization code |
| `/api/auth/sso/exchange` | POST | Public | Exchange SSO code for session |

## Key Files

| File | Purpose |
|------|---------|
| `com/src/lib/cloud.ts` | JWT + refresh token management, `cloudFetch()` |
| `org/libs/auth/src/` | `@lmthing/auth` — cross-domain SSO client library |
| `cloud/gateway/src/routes/auth.ts` | Auth route handlers |
| `cloud/gateway/src/middleware/auth.ts` | JWT verification middleware |

## Integrating Auth in a New Service

### 1. Add the dependency

```bash
cd your-app/
pnpm add "@lmthing/auth@workspace:*"
```

### 2. Wrap your app with AuthProvider

```tsx
// src/routes/__root.tsx (or equivalent entry point)
import { AuthProvider, useAuth } from "@lmthing/auth";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  return <>{children}</>;
}

function RootComponent() {
  return (
    <AuthProvider appName="your-app-name">
      <AuthGate>
        <Outlet />
      </AuthGate>
    </AuthProvider>
  );
}
```

### 3. Use useAuth() anywhere in your app

```tsx
const { username, isAuthenticated, isLoading, login, logout } = useAuth();
```

- `login()` — redirects to com/ for SSO login
- `logout()` — clears the local session
- `username` — the user's email
- `session.accessToken` — JWT for calling cloud functions

### 4. Ensure the Vite alias is registered

In `org/libs/utils/src/vite.mjs`:

```js
'@lmthing/auth': path.resolve(dirname, '../org/libs/auth/src'),
```

### 5. Environment variables (optional)

Defaults are auto-resolved. Override if needed:

```
VITE_COM_URL=https://com.local       # defaults: com.local (dev) / lmthing.com (prod)
VITE_CLOUD_URL=https://cloud.local   # defaults: cloud.local (dev) / lmthing.cloud (prod)
```
