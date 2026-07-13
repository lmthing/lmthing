# `webhook` emitter def

A `webhook` emitter def is the PRODUCER side of the unified event pipeline for events that originate as an inbound HTTP request: an external caller `POST`s to the def's OWN inbound path, the pod verifies the request, and a pure `emit(inbound)` turns the verified request into events `sdk/org/libs/core/src/spaces/emitter-def.ts:65-71`. It is one of the four emitter kinds discriminated on `type` (`webhook`/`cron`/`db`/`internal`) `sdk/org/libs/core/src/spaces/emitter-def.ts:7-12` — see the sibling docs [`cron.md`](./cron.md), [`db.md`](./db.md), [`internal.md`](./internal.md), and the [events README](./README.md) for the shared model.

## Shape

A webhook def is the default export of an `events/<name>.ts` file `sdk/org/libs/core/src/spaces/emitter-def.ts:163` and has this TypeScript type `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef`:

- `type: 'webhook'` — the kind discriminator `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef.type`.
- `path: string` — a URL-safe path segment, the routing key, globally unique per pod `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef`.
- `verify: WebhookVerify` — how the inbound request is authenticated `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef`.
- `secretEnv?: string` — the pod env var holding the signing secret / public key / auth token `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef`.
- `challenge?: ChallengeSpec` — an optional GET subscription-verification echo (WhatsApp / Meta) `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef`.
- `emits: EmitsSchema` — the declared event → payload schema `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef`.
- `emit(inbound: WebhookInbound): Emitted[]` — the PURE function that turns a verified request into events `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef`.

## Its own inbound path

The def is bound to its own inbound URL via `path`, independent of legacy `triggers:` bindings `sdk/org/libs/core/src/spaces/emitter-def.ts:65-74`. `path` must be a non-empty string matching `WEBHOOK_PATH_RE` (`/^[A-Za-z0-9_-]+$/` — letters, digits, `_`, `-`); a missing/empty or non-URL-safe path is a fail-loud error at load `sdk/org/libs/core/src/spaces/emitter-load.ts#WEBHOOK_PATH_RE`,`sdk/org/libs/core/src/spaces/emitter-load.ts:119-125`. On the pod, a `GET` to the path is treated as a subscription-verification handshake (no agent, no emit) while a `POST` runs the verify → preflight → dedupe → emit gate `sdk/org/libs/cli/src/server/routes/webhooks.ts:274-316`.

## `verify` — declarative union vs the `builtin` shorthand

`WebhookVerify` is either a declarative `VerifySpec` the generic engine interprets, or the `{ type: 'builtin'; provider: 'slack' | 'github' }` shorthand for a provider whose scheme isn't expressible in the generic union — both resolved pod-side by `webhook-verifiers.ts` `sdk/org/libs/core/src/spaces/emitter-def.ts:56-63`. The declarative `VerifySpec` union is data-only (`none` / `header-equals` / `body-token` / `hmac` / `ed25519` / `twilio`) so a store-downloaded space can't inject executable verifier logic — all crypto runs pod-side against these specs `sdk/org/libs/core/src/spaces/verify-spec.ts:1-11`,`sdk/org/libs/core/src/spaces/verify-spec.ts#VerifySpec`.

At load, `validateWebhookVerify` fail-loud validates the `verify` block: a `{ type: 'builtin' }` requires `provider` to be `'slack'` or `'github'`, otherwise the spec must pass `isValidVerifySpec` (known type + well-formed hmac/header-equals/body-token/ed25519 params, else rejected fail-closed) `sdk/org/libs/core/src/spaces/emitter-load.ts#validateWebhookVerify`,`sdk/org/libs/core/src/spaces/verify-spec.ts#isValidVerifySpec`.

