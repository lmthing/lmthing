# Inbound webhooks — `POST /api/inbound/:path`

The pod's single external ingress. One route, registered on the pod's `Router` as
`POST /api/inbound/:path` and handled by `createInboundHandler(manager, effectiveLmthingRoot)`
`sdk/org/libs/cli/src/server/serve.ts:236`. `:path` is a URL-safe segment that is **globally
unique per pod** across every project and every binding kind, because the gateway routes on
`path` alone `sdk/org/libs/cli/src/server/webhook-manifest.ts:14-17`.

Related: [REST API index](./README.md) · [hook routes](./hooks.md) · the producer-side format
spec [`webhook` emitter def](../../format/space/events/webhook.md).

## The public path (gateway → pod)

External providers never reach the pod directly. They POST to the cloud gateway's broker,
`POST {BASE_URL}/api/inbound/:userToken/:path`, where the long-lived `userToken` (`aud:"inbound"`)
IS the auth — no `authMiddleware` `cloud/gateway/src/routes/inbound.ts:107-120`. The gateway
rate-limits per verified user (token bucket, default capacity 120 / refill 2/s, fail-open)
`cloud/gateway/src/routes/inbound.ts:74-105`,`cloud/gateway/src/routes/inbound.ts:123-125`, wakes a
scaled-to-zero pod (bounded wait, default 4 s) `cloud/gateway/src/routes/inbound.ts#INBOUND_WAKE_WAIT_MS`,`cloud/gateway/src/routes/inbound.ts:127-135`,
forwards `content-type` + every `x-*` header plus `x-lmthing-inbound-url` to
`{podBase}/api/inbound/:path` **fire-and-forget**, and answers the provider `202 {ok:true, accepted:true}`
immediately so a slow agent run never times the provider out `cloud/gateway/src/routes/inbound.ts#forwardHeaders`,`cloud/gateway/src/routes/inbound.ts:137-156`.

`x-lmthing-inbound-url` exists because Twilio-style signatures are computed over the request URL,
which the pod otherwise never sees `cloud/gateway/src/routes/inbound.ts:21-27` (consumed by the
`twilio` verify spec `sdk/org/libs/cli/src/server/webhook-verifiers.ts:276-287`).

The UI's webhook URLs come from `GET /api/inbound` on the gateway → `{ baseUrl, token, bindings }`,
where `bindings` is what the pod last published `cloud/gateway/src/routes/inbound.ts:51-65`. The pod
publishes that list by POSTing its manifest to `{gateway}/api/compute/webhook-manifest`
(compute-JWT authed, best-effort) `sdk/org/libs/cli/src/server/webhook-manifest.ts#publishWebhookManifest`.

## Binding resolution

The handler reads the raw body, lower-cases-keyed headers, lists projects (excluding the synthetic
`system` project) and calls `resolveBinding(root, projects, path)`
`sdk/org/libs/cli/src/server/routes/webhooks.ts:124-132`. Four binding sources feed the manifest and
the resolver, checked in this order:

| Source | Scanner | Binding kind |
|---|---|---|
| project-app `hooks/*.ts` `{type:'webhook'}` | `loadHooks` | `legacy` `sdk/org/libs/cli/src/server/webhook-manifest.ts:268-286` |
| installed space `hooks/*.ts` `{type:'webhook'}` (worker-extracted) | `scanSpaceHookWebhooks` | `legacy` `sdk/org/libs/cli/src/server/webhook-manifest.ts#scanSpaceHookWebhooks` |
| space agent `triggers:` frontmatter | `scanSpaceTriggers` | `legacy` `sdk/org/libs/cli/src/server/webhook-manifest.ts#scanSpaceTriggers` |
| `events/<name>.ts` `{type:'webhook'}` emitter def | `scanEmitterWebhookBindings` (wraps the worker-isolated `scanEmitterDefs`) | `emitter` `sdk/org/libs/cli/src/server/webhook-manifest.ts#scanEmitterWebhookBindings` |

`resolveBinding` returns a discriminated `ResolvedBinding`: `{kind:'legacy', projectId, agentRef, provider, budget?}`
or `{kind:'emitter', projectId, scope, defFile, defName}` `sdk/org/libs/cli/src/server/webhook-manifest.ts#ResolvedBinding`,`sdk/org/libs/cli/src/server/webhook-manifest.ts#resolveBinding`.
Disabled hooks (`effectiveDisabled`) are invisible to both the manifest
`sdk/org/libs/cli/src/server/webhook-manifest.ts:180` and the resolver
`sdk/org/libs/cli/src/server/webhook-manifest.ts:274-276`.

