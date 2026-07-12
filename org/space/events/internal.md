# `internal` emitter def

An **internal** emitter def is the producer that lets an app observe **lmthing's own runtime** — it subscribes to a curated process-local signal (session lifecycle, delegations, installs, hook fires, document writes, project creates) and normalizes it into a typed event that project/space hooks can consume `sdk/org/libs/core/src/spaces/emitter-def.ts:149-161`. It is one of the four producer kinds of the unified event pipeline (`webhook`/`cron`/`db`/`internal`) `sdk/org/libs/core/src/spaces/emitter-def.ts:7-12`; see [README.md](./README.md) for the pipeline overview and the sibling kinds [webhook.md](./webhook.md), [cron.md](./cron.md), [db.md](./db.md).

## Shape

An `events/<name>.ts` file default-exports one `InternalEmitterDef` `sdk/org/libs/core/src/spaces/emitter-def.ts:163-164`:

- `type: 'internal'` — the discriminant `sdk/org/libs/core/src/spaces/emitter-def.ts:155`.
- `on: { signal }` — the runtime signal name this def subscribes to `sdk/org/libs/core/src/spaces/emitter-def.ts:156`.
- `emits` — the declared event → payload schema (`EmitsSchema`: event name → field → typeString, the same `string|number|boolean|object|array|any` vocabulary as a tasklist node's `output`) `sdk/org/libs/core/src/spaces/emitter-def.ts:37-42`,`sdk/org/libs/core/src/spaces/emitter-def.ts:157`.
- `emit(signal)` — a **pure** function `(InternalSignal) => Emitted[]` that turns the runtime signal into events; no ctx, no i/o `sdk/org/libs/core/src/spaces/emitter-def.ts:159-160`.

The signal handed to `emit` is `{ name, data }` where `data` is a free-form record `sdk/org/libs/core/src/spaces/emitter-def.ts:143-147`. Each returned `Emitted` is `{ event, payload, threadKey? }`; `event` must be one of the def's declared `emits` keys and `payload` is validated against `emits[event].payload` at dispatch time `sdk/org/libs/core/src/spaces/emitter-def.ts:25-35`.

## Validation (fail-loud)

`validateEmitterDef` requires the `internal` branch to carry a non-empty string `on.signal`, otherwise it throws ``an internal emitter needs `on: { signal }` `` `sdk/org/libs/core/src/spaces/emitter-load.ts:185-197`. An unrecognized `type` throws with the allowed set `sdk/org/libs/core/src/spaces/emitter-load.ts:199-201`.

## The curated signal set

Signals are NOT arbitrary: instrumented runtime paths call `emitInternalSignal(name, data, meta?)` with a fixed set documented in the seam's header `sdk/org/libs/cli/src/server/internal-signals.ts:22-31`. An internal def's `on.signal` should be one of these:

| Signal | `data` fields (emitted by the runtime) |
|---|---|
| `session.started` | `projectId`, `agent`, `sessionId`, `spaceRef?` `sdk/org/libs/cli/src/server/internal-signals.ts:23`,`sdk/org/libs/cli/src/server/session-manager.ts:1440` |
| `session.completed` | `projectId`, `agent`, `sessionId`, `spaceRef?`, `ok`, `durationMs` `sdk/org/libs/cli/src/server/internal-signals.ts:24`,`sdk/org/libs/cli/src/server/session-manager.ts:1468` |
| `agent.delegated` | `projectId`, `from?`, `to` `sdk/org/libs/cli/src/server/internal-signals.ts:25`,`sdk/org/libs/cli/src/server/routes/hooks.ts:240` |
| `space.installed` | `projectId`, `spaceId?` `sdk/org/libs/cli/src/server/internal-signals.ts:26`,`sdk/org/libs/cli/src/server/serve.ts:281` |
| `hook.fired` | `projectId`, `slug`, `hookType` `sdk/org/libs/cli/src/server/internal-signals.ts:27`,`sdk/org/libs/cli/src/server/routes/hooks.ts:321` |
| `document.written` | `projectId`, `path` `sdk/org/libs/cli/src/server/internal-signals.ts:28`,`sdk/org/libs/cli/src/server/session-manager.ts:1944` |
| `project.created` | `projectId` `sdk/org/libs/cli/src/server/internal-signals.ts:29`,`sdk/org/libs/cli/src/server/session-manager.ts:1891` |

`data.projectId` scopes the fan-out to that one project; a signal with no `projectId` fans out to every project the sink can list `sdk/org/libs/cli/src/server/internal-signals.ts:247-251`. `project.created` is emitted with `meta.fanOutAll` because its `projectId` names the brand-new SUBJECT project (which has no defs/hooks yet), not the audience, so it too fans out to every project `sdk/org/libs/cli/src/server/internal-signals.ts:75-87`,`sdk/org/libs/cli/src/server/session-manager.ts:1891`.

## Fire-and-forget and worker-contained

`emitInternalSignal` is a **synchronous** enqueue (queue-push + `setImmediate` arm) wrapped in a full try/catch — it must NEVER throw into or slow the instrumented path, and signals fired before the routing sink is installed are silently dropped `sdk/org/libs/cli/src/server/internal-signals.ts:146-158`. The routing sink, installed once at serve boot, does all the work later on a drain task `sdk/org/libs/cli/src/server/internal-signals.ts:165-172`. The drain is concurrency-bounded to ONE signal at a time, and each signal's failure is isolated with a warn so the drain itself never rejects `sdk/org/libs/cli/src/server/internal-signals.ts:207-226`.

For each matching def, `emit(signal)` runs **worker-isolated** with a wall-clock timeout and EMPTY capability handlers — the worker's db/delegate/callConnection proxies reject if touched, enforcing purity — and a throwing or hanging def is contained there and can never reach the instrumented path `sdk/org/libs/cli/src/server/internal-signals.ts:252-291`. The returned events are then schema-validated against the def's `emits` (drop-with-warn) and dispatched to subscribing event hooks `sdk/org/libs/cli/src/server/internal-signals.ts:293-311`.

Two loop guards keep the signal→def→event→hook→signal cycle bounded: a DEPTH CAP drops a signal whose `meta.hookDepth` reaches `HOOK_DEPTH_CAP` `sdk/org/libs/cli/src/server/internal-signals.ts:234-242`, and SELF-TRIGGER SUPPRESSION threads `meta.originatingHookSlug` into dispatch as `skipHookSlug` so a `hook.fired`-derived event never re-triggers the hook that fired it `sdk/org/libs/cli/src/server/internal-signals.ts:297-311`.

## `integration-lmthing` — normalizing the set + `publishEvent`

The store space `integration-lmthing` ships one internal emitter def per runtime signal, each normalizing the pod's raw signal into a typed, defensively-validated event a project hook can subscribe to `store/spaces/integration-lmthing/events/session-completed.ts:1-8`. Five signals are wrapped today — `session.completed`, `space.installed`, `hook.fired`, `document.written`, `project.created` `store/spaces/integration-lmthing/events/session-completed.ts:13`,`store/spaces/integration-lmthing/events/space-installed.ts`,`store/spaces/integration-lmthing/events/hook-fired.ts`,`store/spaces/integration-lmthing/events/document-written.ts`,`store/spaces/integration-lmthing/events/project-created.ts`.

> UNVERIFIED: The curated set has 7 signals but `integration-lmthing` wraps only 5 — no `events/session-started.ts` or `events/agent-delegated.ts` exists (`ls store/spaces/integration-lmthing/events/` returns exactly the five files above). `session.started`/`agent.delegated` are still emitted by the runtime (`session-manager.ts:1440`, `routes/hooks.ts:240`) and can be wrapped by any project/space, just not by this store space today.

The same space also exposes a `publishEvent(name, payload)` function — a thin wrapper over the `emitEvent` global (capability `events:emit`) that fans a CUSTOM `integration-lmthing/<name>` event into the same pipeline; the payload is host-validated against the emitting scope's declared events (drop-with-warn) `store/spaces/integration-lmthing/functions/publishEvent.ts:1-17`. `emitEvent` is a value-yielding global whose host resolver is supplied by libs/cli `sdk/org/libs/core/src/globals/emit-event.ts:53-66`.

## Worked example

Adapted from `store/spaces/integration-lmthing/events/session-completed.ts` — an internal def subscribing to `session.completed`:

```ts
import type { Emitted, InternalEmitterDef, InternalSignal } from '@lmthing/core';

const def: InternalEmitterDef = {
  type: 'internal',
  on: { signal: 'session.completed' },
  emits: {
    'session.completed': {
      payload: {
        projectId: 'string',
        agent: 'string',
        sessionId: 'string',
        ok: 'boolean',
        durationMs: 'number',
      },
    },
  },
  emit(signal: InternalSignal): Emitted[] {
    const d = signal.data as {
      projectId?: string; agent?: string; sessionId?: string;
      ok?: boolean; durationMs?: number;
    };
    // Drop the signal if the pod ever emits it without the fields we contract on.
    if (
      typeof d.projectId !== 'string' || typeof d.agent !== 'string' ||
      typeof d.sessionId !== 'string' || typeof d.ok !== 'boolean' ||
      typeof d.durationMs !== 'number'
    ) return [];
    return [{ event: 'session.completed', payload: { ...d } as Record<string, unknown> }];
  },
};

export default def;
```

Consume it from a project hook with `{ type: 'event', on: { event: 'integration-lmthing/session.completed' }, handler }` — see [../hooks/README.md](../hooks/README.md) and [../../project/hooks/event.md](../../project/hooks/event.md).

## See also

- [README.md](./README.md) — the emitter-def / event pipeline overview
- [webhook.md](./webhook.md) · [cron.md](./cron.md) · [db.md](./db.md) — the other three producer kinds