Pod-side, `adapterForEmitterDef` resolves the def's `verify` into one `WebhookAdapter`: a `builtin` provider maps to the shipped inline `slack`/`github` adapter with its provider-standard secret env, and its GET challenge always returns `null` (builtin providers handshake via a POST preflight, never a GET hub-challenge) `sdk/org/libs/cli/src/server/webhook-verifiers.ts#adapterForEmitterDef`. A declarative `VerifySpec` is fed to `buildAdapterFromDescriptor` via a synthesized descriptor built from the def's own `verify`/`secretEnv`/`challenge`, and only the GET `hub-challenge` echo applies (an emitter def carries no `preflight`/`thread` — its pure `emit` replaces thread extraction and rendering) `sdk/org/libs/cli/src/server/webhook-verifiers.ts:400-413`,`sdk/org/libs/cli/src/server/webhook-verifiers.ts#adapterForEmitterDef`.

## The builtin `slack` adapter

The inline `slack` adapter requires a secret and computes the v0 signature: it rejects when `x-slack-request-timestamp`/`x-slack-signature` are absent, guards replay by rejecting when the clock skew exceeds `SLACK_MAX_CLOCK_SKEW_SECONDS` (`5 * 60` = 5 minutes), then compares `v0=` + HMAC-SHA256 over `v0:${timestamp}:${rawBody}` using a constant-time `safeEqual` `sdk/org/libs/cli/src/server/webhook-verifiers.ts:68-89`. Its `preflight` answers Slack's setup handshake: when the JSON body's `type` is `url_verification`, it echoes `{ challenge }` back with HTTP 200 `sdk/org/libs/cli/src/server/webhook-verifiers.ts:90-96`. The builtin adapters are registered in `WEBHOOK_ADAPTERS` (`generic`, `slack`, `github`) `sdk/org/libs/cli/src/server/webhook-verifiers.ts#WEBHOOK_ADAPTERS`.

## The signing-secret env

`resolveWebhookSecret` resolves the secret in a fixed precedence: a per-path override `LMTHING_WEBHOOK_SECRET_<PATH>` (path upper-cased, `-`→`_`) first, else the descriptor's `secretEnv`, else the built-in provider-standard env, else `undefined` `sdk/org/libs/cli/src/server/webhook-verifiers.ts#resolveWebhookSecret`. The provider-standard env for the builtin `slack` adapter is `SLACK_SIGNING_SECRET` (and `GITHUB_WEBHOOK_SECRET` for `github`) `sdk/org/libs/cli/src/server/webhook-verifiers.ts#PROVIDER_SECRET_ENV`. When no secret is configured a `requiresSecret` adapter (slack/github) rejects every request `sdk/org/libs/cli/src/server/webhook-verifiers.ts#slack`,`sdk/org/libs/cli/src/server/webhook-verifiers.ts#resolveWebhookSecret`.

## A PURE `emit(inbound)` returning `Emitted[]`

`emit` receives a `WebhookInbound` — `{ json, raw, headers, path }` (parsed JSON body, raw body string, lower-cased headers, and the bound path) `sdk/org/libs/core/src/spaces/emitter-def.ts:44-54`. It must be pure: it runs worker-isolated at dispatch (never in the verify path), with no side effects and no i/o `sdk/org/libs/core/src/spaces/emitter-def.ts:65-71`. On the pod, `emit` runs worker-isolated with NO capability handlers wired — the worker's db/delegate/callConnection proxies have no backing and reject if the def calls them — and is timeout-bounded `sdk/org/libs/cli/src/server/routes/webhooks.ts:304-310`. Each returned `Emitted` is `{ event, payload, threadKey? }` where `event` must be one of the def's declared `emits` keys and `payload` is validated against `emits[event].payload` `sdk/org/libs/core/src/spaces/emitter-def.ts:25-35`; an undeclared event name or a payload that doesn't fit its schema is dropped-with-warn by `validateEmitted` `sdk/org/libs/cli/src/server/routes/webhooks.ts:285`.

## Dropping `bot_id`/`subtype` echoes; `threadKey`/`chatId` derivation

> The following behaviors are conventions of the real `integration-slack` example def, not enforced by the loader — the loader only validates shape/types.