**Path collisions are fail-loud at manifest build.** Any collision involving an emitter def (either
side), in any project, throws; two legacy bindings still throw across projects but same-project
sharing is tolerated `sdk/org/libs/cli/src/server/webhook-manifest.ts:195-217`.

No binding → `404 { error: { status: 404, message: 'no webhook binding for "<path>"' } }`
`sdk/org/libs/cli/src/server/routes/webhooks.ts:157`. No `lmthingRoot` → `404 no project root configured`
`sdk/org/libs/cli/src/server/routes/webhooks.ts:119-121`.

## Flow A — emitter def (the current pipeline)

`binding.kind === 'emitter'` branches into `handleEmitterInbound`
`sdk/org/libs/cli/src/server/routes/webhooks.ts:164-167`, which re-loads the def's **data** from the
worker-isolated `scanEmitterDefs` cache (never in-proc) and 404s if it is missing or not a webhook def
`sdk/org/libs/cli/src/server/routes/webhooks.ts:262-270`. Then, in order:

1. **GET** → answer the def's `hub-challenge` handshake and stop (no emit, no agent); a failed match is
   `403 challenge verification failed` `sdk/org/libs/cli/src/server/routes/webhooks.ts:275-285`.
2. **verify** → `401 signature verification failed` on failure `sdk/org/libs/cli/src/server/routes/webhooks.ts:287-290`.
3. **preflight** → if the adapter answers one, return it verbatim `sdk/org/libs/cli/src/server/routes/webhooks.ts:292-296`.
4. **dedupe** → a byte-identical replay returns `200 { ok:true, deduped:true }` `sdk/org/libs/cli/src/server/routes/webhooks.ts:299-302`.
5. **emit** → the def's PURE `emit(inbound)` runs worker-isolated with **no ctx handlers** and a timeout
   (`LMTHING_EMITTER_EMIT_TIMEOUT_MS`, default 5000 ms); a throw/timeout is `500 emit failed: …`
   `sdk/org/libs/cli/src/server/routes/webhooks.ts:230-232`,`sdk/org/libs/cli/src/server/routes/webhooks.ts:272-281`.
   `inbound` is `{ json, raw, headers, path }` `sdk/org/libs/cli/src/server/routes/webhooks.ts:272`.
6. **validate** → every emitted item must name a declared `emits` key and carry a payload matching its
   schema; anything else is dropped-with-warn `sdk/org/libs/cli/src/server/event-dispatch.ts#validateEmitted`.
7. **dispatch** → `dispatchEmittedEvents` is fired **without await**, and the provider gets
   `200 { ok:true, events: <n> }` `sdk/org/libs/cli/src/server/routes/webhooks.ts:296-304`.

The ordering (verify **before** preflight, verify **before** dedupe, both **before** `emit`) is
deliberate: a forged handshake is rejected like any forged event, the dedupe set cannot be poisoned by
forgeries, and store-authored code only ever touches a request proven authentic
`sdk/org/libs/cli/src/server/routes/webhooks.ts:246-250`.

### Where the events go

`dispatchEmittedEvents` source-qualifies each event as `<scope>/<event>` (the project scope is literally
`'project'`), matches subscribing event hooks across the project and every installed space
(`loadAllHooks` + `matchEventHooks`), and runs each one: a `trigger` hook becomes a headless agent run,
a `handler` hook goes through `runHook` with the event **payload** as `ctx.input`
`sdk/org/libs/cli/src/server/event-dispatch.ts#dispatchEmittedEvents`. A failing subscriber is logged and skipped
`sdk/org/libs/cli/src/server/event-dispatch.ts:225-230`. An emitted event carrying `threadKey` continues one
persisted session per `(event:<address>, threadKey)` — the same continuity mechanism as inbound
webhook threading, namespaced by address `sdk/org/libs/cli/src/server/event-dispatch.ts#runTriggerHook`.
Webhook-originated dispatch is **direct and sequential** (only db-write dispatch uses the coalescing
queue) `sdk/org/libs/cli/src/server/event-dispatch.ts:24-31`.

## Flow B — legacy `trigger` binding

For `kind:'legacy'` the handler resolves the owning space's declarative `lmthing.webhook` descriptor
(absent for built-in providers and project-app hooks)
`sdk/org/libs/cli/src/server/routes/webhooks.ts:172`, then:

- **GET** → answer the descriptor's `hub.challenge` handshake, else `403`
  `sdk/org/libs/cli/src/server/routes/webhooks.ts:176-186`.
- **verify** (`401` on failure) → **preflight** (returned verbatim) → **dedupe**
  (`200 {ok:true, deduped:true}`) `sdk/org/libs/cli/src/server/routes/webhooks.ts:188-207`.
