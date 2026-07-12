# `events/<name>.ts` — typed emitter def (four kinds)

The **canonical** emitter-def reference (the format is identical in a space and a project — see the
project-scope notes at [../../project/events/](../../project/events/)). An emitter def makes a space
(or project) an **event SOURCE**: a typed producer of events on the bus. Its consumers are
[event hooks](../hooks/).

`emits` maps `<event name> → { payload: { <field>: <typeString> } }`. typeStrings are
`string | number | boolean | object | array | any`, and a **trailing `?`** marks a field optional
(`threadKey: 'string?'`) — the generated DTS emits an optional member and runtime validation
tolerates its absence. Event names are dot-separated lowercase (`message.received`,
`db.raw_items.insert`). Duplicate event names within one scope fail the whole scope loudly.

---

## a. `webhook` — an inbound HTTP producer

Its own inbound path; a `verify` union or the `{ type:'builtin', provider }` shorthand (resolved
pod-side to the inline adapter, e.g. Slack HMAC + handshake); a **pure** `emit` that parses the
request into events.

```ts
import type { Emitted, WebhookEmitterDef, WebhookInbound } from '@lmthing/core';

const def: WebhookEmitterDef = {
  type: 'webhook',
  path: 'slack',
  verify: { type: 'builtin', provider: 'slack' },          // HMAC/handshake resolved pod-side
  emits: { 'message.received': { payload: { text: 'string', from: 'string', chatId: 'string', threadKey: 'string?', raw: 'object' } } },
  emit(inbound: WebhookInbound): Emitted[] {
    const event = (inbound.json as any)?.event;
    if (!event || event.type !== 'message' || event.bot_id || event.subtype) return [];  // drop echoes/subtypes
    return [{ event: 'message.received', payload: { text: event.text, from: event.user, chatId: event.channel, raw: inbound.json }, threadKey: event.thread_ts ?? event.ts }];
  },
};
export default def;
```

## b. `cron` — a scheduled poll with a gated ctx

`callConnection` is locked to the space's own provider(s) (a project def uses its declared
`connections:`); `ctx.state` is a non-executable, size-capped JSON KV persisted per def
(poll cursors, dedupe marks).

```ts
import type { CronEmitterCtx, CronEmitterDef, Emitted } from '@lmthing/core';

const def: CronEmitterDef = {
  type: 'cron',
  every: '30m',                              // exactly one of `every` (<n>m|h|d) or `daily` ('HH:MM')
  connections: ['gmail'],
  emits: { 'mail.arrived': { payload: { id: 'string', subject: 'string' } } },
  async emit(ctx: CronEmitterCtx): Promise<Emitted[]> {
    const since = (ctx.state?.['lastId'] as string) ?? '0';
    const res = await ctx.callConnection!('gmail', { since });
    // … map results → Emitted[], write ctx.state['lastId'] back so the next tick resumes
    return [];
  },
};
export default def;
```

## c. `db` — fires on a project-db write

A **pure** map from a written row to a curated, named event. Distinct from the automatic synthetic
`project/db.<table>.<event>` (which every write emits anyway) — use a `db` emitter when you want a
domain event with a curated payload instead of the raw row.

```ts
import type { DbEmitterDef, DbEmitterRow, Emitted } from '@lmthing/core';

const def: DbEmitterDef = {
  type: 'db',
  on: { table: 'feed_items', event: 'insert' },            // event ∈ insert | update | remove
  emits: { 'item.added': { payload: { id: 'string', title: 'string' } } },
  emit(row: DbEmitterRow): Emitted[] {
    return [{ event: 'item.added', payload: { id: String(row.row['id']), title: String(row.row['title'] ?? '') } }];
  },
};
export default def;
```

## d. `internal` — an lmthing runtime signal

A **pure** map from a curated runtime signal to events. Signals are fire-and-forget — a
throwing/hanging internal def is worker-contained and never breaks the instrumented path.

```ts
import type { Emitted, InternalEmitterDef, InternalSignal } from '@lmthing/core';

const def: InternalEmitterDef = {
  type: 'internal',
  on: { signal: 'space.installed' },
  emits: { 'space.installed': { payload: { projectId: 'string', spaceId: 'string' } } },
  emit(signal: InternalSignal): Emitted[] { /* … pure */ return []; },
};
export default def;
```

Curated signal set: `session.started`, `session.completed`, `agent.delegated`, `space.installed`,
`hook.fired`, `document.written`, `project.created`. The `integration-lmthing` space normalizes the
whole set into typed events + a `publishEvent(name, payload)` function.

---

## Event addressing

Every emitted event is addressed `<sourceId>/<name>`:

| Source | Address form | Example |
|---|---|---|
| the project's own defs | `project/<event>` | `project/item.added` |
| a synthetic db write | `project/db.<table>.<insert\|update\|remove>` | `project/db.orders.insert` |
| an installed space's defs | `<spaceId>/<event>` | `integration-slack/message.received` |

Consumers subscribe by address with an [event hook](../hooks/). Integrations are **event sources**,
not handler-agent bridges: a messaging integration's `events/messages.ts` emits a typed
`message.received`, and a project subscribes with an event hook.

Real example: `store/spaces/integration-slack/events/messages.ts` (a `webhook` emitter with the
`{ type:'builtin', provider:'slack' }` shorthand).
