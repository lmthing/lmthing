# Gateway Routes

Every HTTP route the **Gateway** serves. The gateway is the sole backend (`cloud/gateway/`); a Hono app mounts one router per feature area under `/api/*`. LiteLLM's OpenAI-compatible `/v1/*` proxy is a separate service — see [./litellm.md](./litellm.md). Auth token mechanics → [./auth.md](./auth.md); tiers/budgets → [./billing-and-tiers.md](./billing-and-tiers.md); the pod-served (non-gateway) `/api/*` surface → [../cli-api/rest/README.md](../cli-api/rest/README.md).

## App wiring & mounts

The entry point builds the Hono app, applies CORS to `/api/*`, exposes a health check, then mounts each router `cloud/gateway/src/index.ts:18-45`:

| Mount | Router file | Section |
|---|---|---|
| `/api/auth` | `routes/auth.ts` | [Auth](#auth--apiauth) |
| `/api/keys` | `routes/keys.ts` | [Keys](#keys--apikeys) |
| `/api/billing` | `routes/billing.ts` | [Billing](#billing--apibilling) |
| `/api/stripe/webhook` | `routes/webhook.ts` | [Stripe webhook](#stripe-webhook--apistripewebhook) |
| `/api/compute` | `routes/compute.ts` | [Compute](#compute--apicompute) |
| `/api/backup` | `routes/backup.ts` | [Backup](#backup--apibackup) |
| `/api/inbound` | `routes/inbound.ts` | [Inbound broker](#inbound-webhook-broker--apiinbound) |
| `/api/status` | `routes/status.ts` | [Status](#status--apistatus) |
| `/api/issues` | `routes/issues.ts` | [Issues](#issues--apiissues) |
| `/api/teams` | `routes/teams.ts` | [Teams](#teams--apiteams) |
| `/api` (catch-all, **LOCAL_DEV only**) | `lib/pod-proxy.ts` | [Pod proxy](#local-dev-pod-proxy) |

- **CORS** — applied to all `/api/*`: `origin:"*"`, methods `GET/POST/PUT/DELETE/OPTIONS`, headers `Content-Type`/`Authorization` `cloud/gateway/src/index.ts:20-27`.
- **`GET /api/health`** → `{status:"ok"}`, no auth `cloud/gateway/src/index.ts:29`.
- On boot the gateway self-heals its own Postgres schema (`ensureSchema()`) and starts the cluster-status refresher `cloud/gateway/src/index.ts:50-64`.

## Auth models used across routes

Three distinct authentication schemes appear below. Do not conflate them.

1. **`authMiddleware`** (browser/user JWT) — `Authorization: Bearer <accessToken>`. Verifies a gateway-issued HS256 access token locally via `verifyAccessToken`; falls back to Zitadel introspection for legacy tokens; accepts the literal token `demo` only when `LOCAL_DEV=true`. Sets `c.get("user") = {id,email}` `cloud/gateway/src/middleware/auth.ts#authMiddleware`. Detail → [./auth.md](./auth.md).
2. **Scoped pod JWTs** (`aud`-pinned, 365d) — minted by the gateway and injected into the pod's `user-env` secret so the pod can call back with no user request in flight. Verified per-route (not by `authMiddleware`); the userId is always the token subject, never a request field. Two audiences are injected: `compute` (self-idle / cron + webhook manifests) `cloud/gateway/src/lib/tokens.ts:146-178`, written as `LMTHING_COMPUTE_JWT` on pod create/ensure `cloud/gateway/src/lib/compute.ts#injectComputeEnv`, `cloud/gateway/src/lib/compute.ts:651-654`; and `backup` (backup-token mint) `cloud/gateway/src/lib/tokens.ts:113-144`, written as `LMTHING_BACKUP_JWT` by `PUT /api/backup/config` `cloud/gateway/src/routes/backup.ts:147-155`.
3. **Provider signatures / opaque tokens** — Stripe's `stripe-signature` HMAC (`/api/stripe/webhook`), the signed `state` param (`aud:"backup-install"`, 10min) on the GitHub-App install callback `cloud/gateway/src/lib/tokens.ts:183-213`, and the long-lived `aud:"inbound"` `userToken` embedded in the public inbound URL `cloud/gateway/src/lib/tokens.ts:215-251`. No `Authorization` header. The inbound token is **not** injected into the pod — it is minted only by `GET /api/inbound/` and handed to the UI/external providers `cloud/gateway/src/routes/inbound.ts:55`.

## Complete route table

| Method | Path | Handler / router | Auth | Purpose |
|---|---|---|---|---|
| GET | `/api/health` | `index.ts:28` | none | Liveness `{status:"ok"}` |
| POST | `/api/auth/register` | `auth.ts:81` | none | Email+password signup → Zitadel user + provision (LiteLLM user + Stripe customer + free-tier key) |
| POST | `/api/auth/login` | `auth.ts:113` | none | Email+password login via Zitadel → gateway JWT pair (**broken in prod — Zitadel "password not supported"**; use `/email/start` instead) |
| POST | `/api/auth/email/start` | `auth.ts:354` | none — IP rate-limited (10 / 15min) | Passwordless sign-in: mail a 6-digit code + magic link to **any** address; 503 when no mailer is configured |
| POST | `/api/auth/email/verify` | `auth.ts:454` | none — IP rate-limited (30 / 15min) | Consume the 6-digit code → gateway JWT pair + `user`; creates the account on first sign-in |
| GET | `/api/auth/email/callback` | `auth.ts:506` | none (`?token`) | Consume the magic link → redirect to the recorded `redirect_uri` with tokens in the URL hash (or JSON when none was recorded) |
| GET | `/api/auth/oauth/url` | `auth.ts:140` | none | Start GitHub login via Zitadel IDP Intent; returns GitHub URL directly (needs `?redirect_to`) |
| GET | `/api/auth/oauth/callback` | `auth.ts:157` | none | Zitadel IDP Intent callback (`?id&token&state`) → provision → redirect with tokens in URL hash |
| POST | `/api/auth/provision` | `auth.ts:192` | JWT | Idempotently provision LiteLLM user + Stripe customer + API key for the caller |
| GET | `/api/auth/me` | `auth.ts:205` | JWT | Caller's `{user_id,email,tier,budget_limits,spend}` from LiteLLM metadata |
| POST | `/api/auth/refresh` | `auth.ts:227` | none (refresh token in body) | Exchange refresh token → new access+refresh pair |
| POST | `/api/auth/sso/create` | `auth.ts:255` | JWT | Mint single-use cross-domain SSO code (60s TTL) in Postgres |
| POST | `/api/auth/sso/exchange` | `auth.ts:280` | none (code in body) | Consume SSO code → gateway JWT session + provision |
| GET | `/api/auth/demo-token` | `auth.ts:326` | none — **LOCAL_DEV only** (else 404) | Signed JWT for `local-dev-user` (demo computer app) |
| GET | `/api/keys` | `keys.ts:12` | JWT | List caller's LiteLLM API keys (redacted subset) |
| POST | `/api/keys` | `keys.ts:32` | JWT | Create a new API key at the caller's current tier |
| DELETE | `/api/keys/:token` | `keys.ts:62` | JWT | Revoke (delete) an API key |
| POST | `/api/billing/checkout` | `billing.ts:63` | JWT | Create Stripe **embedded** Checkout session for a tier upgrade |
| POST | `/api/billing/portal` | `billing.ts:99` | JWT | Create Stripe Customer Portal session |
| GET | `/api/billing/usage` | `billing.ts:115` | JWT | Tier + overall spend + configured budget windows + models |
| GET | `/api/billing/budget` | `billing.ts:161` | JWT | Remaining % per rolling window (1d/7d/30d), computed with master key |
| GET | `/api/billing/checkout/status` | `billing.ts:205` | JWT | Poll a Stripe checkout session's `status`/`payment_status` (needs `?session_id`) |
| POST | `/api/stripe/webhook` | `webhook.ts:9` | Stripe sig | Subscription created/updated/deleted → tier change + pod lifecycle |
| GET | `/api/compute/version` | `compute.ts:208` | none | Latest built compute image tag (`COMPUTE_IMAGE_TAG`) |
| POST | `/api/compute/self-idle` | `compute.ts:93` | compute JWT | Pod reports activity: `idle:true`→scale-to-zero, `idle:false`→heartbeat |
| POST | `/api/compute/cron-manifest` | `compute.ts:117` | compute JWT | Pod publishes full cron schedule; gateway clamps to tier policy + stores |
| POST | `/api/compute/webhook-manifest` | `compute.ts:170` | compute JWT | Pod publishes its registered inbound webhook bindings |
| POST | `/api/compute/upgrade` | `compute.ts:214` | JWT | Rolling-restart the pod onto the latest compute image |
| GET | `/api/compute/status` | `compute.ts:227` | JWT | Pod status `{compute,tier,pod,podConfig}` (all tiers) |
| POST | `/api/compute/ensure` | `compute.ts:253` | JWT | Lazily provision/wake the pod; return connection + status |
| POST | `/api/compute/wake` | `compute.ts:286` | JWT | Fire-and-forget scale 0→1 (Envoy activator); returns 202 |
| POST | `/api/compute/wake-wait` | `compute.ts:309` | JWT | Blocking wake (≤8s); 200 ready / 202 not-yet |
| GET | `/api/compute/env` | `compute.ts:324` | JWT | List the pod's env vars |
| PUT | `/api/compute/env` | `compute.ts:339` | JWT | **Replace all** env vars (validated) → pod restart |
| GET | `/api/backup/install-url` | `backup.ts:31` | JWT | URL to start the GitHub-App backup install flow (503 if unconfigured) |
| GET | `/api/backup/callback` | `backup.ts:43` | none (signed `state`) | GitHub post-install redirect → store installation id |
| GET | `/api/backup/config` | `backup.ts:64` | JWT | Caller's backup config (never returns a token) |
| PUT | `/api/backup/config` | `backup.ts:88` | JWT | Validate repo + save settings + inject backup config & scoped JWT into pod env |
| POST | `/api/backup/token` | `backup.ts:167` | backup JWT | Pod mints a short-lived repo-scoped GitHub-App installation token |
| GET | `/api/inbound/` | `inbound.ts:52` | JWT | Caller's public broker base URL + inbound token + published bindings |
| POST | `/api/inbound/:userToken/:path` | `inbound.ts:114` | inbound token in URL | Public broker: verify token, rate-limit, wake pod, fire-and-forget forward (202) |
| GET | `/api/inbound/:userToken/:path` | `inbound.ts:166` | inbound token in URL | Provider subscription-verification handshake (synchronous echo of pod response) |
| GET | `/api/status/cluster` | `status.ts:27` | none (IP rate-limited) | Cached cluster status JSON (503 until warm) |
| GET | `/api/status/compute-fleet` | `status.ts:37` | none (IP rate-limited) | Cached compute-fleet JSON |
| GET | `/api/status/events` | `status.ts:47` | none (IP rate-limited) | Cached recent events JSON |
| GET | `/api/status/stream` | `status.ts:57` | none (IP + SSE-limited) | SSE stream of cluster/fleet/events updates |
| POST | `/api/issues` | `issues.ts:25` | JWT | File a bug-report GitHub issue + upload trace/screenshot artifacts (501 if unconfigured) |
| POST | `/api/teams` | `teams.ts:110` | JWT | Create a team (creator becomes its first editor) + provision its Stripe/LiteLLM principals |
| GET | `/api/teams` | `teams.ts:148` | JWT | Teams the caller is on + invites addressed to their email |
| GET | `/api/teams/:teamId` | `teams.ts:172` | JWT + member | Team, roster and pending invites |
| PUT | `/api/teams/:teamId` | `teams.ts:205` | JWT + **editor** | Rename the team |
| POST | `/api/teams/:teamId/members` | `teams.ts:226` | JWT + **editor** | Add by email, or record an invite if that email has no account |
| PUT | `/api/teams/:teamId/members/:userId` | `teams.ts:267` | JWT + **editor** | Change a member's role (409 if it would strand the team without an editor) |
| DELETE | `/api/teams/:teamId/members/:userId` | `teams.ts:290` | JWT + **editor**, or self | Remove a member; leaving is always your own right |
| DELETE | `/api/teams/:teamId/invites/:inviteId` | `teams.ts:312` | JWT + **editor** | Revoke a pending invite |
| POST | `/api/teams/invites/:inviteId/accept` | `teams.ts:331` | JWT | Claim an invite addressed to the caller's email |
| POST | `/api/teams/:teamId/token` | `teams.ts:353` | JWT + member | Mint the team-scoped token lmthing.team presents to the team's pod |
| POST | `/api/teams/:teamId/compute/ensure` | `teams.ts:388` | JWT + member | Provision/wake the TEAM's pod (namespace `team-<id>`) |
| GET | `/api/teams/:teamId/compute/status` | `teams.ts:405` | JWT + member | Team pod status `{compute,tier,pod,podConfig}` |
| POST | `/api/teams/:teamId/compute/upgrade` | `teams.ts:426` | JWT + **editor** | Rolling-restart the team pod onto the latest compute image |
| GET | `/api/teams/:teamId/compute/env` | `teams.ts:442` | JWT + **editor** | The team's env vars (its provider tokens — never readable by a viewer) |
| PUT | `/api/teams/:teamId/compute/env` | `teams.ts:460` | JWT + **editor** | **Replace all** team env vars → restarts the pod for every member |
| POST | `/api/teams/:teamId/billing/checkout` | `teams.ts:534` | JWT + **editor** | Stripe embedded Checkout for the TEAM's own subscription |
| POST | `/api/teams/:teamId/billing/portal` | `teams.ts:572` | JWT + **editor** | Stripe Customer Portal for the team |
| GET | `/api/teams/:teamId/billing/usage` | `teams.ts:596` | JWT + member | The team's tier, spend and budget windows |
| DELETE | `/api/teams/:teamId` | `teams.ts:638` | JWT + **editor** | Delete the team (409 while a subscription is active) |
| ALL | `/api/{sessions,spaces,state,events,asks,message,help,node}/*` | `pod-proxy.ts:35` | JWT (token or `?access_token`) | **LOCAL_DEV only** — proxy pod-served paths to the user's pod |

---

## Auth — `/api/auth/*`

Router `cloud/gateway/src/routes/auth.ts`. The shared `provisionUser(userId,email)` helper is idempotent: it returns early if the LiteLLM user already exists, otherwise creates a Stripe customer, a free-tier LiteLLM user, and an API key `cloud/gateway/src/routes/auth.ts#provisionUser`.

- **`POST /register`** — requires `email`+`password` (≥8 chars); creates the Zitadel user then provisions. 400 on validation/Zitadel failure, 500 on provisioning failure (returns `user_id`) `cloud/gateway/src/routes/auth.ts:81-110`.
- **`POST /login`** — verifies credentials via `zitadel.loginWithPassword`, then issues the gateway's OWN token pair (`signTokens`) rather than a Zitadel token; 401 on failure `cloud/gateway/src/routes/auth.ts:113-137`.

  > Production note: `/login` returns 401 because Zitadel password grant is disabled ("password not supported"); see the repo's `.issues/zitadel-password-login-disabled.md`. The working email path is `/email/start` + `/email/verify` (below), which needs no password at all.

- **`POST /email/start`** — passwordless sign-in for **any** address. Normalizes + validates the address, optionally validates `redirect_uri` against an origin allowlist, checks the per-mailbox send throttle, stores hashes of a fresh 6-digit code and magic-link token, and mails both. Returns `{sent, email (masked), expires_at}` `cloud/gateway/src/routes/auth.ts:354-451`. 400 on a bad address or a disallowed `redirect_uri`, 429 on the throttle, **503 when no mail transport is configured**, 502 when delivery fails.
- **`POST /email/verify`** — `{email, code}` → consumes the row and issues the gateway pair plus `user` `cloud/gateway/src/routes/auth.ts:454-503`. 401 on a wrong/expired/spent code, with `attempts_remaining` counting down to the 5-guess cap.
- **`GET /email/callback?token=`** — the magic link. Consumes the row, then `302`-redirects to the recorded `redirect_uri` with the token trio in the **URL hash fragment** (the same shape `/oauth/callback` produces), or returns the session as JSON when no `redirect_uri` was recorded `cloud/gateway/src/routes/auth.ts:506-529`.

  Both verification paths resolve the identity through `zitadel.findOrCreateUserByEmail`, so an unseen address gets an account and a known one lands in the account it already has `cloud/gateway/src/lib/zitadel.ts#findOrCreateUserByEmail`. Full model → [./auth.md](./auth.md#passwordless-email-sign-in-magic-link--one-time-code).

- **`GET /oauth/url`** — requires `?redirect_to`; encodes it into the callback's `state` (base64url) and returns the GitHub URL from `zitadel.startIdpIntent` `cloud/gateway/src/routes/auth.ts:140-154`.
- **`GET /oauth/callback`** — resolves the IDP intent (`?id&token`), signs tokens, best-effort provisions, and `302`-redirects to the decoded `state` with `access_token`/`refresh_token`/`expires_at` in the **URL hash fragment** `cloud/gateway/src/routes/auth.ts:157-189`.
- **`POST /provision`** (JWT) — run `provisionUser` for the caller `cloud/gateway/src/routes/auth.ts:192-202`.
- **`GET /me`** (JWT) — `{user_id,email,tier,budget_limits,spend}` from LiteLLM `getUserInfo`; degrades to `tier:"free"` on error `cloud/gateway/src/routes/auth.ts:205-224`.
- **`POST /refresh`** — verifies the refresh JWT, re-reads the email from Zitadel, re-issues a pair `cloud/gateway/src/routes/auth.ts:227-248`.
- **`POST /sso/create`** (JWT) — requires `redirect_uri`+`app`; stores a 32-byte hex code with a 60s expiry in Postgres `cloud/gateway/src/routes/auth.ts:255-277`.
- **`POST /sso/exchange`** — `findAndConsumeSsoCode` (single-use), re-reads the Zitadel user, signs tokens, best-effort provisions, returns the pair + `user` `cloud/gateway/src/routes/auth.ts:280-317`.
- **`GET /demo-token`** — 404 unless `LOCAL_DEV=true`; returns a signed JWT for `local-dev-user`/`dev@local` `cloud/gateway/src/routes/auth.ts:326-335`.

## Keys — `/api/keys/*`

`authMiddleware` applied to the whole router `cloud/gateway/src/routes/keys.ts:9`. Thin CRUD over LiteLLM keys:

- **`GET /`** — `litellm.listKeys`, returns a redacted projection (`token,key_alias,spend,max_budget,models,tier,…`) `cloud/gateway/src/routes/keys.ts:12-29`.
- **`POST /`** — resolves the caller's tier, generates a key with that tier's limits, returns key + `budget_limits` `cloud/gateway/src/routes/keys.ts:32-59`.
- **`DELETE /:token`** — `litellm.deleteKey(token)` → `{deleted:true}` `cloud/gateway/src/routes/keys.ts:62-66`.

## Billing — `/api/billing/*`

`authMiddleware` on the whole router `cloud/gateway/src/routes/billing.ts:21`. `ensureStripeCustomer` lazily creates+stores a Stripe customer id in LiteLLM metadata `cloud/gateway/src/routes/billing.ts#ensureStripeCustomer`. Full tier/budget model → [./billing-and-tiers.md](./billing-and-tiers.md).

- **`POST /checkout`** — validates `tier` has a `stripePriceId`, creates an **embedded** (`ui_mode:"embedded"`) subscription Checkout session with `user_id`+`tier` metadata, returns `client_secret` `cloud/gateway/src/routes/billing.ts:63-96`.
- **`POST /portal`** — Customer Portal session → `{url}` `cloud/gateway/src/routes/billing.ts:99-109`.
- **`GET /usage`** — `{tier,spend,budgets,models}`; `budgets` maps the tier's configured windows onto LiteLLM per-window spend when available `cloud/gateway/src/routes/billing.ts:115-154`.
- **`GET /budget`** — remaining % per rolling window, computed with the **master key** (so an over-budget user key can't 429 the read) by summing `/user/daily/activity` anchored to `created_at`; helpers in `lib/budget-math.ts`. 502 on failure `cloud/gateway/src/routes/billing.ts:161-202`.
- **`GET /checkout/status`** — requires `?session_id`; returns `{status,payment_status}` `cloud/gateway/src/routes/billing.ts:205-216`.

## Stripe webhook — `/api/stripe/webhook`

`POST /` verifies the `stripe-signature` HMAC against `STRIPE_WEBHOOK_SECRET` (400 on failure), then switches on event type `cloud/gateway/src/routes/webhook.ts:9-32`:

- `customer.subscription.created` / `.updated` → resolve tier by price id (`getTierByPriceId`), `updateUserTier`, then idempotent `ensurePod` (handles upgrade/downgrade resizing) `cloud/gateway/src/routes/webhook.ts:33-74`.
- `customer.subscription.deleted` → downgrade to free + `deletePod` (full namespace teardown) `cloud/gateway/src/routes/webhook.ts:76-103`.
- Always returns `{received:true}` `cloud/gateway/src/routes/webhook.ts:109`.

## Compute — `/api/compute/*`

Router `cloud/gateway/src/routes/compute.ts`. Backed by the K8s client in `lib/compute.ts`. Two distinct auth regimes: pod-callback routes use the **compute JWT** (`computeUser()` extracts+verifies the `aud:"compute"` token → userId `cloud/gateway/src/routes/compute.ts#computeUser`); browser routes use `authMiddleware`. `resolveUserTier()` reads the tier from LiteLLM metadata, defaulting to `free` `cloud/gateway/src/routes/compute.ts#resolveUserTier`.

Pod-callback routes (compute JWT — pod acts only on its own namespace):
- **`POST /self-idle`** — body `{idle?}` (empty body ⇒ idle); `reportPodActivity` scales to zero or heartbeats `cloud/gateway/src/routes/compute.ts:93-110`.
- **`POST /cron-manifest`** — body `{jobs:[{projectId,slug,cronExpr,everyMs,nextRunAt}]}`. Dedupes, clamps `everyMs` up to the tier's `minIntervalMs`, applies deterministic per-job jitter (≤5min), caps at `maxJobs`, then `replaceCronManifest` `cloud/gateway/src/routes/compute.ts:117-162`.
- **`POST /webhook-manifest`** — body `{bindings:[{projectId,path,provider,agentRef}]}`; dedupes by `path` and `upsertWebhookBindings` so the inbound broker can resolve paths without asking the pod `cloud/gateway/src/routes/compute.ts:170-205`.

Public route (no middleware on the handler):
- **`GET /version`** — `{tag: COMPUTE_IMAGE_TAG || null}` `cloud/gateway/src/routes/compute.ts:208-210`.

Browser routes (`authMiddleware` applied per-handler, not router-wide):
- **`POST /upgrade`** — `restartPod` (rolling) → `{ok:true}` `cloud/gateway/src/routes/compute.ts:214-223`.
- **`GET /status`** — `{compute:true,tier,pod,podConfig}`; returns `compute:true` for **all tiers** (the pod may be scaled to zero) and never gates on tier — a K8s error degrades to `pod:{exists:false,ready:false,phase:"error"}` rather than a 403 `cloud/gateway/src/routes/compute.ts:225-249`.
- **`POST /ensure`** — resolve tier, `ensurePod(user.id, tier.pod)`, return `{ok,tier,podConfig,connection,pod}` `cloud/gateway/src/routes/compute.ts:253-277`.
- **`POST /wake`** — Envoy activator path; `wakePod` fire-and-forget, 202 `{ok,waking:true}` `cloud/gateway/src/routes/compute.ts:286-297`.
- **`POST /wake-wait`** — `wakeAndWaitPod(user.id, 8000)`; 200 if ready else 202 `cloud/gateway/src/routes/compute.ts:309-320`.
- **`GET /env`** — `{vars}` from the pod's `user-env` secret `cloud/gateway/src/routes/compute.ts:324-334`.
- **`PUT /env`** — body `{vars}`; validates keys against `/^[A-Za-z_][A-Za-z0-9_]*$/`, values must be strings, ≤100 vars; `setEnvVars` **replaces the whole secret** (clients must GET+merge first) and restarts the pod `cloud/gateway/src/routes/compute.ts:339-381`.

## Backup — `/api/backup/*`

Router `cloud/gateway/src/routes/backup.ts`. GitHub-App-based workspace backup; repo must match `^[\w.-]+\/[\w.-]+$`, default branch `lmthing-backup` `cloud/gateway/src/routes/backup.ts:25-26`.

- **`GET /install-url`** (JWT) — 503 if `!isGithubAppConfigured()`; signs a 10min install-state JWT carrying `?redirect_to`, returns the App install URL `cloud/gateway/src/routes/backup.ts:31-39`.
- **`GET /callback`** — public; GitHub redirect with `?installation_id&state`. Verifies the signed state, stores the installation id, redirects to `redirectTo` `cloud/gateway/src/routes/backup.ts:43-61`.
- **`GET /config`** (JWT) — returns `{configured,connected,repo,auto,intervalMinutes,branch,lastBackupAt,lastCommitSha,status,error}`; never a token `cloud/gateway/src/routes/backup.ts:64-84`.
- **`PUT /config`** (JWT) — validates repo shape; clamps interval to 5–1440 min; requires a prior installation; `checkBackupRepo` must find it reachable & empty (404 not-found / 409 not-empty / 502 on GitHub error). On success saves settings and injects `GITHUB_BACKUP_*` config + a signed `LMTHING_BACKUP_JWT` into pod env (GET+merge+PUT) `cloud/gateway/src/routes/backup.ts:88-162`.
- **`POST /token`** — called **by the pod** with its `aud:"backup"` JWT (not the user token); mints a short-lived repo-scoped installation token so GitHub credentials never live in the pod `cloud/gateway/src/routes/backup.ts:167-193`.

## Inbound webhook broker — `/api/inbound/*`

Router `cloud/gateway/src/routes/inbound.ts`. The **inbound** half of the event pipeline: external providers POST to a per-user public URL; the gateway wakes the pod and forwards. The pod publishes its bindings via `POST /api/compute/webhook-manifest` (above); this router reads them back. Authoring model → the events-and-hooks skill; pod-side handling → [../cli-api/rest/webhooks.md](../cli-api/rest/webhooks.md).

- **`GET /`** (JWT) — for the UI: `{baseUrl,token,bindings}` where `token` is a long-lived `aud:"inbound"` JWT and `baseUrl = <BASE_URL>/api/inbound/<token>` `cloud/gateway/src/routes/inbound.ts:52-66`.
- **`POST /:userToken/:path`** — public broker. `verifyInboundToken` (the URL token IS the auth; 401 if bad), a per-user in-memory token-bucket rate-limit (429; capacity/refill env-tunable, fail-open) `cloud/gateway/src/routes/inbound.ts:75-106`, wakes the pod with a bounded wait, then **fire-and-forget** forwards the raw body + safe headers (`content-type` + `x-*`, plus `x-lmthing-inbound-url`) to `<podBase>/api/inbound/<path>` and returns 202 `cloud/gateway/src/routes/inbound.ts:114-158`.
- **`GET /:userToken/:path`** — provider subscription-verification handshake (e.g. Meta/WhatsApp `hub.*`). Unlike POST this awaits the pod and relays its status/body verbatim so the challenge echoes back; 503 if pod unavailable, 502 on forward failure `cloud/gateway/src/routes/inbound.ts:166-207`.

## Status — `/api/status/*`

Router `cloud/gateway/src/routes/status.ts`; all routes IP-rate-limited (`statusRateLimit()`: token bucket, 60/min/IP `cloud/gateway/src/middleware/rate-limit.ts:9-66`). Data comes from the in-memory caches maintained by `lib/cluster-status.ts`.

- **`GET /cluster`**, **`GET /compute-fleet`**, **`GET /events`** — return the cached JSON blob (`Cache-Control:no-store`) or 503 + `Retry-After:10` until the first refresh lands `cloud/gateway/src/routes/status.ts:27-55`.
- **`GET /stream`** — SSE. Enforces per-IP (3) + global (200) connection caps (`checkSseLimits`), sends an initial snapshot, pings every idle 60s, and closes after a 10-min max lifetime `cloud/gateway/src/routes/status.ts:57-137`, `cloud/gateway/src/middleware/rate-limit.ts:68-93`.

## Issues — `/api/issues`

`authMiddleware` on the router `cloud/gateway/src/routes/issues.ts:14`. **`POST /`** files a bug-report GitHub issue: 501 if `!isIssuesConfigured()`; requires non-empty `title`+`message`; optionally uploads `trace` (ndjson) and `screenshot` (png) as artifacts, embeds them in the issue body, and returns the created issue. 502 on GitHub error `cloud/gateway/src/routes/issues.ts:25-97`. Repo targets are `GITHUB_ISSUES_REPO` (issues) and `GITHUB_BUGREPORT_REPO` (artifacts).

## Teams — `/api/teams/*`

Router `cloud/gateway/src/routes/teams.ts`, `authMiddleware` applied router-wide `cloud/gateway/src/routes/teams.ts:38`. These are **control-plane** routes taking a personal access token — they answer "which teams am I on". Reaching a team's pod is a separate step: `POST /:teamId/token` mints a team-scoped JWT (claims `team` + `role`, 1h TTL) that the edge routes to the team's namespace `cloud/gateway/src/lib/tokens.ts#signTeamToken`. Full model → [./teams.md](./teams.md).

Every route resolves membership through `requireMember(c, teamId, minRole?)` `cloud/gateway/src/routes/teams.ts#requireMember`; a non-member gets **404** whether or not the team exists, so team ids are not probeable.

- **`POST /`** — non-blank `name` ≤100 chars `cloud/gateway/src/routes/teams.ts:116-121`; writes the row (creator seated as first editor in one transaction `cloud/gateway/src/lib/db.ts#createTeam`), then best-effort `provisionTeam` creates the team's own Stripe customer (`metadata.team_id`) and free-tier LiteLLM user keyed `team-<id>` `cloud/gateway/src/routes/teams.ts#provisionTeam`.
- **`GET /`** — `{teams:[{id,name,role}], invites:[{id,team_name,role,expires_at}]}`; invites are matched on the caller's session email `cloud/gateway/src/routes/teams.ts:148-170`.
- **`POST /:teamId/members`** (editor) — `{email, role}`, role defaulting to `viewer`. If `zitadel.getUserByEmail` resolves the address they join immediately (`{status:"added"}`); otherwise a pending invite row is written (`{status:"invited"}`) `cloud/gateway/src/routes/teams.ts:226-265`. There is no mailer — invites are claimed on next login.
- **`PUT|DELETE /:teamId/members/:userId`** (editor) — role change / removal, both refusing to leave a team without an editor (409) `cloud/gateway/src/lib/db.ts#updateTeamMemberRole`, `cloud/gateway/src/lib/db.ts#removeTeamMember`. Removing **yourself** needs only membership `cloud/gateway/src/routes/teams.ts:290-310`.
- **`POST /invites/:inviteId/accept`** — not under `/:teamId`, since accepting is what makes you a member. Addressee, expiry and the single-use stamp are re-checked inside one transaction `cloud/gateway/src/lib/db.ts#acceptTeamInvite`; 403 when the invite isn't claimable by this account.
- **`POST /:teamId/token`** (member) — `{access_token, expires_at, role}`; the role is read from the DB at mint time, never from the client `cloud/gateway/src/routes/teams.ts:353-367`.
- **`/:teamId/billing/*`** (editor, except `usage`) — the team pays for itself. Checkout writes `team_id` and **no** `user_id` into `subscription_data.metadata` `cloud/gateway/src/routes/teams.ts:534-574`, which is what keeps the Stripe webhook's team and user branches disjoint. `usage` reads the team's own LiteLLM principal, so every member can see what the team is spending even though only an editor can change it.
- **`DELETE /:teamId`** (editor) — refuses with **409** while the team has an active Stripe subscription, since deleting the row would orphan it; then tears down the pod BEFORE the row, so a failure leaves a retryable team rather than a namespace nothing owns `cloud/gateway/src/routes/teams.ts:638-683`.
- **`/:teamId/compute/*`** — the team's pod, mirroring `/api/compute/*` but keyed on the team's principal and gated on membership `cloud/gateway/src/routes/teams.ts:388-502`. Still a *personal* token: these are control-plane operations about a team you belong to. `env` (both verbs) and `upgrade` are **editor-only** — env values are the team's provider credentials, and `PUT` replaces the whole secret and rolls the pod for every member.

## Local-dev pod proxy

Mounted only when `LOCAL_DEV=true` `cloud/gateway/src/index.ts:44-46`. In production, Envoy Gateway (Lua + JWT extraction) handles this routing to the pod instead. The catch-all `podProxy.all("*")` serves only the pod-owned path prefixes — `/api/{sessions,spaces,state,events,asks,message,help,node}` — 404-ing anything else `cloud/gateway/src/lib/pod-proxy.ts:22-39`. It resolves the token (`?access_token` query first, else the `Authorization` header; `demo` accepted in LOCAL_DEV), maps to the user's pod URL (503 if not ready), and streams the proxied response `cloud/gateway/src/lib/pod-proxy.ts:41-68`. `attachWsProxy` additionally upgrades `wss://…/api/ws?access_token=<JWT>` to the pod's NodePort by piping raw TCP sockets `cloud/gateway/src/lib/pod-proxy.ts#attachWsProxy` (wired from `cloud/gateway/src/index.ts:60-62`). These pod-served endpoints are documented under [../cli-api/rest/README.md](../cli-api/rest/README.md).

## Cross-references

- Token issuance/verification, Zitadel identity, SSO, middleware → [./auth.md](./auth.md)
- Teams — the principal model, membership tables, the team-scoped token → [./teams.md](./teams.md)
- Tiers, budget windows, Stripe products, LiteLLM provisioning → [./billing-and-tiers.md](./billing-and-tiers.md)
- LiteLLM `/v1/*` OpenAI-compatible proxy → [./litellm.md](./litellm.md)
- The pod's own REST API (the target of the inbound forward and the local-dev proxy) → [../cli-api/rest/README.md](../cli-api/rest/README.md)
