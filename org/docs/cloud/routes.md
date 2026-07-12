# Gateway Routes

Every HTTP route the **Gateway** serves. The gateway is the sole backend (`cloud/gateway/`); a Hono app mounts one router per feature area under `/api/*`. LiteLLM's OpenAI-compatible `/v1/*` proxy is a separate service — see [./litellm.md](./litellm.md). Auth token mechanics → [./auth.md](./auth.md); tiers/budgets → [./billing-and-tiers.md](./billing-and-tiers.md); the pod-served (non-gateway) `/api/*` surface → [../cli-api/rest/README.md](../cli-api/rest/README.md).

## App wiring & mounts

The entry point builds the Hono app, applies CORS to `/api/*`, exposes a health check, then mounts each router `cloud/gateway/src/index.ts:17-44`:

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
| `/api` (catch-all, **LOCAL_DEV only**) | `lib/pod-proxy.ts` | [Pod proxy](#local-dev-pod-proxy) |

- **CORS** — applied to all `/api/*`: `origin:"*"`, methods `GET/POST/PUT/DELETE/OPTIONS`, headers `Content-Type`/`Authorization` `cloud/gateway/src/index.ts:19-26`.
- **`GET /api/health`** → `{status:"ok"}`, no auth `cloud/gateway/src/index.ts:28`.
- On boot the gateway self-heals its own Postgres schema (`ensureSchema()`) and starts the cluster-status refresher `cloud/gateway/src/index.ts:48-62`.

## Auth models used across routes

Three distinct authentication schemes appear below. Do not conflate them.

1. **`authMiddleware`** (browser/user JWT) — `Authorization: Bearer <accessToken>`. Verifies a gateway-issued HS256 access token locally via `verifyAccessToken`; falls back to Zitadel introspection for legacy tokens; accepts the literal token `demo` only when `LOCAL_DEV=true`. Sets `c.get("user") = {id,email}` `cloud/gateway/src/middleware/auth.ts:16-67`. Detail → [./auth.md](./auth.md).
2. **Scoped pod JWTs** (`aud`-pinned, 365d) — minted by the gateway and injected into the pod's `user-env` secret so the pod can call back with no user request in flight. Verified per-route (not by `authMiddleware`); the userId is always the token subject, never a request field. Audiences: `backup` (backup token mint) `cloud/gateway/src/lib/tokens.ts:56-87`, `compute` (self-idle / manifests) `cloud/gateway/src/lib/tokens.ts:89-121`, `inbound` (public broker URL) `cloud/gateway/src/lib/tokens.ts:158-194`.
3. **Provider signatures / opaque tokens** — Stripe's `stripe-signature` HMAC (`/api/stripe/webhook`), the signed `state` param on the GitHub-App install callback, and the long-lived `userToken` embedded in the public inbound URL. No `Authorization` header.

## Complete route table

| Method | Path | Handler / router | Auth | Purpose |
|---|---|---|---|---|
| GET | `/api/health` | `index.ts:28` | none | Liveness `{status:"ok"}` |
| POST | `/api/auth/register` | `auth.ts:62` | none | Email+password signup → Zitadel user + provision (LiteLLM user + Stripe customer + free-tier key) |
| POST | `/api/auth/login` | `auth.ts:94` | none | Email+password login via Zitadel → gateway JWT pair (**broken in prod — Zitadel "password not supported"**) |
| GET | `/api/auth/oauth/url` | `auth.ts:121` | none | Start GitHub login via Zitadel IDP Intent; returns GitHub URL directly (needs `?redirect_to`) |
| GET | `/api/auth/oauth/callback` | `auth.ts:138` | none | Zitadel IDP Intent callback (`?id&token&state`) → provision → redirect with tokens in URL hash |
| POST | `/api/auth/provision` | `auth.ts:173` | JWT | Idempotently provision LiteLLM user + Stripe customer + API key for the caller |
| GET | `/api/auth/me` | `auth.ts:186` | JWT | Caller's `{user_id,email,tier,budget_limits,spend}` from LiteLLM metadata |
| POST | `/api/auth/refresh` | `auth.ts:208` | none (refresh token in body) | Exchange refresh token → new access+refresh pair |
| POST | `/api/auth/sso/create` | `auth.ts:236` | JWT | Mint single-use cross-domain SSO code (60s TTL) in Postgres |
| POST | `/api/auth/sso/exchange` | `auth.ts:261` | none (code in body) | Consume SSO code → gateway JWT session + provision |
| GET | `/api/auth/demo-token` | `auth.ts:307` | none — **LOCAL_DEV only** (else 404) | Signed JWT for `local-dev-user` (demo computer app) |
| GET | `/api/keys` | `keys.ts:12` | JWT | List caller's LiteLLM API keys (redacted subset) |
| POST | `/api/keys` | `keys.ts:32` | JWT | Create a new API key at the caller's current tier |
| DELETE | `/api/keys/:token` | `keys.ts:62` | JWT | Revoke (delete) an API key |
| POST | `/api/billing/checkout` | `billing.ts:63` | JWT | Create Stripe **embedded** Checkout session for a tier upgrade |
| POST | `/api/billing/portal` | `billing.ts:99` | JWT | Create Stripe Customer Portal session |
| GET | `/api/billing/usage` | `billing.ts:115` | JWT | Tier + overall spend + configured budget windows + models |
| GET | `/api/billing/budget` | `billing.ts:161` | JWT | Remaining % per rolling window (1d/7d/30d), computed with master key |
| GET | `/api/billing/checkout/status` | `billing.ts:205` | JWT | Poll a Stripe checkout session's `status`/`payment_status` (needs `?session_id`) |
| POST | `/api/stripe/webhook` | `webhook.ts:9` | Stripe sig | Subscription created/updated/deleted → tier change + pod lifecycle |
| GET | `/api/compute/version` | `compute.ts:180` | none | Latest built compute image tag (`COMPUTE_IMAGE_TAG`) |
| POST | `/api/compute/self-idle` | `compute.ts:65` | compute JWT | Pod reports activity: `idle:true`→scale-to-zero, `idle:false`→heartbeat |
| POST | `/api/compute/cron-manifest` | `compute.ts:89` | compute JWT | Pod publishes full cron schedule; gateway clamps to tier policy + stores |
| POST | `/api/compute/webhook-manifest` | `compute.ts:142` | compute JWT | Pod publishes its registered inbound webhook bindings |
| POST | `/api/compute/upgrade` | `compute.ts:186` | JWT | Rolling-restart the pod onto the latest compute image |
| GET | `/api/compute/status` | `compute.ts:199` | JWT | Pod status `{compute,tier,pod,podConfig}` (all tiers) |
| POST | `/api/compute/ensure` | `compute.ts:225` | JWT | Lazily provision/wake the pod; return connection + status |
| POST | `/api/compute/wake` | `compute.ts:258` | JWT | Fire-and-forget scale 0→1 (Envoy activator); returns 202 |
| POST | `/api/compute/wake-wait` | `compute.ts:277` | JWT | Blocking wake (≤8s); 200 ready / 202 not-yet |
| GET | `/api/compute/env` | `compute.ts:291` | JWT | List the pod's env vars |
| PUT | `/api/compute/env` | `compute.ts:306` | JWT | **Replace all** env vars (validated) → pod restart |
| GET | `/api/backup/install-url` | `backup.ts:31` | JWT | URL to start the GitHub-App backup install flow (503 if unconfigured) |
| GET | `/api/backup/callback` | `backup.ts:43` | none (signed `state`) | GitHub post-install redirect → store installation id |
| GET | `/api/backup/config` | `backup.ts:64` | JWT | Caller's backup config (never returns a token) |
| PUT | `/api/backup/config` | `backup.ts:88` | JWT | Validate repo + save settings + inject backup config & scoped JWT into pod env |
| POST | `/api/backup/token` | `backup.ts:167` | backup JWT | Pod mints a short-lived repo-scoped GitHub-App installation token |
| GET | `/api/inbound/` | `inbound.ts:51` | JWT | Caller's public broker base URL + inbound token + published bindings |
| POST | `/api/inbound/:userToken/:path` | `inbound.ts:113` | inbound token in URL | Public broker: verify token, rate-limit, wake pod, fire-and-forget forward (202) |
| GET | `/api/inbound/:userToken/:path` | `inbound.ts:165` | inbound token in URL | Provider subscription-verification handshake (synchronous echo of pod response) |
| GET | `/api/status/cluster` | `status.ts:27` | none (IP rate-limited) | Cached cluster status JSON (503 until warm) |
| GET | `/api/status/compute-fleet` | `status.ts:37` | none (IP rate-limited) | Cached compute-fleet JSON |
| GET | `/api/status/events` | `status.ts:47` | none (IP rate-limited) | Cached recent events JSON |
| GET | `/api/status/stream` | `status.ts:57` | none (IP + SSE-limited) | SSE stream of cluster/fleet/events updates |
| POST | `/api/issues` | `issues.ts:25` | JWT | File a bug-report GitHub issue + upload trace/screenshot artifacts (501 if unconfigured) |
| ALL | `/api/{sessions,spaces,state,events,asks,message,help,node}/*` | `pod-proxy.ts:35` | JWT (token or `?access_token`) | **LOCAL_DEV only** — proxy pod-served paths to the user's pod |

---

## Auth — `/api/auth/*`

Router `cloud/gateway/src/routes/auth.ts`. The shared `provisionUser(userId,email)` helper is idempotent: it returns early if the LiteLLM user already exists, otherwise creates a Stripe customer, a free-tier LiteLLM user, and an API key `cloud/gateway/src/routes/auth.ts:15-55`.

- **`POST /register`** — requires `email`+`password` (≥8 chars); creates the Zitadel user then provisions. 400 on validation/Zitadel failure, 500 on provisioning failure (returns `user_id`) `cloud/gateway/src/routes/auth.ts:62-91`.
- **`POST /login`** — verifies credentials via `zitadel.loginWithPassword`, then issues the gateway's OWN token pair (`signTokens`) rather than a Zitadel token; 401 on failure `cloud/gateway/src/routes/auth.ts:94-118`.

  > Production note: `/login` returns 401 because Zitadel password grant is disabled ("password not supported"); see the repo's `.issues/zitadel-password-login-disabled.md`. OAuth is the working path.

- **`GET /oauth/url`** — requires `?redirect_to`; encodes it into the callback's `state` (base64url) and returns the GitHub URL from `zitadel.startIdpIntent` `cloud/gateway/src/routes/auth.ts:121-135`.
- **`GET /oauth/callback`** — resolves the IDP intent (`?id&token`), signs tokens, best-effort provisions, and `302`-redirects to the decoded `state` with `access_token`/`refresh_token`/`expires_at` in the **URL hash fragment** `cloud/gateway/src/routes/auth.ts:138-170`.
- **`POST /provision`** (JWT) — run `provisionUser` for the caller `cloud/gateway/src/routes/auth.ts:173-183`.
- **`GET /me`** (JWT) — `{user_id,email,tier,budget_limits,spend}` from LiteLLM `getUserInfo`; degrades to `tier:"free"` on error `cloud/gateway/src/routes/auth.ts:186-205`.
- **`POST /refresh`** — verifies the refresh JWT, re-reads the email from Zitadel, re-issues a pair `cloud/gateway/src/routes/auth.ts:208-229`.
- **`POST /sso/create`** (JWT) — requires `redirect_uri`+`app`; stores a 32-byte hex code with a 60s expiry in Postgres `cloud/gateway/src/routes/auth.ts:236-258`.
- **`POST /sso/exchange`** — `findAndConsumeSsoCode` (single-use), re-reads the Zitadel user, signs tokens, best-effort provisions, returns the pair + `user` `cloud/gateway/src/routes/auth.ts:261-298`.
- **`GET /demo-token`** — 404 unless `LOCAL_DEV=true`; returns a signed JWT for `local-dev-user`/`dev@local` `cloud/gateway/src/routes/auth.ts:307-316`.

## Keys — `/api/keys/*`

`authMiddleware` applied to the whole router `cloud/gateway/src/routes/keys.ts:9`. Thin CRUD over LiteLLM keys:

- **`GET /`** — `litellm.listKeys`, returns a redacted projection (`token,key_alias,spend,max_budget,models,tier,…`) `cloud/gateway/src/routes/keys.ts:12-29`.
- **`POST /`** — resolves the caller's tier, generates a key with that tier's limits, returns key + `budget_limits` `cloud/gateway/src/routes/keys.ts:32-59`.
- **`DELETE /:token`** — `litellm.deleteKey(token)` → `{deleted:true}` `cloud/gateway/src/routes/keys.ts:62-66`.

## Billing — `/api/billing/*`

`authMiddleware` on the whole router `cloud/gateway/src/routes/billing.ts:21`. `ensureStripeCustomer` lazily creates+stores a Stripe customer id in LiteLLM metadata `cloud/gateway/src/routes/billing.ts:24-60`. Full tier/budget model → [./billing-and-tiers.md](./billing-and-tiers.md).

- **`POST /checkout`** — validates `tier` has a `stripePriceId`, creates an **embedded** (`ui_mode:"embedded"`) subscription Checkout session with `user_id`+`tier` metadata, returns `client_secret` `cloud/gateway/src/routes/billing.ts:63-96`.
- **`POST /portal`** — Customer Portal session → `{url}` `cloud/gateway/src/routes/billing.ts:99-109`.
- **`GET /usage`** — `{tier,spend,budgets,models}`; `budgets` maps the tier's configured windows onto LiteLLM per-window spend when available `cloud/gateway/src/routes/billing.ts:115-154`.
- **`GET /budget`** — remaining % per rolling window, computed with the **master key** (so an over-budget user key can't 429 the read) by summing `/user/daily/activity` anchored to `created_at`; helpers in `lib/budget-math.ts`. 502 on failure `cloud/gateway/src/routes/billing.ts:161-202`.
- **`GET /checkout/status`** — requires `?session_id`; returns `{status,payment_status}` `cloud/gateway/src/routes/billing.ts:205-216`.

## Stripe webhook — `/api/stripe/webhook`

`POST /` verifies the `stripe-signature` HMAC against `STRIPE_WEBHOOK_SECRET` (400 on failure), then switches on event type `cloud/gateway/src/routes/webhook.ts:9-32`:

- `customer.subscription.created` / `.updated` → resolve tier by price id (`getTierByPriceId`), `updateUserTier`, then idempotent `ensureUserPod` (handles upgrade/downgrade resizing) `cloud/gateway/src/routes/webhook.ts:33-74`.
- `customer.subscription.deleted` → downgrade to free + `deleteUserPod` (full namespace teardown) `cloud/gateway/src/routes/webhook.ts:76-103`.
- Always returns `{received:true}` `cloud/gateway/src/routes/webhook.ts:109`.

## Compute — `/api/compute/*`

Router `cloud/gateway/src/routes/compute.ts`. Backed by the K8s client in `lib/compute.ts`. Two distinct auth regimes: pod-callback routes use the **compute JWT** (`computeUser()` extracts+verifies the `aud:"compute"` token → userId `cloud/gateway/src/routes/compute.ts:40-47`); browser routes use `authMiddleware`. `resolveUserTier()` reads the tier from LiteLLM metadata, defaulting to `free` `cloud/gateway/src/routes/compute.ts:28-35`.

Pod-callback routes (compute JWT — pod acts only on its own namespace):
- **`POST /self-idle`** — body `{idle?}` (empty body ⇒ idle); `reportPodActivity` scales to zero or heartbeats `cloud/gateway/src/routes/compute.ts:65-82`.
- **`POST /cron-manifest`** — body `{jobs:[{projectId,slug,cronExpr,everyMs,nextRunAt}]}`. Dedupes, clamps `everyMs` up to the tier's `minIntervalMs`, applies deterministic per-job jitter (≤5min), caps at `maxJobs`, then `replaceCronManifest` `cloud/gateway/src/routes/compute.ts:89-134`.
- **`POST /webhook-manifest`** — body `{bindings:[{projectId,path,provider,agentRef}]}`; dedupes by `path` and `upsertWebhookBindings` so the inbound broker can resolve paths without asking the pod `cloud/gateway/src/routes/compute.ts:142-177`.

Browser routes (`authMiddleware`):
- **`GET /version`** — public (no auth on this handler); `{tag: COMPUTE_IMAGE_TAG || null}` `cloud/gateway/src/routes/compute.ts:180-182`.
- **`POST /upgrade`** — `restartUserPod` (rolling) → `{ok:true}` `cloud/gateway/src/routes/compute.ts:186-195`.
- **`GET /status`** — `{compute:true,tier,pod,podConfig}`; returns `compute:true` for **all tiers** (the pod may be scaled to zero) `cloud/gateway/src/routes/compute.ts:199-221`.

  > Correction (stale CLAUDE.md said `/status` & `/env` require pro/max): all tiers have compute access; the source comment and code confirm no tier gate `cloud/gateway/src/routes/compute.ts:197-221`.

- **`POST /ensure`** — resolve tier, `ensureUserPod(user.id, tier.pod)`, return `{ok,tier,podConfig,connection,pod}` `cloud/gateway/src/routes/compute.ts:225-249`.
- **`POST /wake`** — Envoy activator path; `wakeUserPod` fire-and-forget, 202 `{ok,waking:true}` `cloud/gateway/src/routes/compute.ts:258-269`.
- **`POST /wake-wait`** — `wakeAndWaitUserPod(user.id, 8000)`; 200 if ready else 202 `cloud/gateway/src/routes/compute.ts:277-288`.
- **`GET /env`** — `{vars}` from the pod's `user-env` secret `cloud/gateway/src/routes/compute.ts:291-301`.
- **`PUT /env`** — body `{vars}`; validates keys against `/^[A-Za-z_][A-Za-z0-9_]*$/`, values must be strings, ≤100 vars; `setEnvVars` **replaces the whole secret** (clients must GET+merge first) and restarts the pod `cloud/gateway/src/routes/compute.ts:306-348`.

## Backup — `/api/backup/*`

Router `cloud/gateway/src/routes/backup.ts`. GitHub-App-based workspace backup; repo must match `^[\w.-]+\/[\w.-]+$`, default branch `lmthing-backup` `cloud/gateway/src/routes/backup.ts:25-26`.

- **`GET /install-url`** (JWT) — 503 if `!isGithubAppConfigured()`; signs a 10min install-state JWT carrying `?redirect_to`, returns the App install URL `cloud/gateway/src/routes/backup.ts:31-39`.
- **`GET /callback`** — public; GitHub redirect with `?installation_id&state`. Verifies the signed state, stores the installation id, redirects to `redirectTo` `cloud/gateway/src/routes/backup.ts:43-61`.
- **`GET /config`** (JWT) — returns `{configured,connected,repo,auto,intervalMinutes,branch,lastBackupAt,lastCommitSha,status,error}`; never a token `cloud/gateway/src/routes/backup.ts:64-84`.
- **`PUT /config`** (JWT) — validates repo shape; clamps interval to 5–1440 min; requires a prior installation; `checkBackupRepo` must find it reachable & empty (404 not-found / 409 not-empty / 502 on GitHub error). On success saves settings and injects `GITHUB_BACKUP_*` config + a signed `LMTHING_BACKUP_JWT` into pod env (GET+merge+PUT) `cloud/gateway/src/routes/backup.ts:88-162`.
- **`POST /token`** — called **by the pod** with its `aud:"backup"` JWT (not the user token); mints a short-lived repo-scoped installation token so GitHub credentials never live in the pod `cloud/gateway/src/routes/backup.ts:167-193`.

## Inbound webhook broker — `/api/inbound/*`

Router `cloud/gateway/src/routes/inbound.ts`. The **inbound** half of the event pipeline: external providers POST to a per-user public URL; the gateway wakes the pod and forwards. The pod publishes its bindings via `POST /api/compute/webhook-manifest` (above); this router reads them back. Authoring model → the events-and-hooks skill; pod-side handling → [../cli-api/rest/webhooks.md](../cli-api/rest/webhooks.md).

- **`GET /`** (JWT) — for the UI: `{baseUrl,token,bindings}` where `token` is a long-lived `aud:"inbound"` JWT and `baseUrl = <BASE_URL>/api/inbound/<token>` `cloud/gateway/src/routes/inbound.ts:51-65`.
- **`POST /:userToken/:path`** — public broker. `verifyInboundToken` (the URL token IS the auth; 401 if bad), a per-user in-memory token-bucket rate-limit (429; capacity/refill env-tunable, fail-open) `cloud/gateway/src/routes/inbound.ts:74-105`, wakes the pod with a bounded wait, then **fire-and-forget** forwards the raw body + safe headers (`content-type` + `x-*`, plus `x-lmthing-inbound-url`) to `<podBase>/api/inbound/<path>` and returns 202 `cloud/gateway/src/routes/inbound.ts:113-157`.
- **`GET /:userToken/:path`** — provider subscription-verification handshake (e.g. Meta/WhatsApp `hub.*`). Unlike POST this awaits the pod and relays its status/body verbatim so the challenge echoes back; 503 if pod unavailable, 502 on forward failure `cloud/gateway/src/routes/inbound.ts:165-206`.

## Status — `/api/status/*`

Router `cloud/gateway/src/routes/status.ts`; all routes IP-rate-limited (`statusRateLimit()`: token bucket, 60/min/IP `cloud/gateway/src/middleware/rate-limit.ts:9-66`). Data comes from the in-memory caches maintained by `lib/cluster-status.ts`.

- **`GET /cluster`**, **`GET /compute-fleet`**, **`GET /events`** — return the cached JSON blob (`Cache-Control:no-store`) or 503 + `Retry-After:10` until the first refresh lands `cloud/gateway/src/routes/status.ts:27-55`.
- **`GET /stream`** — SSE. Enforces per-IP (3) + global (200) connection caps (`checkSseLimits`), sends an initial snapshot, pings every idle 60s, and closes after a 10-min max lifetime `cloud/gateway/src/routes/status.ts:57-137`, `cloud/gateway/src/middleware/rate-limit.ts:68-93`.

## Issues — `/api/issues`

`authMiddleware` on the router `cloud/gateway/src/routes/issues.ts:14`. **`POST /`** files a bug-report GitHub issue: 501 if `!isIssuesConfigured()`; requires non-empty `title`+`message`; optionally uploads `trace` (ndjson) and `screenshot` (png) as artifacts, embeds them in the issue body, and returns the created issue. 502 on GitHub error `cloud/gateway/src/routes/issues.ts:25-97`. Repo targets are `GITHUB_ISSUES_REPO` (issues) and `GITHUB_BUGREPORT_REPO` (artifacts).

## Local-dev pod proxy

Mounted only when `LOCAL_DEV=true` `cloud/gateway/src/index.ts:42-44`. In production, Envoy Gateway (Lua + JWT extraction) handles this routing to the pod instead. The catch-all `podProxy.all("*")` serves only the pod-owned path prefixes — `/api/{sessions,spaces,state,events,asks,message,help,node}` — 404-ing anything else `cloud/gateway/src/lib/pod-proxy.ts:22-39`. It resolves the token (`?access_token` query first, else the `Authorization` header; `demo` accepted in LOCAL_DEV), maps to the user's pod URL (503 if not ready), and streams the proxied response `cloud/gateway/src/lib/pod-proxy.ts:41-68`. `attachWsProxy` additionally upgrades `wss://…/api/ws?access_token=<JWT>` to the pod's NodePort by piping raw TCP sockets `cloud/gateway/src/lib/pod-proxy.ts:76-136` (wired from `cloud/gateway/src/index.ts:58-60`). These pod-served endpoints are documented under [../cli-api/rest/README.md](../cli-api/rest/README.md).

## Cross-references

- Token issuance/verification, Zitadel identity, SSO, middleware → [./auth.md](./auth.md)
- Tiers, budget windows, Stripe products, LiteLLM provisioning → [./billing-and-tiers.md](./billing-and-tiers.md)
- LiteLLM `/v1/*` OpenAI-compatible proxy → [./litellm.md](./litellm.md)
- The pod's own REST API (the target of the inbound forward and the local-dev proxy) → [../cli-api/rest/README.md](../cli-api/rest/README.md)