- **render** the raw body into an agent message via `adapter.renderMessage`, parse the binding's
  `space/agent#action` into `{spaceRef, agentSlug}`, and dispatch
  `sdk/org/libs/cli/src/server/routes/webhooks.ts#parseTrigger`,`sdk/org/libs/cli/src/server/routes/webhooks.ts:209-211`.
- **thread** — `adapter.extractThread` returning `null` → a one-shot `manager.runHeadless`; a thread key →
  `manager.runHeadlessThreaded` on the stable session id from `getOrCreateThreadSession`
  `sdk/org/libs/cli/src/server/routes/webhooks.ts:213-224`. The binding's `budget` (webhook-hook defs only)
  is forwarded verbatim `sdk/org/libs/cli/src/server/routes/webhooks.ts:211`.
- The run result is returned verbatim as the `200` body `sdk/org/libs/cli/src/server/routes/webhooks.ts:226`
  — unlike the emitter path, the legacy path **awaits** the agent run.

## Verification

Two adapter sources, one `WebhookAdapter` surface
`sdk/org/libs/cli/src/server/webhook-verifiers.ts:4-16`.

**Built-in adapters** — `WEBHOOK_ADAPTERS = { generic, slack, github }`
`sdk/org/libs/cli/src/server/webhook-verifiers.ts#WEBHOOK_ADAPTERS`:

- `generic` — `requiresSecret:false`; with no secret configured it **accepts unsigned requests**, otherwise
  HMAC-SHA256 over the body compared against `x-lmthing-signature: sha256=<hex>`
  `sdk/org/libs/cli/src/server/webhook-verifiers.ts#generic`. Thread key from `x-lmthing-thread`, else body
  `threadKey`/`thread` `sdk/org/libs/cli/src/server/webhook-verifiers.ts#generic`.
- `slack` — `v0=` HMAC over `v0:<ts>:<body>` with `x-slack-signature`, plus a ±5-minute
  `x-slack-request-timestamp` skew replay guard; POST `url_verification` preflight echoes `challenge`;
  thread key = `event.thread_ts` → `event.ts` → `event.channel`; the rendered message carries a
  `[slack-reply-target]` JSON blob so the agent can answer via `callConnection('slack', …)`
  `sdk/org/libs/cli/src/server/webhook-verifiers.ts:68-135`.
- `github` — `sha256=` HMAC over the body against `x-hub-signature-256`; thread key
  `<repo.full_name>#<issue|pr number>` `sdk/org/libs/cli/src/server/webhook-verifiers.ts#github`.

Unknown provider → `generic`, so a stale manifest entry degrades gracefully rather than throwing
`sdk/org/libs/cli/src/server/webhook-verifiers.ts#getAdapter`.

**Descriptor-driven adapters** — a space's declarative `lmthing.webhook` block is compiled into an
adapter at dispatch time (`buildAdapterFromDescriptor`), so an integration space carries its own
verify/thread/preflight/challenge **spec** and the pod interprets it with generic crypto primitives — no
per-provider code `sdk/org/libs/cli/src/server/webhook-verifiers.ts#buildAdapterFromDescriptor`. Supported `VerifySpec`
types: `none`, `header-equals`, `body-token`, `hmac` (algo/encoding/prefix/signed-parts + optional skew
header), `ed25519`, `twilio` `sdk/org/libs/cli/src/server/webhook-verifiers.ts#verifyFromSpec`. An
unauthenticated (`verify:{type:'none'}`) descriptor **fails closed** unless it explicitly sets
`allowUnauthenticated: true` `sdk/org/libs/cli/src/server/webhook-verifiers.ts:349-360`. Every adapter
method is defensive — a malformed body/header never throws out of `verify`; the worst case is `false`
(reject) `sdk/org/libs/cli/src/server/webhook-verifiers.ts:18-22`.

**Emitter-def adapters** — `adapterForEmitterDef` maps a def's `verify` onto the same surface:
`{type:'builtin', provider}` reuses the shipped `slack`/`github` adapter (and its GET challenge is always
`null`, because builtins handshake via a POST preflight), while a declarative spec is fed through
`buildAdapterFromDescriptor` from a synthesized descriptor
`sdk/org/libs/cli/src/server/webhook-verifiers.ts#adapterForEmitterDef`.

### Secret resolution

`resolveWebhookSecret(path, provider, descriptor)` checks, in order
`sdk/org/libs/cli/src/server/webhook-verifiers.ts:444-464`:

