# Hook file — `{ type: 'event' }`

An **event hook** is the CONSUMER side of the unified event pipeline: a `hooks/<slug>.ts` file that default-exports a `{ type: 'event' }` object and fires when an event named by `on.event` is dispatched (`sdk/org/libs/cli/src/app/hooks/loader.ts:126-145` `EventHookDef`). Its symmetric PRODUCER counterpart is an emitter def (`events/<name>.ts`); see [`project/events/README.md`](../events/README.md) and [`space/events/README.md`](../../space/events/README.md). For the hook file family as a whole (discovery, slugs, `cron`/`webhook`/`database` kinds) see [`project/hooks/README.md`](./README.md).

## Shape

An event hook is a default-exported object with `type: 'event'` and an `on: { event: '<address>' }` subscription (`sdk/org/libs/cli/src/app/hooks/loader.ts:135-145`). The address is **source-qualified** — `<sourceId>/<name>` where `sourceId` is the emitting scope (literally `project`, or a `<spaceId>`) and `name` is the def's declared dot-segmented event name (`sdk/org/libs/cli/src/app/hooks/loader.ts:126-133`). The loader validates the address against `EVENT_ADDR_RE = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/` and throws fail-loud on a missing or malformed `on.event` (`sdk/org/libs/cli/src/app/hooks/loader.ts:190,420-429`).

A committed project db write auto-emits the synthetic event `project/db.<table>.<insert|update|remove>` whose payload IS the written row, so a subscription like `on: { event: 'project/db.feed_items.insert' }` is how you react to inserts (this is the S6 replacement for the removed `{ type: 'database' }` hook) (`sdk/org/libs/cli/src/app/hooks/runtime.ts:128-136`; `sdk/org/libs/cli/src/app/hooks/loader.ts:49-53,120-123`). A file still declaring `{ type: 'database' }` is dropped with a migration error rather than loaded (`sdk/org/libs/cli/src/app/hooks/loader.ts:230-233,414-418`, `databaseHookRemovedMessage` `:481-488`).

## Exactly one of `handler` or `trigger`

An event hook must carry **exactly one** of `handler` (imperative code-as-filter) or `trigger` (delegate to `space/agent#action`) — the loader throws when both or neither is present (the `hasTrigger === hasHandler` guard) (`sdk/org/libs/cli/src/app/hooks/loader.ts:430-436`).

- **`handler`** — an imperative async function; the handler IS the filter, with no DSL and no agent/LLM spun up (`sdk/org/libs/cli/src/app/hooks/loader.ts:131-133,138-145`). It is the cheap path for deterministic reactions. A project hook's handler is transpiled and run in-proc (`sdk/org/libs/cli/src/app/hooks/loader.ts:206-244,358-374`); a space hook's handler is run worker-isolated through a shim (`sdk/org/libs/cli/src/app/hooks/loader.ts:271-298,343-356`).
- **`trigger`** — a `space/agent#action` string parsed on `#` into `{ spaceRef, agentSlug, action }` and run as a headless agent session via the manager (`sdk/org/libs/cli/src/server/event-dispatch.ts:97-103,134-159`).

## Dispatch and `ctx.input`

`dispatchEmittedEvents` source-qualifies each event's address (`${sourceScope}/${ev.event}`), matches every subscribing event hook across the project AND every installed space via `matchEventHooks`, and runs each (`sdk/org/libs/cli/src/server/event-dispatch.ts:169-230`). `matchEventHooks` selects every loaded `event`-type hook whose `on.event` equals the address — the SINGLE matcher shared by direct and db-coalesced dispatch (`sdk/org/libs/cli/src/app/hooks/loop-guard.ts:109-111`).

