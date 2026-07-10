---
name: webhooks
description: Load when touching the inbound-webhook request flow — the gateway `/api/inbound` broker, the pod `POST /api/inbound/:path` dispatcher, provider verifiers (generic/slack/github HMAC), inbound tokens, per-binding secrets, threading, or prod deploy/verify.
---

# Skill: Inbound Webhooks (the transport + security plumbing)

The internal machinery behind Triggers. **Authoring** a binding (`triggers:` frontmatter /
`type:'webhook'` hook) is `@.claude/skills/triggers.md`; **running OpenClaw plugins** on this same
ingress is `@.claude/skills/openclaw-compat.md`. This skill is the three-leg request path, signature
verification, tokens, and secrets.

## The three legs

```
external POST
  → [leg 3] gateway  POST /api/inbound/:userToken/:path   (public, token-gated)
        verify userToken → wakeUserPod → waitForPodReady → forward raw body+headers → 202 (async)
  → [leg 1] pod      POST /api/inbound/:path              (in-cluster only)
        resolveBinding → adapter.verify → adapter.preflight? → adapter.renderMessage
        → [leg 2] threaded? runHeadlessThreaded : runHeadless
```

### Leg 3 — gateway broker (`cloud/gateway/src/routes/inbound.ts`)
- `POST /:userToken/:path` — **public, no authMiddleware**: the long-lived `userToken`
  (`aud:"inbound"`, `signInboundToken`/`verifyInboundToken` in `lib/tokens.ts`, HS256, key =
  `Buffer.from(GATEWAY_JWT_SECRET, "base64")`, 365d) IS the auth — same posture as the Stripe webhook
  and the connections `/callback`. Deep provider-signature verification runs **on the pod** (it owns
  the binding secret + needs the raw body); the gateway token gate just stops random wake spam.
- Flow: `resolvePodConfig` → `wakeUserPod` → `waitForPodReady(INBOUND_WAKE_WAIT_MS, default 4s)` →
  **fire-and-forget** `fetch(<podBase>/api/inbound/:path)` → **`202 {ok,accepted}` immediately**. Does
  NOT await pod handling — the external provider only needs delivery acceptance (async model tolerates
  the ~6s cold-start wake).
- `getPodInternalBaseUrl(userId)` = the **first prod gateway→pod forward** (previously podProxy was
  `LOCAL_DEV`-only) → in-cluster DNS `lmthing.user-<id>.svc.cluster.local:8080`.
- `forwardHeaders` relays only `content-type` + any `x-*` header (provider signatures like
  `x-hub-signature-256`, `x-slack-signature`); Host/Authorization/routing headers are dropped.
- `GET /api/inbound` (authed) → `{ baseUrl: <gw>/api/inbound/<token>, token, bindings }` for the UI.
- `POST /api/compute/webhook-manifest` (compute-JWT) receives the pod's published bindings →
  `webhook_bindings` table (migration `cloud/migrations/008_webhook_bindings.sql`, keyed
  `(user_id, binding_id)`).

### Leg 1 — pod dispatcher (`sdk/org/libs/cli/src/server/routes/webhooks.ts`)
`createInboundHandler(manager, lmthingRoot, pluginRoutes?)` → `POST /api/inbound/:path`:
1. `resolveBinding(root, projects, path)` (hooks first, then `scanSpaceTriggers`). No binding **and**
   no `pluginRoutes` match ⇒ 404. (The `pluginRoutes` fallback is the OpenClaw route table —
   `@.claude/skills/openclaw-compat.md`. **Bindings always win**; a plugin can't shadow a real path.)
2. `getAdapter(binding.provider)` → `adapter.verify(rawBody, headers, secret)`; fail ⇒ **401**.
3. `adapter.preflight?(...)` — Slack `url_verification` handshake answered **before** any agent wakes.
   **Order is verify → preflight** (a forged handshake is rejected like any forged event).
4. `adapter.renderMessage(path, rawBody, headers)` → the agent's user message.
5. `adapter.extractThread(...)` → key ⇒ `runHeadlessThreaded` (sessionId from `getOrCreateThreadSession`,
   `webhook-threads.ts`), null ⇒ one-shot `runHeadless`.

### Leg 2 — threading store (`sdk/org/libs/cli/src/server/webhook-threads.ts`)
`getOrCreateThreadSession(projectRoot, path, threadKey)` persists `externalThreadKey → sessionId` in
`.data/webhook-threads.json` (keyed `<path>::<threadKey>`). First event mints + records a uuid;
later events on the same key resume that persisted session. `runHeadless` is **ephemeral** (fresh
uuid, unpersisted) — threading REQUIRES the explicit `runHeadlessThreaded` path.

## Provider verifiers (`sdk/org/libs/cli/src/server/webhook-verifiers.ts`)

Registry `WEBHOOK_ADAPTERS: Record<string, WebhookAdapter>`, shaped like the gateway's
`connections-registry.ts`. `getAdapter(provider)` falls back to `generic` for unknown providers
(graceful, no 500). **Every method is defensive — never throws; `verify` returns `false` on any
parse/HMAC error (safe default: reject).** Adding a provider is pure config.

| Provider | `verify` (HMAC) | thread key | `preflight` | `requiresSecret` |
|---|---|---|---|---|
| `generic` | `x-lmthing-signature` = `sha256=HMAC(secret, body)`; **no secret ⇒ allow** | `x-lmthing-thread` header, else JSON `threadKey`/`thread` | — | false |
| `slack` | `x-slack-signature` = `v0=HMAC(secret, "v0:"+ts+":"+body)` + **±5min replay window** | `event.thread_ts`→`ts`→`channel` | `url_verification` → `{challenge}` | true |
| `github` | `x-hub-signature-256` = `sha256=HMAC(secret, body)` | `<repo.full_name>#<issue|pr.number>` | — | true |

`safeEqual` guards `timingSafeEqual`'s length-mismatch throw (mismatch = "not equal", not error).

### Secret resolution (`resolveWebhookSecret(path, provider)`)
1. per-path override `LMTHING_WEBHOOK_SECRET_<PATH>` (path upper-cased, `-`→`_`);
2. provider-standard env (`SLACK_SIGNING_SECRET`, `GITHUB_WEBHOOK_SECRET`);
3. `undefined` — a `requiresSecret` adapter then rejects every request; `generic` allows unsigned.

Per-binding secrets are injected into the pod's `user-env` on create (mirroring
`LMTHING_CONNECTIONS_JWT`).