In the shipped Slack def, `emit` forwards only genuine user channel messages: it returns `[]` for anything that isn't `event.type === 'message'`, and drops the pod's own / any bot echoes (`event.bot_id`) and every message subtype (edits/deletes/joins/bot posts carry `event.subtype`) `store/spaces/integration-slack/events/messages.ts:53-64`. `threadKey` (and the payload's `threadKey` field) falls back to the message `ts` when there is no `thread_ts`, so a reply starts a thread on the original message; `chatId` is the channel `store/spaces/integration-slack/events/messages.ts:66-84`. The top-level `threadKey` on an `Emitted` derives a stable conversation thread for multi-turn continuity — omitting it makes each event a one-shot run `sdk/org/libs/core/src/spaces/emitter-def.ts:25-35`.

## Worked example

Adapted from the real `store/spaces/integration-slack/events/messages.ts` `store/spaces/integration-slack/events/messages.ts:37-88`:

```ts
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'slack',
  verify: { type: 'builtin', provider: 'slack' }, // pod-side v0-HMAC + skew + url_verification
  emits: {
    'message.received': {
      payload: {
        text: 'string',
        from: 'string',
        chatId: 'string',
        threadKey: 'string?', // optional (trailing '?')
        userName: 'string?',
        raw: 'object',
      },
    },
  },
  emit(inbound: WebhookInbound): Emitted[] {
    const json = inbound.json as { event?: Record<string, unknown> } | null | undefined;
    const event = json?.event as Record<string, unknown> | undefined;
    if (!event || event['type'] !== 'message') return [];
    if (event['bot_id']) return []; // drop bot echoes
    if (event['subtype']) return []; // drop edits/deletes/joins/bot posts
    const text = event['text'];
    if (typeof text !== 'string' || text.length === 0) return [];
    if (typeof event['channel'] !== 'string') return [];
    if (typeof event['user'] !== 'string') return [];
    const threadKey =
      typeof event['thread_ts'] === 'string' ? event['thread_ts']
      : typeof event['ts'] === 'string' ? event['ts'] : undefined;
    return [{
      event: 'message.received',
      payload: { text, from: event['user'], chatId: event['channel'], threadKey, userName: undefined, raw: json as Record<string, unknown> },
      ...(threadKey !== undefined ? { threadKey } : {}),
    }];
  },
};

export default def;
```

## Payload typeStrings

Each `emits` payload field is a typeString from the same vocabulary as a tasklist node's `output` — `string | number | boolean | object | array | any`, optionally suffixed with a trailing `?` to mark the field optional `sdk/org/libs/core/src/spaces/emitter-load.ts:36-39`,`sdk/org/libs/core/src/spaces/emitter-load.ts:64-79`. A trailing `?` is preserved in the stored schema so the DTS generator emits an optional member and runtime validation tolerates the field's absence `sdk/org/libs/core/src/spaces/emitter-load.ts:66-77`,`sdk/org/libs/core/src/spaces/emitter-load.ts#buildEventPayloadsDts`. Event names must be dot-separated lowercase segments, and a def must declare at least one event `sdk/org/libs/core/src/spaces/emitter-load.ts:32-34`,`sdk/org/libs/core/src/spaces/emitter-load.ts:47-56`.

## Dispatch to subscribers

After a verified `POST`, the pod runs verify → preflight → dedupe → the pure `emit`, validates the events, then fire-and-forgets `dispatchEmittedEvents` to subscribing event hooks and acks the provider immediately `sdk/org/libs/cli/src/server/routes/webhooks.ts#handleEmitterInbound`. Consumers subscribe with an event hook (`hooks/<slug>.ts` `{type:'event'}`) — see the [events README](./README.md) and [hooks README](../hooks/README.md).

## See also

- [Events README](./README.md) — the unified event pipeline and the four emitter kinds.
- [`cron.md`](./cron.md) · [`db.md`](./db.md) · [`internal.md`](./internal.md) — the other three producer kinds.
