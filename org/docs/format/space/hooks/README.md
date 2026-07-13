# `hooks/<slug>.ts` — event-hook consumers (in a space)

The unified event pipeline has two symmetric halves — **emitter defs** (the producer, `events/<name>.ts`) and **event hooks** (the consumer, `hooks/<slug>.ts` with `{ type: 'event' }`) — and that model applies to both projects and spaces (project CLAUDE.md "Events, integrations & the store"; `/home/vasilis/LMTHING/lmthing/CLAUDE.md`). The loader that discovers a space's hooks reads them from `<projectRoot>/spaces/<spaceId>/hooks/` `sdk/org/libs/cli/src/app/hooks/loader.ts:271-298`, so a space CAN carry its own `hooks/` dir alongside a project's own `<projectRoot>/hooks/` `sdk/org/libs/cli/src/app/hooks/loader.ts#WebhookHookDef`.

## In practice: spaces EMIT, the project consumes

No store space currently ships a `hooks/` directory — every `store/spaces/integration-*` space contains only `events/`, `agents/`, `functions/`, and `knowledge/`, never `hooks/` `store/spaces/integration-slack/` (directory listing). A store integration is therefore an **event source**: e.g. `integration-slack` ships an emitter def that normalizes inbound Slack callbacks into a `message.received` event `store/spaces/integration-slack/events/messages.ts:8`, `store/spaces/integration-slack/events/messages.ts#def`. The *consumer* event hook that reacts to it lives in the LIVE project's own `hooks/` dir, subscribing to the source-qualified address `integration-slack/message.received` (see [events addressing](../events/README.md) and the project-side consumer doc [../../project/hooks/event.md](../../project/hooks/event.md)).

A space's own `hooks/` dir is only meaningful when the consumer is part of the space's own behavior; the loader supports it `sdk/org/libs/cli/src/app/hooks/loader.ts:271-298`, but the shipped catalog does not exercise it `store/spaces/integration-slack/` (no `hooks/` entry).

No *shipped* space carries a `hooks/` dir — neither the store integrations `store/spaces/integration-slack/` (no `hooks/` entry) nor the system spaces `sdk/org/libs/core/system-spaces/system-architect/` (only `agents/ functions/ knowledge/ tasklists/`). The only space hooks that exist in-tree are the loader's worker-isolation test fixtures: a **`trigger`** space hook on `integration-slack/message.posted` `sdk/org/libs/cli/src/app/hooks/space-hooks.test.ts:43-48` and a **`handler`** space hook on `integration-demo/ping` `sdk/org/libs/cli/src/app/hooks/space-hooks.test.ts:68-80` — loaded from `spaces/<spaceId>/hooks/<name>.ts` and namespaced `<spaceId>:<basename>` `sdk/org/libs/cli/src/app/hooks/space-hooks.test.ts#writeSpaceHook`, `sdk/org/libs/cli/src/app/hooks/space-hooks.test.ts:54-55`. The **file shape is identical** in both scopes: the project loader and the space loader validate the raw default export through the *same* `validateHook` `sdk/org/libs/cli/src/app/hooks/loader.ts:241`, `sdk/org/libs/cli/src/app/hooks/loader.ts#loadSpaceHooks`, `sdk/org/libs/cli/src/app/hooks/loader.ts:384-482` — only the *loading* differs (in-proc vs worker, below).

## How a space hook differs at load time

Space hooks are store-downloaded code, so — unlike project hooks, which are `require()`d in-proc — a space hook module is **never run in-proc**: its default-export data is extracted in a worker, and an imperative `handler` is replaced by a shim that runs the real handler worker-isolated `sdk/org/libs/cli/src/app/hooks/loader.ts:262-298`. Each space hook's slug is namespaced `<spaceId>:<basename>` and its `owner` is the spaceId `sdk/org/libs/cli/src/app/hooks/loader.ts:276-295`. `loadAllHooks` composes project hooks (in-proc) with every installed space's hooks (worker-isolated) into one flat list, skipping a single space fail-soft if its hooks fail to load `sdk/org/libs/cli/src/app/hooks/loader.ts:300-326`.

