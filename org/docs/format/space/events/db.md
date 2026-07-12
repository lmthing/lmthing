# `db` emitter def (`events/<name>.ts`, `type: 'db'`)

A `db` emitter is one of the four producer kinds in the unified event pipeline; it fires when a row is written to the project db at `on.table`/`on.event`, and its pure `emit(row)` turns the written row into curated named events (`sdk/org/libs/core/src/spaces/emitter-def.ts:130-141`). It is the PRODUCER counterpart to an event hook (the consumer) — see [`README.md`](./README.md) and [`../hooks/README.md`](../hooks/README.md).

## When to use it (vs. the automatic synthetic event)

Every committed db write ALREADY auto-emits a synthetic event `project/db.<table>.<insert|update|remove>` whose payload IS the written row, with no emitter def required (`sdk/org/libs/cli/src/app/hooks/runtime.ts:128-136`). A subscriber reads that raw row directly as `ctx.input` on an event hook `on:{event:'project/db.<table>.<event>'}` (`sdk/org/libs/cli/src/app/hooks/runtime.ts:45-48`). So author a `db` emitter def ONLY when you want a CURATED, renamed, typed payload instead of the raw-row synthetic event — the def's `emit(row)` maps the raw row into one or more of your own declared events (`sdk/org/libs/core/src/spaces/emitter-def.ts:130-140`). Both fire for the same write: the synthetic event is enqueued synchronously and any `{type:'db'}` def's typed events are enqueued on a follow-up microtask, into the SAME coalescing dispatch queue (`sdk/org/libs/cli/src/app/hooks/runtime.ts:44-53`).

## Shape

A `db` emitter def default-exports an object with `type: 'db'`, an `on: { table, event }` selector, an `emits` schema, and a pure `emit(row)` function (`sdk/org/libs/core/src/spaces/emitter-def.ts:134-141`).

- `type` must be the literal `'db'` (`sdk/org/libs/core/src/spaces/emitter-def.ts:135`).
- `on.table` is the project-db table name (a non-empty string), and `on.event` is one of `'insert' | 'update' | 'remove'` (`sdk/org/libs/core/src/spaces/emitter-def.ts:119-136`).
- `emits` declares each produced event name → `{ payload }`, where each payload field maps to a typeString (`'string'|'number'|'boolean'|'object'|'array'|'any'`, the same vocabulary as a tasklist node's `output`) (`sdk/org/libs/core/src/spaces/emitter-def.ts:37-42`). A trailing `?` on a typeString (e.g. `'string?'`) marks the field optional (`sdk/org/libs/core/src/spaces/emitter-load.ts:67-77`).
- `emit(row: DbEmitterRow): Emitted[]` is PURE — the written row in, an array of `{ event, payload, threadKey? }` out — with no side effects and no i/o (`sdk/org/libs/core/src/spaces/emitter-def.ts:139-140`). Its argument carries `{ table, event, row }` (`sdk/org/libs/core/src/spaces/emitter-def.ts:123-128`).

## Validation (fail-loud)

`validateEmitterDef` validates the raw default export for the `type === 'db'` branch, throwing `a db emitter needs \`on: { table, event }\`` when `on.table` is missing or not a non-empty string, and throwing `\`on.event\` must be 'insert' | 'update' | 'remove'` on any other event value (`sdk/org/libs/core/src/spaces/emitter-load.ts:168-183`). Every def (all kinds) must have an `emit` function and a non-empty `emits` object with at least one event and valid typeStrings, else it throws (`sdk/org/libs/core/src/spaces/emitter-load.ts:114-117`, `sdk/org/libs/core/src/spaces/emitter-load.ts:42-82`). This validator is pure — it never touches fs or runs `emit` (`sdk/org/libs/core/src/spaces/emitter-load.ts:103-108`).

## Dispatch (runtime)

On a committed write the pod scans the project's emitter defs, skips any whose `type !== 'db'` or whose `on.table`/`on.event` don't match, then runs each matching def's `emit(row)` WORKER-ISOLATED with a 5s ceiling (`LMTHING_EMITTER_EMIT_TIMEOUT_MS`) (`sdk/org/libs/cli/src/app/hooks/runtime.ts:151-181`, `sdk/org/libs/cli/src/app/hooks/runtime.ts:12-14`). Because a `db` emitter is a pure transform, the worker's db/`callConnection` proxies are given empty handlers and reject if the `emit` tries to touch them (`sdk/org/libs/cli/src/app/hooks/runtime.ts:164-165`). The `emit` output is validated against the def's `emits` schema, and each surviving event is enqueued at address `<scope>/<event>` (scope = `project` for a project def, the space id for a space def) (`sdk/org/libs/cli/src/app/hooks/runtime.ts:182-192`). Both the synthetic and the db-emitter events ride the coalescing `HookDispatcher` queue, so per-slug coalesce, depth cap (3), self-write exclusion, and cooldown bound the loop (`sdk/org/libs/cli/src/app/hooks/runtime.ts:41-53`).

## Worked example

No `db`-kind emitter ships on disk today; the shape below is adapted from the on-disk internal emitter `store/spaces/integration-lmthing/events/document-written.ts` (same `Emitted`/`emit` contract, `db` selector substituted):

```ts
import type { DbEmitterDef, DbEmitterRow, Emitted } from '@lmthing/core';

const def: DbEmitterDef = {
  type: 'db',
  on: { table: 'posts', event: 'insert' },
  emits: {
    'post.published': {
      payload: { id: 'string', title: 'string', excerpt: 'string?' },
    },
  },
  emit(w: DbEmitterRow): Emitted[] {
    const r = w.row as { id?: string; title?: string; body?: string };
    if (typeof r.id !== 'string' || typeof r.title !== 'string') return [];
    return [
      {
        event: 'post.published',
        payload: { id: r.id, title: r.title, excerpt: (r.body ?? '').slice(0, 160) },
      },
    ];
  },
};

export default def;
```

The `Emitted` return shape (`{ event, payload, threadKey? }`) matches the emitter contract, and `event` must be one of the def's declared `emits` keys (`sdk/org/libs/core/src/spaces/emitter-def.ts:25-35`).

## Related

- [`README.md`](./README.md) — the `events/` dir and the four emitter kinds
- [`webhook.md`](./webhook.md) — the `webhook` emitter kind
- [`cron.md`](./cron.md) — the `cron` emitter kind
- [`internal.md`](./internal.md) — the `internal` emitter kind
- [`../hooks/README.md`](../hooks/README.md) — event hooks (the consumer side)
- [`../../project/events/README.md`](../../project/events/README.md) — emitter defs in a project's `events/` dir
