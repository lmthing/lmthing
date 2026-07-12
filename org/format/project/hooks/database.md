# `database` hook (REMOVED — migrated to an `event` hook on `project/db.<table>.<event>`)

The `{type:'database'}` hook kind was **removed with no back-compat**: a file still declaring `{type:'database'}` is dropped from the load with a clear migration error (the rest of the project still loads) `sdk/org/libs/cli/src/app/hooks/loader.ts:49-53`. A raw default export whose `type` is `'database'` is recognized by `isRemovedDatabaseHook` and skipped-with-warn in both the project and space loaders `sdk/org/libs/cli/src/app/hooks/loader.ts:230-233,283-286,475-477`, and `validateHook` throws the same migration message as a backstop so a `database` hook can never sneak through `sdk/org/libs/cli/src/app/hooks/loader.ts:414-418`. The migration message names the exact replacement: subscribe to the synthetic event `project/db.<table>.<event>` with `{type:'event', on:{event:...}, handler}`, where `ctx.input` is the written row `sdk/org/libs/cli/src/app/hooks/loader.ts:481-488`.

## What replaced it

A committed project db write **auto-emits** a synthetic event `project/db.<table>.<insert|update|remove>` whose payload IS the written row; an [`event` hook](./event.md) subscribes to it `sdk/org/libs/cli/src/app/hooks/loader.ts:18-25,120-123`. The three write kinds are exactly `insert | update | remove` `sdk/org/libs/cli/src/app/hooks/loop-guard.ts:24-26`.

## Shape

Because it is now an event hook, the file default-exports `{type:'event', on:{event}}` — not `{type:'database', on:{table,event}}` `sdk/org/libs/cli/src/app/hooks/loader.ts:135-137`. The `on.event` address is **source-qualified** `<sourceId>/<name>`; for a db subscription the source is the literal `project` and the name is `db.<table>.<event>`, validated against `EVENT_ADDR_RE` `sdk/org/libs/cli/src/app/hooks/loader.ts:189-190,420-429`.

## Exactly one of `trigger` | `handler`

An event hook must carry **exactly one** of `trigger` (a declarative `space/agent#action`) or `handler` (an imperative function); declaring both or neither throws fail-loud `sdk/org/libs/cli/src/app/hooks/loader.ts:430-436`. Use a `handler` for a deterministic reaction to a row write and a `trigger` to delegate the row into an agent.

## Imperative handler ctx (`input` / `row` / `db` / `delegate`)

A handler receives a ctx built by `buildHookCtx` `sdk/org/libs/cli/src/server/routes/hooks.ts:228-285`. The synthetic db event's payload (the written row) arrives as **`ctx.input`** `sdk/org/libs/cli/src/app/hooks/runtime.ts:219-224` `sdk/org/libs/cli/src/server/routes/hooks.ts:283`; the legacy `ctx.row` field is retained only as a seed for the space-hook worker shim and you should prefer `input` `sdk/org/libs/cli/src/app/hooks/loader.ts:75-86`. `ctx.db` is the project's async data API (`AsyncDbApi`), threaded through from the project db `sdk/org/libs/cli/src/server/routes/hooks.ts:346-349,277-278`. `ctx.delegate(space/agent, action?, {input})` runs the target agent headless with the hook's budget, emits an `agent.delegated` signal, and returns the normalized `DelegateResult` `sdk/org/libs/cli/src/server/routes/hooks.ts:237-256`. `ctx.callConnection` is gated to the hook def's declared `connections:` `sdk/org/libs/cli/src/server/routes/hooks.ts:258-268,142-143`.

## A pure handler runs no agent — no LLM, no credits

When a hook has a `handler`, `runHook` invokes `hook.handler(ctx)` **directly** in-proc; only the `trigger` branch calls `manager.runHeadless` (which spins up an agent session) `sdk/org/libs/cli/src/server/routes/hooks.ts:326-353`. So a handler that only reads/writes `ctx.db` never starts an agent session and consumes no model credits — the interface documents `handler` as "real code, no agent/LLM" `sdk/org/libs/cli/src/app/hooks/loader.ts:99-114`. A handler that itself calls `ctx.delegate(...)` does start an agent for that delegation `sdk/org/libs/cli/src/server/routes/hooks.ts:245-252`.

## Dispatch path, coalescing & loop guards

The project db `onWrite` seam feeds `ProjectHookRuntime.onDbWrite`, which enqueues the synthetic `project/db.<table>.<event>` event (payload = `rows[0]`) into the coalescing `HookDispatcher` **synchronously**, then drains on the next `setImmediate` tick — a committed write enqueues and returns, never re-entrant `sdk/org/libs/cli/src/app/hooks/runtime.ts:119-146,198-205`. Db-write dispatch is the one path that goes through this coalescing queue; other event kinds (webhook/cron/internal) dispatch directly `sdk/org/libs/cli/src/app/hooks/runtime.ts:37-62`. Three pure firing guards bound the cascade: a depth cap of 3, self-write exclusion (a hook never fires on an event produced by its own triggered session), and a per-hook cooldown that coalesces a burst to one fire `sdk/org/libs/cli/src/app/hooks/loop-guard.ts:51-100`. Subscribers are matched by `matchEventHooks` on the source-qualified address `sdk/org/libs/cli/src/app/hooks/loop-guard.ts:109-111`.

## Worked example

Real, from `store/projects/blog/hooks/synthesize-new.ts` `store/projects/blog/hooks/synthesize-new.ts:1-13` — an event hook subscribing to the synthetic insert event, reading the row as `ctx.input`, then delegating:

```ts
// hooks/synthesize-new.ts — fires when a `raw_items` row is inserted.
// `ctx.input` IS the written row.
export default {
  type: 'event',
  on: { event: 'project/db.raw_items.insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ input, delegate }: {
    input: any;
    delegate: (ref: string, action: string, opts: { input: unknown }) => Promise<unknown>;
  }) => {
    if (input && input.processed) return; // idempotence — loop guard also excludes self-writes
    await delegate('newsroom/synthesizer', 'synthesize', { input: { rawItemId: input?.id } });
  },
};
```

Because events coalesce per-hook, a real handler treats the passed row as a hint and self-queries the latest state; a burst learns once per window (see `store/projects/blog/hooks/personalize-on-read.ts` `store/projects/blog/hooks/personalize-on-read.ts:1-21`).

## See also

- [`hooks/README.md`](./README.md) — hook kinds, slug/owner, project vs space loading.
- [`hooks/event.md`](./event.md) — the event-hook kind this migrates to (full `on.event` / trigger-vs-handler reference).
- [`hooks/cron.md`](./cron.md) — the time-based hook kind (also `trigger`-or-`handler`).
- [`events/README.md`](../events/README.md) · [`space/events/db.md`](../../space/events/db.md) — the `{type:'db'}` emitter def, the other producer a committed write can fan out to.