## Format

An event hook default-exports `{ type: 'event', on: { event: '<address>' }, … }` `sdk/org/libs/cli/src/app/hooks/loader.ts:420-445`. `on.event` is required and must be a **source-qualified** address matching `EVENT_ADDR_RE` (`<sourceId>/<name>`, dotted names allowed) — otherwise validation throws fail-loud `sdk/org/libs/cli/src/app/hooks/loader.ts#LoadedHook`, `sdk/org/libs/cli/src/app/hooks/loader.ts:422-429`. The hook must carry **exactly one** of `handler` or `trigger`; supplying both or neither throws `sdk/org/libs/cli/src/app/hooks/loader.ts:430-436`.

### `handler` — code-as-filter

A `handler` is an imperative async function `sdk/org/libs/cli/src/app/hooks/loader.ts:431`; it receives `ctx.input` carrying the event payload (for a synthetic db event, the written row) `sdk/org/libs/cli/src/server/event-dispatch.ts:208-221`. The handler itself *is* the filter — there is no separate filter DSL; a code handler that decides not to react simply returns early `store/projects/demo-feed/hooks/enrich-on-add.ts` (the `if (!input?.id) return;` guard).

### `trigger` — delegate to an agent

A `trigger` is a `'space/agent#action'` string `sdk/org/libs/cli/src/app/hooks/loader.ts:430`; it is parsed by splitting on `#` (everything before `#` is the space/agent ref, everything after is the action; the agent slug is the last `/`-segment of the ref) `sdk/org/libs/cli/src/server/routes/hooks.ts#HookManager`. On a matching event a trigger hook is dispatched straight to a headless agent run (not through the handler path) `sdk/org/libs/cli/src/server/event-dispatch.ts:197-206`.

## `budget`

An optional `budget` object is validated by `validateBudget`, which accepts only `maxEpisodes` and `maxWallClockMs` (each a non-negative number, else throw) `sdk/org/libs/cli/src/app/hooks/loader.ts` `validateBudget`, and is attached to every hook kind `sdk/org/libs/cli/src/app/hooks/loader.ts:437-444`. The budget is forwarded verbatim into the headless run a trigger hook kicks off `sdk/org/libs/cli/src/server/routes/hooks.ts:283`.

## Worked example

Taken from the real on-disk **project** hook `store/projects/demo-feed/hooks/enrich-on-add.ts:14-29` — no shipped space ships a `hooks/` dir, and the file shape is identical in either scope (same `validateHook` `sdk/org/libs/cli/src/app/hooks/loader.ts:241`, `sdk/org/libs/cli/src/app/hooks/loader.ts#loadSpaceHooks`). A handler-as-filter subscribing to a source-qualified event and reacting only when a condition holds:

```ts
// hooks/enrich-on-add.ts — event hook, code-as-filter
export default {
  type: 'event' as const,
  on: { event: 'project/db.feed_items.insert' },   // source-qualified address
  handler: async ({ input, db }: {
    input: { id: string; title?: string; summary?: string };
    db: { update(table: string, opts: { where: Record<string, unknown>; set: Record<string, unknown> }): Promise<number> };
  }): Promise<void> => {
    if (!input?.id) return;                          // filter, in code
    if (!input.summary || input.summary.trim() === '') {
      await db.update('feed_items', {
        where: { id: input.id },
        set: { summary: `Saved: ${input.title ?? 'untitled'}` },
      });
    }
  },
};
```

## See also

- [../events/README.md](../events/README.md) — the emitter-def PRODUCER side and the event-address table.
- [../../project/hooks/event.md](../../project/hooks/event.md) — the project-side consumer, where integration hooks live in practice.
- Full producer/consumer walkthrough → `@.claude/skills/events-and-hooks.md`.