## Gotchas

- **`path` is globally unique per pod** — the gateway routes on `path` alone; `buildWebhookManifest`
  is fail-loud on any duplicate across hooks + space-triggers. Don't add a second disambiguator.
- **No provider→user reverse mapping exists** (`connections` table has no `team_id`/`chat_id`) — the
  per-user `userToken` **in the URL** is the only routing key. Don't assume you can look a user up from
  a Slack team id.
- **Verify runs pod-side, not gateway-side** — the gateway can't (it doesn't hold the binding secret
  and the fire-and-forget forward already returned 202). Keep signature logic in `webhook-verifiers.ts`.
- **Fire-and-forget forward** — the gateway never sees the agent result; don't try to return it to the
  caller. Replies go outbound via Connections (`@.claude/skills/triggers.md`).
- **New cli/core workspace deps must be added to `devops/argocd/compute/Dockerfile`** — it does NOT
  auto-include `libs/*`. This bit us: the cli's `@lmthing/openclaw-compat` dep wasn't packaged →
  pods crash-looped on `Cannot find package` (a real prod outage). See `[[project-inbound-triggers]]`.

## File map

| File | Role |
|---|---|
| `cloud/gateway/src/routes/inbound.ts` | Public broker `POST /:userToken/:path`; `GET /`; header relay; wake+forward+202 |
| `cloud/gateway/src/lib/tokens.ts` | `signInboundToken`/`verifyInboundToken` (`aud:"inbound"`) |
| `cloud/gateway/src/lib/compute.ts` | `getPodInternalBaseUrl`, `wakeUserPod`, `waitForPodReady` |
| `cloud/migrations/008_webhook_bindings.sql` | `webhook_bindings` table |
| `sdk/org/libs/cli/src/server/routes/webhooks.ts` | Pod dispatcher `createInboundHandler` (+ `pluginRoutes` fallback) |
| `sdk/org/libs/cli/src/server/webhook-verifiers.ts` | `WEBHOOK_ADAPTERS`, `getAdapter`, `resolveWebhookSecret` |
| `sdk/org/libs/cli/src/server/webhook-threads.ts` | `getOrCreateThreadSession` (`.data/webhook-threads.json`) |
| `sdk/org/libs/cli/src/server/webhook-manifest.ts` | `buildWebhookManifest`/`resolveBinding`/`publishWebhookManifest` |

## Testing

- Pod unit: `pnpm --filter @lmthing/cli test -- webhook` (`webhook-inbound.test.ts` handler wiring w/
  fake req/res, `webhook-verifiers.test.ts` HMAC/replay/preflight, `webhook-threads.test.ts`).
- **Mint an inbound token** (prod): HS256, `sub=userId`, `aud="inbound"`, key =
  base64-decode(`GATEWAY_JWT_SECRET` from the `lmthing-secrets` k8s secret). Shape in
  `cloud/gateway/src/lib/tokens.ts`.
- **Prod round-trip:** `POST <gw>/api/inbound/<inboundJWT>/<path>` → expect **202** `{ok,accepted}`;
  tampered token → 401. Then read the pod's persisted session snapshot (survives idle scale-to-zero;
  drive via the gateway, which wakes the pod — `kubectl exec` fights the idle scaler). See the
  live-verified runbook in memory `[[project-inbound-triggers]]` and prod-user/deploy notes
  `[[reference-prod-test-user-and-deploy]]`.
- **CI gotcha:** two near-simultaneous pushes race on the devops image-tag bump → the 2nd run's
  update-manifests fails on a rebase conflict; `gh run rerun <id> --failed` fixes it.
