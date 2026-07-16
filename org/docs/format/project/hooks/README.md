# `hooks/` — in-proc project automation

Each `hooks/<slug>.ts` file **default-exports exactly one** hook def; the slug is the filename basename, and a duplicate slug throws fail-loud at load (`sdk/org/libs/cli/src/app/hooks/loader.ts:206-244`). A project's own hooks are USER code: their `.ts` is transpiled to CJS and evaluated **in-proc** (`sdk/org/libs/cli/src/app/hooks/loader.ts:358-374`), while an installed space's `spaces/<id>/hooks/` are store code, loaded worker-isolated with a handler shim (`sdk/org/libs/cli/src/app/hooks/loader.ts:271-298`).

Hook files are authored by the `writeHook(slug, src)` global, which writes `hooks/<slug>.ts` under the current app (`sdk/org/libs/cli/src/app/authoring/globals.ts:218-228`); the live-project twin is `writeProjectHook(slug, src)` (`sdk/org/libs/cli/src/app/authoring/globals.ts:311-318`). Both globals are injected **only** when the authoring agent holds the `hooks:write` capability grant (`sdk/org/libs/core/src/exec/app-globals.ts:206-211`). See [../../space/agents/capabilities.md](../../space/agents/capabilities.md).

## The hook types

The loader recognizes three live `type` values, validated fail-loud in `validateHook` (`sdk/org/libs/cli/src/app/hooks/loader.ts:377-472`):

| `type` | Fires on | Doc |
|---|---|---|
| `cron` | a time schedule (`every` or `daily`) | [./cron.md](./cron.md) |
| `event` | a source-qualified event address (the unified pipeline) | [./event.md](./event.md) |
| `webhook` | an external inbound `POST` to a bound `path` | (legacy inbound path) |

A `cron` hook needs exactly one of `every` / `daily` (`sdk/org/libs/cli/src/app/hooks/loader.ts:384-395`); an `event` hook needs a source-qualified `on.event` matching `EVENT_ADDR_RE` (`sdk/org/libs/cli/src/app/hooks/loader.ts#LoadedHook,420-429`); a `webhook` hook needs a URL-safe `path` and a `trigger` (`sdk/org/libs/cli/src/app/hooks/loader.ts:447-467`).

**There is no `database` hook type any more.** `{type:'database'}` was removed with no back-compat: a file still declaring it is dropped-with-warn (the rest of the project still loads), and `validateHook` throws a migration error as a backstop (`sdk/org/libs/cli/src/app/hooks/loader.ts:414-418,474-488`). To react to database writes you subscribe an `event` hook to the synthetic `project/db.<table>.<event>` address — this is what [./database.md](./database.md) documents.

The **gross shape** is checked at write time: `writeHook`/`writeProjectHook` evaluate the module and reject (thrown, retryable) a `export default` that is not an object, or one whose `type` is not `cron`/`event`/`webhook` `sdk/org/libs/cli/src/app/authoring/lint.ts#lintHookSource`. The finer per-type shape (`every`/`daily`/`on.event`/`trigger`/`handler`) stays with the **fail-soft** loader, so a hook that misses those is skipped-with-warn at load rather than blocking the write.

## `trigger` vs `handler`

Both `cron` and `event` hooks need **exactly one** of `trigger` (declarative) or `handler` (imperative) — declaring neither or both throws (`sdk/org/libs/cli/src/app/hooks/loader.ts:396-402,430-436`). The dispatcher branches on which is present (`sdk/org/libs/cli/src/server/routes/hooks.ts#runHook`):

- **`trigger: 'space/agent#action'`** — delegate to an agent. `parseTrigger` splits the string on `#` into `spaceRef`/`action` (`sdk/org/libs/cli/src/server/routes/hooks.ts#HookManager`), then runs it headless with the hook's `budget`, threading any structured `input` into the kickoff message (`sdk/org/libs/cli/src/server/routes/hooks.ts:327-345`). This spins up an agent session (spends AI credits).
- **`handler: async (ctx) => …`** — a plain Node function invoked in-proc with a `{ db, delegate, callConnection, tasklist, input }` ctx (`sdk/org/libs/cli/src/server/routes/hooks.ts:225-291,347-352`). No agent, no LLM, no AI credits — the handler code IS the filter/reaction. `ctx.delegate(space/agent, action, {input})` threads structured input into a headless run and returns the normalized result (`sdk/org/libs/cli/src/server/routes/hooks.ts:237-262`).