For a **handler** hook, dispatch calls `runHook` with the emitted event's payload as `ctx.input` (`sdk/org/libs/cli/src/server/event-dispatch.ts:217-220`); `runHook` builds the ctx and passes `opts.input` through as `ctx.input` (`sdk/org/libs/cli/src/server/routes/hooks.ts:277-284,346-352`). `ctx.input` carries the payload uniformly: for a synthetic `project/db.<table>.<event>` subscription it is the written row, otherwise it is the emitter's declared payload (`sdk/org/libs/cli/src/app/hooks/loader.ts:83-85`; `sdk/org/libs/cli/src/app/hooks/runtime.ts:124-135`). The handler ctx also carries `db`, `delegate` (structured input in, result out), `callConnection` (gated by the hook's declared `connections`), and `tasklist.run` (`sdk/org/libs/cli/src/server/routes/hooks.ts:228-285`).

For a **trigger** hook, dispatch seeds a headless run with a kickoff message embedding the event address and JSON payload; when the emitted event carries a `threadKey` the run continues one persisted session per `(event:<address>, threadKey)`, else a fresh `runHeadless` (`sdk/org/libs/cli/src/server/event-dispatch.ts:134-159,197-206`). Trigger event hooks bypass `runHook`, so their `hook.fired` internal signal is emitted directly in the dispatcher (`sdk/org/libs/cli/src/server/event-dispatch.ts:198-205`). A single failing subscriber is logged and skipped — one bad hook must not sink the rest (`sdk/org/libs/cli/src/server/event-dispatch.ts:222-227`).

## Budget forwarding

An optional `budget` with `maxEpisodes` / `maxWallClockMs` is validated (only those two keys; non-negative numbers) and attached to the hook (`sdk/org/libs/cli/src/app/hooks/loader.ts:64-70,443,500-519`). For a trigger hook the budget is forwarded verbatim into the headless run (`budget: def.budget` → `runHeadless` / `runHeadlessThreaded`) (`sdk/org/libs/cli/src/server/event-dispatch.ts:149-158`). For a handler hook that delegates, the same `hook.budget` is forwarded into `ctx.delegate`'s `runHeadless` (`sdk/org/libs/cli/src/server/routes/hooks.ts:245-252`).

## Coalescing (db-write events only)

DB-write-originated events route through the coalescing `HookDispatcher` queue; every other kind (webhook/cron/internal) dispatches directly — async and sequential, with no post-commit coalescing, because each arrives singly from an external edge (`sdk/org/libs/cli/src/server/event-dispatch.ts:23-31,207-220`; `sdk/org/libs/cli/src/app/hooks/runtime.ts:128-136`). The queue applies three pure firing guards uniformly (`shouldFireHook`): a depth cap (`HOOK_DEPTH_CAP = 3`), self-write exclusion (`originatingHookSlug === hook.slug`), and a cooldown/coalesce window (`sdk/org/libs/cli/src/app/hooks/loop-guard.ts:52,84-100`). The window is `HOOK_COOLDOWN_MS = 5_000` ms, so a burst of same-address db writes inside one eval collapses to a single fire (`sdk/org/libs/cli/src/app/hooks/runtime.ts:10,87`). Direct-dispatched events still get self-trigger suppression: a subscribing hook whose slug equals `skipHookSlug` is skipped (`sdk/org/libs/cli/src/server/event-dispatch.ts:189-194`).

Only DECLARED, schema-valid events reach subscribers: `validateEmitted` drops any raw item that names an undeclared event or whose payload fails its declared field schema (`sdk/org/libs/cli/src/server/event-dispatch.ts:240-274`).

## Worked example

Adapted from the real handler hook `store/projects/demo-feed/hooks/enrich-on-add.ts` — it subscribes to the synthetic insert event, reads the written row from `ctx.input`, and writes back (an `update`, so it never re-triggers itself):

````ts
// hooks/enrich-on-add.ts — event, imperative (no agent)
export default {
  type: 'event' as const,
  on: { event: 'project/db.feed_items.insert' },
  handler: async ({ input, db }: {
    input: { id: string; title?: string; summary?: string };
    db: { update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number> };
  }): Promise<void> => {
    if (!input?.id) return;
    if (!input.summary || input.summary.trim() === '') {
      await db.update('feed_items', {
        where: { id: input.id },
        set: { summary: `Saved: ${input.title ?? 'untitled'}` },
      });
    }
  },
};
````

A trigger form instead delegates to an agent and typically carries a budget, e.g. `{ type: 'event', on: { event: 'project/db.visit_briefs.insert' }, trigger: 'clinic/interpreter#prep', budget: { maxEpisodes: 6, maxWallClockMs: 300000 } }` (`store/projects/health/hooks/prepare-visit-brief.ts`).

## See also

- [`project/hooks/README.md`](./README.md) — the hook file family (discovery, slugs, all kinds)
- [`project/hooks/database.md`](./database.md) — the removed `database` kind and its event-hook replacement
- [`project/hooks/cron.md`](./cron.md) — the time-based hook kind
- [`project/events/README.md`](../events/README.md) — emitter defs (the producer side)
- [`space/events/README.md`](../../space/events/README.md) — emitter defs authored in a space
