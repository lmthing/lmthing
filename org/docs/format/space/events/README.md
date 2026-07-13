# `events/` — emitter defs (the event SOURCE)

An `events/` directory in a **space** or a **project** holds named `.ts` files, each default-exporting one typed `EmitterDef` — the **PRODUCER** side of the one unified event pipeline, symmetric with hooks (the consumer side) `sdk/org/libs/core/src/spaces/emitter-def.ts:1-22`. A def makes its scope an **event SOURCE**: a typed producer of events on the bus `sdk/org/libs/core/src/spaces/emitter-def.ts:1-6`. Its consumers are [event hooks](../hooks/README.md), which subscribe by address `sdk/org/libs/cli/src/server/event-dispatch.ts:184-185`.

The def format is **identical in a space and a project** — see the project-scope notes at [../../project/events/README.md](../../project/events/README.md) `sdk/org/libs/core/src/spaces/emitter-def.ts:3-6`.

## The `emits` schema

Every def declares the payload schema of every event it produces INLINE in `emits`: a map of `<event name> → { payload: { <field>: <typeString> } }` `sdk/org/libs/core/src/spaces/emitter-def.ts:37-42`. typeStrings are `string | number | boolean | object | array | any` — the SAME vocabulary as a tasklist node's `output` `sdk/org/libs/core/src/spaces/emitter-load.ts:36-39`. `emits` must be an object declaring at least one event, or validation throws fail-loud `sdk/org/libs/core/src/spaces/emitter-load.ts#validateEmits`.

A **trailing `?`** on a typeString marks the field optional (`threadKey: 'string?'`): the base type is checked after stripping the `?`, the `?` is preserved in the stored schema, the generated DTS emits an optional member, and runtime validation tolerates the field's absence `sdk/org/libs/core/src/spaces/emitter-load.ts:64-77`. An invalid base typeString (with or without the `?`) throws `sdk/org/libs/core/src/spaces/emitter-load.ts:71-76`. The DTS `EventPayloads` map that consumers typecheck against is built from a scope's merged emits, with the `?` reapplied to the member `sdk/org/libs/core/src/spaces/emitter-load.ts#buildEventPayloadsDts`.

Emitted payloads are validated against this schema at dispatch time `sdk/org/libs/core/src/spaces/emitter-def.ts:15-17`.

## Event naming

Event names are **dot-separated lowercase segments** (`message.posted`, `db.raw_items.insert`), enforced by `EVENT_NAME_RE`; a non-matching name throws fail-loud `sdk/org/libs/core/src/spaces/emitter-load.ts:32-34,52-55`. Segments may include digits and underscores but the name is lowercase only `sdk/org/libs/core/src/spaces/emitter-load.ts#EVENT_NAME_RE`.

**Duplicate event names within one scope fail the whole scope loudly** — merging the emits of every def in a scope throws when two defs declare the same event name `sdk/org/libs/core/src/spaces/emitter-load.ts#collectDeclaredEvents`.

## The four producer kinds

The kind is discriminated on `type`; `validateEmitterDef` fail-loud validates a raw default export into a typed `EmitterDef` and throws on any `type` outside the four `sdk/org/libs/core/src/spaces/emitter-load.ts#validateEmitterDef`. Every kind needs an `emit` function `sdk/org/libs/core/src/spaces/emitter-load.ts:114-116`.

| Kind | Fires on | `emit` receives | Detail |
|---|---|---|---|
| `webhook` | an external caller `POST`s to the def's own `path` | the verified `WebhookInbound` | [webhook.md](./webhook.md) `sdk/org/libs/core/src/spaces/emitter-def.ts#WebhookEmitterDef` |
| `cron` | the def's schedule (exactly one of `every`/`daily`) | a gated `CronEmitterCtx` | [cron.md](./cron.md) `sdk/org/libs/core/src/spaces/emitter-def.ts#CronEmitterDef` |
| `db` | a project-db write to `on.table`/`on.event` | the written `DbEmitterRow` | [db.md](./db.md) `sdk/org/libs/core/src/spaces/emitter-def.ts#DbEmitterDef` |
| `internal` | an lmthing runtime signal (`on.signal`) | the `InternalSignal` | [internal.md](./internal.md) `sdk/org/libs/core/src/spaces/emitter-def.ts#InternalEmitterDef` |

## Event addressing

Every emitted event is source-qualified into an address `<sourceScope>/<event>` at dispatch: the project scope is literally `project`, a space scope its id `sdk/org/libs/cli/src/server/event-dispatch.ts:183-185`. Consumers match on the full address via `on.event`, whose form is enforced by `EVENT_ADDR_RE` `sdk/org/libs/cli/src/app/hooks/loader.ts#LoadedHook`.

| Source | Address form | Example |
|---|---|---|
| the project's own defs | `project/<event>` | `project/item.added` |
| a synthetic db write (every committed write auto-emits) | `project/db.<table>.<insert\|update\|remove>` | `project/db.orders.insert` |
| an installed space's defs | `<spaceId>/<event>` | `integration-slack/message.received` |

The synthetic `project/db.<table>.<event>` is built at runtime with the written row as its payload `sdk/org/libs/cli/src/app/hooks/runtime.ts#ProjectHookRuntime.onDbWrite`. Consumers subscribe by address with an [event hook](../hooks/README.md) `sdk/org/libs/cli/src/server/event-dispatch.ts:184-186`.

## Integrations are event SOURCES

An integration (Slack, Telegram, …) is a store space whose `events/<name>.ts` emits a typed event — **not** a handler-agent bridge. A messaging integration's def emits a normalized `message.received`, and a project subscribes with an event hook `store/spaces/integration-slack/events/messages.ts:1-8`. The `integration-lmthing` space normalizes the curated runtime signals (`session.started`, `session.completed`, `agent.delegated`, `space.installed`, `hook.fired`, `document.written`, `project.created`) into typed events plus a `publishEvent(name, payload)` function `sdk/org/libs/cli/src/server/internal-signals.ts:20-28` `store/spaces/integration-lmthing/functions/publishEvent.ts`.

## A real def (webhook)

Adapted from `store/spaces/integration-slack/events/messages.ts` — a `webhook` emitter with the `{ type:'builtin', provider:'slack' }` shorthand and a `threadKey?` optional field `store/spaces/integration-slack/events/messages.ts:37-88`:

```ts
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'slack',                                   // this def's OWN inbound path
  verify: { type: 'builtin', provider: 'slack' },  // HMAC + handshake resolved pod-side
  emits: {
    'message.received': {
      payload: { text: 'string', from: 'string', chatId: 'string', threadKey: 'string?', raw: 'object' },
    },
  },
  emit(inbound: WebhookInbound): Emitted[] {       // PURE: verified request → events
    const event = (inbound.json as any)?.event;
    if (!event || event.type !== 'message' || event.bot_id || event.subtype) return []; // drop echoes/subtypes
    const threadKey = event.thread_ts ?? event.ts;
    return [{
      event: 'message.received',
      payload: { text: event.text, from: event.user, chatId: event.channel, raw: inbound.json },
      ...(threadKey ? { threadKey } : {}),
    }];
  },
};
export default def;
```

## See also

- [webhook.md](./webhook.md) · [cron.md](./cron.md) · [db.md](./db.md) · [internal.md](./internal.md) — the four kinds in detail.
- [../hooks/README.md](../hooks/README.md) — event hooks, the CONSUMER side of the pipeline.
- [../../project/events/README.md](../../project/events/README.md) — the same def format in project scope.
