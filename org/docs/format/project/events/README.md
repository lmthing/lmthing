# `events/<name>.ts` — typed emitter def (project scope)

An emitter def is a **producer** of typed events: a `.ts` file whose default export is a typed `EmitterDef`, fail-loud validated by `validateEmitterDef` `sdk/org/libs/core/src/spaces/emitter-load.ts:108`. The on-disk format is **identical in a project and a space** — the same pure validator is shared by the pod scanner and the store catalog-gen script `sdk/org/libs/core/src/spaces/emitter-load.ts:1-6`. The canonical four-kind reference lives at **[../../space/events/README.md](../../space/events/README.md)**; this page covers only the project-scope specifics.

## Project-scope framing

- A project's own emitter defs address their events as **`project/<event>`** — at dispatch the emitting scope is source-qualified into `<sourceScope>/<event>`, and for a project the `sourceScope` is literally the string `'project'` `sdk/org/libs/cli/src/server/event-dispatch.ts:75-77`, `sdk/org/libs/cli/src/server/event-dispatch.ts:183-184`.
- Every committed db write **also** auto-emits a synthetic **`project/db.<table>.<insert|update|remove>`** event whose payload IS the row — no `db` emitter is needed to react to writes `sdk/org/libs/cli/src/app/hooks/runtime.ts:128-136`. The synthetic event's payload is the representative row (`rows[0]`, matching the pre-S6 database-hook behavior) `sdk/org/libs/cli/src/app/hooks/runtime.ts:124-126`. Author a `db` emitter only when you want a *curated, named* payload instead of the raw row — its pure `emit(row)` runs worker-isolated and its output is validated before enqueue `sdk/org/libs/cli/src/app/hooks/runtime.ts:138-140`, `sdk/org/libs/cli/src/app/hooks/runtime.ts:148-150`.
- A `cron` emitter in a project may declare `connections: [...]`, validated as an array of provider-id strings `sdk/org/libs/core/src/spaces/emitter-load.ts:152-156`. At run time its `ctx.callConnection` is gated to those **declared** providers intersected with the project's **installed** integration providers `sdk/org/libs/cli/src/server/routes/hooks.ts:579-593` (a space-owned cron def is instead locked to the owning space's OWN providers).

## The four kinds (summary)

| Kind | `type` | Fires on | `emit` shape |
|---|---|---|---|
| `webhook` | `'webhook'` | inbound HTTP to its own `path` | pure `(inbound) => Emitted[]` `sdk/org/libs/core/src/spaces/emitter-def.ts:85` |
| `cron` | `'cron'` | `every`/`daily` schedule | async `(ctx) => Promise<Emitted[]>` `sdk/org/libs/core/src/spaces/emitter-def.ts:116` |
| `db` | `'db'` | a project-db write (`on: { table, event }`) | pure `(row) => Emitted[]` `sdk/org/libs/core/src/spaces/emitter-def.ts:140` |
| `internal` | `'internal'` | a curated runtime signal (`on: { signal }`) | pure `(signal) => Emitted[]` `sdk/org/libs/core/src/spaces/emitter-def.ts:160` |

The discriminated `type` selects the validation branch, and only `'webhook' | 'cron' | 'db' | 'internal'` are accepted `sdk/org/libs/core/src/spaces/emitter-load.ts:119-201`. Every kind requires an `emit` function `sdk/org/libs/core/src/spaces/emitter-load.ts:114-116`. A `cron` def needs exactly one of `every` (`/^\d+[mhd]$/`) or `daily` (`HH:MM`) `sdk/org/libs/core/src/spaces/emitter-load.ts:140-151`; a `db` def needs `on: { table, event }` with `event ∈ insert|update|remove` `sdk/org/libs/core/src/spaces/emitter-load.ts:168-183`; an `internal` def needs `on: { signal }` `sdk/org/libs/core/src/spaces/emitter-load.ts:185-197`.

Each kind's file-format, imports, and worked examples: [webhook](../../space/events/webhook.md) · [cron](../../space/events/cron.md) · [db](../../space/events/db.md) · [internal](../../space/events/internal.md).

## `emits` — the payload contract

`emits` maps `<event name> → { payload: { <field>: <typeString> } }`, must be a non-empty object, and event names must be dot-separated lowercase segments `sdk/org/libs/core/src/spaces/emitter-load.ts:41-81`. TypeStrings are `string | number | boolean | object | array | any` `sdk/org/libs/core/src/spaces/emitter-load.ts:39`, each with an optional trailing **`?`** marking the field optional — the `?` is preserved in the schema so the DTS generator emits an optional member and runtime validation tolerates its absence `sdk/org/libs/core/src/spaces/emitter-load.ts:68-77`, `sdk/org/libs/core/src/spaces/emitter-load.ts:256-272`. Event names must be unique within one scope (a project's `events/` dir) or `collectDeclaredEvents` throws `sdk/org/libs/core/src/spaces/emitter-load.ts:210-226`.

## Worked example — a project `db` emitter (curated payload)

Adapted from the real internal emitter `store/spaces/integration-lmthing/events/session-completed.ts:11-58` (same `EmitterDef` shape), a project-rooted `db` emitter turning each new `posts` row into a named `post.published` event:

```ts
import type { DbEmitterDef, DbEmitterRow, Emitted } from '@lmthing/core';

const def: DbEmitterDef = {
  type: 'db',
  on: { table: 'posts', event: 'insert' },
  emits: {
    'post.published': { payload: { id: 'string', title: 'string', slug: 'string?' } },
  },
  emit(row: DbEmitterRow): Emitted[] {
    const r = row.row as { id?: string; title?: string; slug?: string };
    if (typeof r.id !== 'string' || typeof r.title !== 'string') return [];
    return [{ event: 'post.published', payload: { id: r.id, title: r.title, slug: r.slug } }];
  },
};

export default def;
```

This def emits `project/post.published`; without it, an insert on `posts` would still auto-emit `project/db.posts.insert` (payload = the raw row) `sdk/org/libs/cli/src/app/hooks/runtime.ts:128-136`.

## Consuming project events

Consumers subscribe with an [event hook](../hooks/README.md) — a `hooks/<slug>.ts` `{ type: 'event', on: { event: 'project/…' } }` whose `ctx.input` carries the event payload (the row, for a synthetic `db.<table>.<event>` event). Full authoring guide for the emitter side: [../../space/events/README.md](../../space/events/README.md).
