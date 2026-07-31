# Cloud Auth — JWT, sessions, Zitadel/SSO, API keys

The gateway is its **own token issuer**. [Zitadel](https://auth.lmthing.cloud) is the identity store (users, passwords, GitHub OAuth), but clients never hold a Zitadel token — the gateway mints HS256 JWTs signed with `GATEWAY_JWT_SECRET` and every authenticated request is verified locally, no network round-trip. See the full route table in [routes.md](./routes.md); local demo bypass in [../devops/local-dev.md](../devops/local-dev.md).

## The gateway token (shape + signing)

All gateway JWTs are HS256, signed with a base64-decoded secret from the env var `GATEWAY_JWT_SECRET` `cloud/gateway/src/lib/tokens.ts#secret`. `signTokens(userId, email)` issues a pair `cloud/gateway/src/lib/tokens.ts#signTokens`:

- **access token** — `sub = userId`, custom claim `{ email }`, `iat` now, `exp` = `ACCESS_TTL` (`"12h"`) `cloud/gateway/src/lib/tokens.ts#ACCESS_TTL,15-20`. The function also returns `expires_at` computed as `now + 12h` in **seconds** `cloud/gateway/src/lib/tokens.ts#signTokens`.
- **refresh token** — `sub = userId`, custom claim `{ type: "refresh" }`, `exp` = `REFRESH_TTL` (`"30d"`) `cloud/gateway/src/lib/tokens.ts#REFRESH_TTL,22-27`. Carries no email.

Verification is local via `jose.jwtVerify`:

- `verifyAccessToken(token)` → `{ userId, email }` or `null`; rejects unless `payload.sub` is set and `payload.email` is a string `cloud/gateway/src/lib/tokens.ts#verifyAccessToken`.
- `verifyRefreshToken(token)` → `{ userId }` or `null`; rejects unless `sub` is set and `type === "refresh"` `cloud/gateway/src/lib/tokens.ts#verifyRefreshToken`.

> Minting a JWT by hand (still the fallback when a deployment has no mail transport configured, so email sign-in 503s): sign an HS256 JWT with `sub=<user_id>`, `email` claim, using the base64-decoded `GATEWAY_JWT_SECRET` (from the `lmthing-secrets` k8s secret), then inject it into `localStorage.lmthing_session` — the shape is `AuthSession` `sdk/org/libs/auth/src/types.ts#AuthSession`. With a mailer configured, [passwordless email sign-in](#passwordless-email-sign-in-magic-link--one-time-code) is the real path.

### Audience-scoped service tokens

Besides the user session pair, `tokens.ts` mints four long-lived, single-purpose JWTs — same secret, distinguished by the `aud` claim, verified with `jwtVerify(..., { audience })`:

| Function | `aud` | TTL | Purpose |
|---|---|---|---|
| `signBackupToken` / `verifyBackupToken` | `backup` | `365d` | Pod exchanges it at `POST /api/backup/token` for a short-lived GitHub App token; injected into the pod's `user-env` secret `cloud/gateway/src/lib/tokens.ts:122-144` |
| `signComputeToken` / `verifyComputeToken` | `compute` | `365d` | Pod's autonomous callbacks (self-idle, cron-manifest); userId is taken from the verified subject, never the request body `cloud/gateway/src/lib/tokens.ts:156-178` |
| `signInstallState` / `verifyInstallState` | `backup-install` | `10m` | Signed state carried through the GitHub App install redirect; extra claim `rt` = redirectTo `cloud/gateway/src/lib/tokens.ts:183-213` |
| `signInboundToken` / `verifyInboundToken` | `inbound` | `365d` | Embedded in a per-user public inbound-webhook URL; resolves which pod to wake `cloud/gateway/src/lib/tokens.ts:227-251` |

### The team token

Separate from both the session pair and the service tokens: a **team-scoped access token**, minted by `POST /api/teams/:teamId/token` after a membership check `cloud/gateway/src/lib/tokens.ts#signTeamToken`. Same secret and algorithm, no `aud`, TTL **1 hour** `cloud/gateway/src/lib/tokens.ts#TEAM_TTL`.

It carries `sub` = the member's user id and `email`, plus two extra claims the edge reads: `team` (the team id) and `role` (`viewer` or `editor`, read from the database at mint time, never from the client). A browser on lmthing.team cannot use a personal token, because the edge routes by the `team` claim — a personal token would resolve to the member's own pod. `verifyTeamToken` requires a string `team` claim and a known role, so a personal token can never satisfy it `cloud/gateway/src/lib/tokens.ts#verifyTeamToken`.

The one-hour TTL *is* the propagation mechanism for authorization changes: a role change or a removal takes effect on the next silent re-mint rather than lingering for a browser session.

> A team token also satisfies `verifyAccessToken`, since it carries `sub` and `email` `cloud/gateway/src/lib/tokens.ts#verifyAccessToken`. That grants nothing beyond the member's own identity, which they already hold — `sub` is always the member, never the team.

Full model (tables, roles, the principal key) → [./teams.md](./teams.md).

## Auth middleware

`authMiddleware` `cloud/gateway/src/middleware/auth.ts#authMiddleware` guards every JWT-protected route and sets `c.get("user")` to `{ id, email }` (`AuthUser` `cloud/gateway/src/middleware/auth.ts#AuthUser`). Order:

1. Require `Authorization: Bearer <token>`; else 401 `cloud/gateway/src/middleware/auth.ts#authMiddleware`.
2. **Local dev only** (`LOCAL_DEV === "true"`): the literal token `"demo"` resolves to `{ id: "local-dev-user", email: "dev@local" }` `cloud/gateway/src/middleware/auth.ts#LOCAL_DEV,24-28`.
3. Try `verifyAccessToken(token)` — the normal path for gateway-issued tokens (OAuth + password logins) `cloud/gateway/src/middleware/auth.ts:30-35`.
4. **Fallback**: Zitadel introspection at `POST {ZITADEL_URL}/oauth/v2/introspect` with HTTP Basic (`ZITADEL_CLIENT_ID:ZITADEL_CLIENT_SECRET`) for any legacy tokens; requires the response `active` plus `sub` and string `email` `cloud/gateway/src/middleware/auth.ts#authMiddleware`.

CORS is applied to all `/api/*` with `origin: "*"` and allowed headers `Content-Type`/`Authorization` `cloud/gateway/src/index.ts:20-27`; the auth router is mounted at `/api/auth` `cloud/gateway/src/index.ts:31`.

## Register / login / OAuth / refresh

All handlers live in `cloud/gateway/src/routes/auth.ts`. Each success path that establishes identity also calls `provisionUser(userId, email)` `cloud/gateway/src/routes/auth.ts#provisionUser` — idempotent: it returns early if the user already exists in LiteLLM, otherwise creates a Stripe customer, a LiteLLM free-tier user, and one API key.

### `POST /register` (public)

Validates email + password (≥8 chars), creates a Zitadel human user via `zitadel.createUser`, then provisions LiteLLM + Stripe and returns `{ user_id, email, tier, api_key, already_provisioned }` `cloud/gateway/src/routes/auth.ts:81-110`. `zitadel.createUser` `POST`s `/v2/users/human` with `email.isVerified: true` and `password.changeRequired: false` `cloud/gateway/src/lib/zitadel.ts#createUser`.

### `POST /login` (public) — BROKEN in production

The handler verifies the password via `zitadel.loginWithPassword`, looks up the user id via `zitadel.getUserByEmail`, then issues the gateway pair `{ access_token, refresh_token, expires_at }` `cloud/gateway/src/routes/auth.ts:113-137`. `loginWithPassword` uses the OIDC `grant_type=password` flow against `/oauth/v2/token` `cloud/gateway/src/lib/zitadel.ts#loginWithPassword`.

> **Known broken**: on production this returns `{"error":"password not supported"}` — the Zitadel OIDC client has no password grant enabled, so there is no email/**password** path to a gateway JWT even though `/register` succeeds. Root cause in [../../.issues/zitadel-password-login-disabled.md](../../../.issues/zitadel-password-login-disabled.md). Neither GitHub OAuth nor passwordless email sign-in (both below) goes anywhere near the password grant, so both work; passwordless email is the supported way to sign in with an email address.

## Passwordless email sign-in (magic link + one-time code)

Any email address can sign in, and there is **no separate registration step**: proving control of a mailbox *is* the account. This sits alongside GitHub OAuth rather than replacing it — an address that already has an account (password-registered, or created by the GitHub IDP link) resolves to that same Zitadel user, so both doors open the same account `cloud/gateway/src/lib/zitadel.ts#findOrCreateUserByEmail`.

One request issues **two credentials for one single-use row**: a 6-digit code to type back into the page, and an opaque magic-link token to click from the inbox. Consuming either invalidates the other, because `consumed_at` belongs to the row and not to a credential. Two credentials is what makes the flow work when mail is read on a different device than the one that asked.

### The three routes

1. **`POST /email/start`** (public, IP rate-limited 10 / 15 min via `ipRateLimit` `cloud/gateway/src/middleware/rate-limit.ts#ipRateLimit`) — `{ email, redirect_uri? }` `cloud/gateway/src/routes/auth.ts:354-451`. In order: `normalizeEmail` (trim + lower-case, reject what cannot be an address) `cloud/gateway/src/lib/email-login.ts#normalizeEmail`; `isAllowedRedirect` when a `redirect_uri` was supplied `cloud/gateway/src/lib/email-login.ts#isAllowedRedirect`; the mailer-configured check; the per-mailbox send throttle (`MAX_SENDS_PER_WINDOW` = 5 per `SEND_WINDOW_MS` = 15 min) `cloud/gateway/src/lib/db.ts#countRecentEmailLoginCodes`; then `generateOtp` + `generateLinkToken`, stored as hashes by `db.insertEmailLoginCode` `cloud/gateway/src/lib/db.ts#insertEmailLoginCode`, and `sendEmail` `cloud/gateway/src/lib/email.ts#sendEmail`.

   Returns `{ sent: true, email: <masked>, expires_at }` — the address is masked by `maskEmail` and **neither credential is ever in the response** `cloud/gateway/src/lib/email-login.ts#maskEmail`. Status codes: 400 (bad address / disallowed `redirect_uri`), 429 (throttle), 503 (no mailer, or the throttle query failed), 502 (delivery failed — the relay's error text is logged, never returned).

2. **`POST /email/verify`** (public, 30 / 15 min) — `{ email, code }` `cloud/gateway/src/routes/auth.ts:454-503`. Reads the newest live row for the mailbox (`db.findLiveEmailLoginCode`, whose `WHERE consumed_at IS NULL AND expires_at > now()` makes a spent or expired row invisible) `cloud/gateway/src/lib/db.ts#findLiveEmailLoginCode`, compares in constant time `cloud/gateway/src/lib/email-login.ts#hashesEqual`, and on a mismatch counts the guess and burns the row at `MAX_ATTEMPTS` = 5 `cloud/gateway/src/lib/db.ts#recordEmailLoginAttempt`. On a match it spends the row *before* minting anything `cloud/gateway/src/lib/db.ts#consumeEmailLoginCode`, then returns `{ access_token, refresh_token, expires_at, user }` `cloud/gateway/src/routes/auth.ts#mintEmailSession`.

3. **`GET /email/callback?token=`** (public) — the magic link `cloud/gateway/src/routes/auth.ts#auth`. Looks the row up by `hashLinkToken` `cloud/gateway/src/lib/db.ts#findLiveEmailLoginCodeByLink`, then asks **which device is this?** before spending anything (below). For the browser that started the flow it consumes the row and `302`-redirects to the `redirect_uri` **recorded at issue time** with the token trio appended as a URL fragment `cloud/gateway/src/lib/email-login.ts#redirectWithTokens` — the same shape `/oauth/callback` produces, which is why `com`'s `/callback` route handles both without knowing which flow it came from. With no `redirect_uri` on the row (an API-only caller) it returns the session as JSON instead.

#### One address signs in with a code that was never mailed

Google Play requires working credentials for anything behind a login, and every screen past launch is. The problem is that this login's only factor is a code sent to a mailbox — and the reviewer's mailbox is not ours, so there is nothing to put in the **App access** form. Left alone, a reviewer sees the sign-in screen, cannot get past it, and the submission is rejected as inaccessible.

`REVIEW_DEMO_EMAIL` + `REVIEW_DEMO_CODE` name one address whose code is fixed rather than mailed `cloud/gateway/src/lib/email-login.ts#isReviewDemoLogin`. `/email/verify` checks it *before* the row lookup, because nothing was ever mailed for it and there is no row to find `cloud/gateway/src/routes/auth.ts:470-520`.

This is an auth bypass, and the shape is what keeps it small:

- **Inert unless both are set**, so no deployment has one by default and clearing either revokes it with a `make deploy-secrets` — no code change, no image.
- **One constant-time comparison over `hashCode(email, code)`**, not two field comparisons: a mismatch cannot reveal which half was wrong, and the address is not exposed by a timing difference.
- **Inside the rate limit, not around it.** `/email/verify` is `ipRateLimit(30, 15 min)` and that middleware has already run. Six digits is 10⁶, so this limiter is the only thing between the account and a guess — which is the reason the account must be worth nothing: it is an *ordinary* user, and the workspace behind it should hold demo content and nothing else.
- **It does not weaken the normal path for that address** — a wrong code still 401s.

Blank `vault_review_demo_code` once the review is through `devops/ansible/vault.yml.example:104-116`.

#### A link opened on a different device does not sign that device in

A magic link is a bearer credential sitting in an inbox, and an inbox is read on whatever device is to hand. Handing a session to whoever opens it is wrong twice: the browser that actually asked is still sitting on the sign-in page logged out, and a **forwarded link becomes an account takeover**.

So `/email/start` sets `__Host-lmthing_email_origin`, an opaque 256-bit token naming that browser, and stores only its hash on the row `cloud/gateway/src/lib/email-login.ts#ORIGIN_COOKIE`. The callback completes a login only when the click carries the cookie back and it hashes to the row's `origin_hash` `cloud/gateway/src/lib/email-login.ts#hashOriginToken`. Any other click — no cookie, or a cookie from a *different* sign-in — gets a plain HTML page telling the reader to type the 6-digit code on the device where they started, and **the row is left unspent** so that device can still finish `cloud/gateway/src/routes/auth.ts#otherDevicePage`.

Nothing is regenerated or displayed on the second device: the code is already in the same email the link came from, so the only thing missing was telling the reader where to type it.

- The comparison is truthy-guarded, not `!= null`: a row issued before `origin_hash` existed reads back `undefined`, and treating that as "cannot prove same device" is the difference between the instructions page and a `500`.
- The cookie outlives the code (`CODE_TTL_MS * 2`) so a click arriving a moment late is not misread as a different device `cloud/gateway/src/lib/email-login.ts#originCookie`.
- `__Host-` is refused by the browser unless the cookie is `Secure`, path `/`, and carries no `Domain`, which pins it to the gateway origin and stops a sibling subdomain setting one that would be sent here.
- **This is why the email routes have their own CORS policy.** The SPA is on `lmthing.com` and the gateway on `lmthing.cloud`, so the response that sets this cookie is cross-site — and a cookie cannot be stored from one unless the response carries `Access-Control-Allow-Credentials: true` with a *concrete* origin. The spec forbids pairing credentials with `*`, so `/api/auth/email/*` reflects only origins we ship while the rest of `/api/*` keeps the wildcard `cloud/gateway/src/index.ts#isTrustedWebOrigin`. Callers must send `credentials: 'include'` or the cookie never lands and every link looks foreign `sdk/org/libs/auth/src/email-login.ts#requestEmailCode`.
- Native never has this cookie and does not need it: the mobile app has no magic link (see below), and its user types the code.

### What stops each attack

| Property | How |
|---|---|
| A database dump contains no live credential | only `sha256` hashes are stored `cloud/gateway/src/lib/email-login.ts#hashCode` |
| A code harvested for one mailbox cannot be tried against another | the code hash is `sha256(email ‖ NUL ‖ code)` — bound to the address, because 10⁶ is brute-forceable `cloud/gateway/src/lib/email-login.ts#hashCode` |
| Two simultaneous submissions of one code cannot both win | single-use is a SQL predicate on the `UPDATE`, not a read-then-write `cloud/gateway/src/lib/db.ts#consumeEmailLoginCode` |
| Guessing is bounded | 5 attempts, then the row is burned in the same statement `cloud/gateway/src/lib/db.ts#recordEmailLoginAttempt` |
| A magic link cannot deliver tokens to an attacker's host | `redirect_uri` is origin-checked at **issue** time and stored, so a click cannot re-aim it `cloud/gateway/src/lib/email-login.ts#isAllowedRedirect` |
| Codes are uniformly distributed | `crypto.randomInt`, not `randomBytes % 1e6` `cloud/gateway/src/lib/email-login.ts#generateOtp` |
| A resend makes the old code dead | the insert supersedes any live row for the mailbox in one transaction `cloud/gateway/src/lib/db.ts#insertEmailLoginCode` |
| An unconfigured deployment cannot be signed into | no mailer ⇒ 503, not a "sent" that nobody can act on `cloud/gateway/src/lib/email.ts#isEmailConfigured` |
| A **forwarded magic link is not an account** | the callback signs in only the browser whose `__Host-` cookie hashes to the row's `origin_hash`; anyone else gets instructions and the row is left unspent `cloud/gateway/src/lib/email-login.ts#ORIGIN_COOKIE` |
| A stale cookie from another sign-in does not pass | the binding is per-row, not "any valid cookie" `cloud/gateway/src/lib/db.ts#EmailLoginCode` |

The default `isAllowedRedirect` allowlist is https on any `lmthing.*` host or subdomain, plus `localhost` / `127.0.0.1` / `0.0.0.0` / `[::1]` / `*.test`; `EMAIL_LOGIN_ALLOWED_ORIGINS` (comma-separated exact origins) replaces it entirely.

> The two throttles are not equivalent. The per-mailbox one counts rows in Postgres, so it holds across both gateway replicas and across a sender rotating IPs. The per-IP one is an in-memory map per replica `cloud/gateway/src/middleware/rate-limit.ts#ipRateLimit`, so with `replicas: 2` the effective per-IP budget is up to 2×10 per window — it is a coarse burst guard, and the per-mailbox count plus the 5-attempt cap are what actually bound abuse of a given account.

### The `email_login_codes` table

`(id uuid, email text, code_hash, link_hash UNIQUE, redirect_uri, origin_hash, attempts int, expires_at, consumed_at, created_at)`, created idempotently by `ensureSchema()` on boot and mirrored in `cloud/migrations/012_email_login_codes.sql` plus `cloud/migrations/013_email_login_origin.sql` `cloud/gateway/src/lib/db.ts#EmailLoginCode`. There is deliberately **no `user_id`** column: the mailbox is the key on this path, and the Zitadel user is resolved only after the code verifies. `TTL` is `CODE_TTL_MS` = 15 minutes `cloud/gateway/src/lib/email-login.ts#CODE_TTL_MS`; spent rows older than a day are purged opportunistically `cloud/gateway/src/lib/db.ts#purgeExpiredEmailLoginCodes`.

### Sending the mail

`sendEmail` picks one of three transports per call, so credentials can be added to the k8s secret without a code change `cloud/gateway/src/lib/email.ts#mailerKind`:

| Kind | Selected when | How |
|---|---|---|
| `resend` | `EMAIL_PROVIDER=resend`, else `RESEND_API_KEY` is set | `POST https://api.resend.com/emails` with `fetch` |
| `smtp` | `EMAIL_PROVIDER=smtp`, else `SMTP_HOST` is set | the dependency-free client `cloud/gateway/src/lib/smtp.ts#sendSmtp` |
| `console` | nothing configured (or `EMAIL_PROVIDER=console`) | prints the message to stdout; `isEmailConfigured()` is false |

`smtp.ts` speaks RFC 5321 submission directly over `node:net` / `node:tls` — EHLO, a **mandatory** STARTTLS upgrade when `security: "starttls"` (it refuses to send credentials in the clear if the server does not advertise it), `AUTH PLAIN` or `AUTH LOGIN`, `MAIL FROM` / `RCPT TO` / `DATA`. Bodies are base64-encoded, which keeps every line inside the 76-char limit and out of dot-stuffing trouble `cloud/gateway/src/lib/smtp.ts#buildMessage`. `SMTP_SECURITY` defaults to `tls` on port 465 and `starttls` everywhere else — plaintext must be asked for explicitly `cloud/gateway/src/lib/email.ts#smtpSecurity`.

The message itself carries the code in the **subject line** as well as the body, and the code field in the UI is `autocomplete="one-time-code"`, so a phone can offer the code straight from the notification `cloud/gateway/src/lib/email-login.ts#renderLoginEmail`.

> **Local dev**: with no transport configured, `POST /email/start` normally 503s. Setting `EMAIL_DEV_ECHO=true` (or `LOCAL_DEV=true`) instead returns `dev_code` + `dev_link` in the response body so the whole flow can be driven without a relay. The echo is suppressed the moment a real transport *is* configured, so it cannot leak codes in production `cloud/gateway/src/routes/auth.ts:381,448`.

### GitHub OAuth — Zitadel IDP Intent (bypasses the Zitadel UI)

1. `GET /oauth/url?redirect_to=...` (public) builds a success URL `{BASE_URL}/api/auth/oauth/callback?state=<base64url(redirect_to)>` and calls `zitadel.startIdpIntent`, returning `{ url }` — a GitHub OAuth URL `cloud/gateway/src/routes/auth.ts:140-154`. `startIdpIntent` resolves the GitHub IDP id (cached; auto-discovered from `/management/v1/idps/_search`, override with `ZITADEL_GITHUB_IDP_ID`) and `POST`s `/v2/idp_intents`, returning `authUrl` `cloud/gateway/src/lib/zitadel.ts#cachedGithubIdpId,13-35,142-162`.
2. GitHub → Zitadel → `GET /oauth/callback?id=...&token=...&state=...` (public). It resolves the intent via `zitadel.resolveIdpIntent`, signs the gateway pair, best-effort provisions, and **redirects** to `redirect_to#access_token=...&refresh_token=...&expires_at=...` (tokens in the hash fragment) `cloud/gateway/src/routes/auth.ts:157-189`.
3. `resolveIdpIntent` `POST`s `/v2/idp_intents/{id}` with the intent token. If already linked (`intent.userId`) it returns that user; on first login it creates the Zitadel user with an `idpLinks` entry, and on an email conflict it searches and links the IDP to the existing user `cloud/gateway/src/lib/zitadel.ts#resolveIdpIntent`.

### `POST /refresh` (public)

Verifies the refresh JWT locally (`verifyRefreshToken`), re-reads the email via `zitadel.getUserById`, and returns a fresh pair `cloud/gateway/src/routes/auth.ts:227-248`.

### `POST /provision` (JWT) · `GET /me` (JWT)

`/provision` re-runs `provisionUser` for the authenticated user `cloud/gateway/src/routes/auth.ts:192-202`. `/me` returns `{ user_id, email, tier, budget_limits, spend }` from LiteLLM, defaulting to `tier: "free"` if the LiteLLM lookup fails `cloud/gateway/src/routes/auth.ts:205-224`.

### `GET /demo-token` (local dev only)

Returns a signed access token for `local-dev-user` / `dev@local`; 404 unless `LOCAL_DEV === "true"`. Lets demo-mode frontends call `/api/compute/ensure` and open sessions without real auth `cloud/gateway/src/routes/auth.ts:326-335`.

## Cross-domain SSO

Other lmthing.\* SPAs delegate login to com/ via a single-use code exchanged for a gateway session.

- `POST /sso/create` (JWT): mints a 32-byte hex `code` with a **60-second** TTL and stores it via `db.insertSsoCode(user.id, code, redirect_uri, app, expiresAt)` `cloud/gateway/src/routes/auth.ts:255-277`.
- `POST /sso/exchange` (public): `db.findAndConsumeSsoCode(code, redirect_uri)` atomically consumes the row, then `zitadel.getUserById` + `signTokens` return `{ access_token, refresh_token, expires_at, user: { id, email } }` and best-effort provision `cloud/gateway/src/routes/auth.ts:280-317`.

The `sso_codes` table (id uuid, user_id **text**, code unique, redirect_uri, app, expires_at, used_at, created_at) is created idempotently by `ensureSchema()` on gateway boot `cloud/gateway/src/lib/db.ts:99-114`, which runs before the server starts serving `cloud/gateway/src/index.ts:50-53`.

### Client library `@lmthing/auth` (`sdk/org/libs/auth/`)

Consumed by the product SPAs. Key session mechanics in `sdk/org/libs/auth/src/client.ts`:

- Session is persisted in `localStorage["lmthing_session"]` as an `AuthSession` `sdk/org/libs/auth/src/client.ts#SESSION_KEY,218-227`, `sdk/org/libs/auth/src/types.ts#AuthSession`.
- `redirectToLogin` sends the browser to `{comUrl}/auth/sso?redirect_uri=&app=&state=`, storing a CSRF `state` in `sessionStorage` `sdk/org/libs/auth/src/client.ts#redirectToLogin`.
- `handleAuthCallback` verifies `state`, `POST`s `/api/auth/sso/exchange`, and stores the resulting session `sdk/org/libs/auth/src/client.ts#handleAuthCallback`.
- `refreshSession` `POST`s `/api/auth/refresh` `sdk/org/libs/auth/src/client.ts#refreshSession`; `ensureValidToken` refreshes when within `REFRESH_BUFFER` (60s) of `expiresAt`, clearing the session on failure `sdk/org/libs/auth/src/client.ts:7,118-145`.
- `authFetch` sets the Bearer header, and on `401` force-refreshes once and retries; it also transparently retries the Envoy activator's `{waking:true}` 503 up to `WAKE_RETRIES` (6 × 1200ms) so a scaled-to-zero pod self-heals `sdk/org/libs/auth/src/client.ts:161-204`.
- A pod-embedded app reads a bootstrap-injected `window.__LM_ACCESS_TOKEN__` (`getPodInjectedToken`/`isPodEmbedded`) `sdk/org/libs/auth/src/client.ts:229-239`.

#### Email sign-in is the one path with no browser hop — which is what makes it work on a phone

`requestEmailCode` / `verifyEmailCode` are two plain `fetch` calls against `/api/auth/email/*`, so there is nothing to fork per target and **no `platform/` seam at all** `sdk/org/libs/auth/src/email-login.ts#verifyEmailCode`. The mobile app signs a user in *inside the app*: no `WebBrowser.openAuthSessionAsync` sheet, no SSO code, no `state`, and therefore none of the cross-device problems the SSO path has. `AuthProvider` exposes them as `sendEmailCode` / `signInWithEmailCode`, and adopting the returned session flips `isAuthenticated` `sdk/org/libs/auth/src/AuthProvider.tsx#AuthProvider`.

The session it yields is mapped identically to `exchangeSsoCode`'s, deliberately: an address that signs in by email and one that signs in through GitHub resolve to **one** Zitadel user, so a session differing in shape between the two paths would be a latent bug in whatever consumes it `sdk/org/libs/auth/src/sso-exchange.ts#exchangeSsoCode`.

Two target-specific rules, both enforced by the native suite `sdk/org/libs/ui/metro/suites/auth-login.ts`:

- **Native sends no `redirect_uri`.** `isAllowedRedirect` accepts `http`/`https` only, so passing a `lmthing://auth/callback` deep link would `400` the whole request. `AuthProvider` supplies one only when `isWeb()` `sdk/org/libs/auth/src/AuthProvider.tsx#AuthProvider`.
- **No browser sheet may open.** A test asserts no auth URL is recorded during an email sign-in, so re-routing this through `/auth/sso` later fails loudly rather than silently reintroducing the sheet.

**GitHub sign-in still leaves the app, and must.** An OAuth handoff to an external identity provider has to happen in a real browser session (`ASWebAuthenticationSession` / Custom Tab) — embedding it in a WebView breaks GitHub's policy and is an app-store rejection risk. `platform/sso.native.ts` is the correct primitive, not a workaround. Only the email path can be fully in-app.

Both doors are rendered by one shared `LoginScreen` `sdk/org/libs/ui/src/components/auth/login-screen/index.tsx`. Two cross-platform traps it encodes: the field uses **`inputMode`** rather than RN's `keyboardType` (the one spelling React DOM and `TextInput` both accept, and the only one `InputProps` types), and it sets **no `autoCorrect`** — the DOM types it as a *string* while RN wants a *boolean*, so `"off"` would arrive truthy on a phone and switch autocorrect **on**, corrupting typed addresses.

**Demo mode**: `AuthProvider` uses a hardcoded `DEMO_SESSION` (accessToken `"demo"`, userId `demo-user`, email `demo@lmthing.local`) whenever `import.meta.env.VITE_DEMO_USER === 'true'` **or** `isLocalRun()` is true (localhost/loopback/`*.test`) `sdk/org/libs/auth/src/AuthProvider.tsx:27-40`, `sdk/org/libs/auth/src/client.ts#isLocalRun`. This pairs with the middleware's `"demo"` bypass above.

## API keys

Each user has LiteLLM keys carrying their tier's budget windows. Routes under `/api/keys` (all `authMiddleware`-guarded via `keys.use("*", authMiddleware)` `cloud/gateway/src/routes/keys.ts:9`):

- `GET /` — `litellm.listKeys(user.id)`, returning a safe projection (`token`, `key_alias`, `spend`, `max_budget`, `models`, `tier`, …) `cloud/gateway/src/routes/keys.ts:12-29`.
- `POST /` — reads the user's current tier from LiteLLM, then `litellm.generateKey(user.id, tier, name)`; returns `{ key, key_alias, tier, models, budget_limits }` `cloud/gateway/src/routes/keys.ts:32-59`.
- `DELETE /:token` — `litellm.deleteKey(token)` `cloud/gateway/src/routes/keys.ts:62-66`.

The register/provision flow issues the first key automatically `cloud/gateway/src/routes/auth.ts:61-66`. Tier→budget mapping (`toBudgetLimits`) and LiteLLM specifics are in [litellm.md](./litellm.md) and [billing-and-tiers.md](./billing-and-tiers.md).

## Environment variables

| Var | Used by | Purpose |
|---|---|---|
| `GATEWAY_JWT_SECRET` | tokens.ts | base64-encoded HS256 signing secret `cloud/gateway/src/lib/tokens.ts#secret` |
| `ZITADEL_URL` | zitadel.ts, auth middleware | Zitadel instance (`https://auth.lmthing.cloud`) `cloud/gateway/src/lib/zitadel.ts#ZITADEL_URL` |
| `ZITADEL_SERVICE_PAT` | zitadel.ts | machine-user PAT for the v2 admin API `cloud/gateway/src/lib/zitadel.ts#SERVICE_PAT,9-11` |
| `ZITADEL_CLIENT_ID` / `ZITADEL_CLIENT_SECRET` | zitadel.ts, auth middleware | OIDC client for password grant + introspection `cloud/gateway/src/lib/zitadel.ts:3-4`, `cloud/gateway/src/middleware/auth.ts:6-7` |
| `ZITADEL_GITHUB_IDP_ID` | zitadel.ts | optional; GitHub IDP id, else auto-discovered `cloud/gateway/src/lib/zitadel.ts#cachedGithubIdpId` |
| `BASE_URL` | auth.ts | OAuth callback/failure URL host, and the magic-link host `cloud/gateway/src/routes/auth.ts:147`, `cloud/gateway/src/lib/zitadel.ts#startIdpIntent` |
| `LOCAL_DEV` | auth middleware, auth.ts | enables the `"demo"` token bypass + `/demo-token`, and the email dev echo `cloud/gateway/src/middleware/auth.ts#LOCAL_DEV`, `cloud/gateway/src/routes/auth.ts:327` |
| `DATABASE_URL` | db.ts | Postgres for `sso_codes` + `email_login_codes` `cloud/gateway/src/lib/db.ts` |

All of the following are **optional**; with none of them set, email sign-in is off and `POST /api/auth/email/start` answers 503. Wired as optional `secretKeyRef`s in `devops/argocd/core/gateway.yaml` and populated from Ansible Vault in `devops/ansible/roles/cloud_secrets/tasks/main.yml`.

| Var | Used by | Purpose |
|---|---|---|
| `EMAIL_PROVIDER` | email.ts | force a transport: `resend` \| `smtp` \| `console`; unset ⇒ inferred from credentials `cloud/gateway/src/lib/email.ts#mailerKind` |
| `RESEND_API_KEY` | email.ts | bearer token for the Resend HTTPS API `cloud/gateway/src/lib/email.ts#sendViaResend` |
| `SMTP_HOST` / `SMTP_PORT` | email.ts | submission relay; port defaults to 587 `cloud/gateway/src/lib/email.ts#sendViaSmtp` |
| `SMTP_USER` / `SMTP_PASSWORD` | email.ts | relay credentials; omitted ⇒ AUTH is skipped entirely `cloud/gateway/src/lib/smtp.ts#sendSmtp` |
| `SMTP_SECURITY` | email.ts | `tls` \| `starttls` \| `none`; unset ⇒ `tls` on 465, else `starttls` `cloud/gateway/src/lib/email.ts#smtpSecurity` |
| `SMTP_INSECURE` | email.ts | `true` disables TLS certificate verification (self-signed relay only) `cloud/gateway/src/lib/email.ts#sendViaSmtp` |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | email.ts | sender; unset ⇒ `no-reply@<BASE_URL host>` as "lmthing" `cloud/gateway/src/lib/email.ts#fromAddress` |
| `EMAIL_LOGIN_ALLOWED_ORIGINS` | auth.ts | comma-separated exact origins replacing the magic-link redirect allowlist `cloud/gateway/src/lib/email-login.ts#isAllowedRedirect` |
| `EMAIL_DEV_ECHO` | auth.ts | `true` returns `dev_code`/`dev_link` when no transport is configured (dev/CI only) `cloud/gateway/src/routes/auth.ts:381` |

## The four things that most often trip people up

- **The broken login route is `/login` (password), not email sign-in.** `POST /api/auth/login` returns `{"error":"password not supported"}` because the Zitadel OIDC client has no password grant — [../../.issues/zitadel-password-login-disabled.md](../../../.issues/zitadel-password-login-disabled.md). Signing in with an email address works, it just does not use a password: `POST /api/auth/email/start` then `/email/verify`. Hand-minting a JWT (above) is now only needed when no mail transport is configured.
- **Two different demo identities.** The client's `DEMO_SESSION` user is `demo-user` / `demo@lmthing.local` `sdk/org/libs/auth/src/AuthProvider.tsx:27-40`; the gateway middleware's `"demo"`-token bypass resolves to `local-dev-user` / `dev@local` `cloud/gateway/src/middleware/auth.ts:24-28`.
- **Demo mode is not env-gated alone.** It engages when `import.meta.env.VITE_DEMO_USER === 'true'` **or** `isLocalRun()` (localhost/loopback/`*.test`) `sdk/org/libs/auth/src/AuthProvider.tsx:39`, `sdk/org/libs/auth/src/client.ts#isLocalRun`.
- **`GET /api/auth/demo-token` exists** (local dev only) `cloud/gateway/src/routes/auth.ts:326-335`, and the gateway mints **four** audience-scoped service tokens beyond the user session pair `cloud/gateway/src/lib/tokens.ts:113-251`.
