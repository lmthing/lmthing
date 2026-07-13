# Cloud Auth — JWT, sessions, Zitadel/SSO, API keys

The gateway is its **own token issuer**. [Zitadel](https://auth.lmthing.cloud) is the identity store (users, passwords, GitHub OAuth), but clients never hold a Zitadel token — the gateway mints HS256 JWTs signed with `GATEWAY_JWT_SECRET` and every authenticated request is verified locally, no network round-trip. See the full route table in [routes.md](./routes.md); local demo bypass in [../devops/local-dev.md](../devops/local-dev.md).

## The gateway token (shape + signing)

All gateway JWTs are HS256, signed with a base64-decoded secret from the env var `GATEWAY_JWT_SECRET` `cloud/gateway/src/lib/tokens.ts#secret`. `signTokens(userId, email)` issues a pair `cloud/gateway/src/lib/tokens.ts#signTokens`:

- **access token** — `sub = userId`, custom claim `{ email }`, `iat` now, `exp` = `ACCESS_TTL` (`"12h"`) `cloud/gateway/src/lib/tokens.ts#ACCESS_TTL,15-20`. The function also returns `expires_at` computed as `now + 12h` in **seconds** `cloud/gateway/src/lib/tokens.ts#signTokens`.
- **refresh token** — `sub = userId`, custom claim `{ type: "refresh" }`, `exp` = `REFRESH_TTL` (`"30d"`) `cloud/gateway/src/lib/tokens.ts#REFRESH_TTL,22-27`. Carries no email.

Verification is local via `jose.jwtVerify`:

- `verifyAccessToken(token)` → `{ userId, email }` or `null`; rejects unless `payload.sub` is set and `payload.email` is a string `cloud/gateway/src/lib/tokens.ts#verifyAccessToken`.
- `verifyRefreshToken(token)` → `{ userId }` or `null`; rejects unless `sub` is set and `type === "refresh"` `cloud/gateway/src/lib/tokens.ts#verifyRefreshToken`.

> Minting a JWT by hand (the workaround for broken password login): sign an HS256 JWT with `sub=<user_id>`, `email` claim, using the base64-decoded `GATEWAY_JWT_SECRET` (from the `lmthing-secrets` k8s secret), then inject it into `localStorage.lmthing_session` — the shape is `AuthSession` `sdk/org/libs/auth/src/types.ts#AuthSession`.

### Audience-scoped service tokens

Besides the user session pair, `tokens.ts` mints four long-lived, single-purpose JWTs — same secret, distinguished by the `aud` claim, verified with `jwtVerify(..., { audience })`:

| Function | `aud` | TTL | Purpose |
|---|---|---|---|
| `signBackupToken` / `verifyBackupToken` | `backup` | `365d` | Pod exchanges it at `POST /api/backup/token` for a short-lived GitHub App token; injected into the pod's `user-env` secret `cloud/gateway/src/lib/tokens.ts:65-87` |
| `signComputeToken` / `verifyComputeToken` | `compute` | `365d` | Pod's autonomous callbacks (self-idle, cron-manifest); userId is taken from the verified subject, never the request body `cloud/gateway/src/lib/tokens.ts:99-121` |
| `signInstallState` / `verifyInstallState` | `backup-install` | `10m` | Signed state carried through the GitHub App install redirect; extra claim `rt` = redirectTo `cloud/gateway/src/lib/tokens.ts:126-156` |
| `signInboundToken` / `verifyInboundToken` | `inbound` | `365d` | Embedded in a per-user public inbound-webhook URL; resolves which pod to wake `cloud/gateway/src/lib/tokens.ts:170-194` |

## Auth middleware

`authMiddleware` `cloud/gateway/src/middleware/auth.ts#authMiddleware` guards every JWT-protected route and sets `c.get("user")` to `{ id, email }` (`AuthUser` `cloud/gateway/src/middleware/auth.ts#AuthUser`). Order:

1. Require `Authorization: Bearer <token>`; else 401 `cloud/gateway/src/middleware/auth.ts#authMiddleware`.
2. **Local dev only** (`LOCAL_DEV === "true"`): the literal token `"demo"` resolves to `{ id: "local-dev-user", email: "dev@local" }` `cloud/gateway/src/middleware/auth.ts#LOCAL_DEV,24-28`.
3. Try `verifyAccessToken(token)` — the normal path for gateway-issued tokens (OAuth + password logins) `cloud/gateway/src/middleware/auth.ts:30-35`.
4. **Fallback**: Zitadel introspection at `POST {ZITADEL_URL}/oauth/v2/introspect` with HTTP Basic (`ZITADEL_CLIENT_ID:ZITADEL_CLIENT_SECRET`) for any legacy tokens; requires the response `active` plus `sub` and string `email` `cloud/gateway/src/middleware/auth.ts#authMiddleware`.

CORS is applied to all `/api/*` with `origin: "*"` and allowed headers `Content-Type`/`Authorization` `cloud/gateway/src/index.ts:19-26`; the auth router is mounted at `/api/auth` `cloud/gateway/src/index.ts:30`.

## Register / login / OAuth / refresh

All handlers live in `cloud/gateway/src/routes/auth.ts`. Each success path that establishes identity also calls `provisionUser(userId, email)` `cloud/gateway/src/routes/auth.ts#provisionUser` — idempotent: it returns early if the user already exists in LiteLLM, otherwise creates a Stripe customer, a LiteLLM free-tier user, and one API key.

### `POST /register` (public)

Validates email + password (≥8 chars), creates a Zitadel human user via `zitadel.createUser`, then provisions LiteLLM + Stripe and returns `{ user_id, email, tier, api_key, already_provisioned }` `cloud/gateway/src/routes/auth.ts:62-91`. `zitadel.createUser` `POST`s `/v2/users/human` with `email.isVerified: true` and `password.changeRequired: false` `cloud/gateway/src/lib/zitadel.ts#createUser`.

### `POST /login` (public) — BROKEN in production

The handler verifies the password via `zitadel.loginWithPassword`, looks up the user id via `zitadel.getUserByEmail`, then issues the gateway pair `{ access_token, refresh_token, expires_at }` `cloud/gateway/src/routes/auth.ts:94-118`. `loginWithPassword` uses the OIDC `grant_type=password` flow against `/oauth/v2/token` `cloud/gateway/src/lib/zitadel.ts#loginWithPassword`.

> **Known broken**: on production this returns `{"error":"password not supported"}` — the Zitadel OIDC client has no password grant enabled, so there is no email/password path to a gateway JWT even though `/register` succeeds. Root cause + the mint-a-JWT workaround are in [../../.issues/zitadel-password-login-disabled.md](../../../.issues/zitadel-password-login-disabled.md). GitHub OAuth (below) is unaffected.

### GitHub OAuth — Zitadel IDP Intent (bypasses the Zitadel UI)

1. `GET /oauth/url?redirect_to=...` (public) builds a success URL `{BASE_URL}/api/auth/oauth/callback?state=<base64url(redirect_to)>` and calls `zitadel.startIdpIntent`, returning `{ url }` — a GitHub OAuth URL `cloud/gateway/src/routes/auth.ts:121-135`. `startIdpIntent` resolves the GitHub IDP id (cached; auto-discovered from `/management/v1/idps/_search`, override with `ZITADEL_GITHUB_IDP_ID`) and `POST`s `/v2/idp_intents`, returning `authUrl` `cloud/gateway/src/lib/zitadel.ts#cachedGithubIdpId,13-35,142-162`.
2. GitHub → Zitadel → `GET /oauth/callback?id=...&token=...&state=...` (public). It resolves the intent via `zitadel.resolveIdpIntent`, signs the gateway pair, best-effort provisions, and **redirects** to `redirect_to#access_token=...&refresh_token=...&expires_at=...` (tokens in the hash fragment) `cloud/gateway/src/routes/auth.ts:138-170`.
3. `resolveIdpIntent` `POST`s `/v2/idp_intents/{id}` with the intent token. If already linked (`intent.userId`) it returns that user; on first login it creates the Zitadel user with an `idpLinks` entry, and on an email conflict it searches and links the IDP to the existing user `cloud/gateway/src/lib/zitadel.ts#resolveIdpIntent`.

### `POST /refresh` (public)

Verifies the refresh JWT locally (`verifyRefreshToken`), re-reads the email via `zitadel.getUserById`, and returns a fresh pair `cloud/gateway/src/routes/auth.ts:208-229`.

### `POST /provision` (JWT) · `GET /me` (JWT)

`/provision` re-runs `provisionUser` for the authenticated user `cloud/gateway/src/routes/auth.ts:173-183`. `/me` returns `{ user_id, email, tier, budget_limits, spend }` from LiteLLM, defaulting to `tier: "free"` if the LiteLLM lookup fails `cloud/gateway/src/routes/auth.ts:186-205`.

### `GET /demo-token` (local dev only)

Returns a signed access token for `local-dev-user` / `dev@local`; 404 unless `LOCAL_DEV === "true"`. Lets demo-mode frontends call `/api/compute/ensure` and open sessions without real auth `cloud/gateway/src/routes/auth.ts:307-316`.

## Cross-domain SSO

Other lmthing.\* SPAs delegate login to com/ via a single-use code exchanged for a gateway session.

- `POST /sso/create` (JWT): mints a 32-byte hex `code` with a **60-second** TTL and stores it via `db.insertSsoCode(user.id, code, redirect_uri, app, expiresAt)` `cloud/gateway/src/routes/auth.ts:236-258`.
- `POST /sso/exchange` (public): `db.findAndConsumeSsoCode(code, redirect_uri)` atomically consumes the row, then `zitadel.getUserById` + `signTokens` return `{ access_token, refresh_token, expires_at, user: { id, email } }` and best-effort provision `cloud/gateway/src/routes/auth.ts:261-298`.

The `sso_codes` table (id uuid, user_id **text**, code unique, redirect_uri, app, expires_at, used_at, created_at) is created idempotently by `ensureSchema()` on gateway boot `cloud/gateway/src/lib/db.ts:99-114`, which runs before the server starts serving `cloud/gateway/src/index.ts:48-51`.

### Client library `@lmthing/auth` (`sdk/org/libs/auth/`)

Consumed by the product SPAs. Key session mechanics in `sdk/org/libs/auth/src/client.ts`:

- Session is persisted in `localStorage["lmthing_session"]` as an `AuthSession` `sdk/org/libs/auth/src/client.ts#SESSION_KEY,218-227`, `sdk/org/libs/auth/src/types.ts#AuthSession`.
- `redirectToLogin` sends the browser to `{comUrl}/auth/sso?redirect_uri=&app=&state=`, storing a CSRF `state` in `sessionStorage` `sdk/org/libs/auth/src/client.ts#redirectToLogin`.
- `handleAuthCallback` verifies `state`, `POST`s `/api/auth/sso/exchange`, and stores the resulting session `sdk/org/libs/auth/src/client.ts#handleAuthCallback`.
- `refreshSession` `POST`s `/api/auth/refresh` `sdk/org/libs/auth/src/client.ts#refreshSession`; `ensureValidToken` refreshes when within `REFRESH_BUFFER` (60s) of `expiresAt`, clearing the session on failure `sdk/org/libs/auth/src/client.ts:7,118-145`.
- `authFetch` sets the Bearer header, and on `401` force-refreshes once and retries; it also transparently retries the Envoy activator's `{waking:true}` 503 up to `WAKE_RETRIES` (6 × 1200ms) so a scaled-to-zero pod self-heals `sdk/org/libs/auth/src/client.ts:161-204`.
- A pod-embedded app reads a bootstrap-injected `window.__LM_ACCESS_TOKEN__` (`getPodInjectedToken`/`isPodEmbedded`) `sdk/org/libs/auth/src/client.ts:229-239`.

**Demo mode**: `AuthProvider` uses a hardcoded `DEMO_SESSION` (accessToken `"demo"`, userId `demo-user`, email `demo@lmthing.local`) whenever `import.meta.env.VITE_DEMO_USER === 'true'` **or** `isLocalRun()` is true (localhost/loopback/`*.test`) `sdk/org/libs/auth/src/AuthProvider.tsx:27-40`, `sdk/org/libs/auth/src/client.ts#isLocalRun`. This pairs with the middleware's `"demo"` bypass above.

## API keys

Each user has LiteLLM keys carrying their tier's budget windows. Routes under `/api/keys` (all `authMiddleware`-guarded via `keys.use("*", authMiddleware)` `cloud/gateway/src/routes/keys.ts:9`):

- `GET /` — `litellm.listKeys(user.id)`, returning a safe projection (`token`, `key_alias`, `spend`, `max_budget`, `models`, `tier`, …) `cloud/gateway/src/routes/keys.ts:12-29`.
- `POST /` — reads the user's current tier from LiteLLM, then `litellm.generateKey(user.id, tier, name)`; returns `{ key, key_alias, tier, models, budget_limits }` `cloud/gateway/src/routes/keys.ts:32-59`.
- `DELETE /:token` — `litellm.deleteKey(token)` `cloud/gateway/src/routes/keys.ts:62-66`.

The register/provision flow issues the first key automatically `cloud/gateway/src/routes/auth.ts:42-47`. Tier→budget mapping (`toBudgetLimits`) and LiteLLM specifics are in [litellm.md](./litellm.md) and [billing-and-tiers.md](./billing-and-tiers.md).

## Environment variables

| Var | Used by | Purpose |
|---|---|---|
| `GATEWAY_JWT_SECRET` | tokens.ts | base64-encoded HS256 signing secret `cloud/gateway/src/lib/tokens.ts#secret` |
| `ZITADEL_URL` | zitadel.ts, auth middleware | Zitadel instance (`https://auth.lmthing.cloud`) `cloud/gateway/src/lib/zitadel.ts#ZITADEL_URL` |
| `ZITADEL_SERVICE_PAT` | zitadel.ts | machine-user PAT for the v2 admin API `cloud/gateway/src/lib/zitadel.ts#SERVICE_PAT,9-11` |
| `ZITADEL_CLIENT_ID` / `ZITADEL_CLIENT_SECRET` | zitadel.ts, auth middleware | OIDC client for password grant + introspection `cloud/gateway/src/lib/zitadel.ts:3-4`, `cloud/gateway/src/middleware/auth.ts:6-7` |
| `ZITADEL_GITHUB_IDP_ID` | zitadel.ts | optional; GitHub IDP id, else auto-discovered `cloud/gateway/src/lib/zitadel.ts#cachedGithubIdpId` |
| `BASE_URL` | auth.ts | OAuth callback/failure URL host `cloud/gateway/src/routes/auth.ts:128`, `cloud/gateway/src/lib/zitadel.ts#startIdpIntent` |
| `LOCAL_DEV` | auth middleware, auth.ts | enables the `"demo"` token bypass + `/demo-token` `cloud/gateway/src/middleware/auth.ts#LOCAL_DEV`, `cloud/gateway/src/routes/auth.ts:308` |
| `DATABASE_URL` | db.ts | Postgres for `sso_codes` `cloud/gateway/src/lib/db.ts` |

## The four things that most often trip people up

- **There is no working email/password path to a gateway JWT in production.** `/register` succeeds, but `POST /api/auth/login` returns `{"error":"password not supported"}` because the Zitadel OIDC client has no password grant — [../../.issues/zitadel-password-login-disabled.md](../../../.issues/zitadel-password-login-disabled.md). GitHub OAuth and `/sso/exchange` are the only real login paths; hand-minting a JWT (above) is the test workaround.
- **Two different demo identities.** The client's `DEMO_SESSION` user is `demo-user` / `demo@lmthing.local` `sdk/org/libs/auth/src/AuthProvider.tsx:27-40`; the gateway middleware's `"demo"`-token bypass resolves to `local-dev-user` / `dev@local` `cloud/gateway/src/middleware/auth.ts:24-28`.
- **Demo mode is not env-gated alone.** It engages when `import.meta.env.VITE_DEMO_USER === 'true'` **or** `isLocalRun()` (localhost/loopback/`*.test`) `sdk/org/libs/auth/src/AuthProvider.tsx:39`, `sdk/org/libs/auth/src/client.ts#isLocalRun`.
- **`GET /api/auth/demo-token` exists** (local dev only) `cloud/gateway/src/routes/auth.ts:307-316`, and the gateway mints **four** audience-scoped service tokens beyond the user session pair `cloud/gateway/src/lib/tokens.ts:56-194`.