1. the per-path override `LMTHING_WEBHOOK_SECRET_<PATH>` (upper-cased, `-` → `_`);
2. the descriptor's / def's `secretEnv`, else the provider-standard env — `SLACK_SIGNING_SECRET`,
   `GITHUB_WEBHOOK_SECRET` `sdk/org/libs/cli/src/server/webhook-verifiers.ts#PROVIDER_SECRET_ENV`;
3. `undefined` — a `requiresSecret` adapter then rejects everything; `generic` lets unsigned requests through.

### GET subscription-verification (`hub.challenge`)

`resolveChallenge` answers `200 <challenge>` as `text/plain` when the query's verify token
(`hub.verify_token` by default) matches `process.env[verifyTokenEnv]` and `hub.challenge` is present;
otherwise `null` → the caller `403`s `sdk/org/libs/cli/src/server/webhook-verifiers.ts:466-486`,
`sdk/org/libs/cli/src/server/routes/webhooks.ts:176-186`.

## Dedupe (replay / retry guard)

`isDuplicateInbound(path, rawBody)` keys on `sha256(path + "\n" + rawBody)` and remembers it for a TTL
(`LMTHING_WEBHOOK_DEDUPE_TTL_MS`, default 10 min), in-memory per pod, lazily pruned
`sdk/org/libs/cli/src/server/webhook-dedupe.ts:20-51`. Hashing the raw bytes is provider-agnostic and
never collapses *distinct* messages (real events differ in their embedded id/timestamp) — only
byte-identical replays and provider retries collide `sdk/org/libs/cli/src/server/webhook-dedupe.ts:8-13`.
An empty body is never deduped `sdk/org/libs/cli/src/server/webhook-dedupe.ts#isDuplicateInbound`. It runs **after**
verify in both flows, so the set cannot be poisoned without a valid signature
`sdk/org/libs/cli/src/server/webhook-dedupe.ts:14-16`.

## Threading

`getOrCreateThreadSession(projectRoot, path, threadKey)` maps `"<path>::<threadKey>"` → a stable
`randomUUID()` session id, persisted at `<projectRoot>/.data/webhook-threads.json`
`sdk/org/libs/cli/src/server/webhook-threads.ts:22-28`,`sdk/org/libs/cli/src/server/webhook-threads.ts#getOrCreateThreadSession`.
Namespacing by `path` means two bindings never collide even when a provider reuses key values
`sdk/org/libs/cli/src/server/webhook-threads.ts:4-6`. The file is a cache, not the source of truth (the
session snapshot is): a missing or corrupt file is treated as empty
`sdk/org/libs/cli/src/server/webhook-threads.ts#loadWebhookThreads`. The read-modify-write is unlocked; a lost update can
only mint two ids for two near-simultaneous *first* events on a brand-new thread, never corrupt an
existing mapping `sdk/org/libs/cli/src/server/webhook-threads.ts:60-69`.

## Response codes

| Status | Body | When |
|---|---|---|
| 200 | run result verbatim | legacy binding, agent run completed `sdk/org/libs/cli/src/server/routes/webhooks.ts:226` |
| 200 | `{ ok:true, events:<n> }` | emitter def emitted `n` validated events (dispatch not awaited) `sdk/org/libs/cli/src/server/routes/webhooks.ts:304` |
| 200 | `{ ok:true, deduped:true }` | byte-identical replay within the TTL `sdk/org/libs/cli/src/server/routes/webhooks.ts:205`,`sdk/org/libs/cli/src/server/routes/webhooks.ts:300` |
| 200 | adapter preflight body | e.g. Slack `url_verification` `sdk/org/libs/cli/src/server/routes/webhooks.ts:195-199` |
| 200 | `<challenge>` (text/plain) | GET `hub-challenge` match `sdk/org/libs/cli/src/server/routes/webhooks.ts:179-182` |
| 401 | `{error:{status:401,message:'signature verification failed'}}` | verify failed `sdk/org/libs/cli/src/server/routes/webhooks.ts:191`,`sdk/org/libs/cli/src/server/routes/webhooks.ts:288` |
| 403 | `{error:{status:403,message:'challenge verification failed'}}` | GET, no challenge match `sdk/org/libs/cli/src/server/routes/webhooks.ts:184`,`sdk/org/libs/cli/src/server/routes/webhooks.ts:283` |
| 404 | `no project root configured` / `no webhook binding for "<path>"` / `emitter def "…" not found or not a webhook` | `sdk/org/libs/cli/src/server/routes/webhooks.ts:120`,`sdk/org/libs/cli/src/server/routes/webhooks.ts:157`,`sdk/org/libs/cli/src/server/routes/webhooks.ts:266-268` |
| 500 | `emit failed: <msg>` | emitter `emit()` threw / timed out `sdk/org/libs/cli/src/server/routes/webhooks.ts:276-280` |

