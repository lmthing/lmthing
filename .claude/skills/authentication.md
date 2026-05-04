# Authentication

## Overview

Authentication is handled through **com/** (the central auth hub) which talks to the **cloud gateway API**. com/ has its own login/signup UI. Other lmthing.\* apps use cross-domain SSO via com/.

**Identity provider**: [Zitadel](https://auth.lmthing.cloud) — stores users, handles GitHub OAuth (via IDP Intent API), and verifies passwords.

**Token issuer**: The **gateway itself** — issues HS256 JWTs signed with `GATEWAY_JWT_SECRET`. Clients never hold Zitadel tokens.

**Auth providers**: Email/password and GitHub OAuth (GitHub-only OAuth flow, no Zitadel login UI shown to users).

## Auth Flows

### Email/password login (com/)

1. User submits email + password to `POST /api/auth/login`
2. Gateway verifies credentials via Zitadel password grant
3. Gateway looks up user ID by email (`getUserByEmail`)
4. Gateway calls `signTokens(userId, email)` → returns gateway JWT (`access_token` 12h) + `refresh_token` (30d)
5. com/ stores tokens, calls `/api/auth/provision` to create LiteLLM user + Stripe customer + API key

### GitHub OAuth (IDP Intent flow)

1. com/ calls `GET /api/auth/oauth/url?redirect_to=...`
2. Gateway calls Zitadel `POST /v2/idp_intents` with the GitHub IDP ID → returns a GitHub OAuth URL directly (no Zitadel UI)
3. User authenticates on GitHub
4. GitHub → Zitadel → `GET /api/auth/oauth/callback?id=...&token=...` (the gateway's success URL)
5. Gateway resolves the IDP intent (`POST /v2/idp_intents/{id}`), gets or creates the Zitadel user
6. Gateway calls `signTokens(userId, email)` → redirects to `redirect_to#access_token=...&refresh_token=...`
7. com/ extracts tokens from hash fragment, stores them, calls `/api/auth/provision`

### Cross-domain SSO (other apps via `@lmthing/auth`)

1. App detects no session → redirects to `lmthing.com/auth/sso?redirect_uri=...&app=...`
2. com/ checks for active session (redirects to `/login` if none)
3. com/ calls `POST /api/auth/sso/create` → gateway creates a single-use code in Postgres (60s TTL)
4. com/ redirects back to the app with `?code=...`
5. App calls `POST /api/auth/sso/exchange` → gateway validates code, calls `signTokens()` → returns gateway JWT session

### Token refresh

- `POST /api/auth/refresh` with `{ refresh_token }` → gateway verifies the refresh JWT locally → issues new token pair

### Backend auth (gateway middleware)

1. Extract `Authorization: Bearer <token>`
2. Try `verifyAccessToken(token)` — local HS256 verification, no network call
3. If that fails, fall back to Zitadel `POST /oauth/v2/introspect` (Basic auth) for any legacy tokens

## Gateway Auth Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/register` | POST | Public | Register, auto-provisions LiteLLM + Stripe, returns user info |
| `/api/auth/login` | POST | Public | Password login — returns gateway JWT + refresh token |
| `/api/auth/oauth/url` | GET | Public | Start GitHub OAuth via Zitadel IDP Intent |
| `/api/auth/oauth/callback` | GET | Public | IDP Intent callback — issues gateway tokens, redirects |
| `/api/auth/provision` | POST | JWT | Provision LiteLLM user + Stripe customer (idempotent) |
| `/api/auth/refresh` | POST | Public | Refresh access token |
| `/api/auth/me` | GET | JWT | User info + tier |
| `/api/auth/sso/create` | POST | JWT | Generate SSO authorization code (60s TTL) |
| `/api/auth/sso/exchange` | POST | Public | Exchange SSO code for gateway JWT session |

## Key Files

| File | Purpose |
|------|---------|
| `cloud/gateway/src/lib/tokens.ts` | `signTokens`, `verifyAccessToken`, `verifyRefreshToken` — HS256 JWTs |
| `cloud/gateway/src/lib/zitadel.ts` | Zitadel v2 API client — user CRUD, IDP Intent, password login |
| `cloud/gateway/src/routes/auth.ts` | All auth route handlers |
| `cloud/gateway/src/middleware/auth.ts` | Bearer token verification middleware |
| `sdk/libs/auth/src/` | `@lmthing/auth` — cross-domain SSO client library |
| `com/src/lib/cloud.ts` | JWT + refresh token management, `cloudFetch()` |

## Demo mode (local development)

When `VITE_DEMO_USER=true` is set (default in `.env.development` for studio, chat, and computer), `AuthProvider` skips all SSO flows and uses a hardcoded demo session (`demo-user` / `demo@lmthing.test`). No redirect to com/, no SSO exchange, no gateway calls needed.

## Integrating Auth in a New Service

### 1. Add the dependency

```bash
cd your-app/
pnpm add "@lmthing/auth@workspace:*"
```

### 2. Wrap your app with AuthProvider

```tsx
import { AuthProvider, useAuth } from "@lmthing/auth";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <LoginScreen />;
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

### 3. Use useAuth() anywhere

```tsx
const { username, isAuthenticated, isLoading, login, logout } = useAuth();
```

- `login()` — redirects to com/ for SSO login
- `logout()` — clears the local session
- `username` — the user's email
- `session.accessToken` — gateway JWT for calling cloud APIs

### 4. Ensure the Vite alias is registered

In `sdk/libs/utils/src/vite.mjs`:

```js
'@lmthing/auth': path.resolve(dirname, '../sdk/libs/auth/src'),
```

### 5. Environment variables (optional)

```
VITE_COM_URL=https://com.test       # defaults: com.test (dev) / lmthing.com (prod)
VITE_CLOUD_URL=https://cloud.test   # defaults: cloud.test (dev) / lmthing.cloud (prod)
VITE_DEMO_USER=true                  # bypass auth with demo session (set in .env.development)
```
