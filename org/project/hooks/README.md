# `hooks/<slug>.ts` — in-proc automation

Each file default-exports **one** hook def. Written by `writeHook(slug, src)` (granted by
`hooks:write`). Three types: `cron`, `database`, and `event` (the current, unified pipeline).

## `cron` — time-based

```ts
export default { type: 'cron', every: '30m', trigger: 'newsroom/fetcher#refresh' };
// `every` = <n>m|h|d, mutually exclusive with `daily: 'HH:MM'`
```

## `database` — fires on a project-db write

Declarative or imperative. **Exactly one** of `trigger` / `handler`; `event` ∈ `insert | update | remove`:

```ts
// declarative — delegate to an agent action
export default { type: 'database', on: { table: 'raw_items', event: 'insert' }, trigger: 'newsroom/synthesizer#synthesize' };

// imperative — a plain Node handler (no LLM, no AI credits)
export default {
  type: 'database', on: { table: 'raw_items', event: 'insert' },
  handler: async ({ row, db, delegate }) => { /* … */ },
};
```

## `event` — subscribe to ONE source-qualified event address

The current unified pipeline. **Exactly one** of `handler` (code-as-filter, cheap, no agent) or
`trigger` (delegate to an agent):

```ts
// code handler as filter — react to a raw db write; ctx.input IS the written row
export default {
  type: 'event',
  on: { event: 'project/db.reading_events.insert' },
  budget: { maxEpisodes: 8 },
  handler: async ({ input, delegate }) => {
    if (input?.processed) return;                       // idempotence / loop-guard
    await delegate('editorial/personalizer', 'learn', { input: { eventId: input?.id } });
  },
};

// delegate to an agent action, seeded with the event payload
export default {
  type: 'event',
  on: { event: 'project/db.interactions.insert' },
  trigger: 'pharmacy/pharmacist#review',
  budget: { maxEpisodes: 8, maxWallClockMs: 300000 },   // forwarded to the headless run
};
```

## The source-qualified event address `<sourceId>/<name>`

| Source | Address form | Example |
|---|---|---|
| the project's own [events/](../events/) defs | `project/<event>` | `project/item.added` |
| a synthetic db write (auto-emitted) | `project/db.<table>.<insert\|update\|remove>` | `project/db.orders.insert` |
| an installed space's defs | `<spaceId>/<event>` | `integration-slack/message.received` |

> You do **not** need a `db` emitter to react to a write — every committed write auto-emits the
> synthetic `project/db.<table>.<event>`, whose payload **is** the row. Use a
> [db emitter](../events/) only when you want a curated, domain-named payload.

`trigger` is `'space/agent#action'`. `budget` (optional) is forwarded to the headless agent run.
`event`/`database` handlers are the *consumer* half of the pipeline; the *producer* half is
[events/](../events/).

Real examples: `store/projects/blog/hooks/{refresh-sources,synthesize-new,personalize-on-read}.ts`.