Auth on this route is **per-provider signature verification only** — the pod server has no JWT
middleware; the gateway's `userToken` gates the public edge
`cloud/gateway/src/routes/inbound.ts:107-120`.

## Environment

| Var | Effect |
|---|---|
| `LMTHING_WEBHOOK_SECRET_<PATH>` | per-binding secret override `sdk/org/libs/cli/src/server/webhook-verifiers.ts#resolveWebhookSecret` |
| `SLACK_SIGNING_SECRET`, `GITHUB_WEBHOOK_SECRET` | built-in provider secrets `sdk/org/libs/cli/src/server/webhook-verifiers.ts#PROVIDER_SECRET_ENV` |
| `LMTHING_WEBHOOK_DEDUPE_TTL_MS` | dedupe window (default 600000) `sdk/org/libs/cli/src/server/webhook-dedupe.ts#TTL_MS` |
| `LMTHING_EMITTER_EMIT_TIMEOUT_MS` | emitter `emit()` wall-clock cap (default 5000) `sdk/org/libs/cli/src/server/routes/webhooks.ts#EMIT_TIMEOUT_MS` |
| gateway `INBOUND_RATE_CAPACITY`, `INBOUND_RATE_REFILL_PER_SEC`, `INBOUND_WAKE_WAIT_MS` | broker rate limit + pod-wake wait `cloud/gateway/src/routes/inbound.ts#INBOUND_WAKE_WAIT_MS`,`cloud/gateway/src/routes/inbound.ts:74-76` |

## Example — a verified inbound POST reaching an emitter def

````bash
# What the gateway relays to the pod (headers preserved, x-lmthing-inbound-url added)
curl -X POST http://localhost:8080/api/inbound/slack-events \
  -H 'content-type: application/json' \
  -H 'x-slack-request-timestamp: 1770000000' \
  -H 'x-slack-signature: v0=<hmac>' \
  -d '{"event":{"type":"message","channel":"C1","ts":"1.2","text":"hi"}}'
# → 200 {"ok":true,"events":1}
````

The pod's chain for that request: `resolveBinding` → `kind:'emitter'` → `adapterForEmitterDef` (builtin
`slack` verify) → dedupe → worker-isolated `emit(inbound)` → `validateEmitted` → `dispatchEmittedEvents`
to every event hook subscribing to `<spaceId>/<event>` `sdk/org/libs/cli/src/server/routes/webhooks.ts#handleEmitterInbound`.

## Known gap — the GET `hub.challenge` branches are unreachable over HTTP

**The pod never serves a GET to `/api/inbound/:path`.** Every ingredient of the handshake exists except
the route registration:

- Both flows implement a GET `hub.challenge` branch — legacy
  `sdk/org/libs/cli/src/server/routes/webhooks.ts:176-186`, emitter
  `sdk/org/libs/cli/src/server/routes/webhooks.ts:275-285` — and `resolveChallenge` is fully implemented
  `sdk/org/libs/cli/src/server/webhook-verifiers.ts#resolveChallenge`.
- The gateway forwards a provider's GET handshake **synchronously**, preserving the `hub.*` query string,
  and relays the pod's status/body verbatim `cloud/gateway/src/routes/inbound.ts:165-206`.
- But `serve.ts` registers the ingress for **POST only** —
  `router.add('POST', '/api/inbound/:path', createInboundHandler(…))`
  `sdk/org/libs/cli/src/server/serve.ts:236` (the sole registration in the file) — and `Router.dispatch`
  skips any route whose method does not match `sdk/org/libs/cli/src/server/router.ts#Router.dispatch`.

So a GET to a bound path falls through to the pod's catch-all reserved-`/api/*` 404,
`{ error: 'unknown API route GET /api/inbound/<path>' }` `sdk/org/libs/cli/src/server/serve.ts:360-366`,
which the gateway then relays to the provider as a 404 `cloud/gateway/src/routes/inbound.ts:198-201`. A
Meta/WhatsApp-style subscription verification therefore cannot succeed against a live pod, and neither
challenge branch is reachable in production.

The unit tests do not catch this because they call `createInboundHandler` **directly** with a fake `GET`
request, bypassing the `Router` entirely
`sdk/org/libs/cli/src/server/webhook-descriptor-dispatch.test.ts:171-202`. The fix is a one-line
registration (`GET`, or `'*'`, on the same handler) plus a test that exercises the route through
`Router.dispatch`.