The optional `budget` (`{ maxEpisodes?, maxWallClockMs? }`, validated at `sdk/org/libs/cli/src/app/hooks/loader.ts:500-519`) is forwarded verbatim to every headless run a hook drives.

## The source-qualified event address `<sourceId>/<name>`

An `event` hook's `on.event` is **source-qualified**: the emitting scope (`project` or a `<spaceId>`) followed by `/` and the def's dot-segmented event name (`EVENT_ADDR_RE`, `sdk/org/libs/cli/src/app/hooks/loader.ts#LoadedHook`). The dispatcher builds the address as `` `${sourceScope}/${ev.event}` `` — where `sourceScope` is literally `'project'` or a space's id — and fires every event hook whose `on.event` equals it (`sdk/org/libs/cli/src/server/event-dispatch.ts:184-186`, `sdk/org/libs/cli/src/app/hooks/loop-guard.ts#matchEventHooks`).

| Source | Address form | Example |
|---|---|---|
| the project's own [`events/`](../events/README.md) defs | `project/<event>` | `project/item.added` |
| a synthetic db write (auto-emitted, no def needed) | `project/db.<table>.<insert\|update\|remove>` | `project/db.raw_items.insert` |
| an installed space's defs | `<spaceId>/<event>` | `integration-slack/message.posted` |

> **You do not need a `db` emitter to react to a write.** Every committed db write auto-emits the synthetic event `` `project/db.${table}.${event}` `` synchronously on the write path, and its `payload` **is** the written row (`sdk/org/libs/cli/src/app/hooks/runtime.ts:119-129`). A handler hook receives that row as `ctx.input`, the same shape space/webhook/cron event payloads arrive in (`sdk/org/libs/cli/src/server/event-dispatch.ts:210-218`). Use a curated [`db` emitter def](../events/README.md) only when you want a domain-named event with a shaped payload instead of the raw row.

## Firing guards (loop protection)

db-write-originated events go through a coalescing queue with a 5-second cooldown per hook (`sdk/org/libs/cli/src/app/hooks/runtime.ts:10,87`); other kinds dispatch directly (`sdk/org/libs/cli/src/server/event-dispatch.ts#dispatchEmittedEvents`). Three pure guards decide whether a matched hook fires (`sdk/org/libs/cli/src/app/hooks/loop-guard.ts#shouldFireHook`): a **depth cap** of 3 stops runaway cascades (`sdk/org/libs/cli/src/app/hooks/loop-guard.ts#HOOK_DEPTH_CAP,85-86`), **self-write exclusion** stops a hook re-triggering on an event its own run produced (`sdk/org/libs/cli/src/app/hooks/loop-guard.ts#shouldFireHook`), and the **cooldown** collapses a burst of same-address events into one fire (`sdk/org/libs/cli/src/app/hooks/loop-guard.ts#shouldFireHook`).

## Worked example

Reacting to a raw-item insert with an imperative handler — adapted from `store/projects/blog/hooks/synthesize-new.ts`:

```ts
// hooks/synthesize-new.ts — fires on the synthetic project/db.raw_items.insert;
// ctx.input IS the written row (no db emitter def needed).
export default {
  type: 'event',
  on: { event: 'project/db.raw_items.insert' },
  budget: { maxEpisodes: 10 },
  handler: async ({ input, delegate }) => {
    if (input && input.processed) return;              // idempotence / loop guard
    await delegate('newsroom/synthesizer', 'synthesize', { input: { rawItemId: input?.id } });
  },
};
```

A time-based `trigger` hook looks like `store/projects/blog/hooks/scan-subscriptions.ts`: `{ type: 'cron', every: '30m', trigger: 'research/librarian#scan', budget: { maxEpisodes: 15, maxWallClockMs: 600000 } }` (`store/projects/blog/hooks/scan-subscriptions.ts`). A deterministic `cron` handler (no agent) is `store/projects/blog/hooks/refresh-sources.ts`, which fetches feeds and inserts new rows in plain Node code (`store/projects/blog/hooks/refresh-sources.ts:187-247`).

## See also

- [./cron.md](./cron.md) — time-based hooks (`every` / `daily`)
- [./database.md](./database.md) — reacting to db writes via the synthetic `project/db.<table>.<event>`
- [./event.md](./event.md) — subscribing to any source-qualified event address
- [../events/README.md](../events/README.md) — the PRODUCER half: emitter defs (`webhook`/`cron`/`db`/`internal`)
