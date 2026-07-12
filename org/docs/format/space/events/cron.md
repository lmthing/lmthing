# `cron` emitter def (`events/<name>.ts`)

A **cron emitter** is one of the four producer kinds of the unified event pipeline — a scheduled poller that runs `emit(ctx)` on a fixed cadence and turns the result into events for subscribing hooks (`sdk/org/libs/core/src/spaces/emitter-def.ts:105-117`). It sits alongside [`webhook`](./webhook.md), [`db`](./db.md), and [`internal`](./internal.md); see the [events overview](./README.md) for the shared model.

An `events/<name>.ts` file default-exports one `CronEmitterDef`; the filename basename is its stable per-scope id (`sdk/org/libs/core/src/spaces/emitter-def.ts:163-171`).

## Shape

`type: 'cron'` selects this kind; the discriminator is checked in the loader's validation branch (`sdk/org/libs/core/src/spaces/emitter-load.ts:140`). A cron def carries `every?`/`daily?`, an optional `connections?: string[]`, an `emits` schema, and an async `emit(ctx): Promise<Emitted[]>` (`sdk/org/libs/core/src/spaces/emitter-def.ts:105-117`).

### Exactly one of `every` or `daily`

The def must supply **exactly one** of `every` or `daily` — the validator throws when both or neither is a string (`hasEvery === hasDaily`) (`sdk/org/libs/core/src/spaces/emitter-load.ts:141-145`). `every` is an interval spec matching `/^\d+[mhd]$/` (e.g. `'30m'`, `'2h'`, `'1d'`); a malformed value fails loud (`sdk/org/libs/core/src/spaces/emitter-load.ts:29,146-148`). `daily` is a wall-clock time matching `/^([01]?\d|2[0-3]):([0-5]\d)$/` (`'HH:MM'`) (`sdk/org/libs/core/src/spaces/emitter-load.ts:28,149-151`).

The validator's `every` regex accepts any positive interval, but the pod's scheduler clamps the effective granularity to **≥5 minutes** via `MIN_CRON_INTERVAL_MS`, since that is what a real `crond` can dependably deliver (`sdk/org/libs/cli/src/app/hooks/cron.ts:20-38`). Dueness for both `every` and `daily` is computed by `nextRunAt` against the persisted `lastRunAt`, so a window missed while the pod was down fires once on boot catch-up (`sdk/org/libs/cli/src/app/hooks/cron.ts:60-79`, `sdk/org/libs/cli/src/server/routes/hooks.ts:739-745`).

### `connections`

`connections`, when present, must be an array of provider-id strings — a non-array or non-string element throws (`sdk/org/libs/core/src/spaces/emitter-load.ts:152-156`). It declares the outbound providers `ctx.callConnection` may reach (`sdk/org/libs/core/src/spaces/emitter-def.ts:111-112`).

### `emits`

`emits` maps each event name to `{ payload }`, where every payload field is a typeString from `string | number | boolean | object | array | any`, optionally suffixed with `?` to mark it optional (`sdk/org/libs/core/src/spaces/emitter-load.ts:39,42-82`). At least one event must be declared (`sdk/org/libs/core/src/spaces/emitter-load.ts:47-49`), and emitted payloads are validated against this schema at dispatch (drop-with-warn) (`sdk/org/libs/cli/src/server/routes/hooks.ts:671`).

## The gated `ctx`

The core type `CronEmitterCtx` declares three members — `state`, `callConnection`, and `env` (`sdk/org/libs/core/src/spaces/emitter-def.ts:94-98`) — and is intentionally loose because core stays pod-dependency-free; the pod supplies the real implementations at run time (`sdk/org/libs/core/src/spaces/emitter-def.ts:88-93`). What the pod actually hands `emit` is narrower than the type: the cron runner invokes the def with an **empty ctx seed** and exactly two handlers, `callConnection` and `state` (`sdk/org/libs/cli/src/server/routes/hooks.ts:805`), so **`ctx.env` is never populated** — a cron def reads nothing through it.

### `emit(ctx)` runs worker-isolated and time-bounded

The pod runs `emit` worker-isolated with a wall-clock ceiling (`LMTHING_EMITTER_EMIT_TIMEOUT_MS`, default 5000ms); on failure it logs and returns rather than throwing (`sdk/org/libs/cli/src/server/routes/hooks.ts:764-765,803-812`). Surviving validated events are dispatched to subscribing event hooks (`sdk/org/libs/cli/src/server/routes/hooks.ts:813-816`).

### `ctx.state` — a persisted JSON KV cursor

`ctx.state` is a per-def persisted key-value scratchpad — a cursor / last-seen-id / ETag that survives across ticks (`sdk/org/libs/cli/src/server/emitter-state.ts:1-8`). At runtime it is an async store with `get(key)` and `set(key, value)`, serviced main-side for the worker (`sdk/org/libs/cli/src/server/emitter-state.ts:29-36,84-105`).

The two shapes never meet, so there is nothing to reconcile: core's loose `state?: Record<string, unknown>` is an advisory public type (`sdk/org/libs/core/src/index.ts:154`) and is **not** what a def receives. The worker entry builds the ctx itself and injects `state` as a pair of RPC proxies — `get(key)` / `set(key, value)`, both async — after spreading the (empty) ctx seed, so the def always sees the `{ get, set }` store (`sdk/org/libs/cli/src/app/worker-load-entry.ts:124-138`). Each call is round-tripped to the main process by the `state` proxy branch (`sdk/org/libs/cli/src/app/worker-load.ts:105-108,250-254`), which services it with the per-def `EmitterStateStore` the cron runner built from `makeEmitterStateStore` (`sdk/org/libs/cli/src/server/routes/hooks.ts:798,805`, `sdk/org/libs/cli/src/server/emitter-state.ts:84-105`). A `get`/`set` from any other worker-run context (a hook handler, a code node) has no main-side `state` handler and therefore rejects (`sdk/org/libs/cli/src/app/worker-load.ts:250-251`). The cron-emitter tests exercise this end-to-end against the real worker — a counter written with `await ctx.state.set('n', n)` on one tick is read back on the next (`sdk/org/libs/cli/src/server/routes/cron-emitter.test.ts:8-11,118-130`).

State is stored as one file per project (`<projectRoot>/.data/emitter-state.json`), a map `"<scope>/<defName>" → { key: value }`, tolerant of a missing/corrupt file (treated as empty) (`sdk/org/libs/cli/src/server/emitter-state.ts:41-70`). Each op is a read-modify-write touching only that def's own slot (`sdk/org/libs/cli/src/server/emitter-state.ts:84-104`). A `set` that would push one def's serialized KV past `EMITTER_STATE_MAX_BYTES` (~256KB) is rejected — it throws and is not persisted, so a buggy or hostile def can't balloon pod disk (`sdk/org/libs/cli/src/server/emitter-state.ts:38-39,91-101`).

### `ctx.callConnection` — gated to the scope's providers

`ctx.callConnection(provider, req)` reaches an outbound provider, SSRF-pinned by the host resolver (`sdk/org/libs/core/src/spaces/emitter-def.ts:96`). The allowed provider set differs by scope: a **project** def gets `connections` intersected with the project's INSTALLED integration providers; a **space** def is locked to `connections` intersected with the owning space's OWN provider(s), so a space can never reach beyond what it itself declares and owns (`sdk/org/libs/cli/src/server/routes/hooks.ts:721-735`). Calling a provider outside the allowed set rejects with an explicit "not allowed" error (`sdk/org/libs/cli/src/server/routes/hooks.ts:787-795`).

## Scheduling & run path

Each cron emitter def gets a crontab line keyed by the reserved pseudo-slug `@emitter:<scope>:<name>`, which routes to the emitter run path (not a hook) on the shared run endpoint (`sdk/org/libs/cli/src/server/routes/hooks.ts:397-401,485-488,552-560`). Dueness is tracked in the same `hooks-state.json` `cron` map under that pseudo-slug; after a run, `lastRunAt` is stamped so the boot catch-up won't double-fire (`sdk/org/libs/cli/src/server/routes/hooks.ts:704-709,761-768`).

## Worked example

Adapted from the cron-emitter test fixture (`sdk/org/libs/cli/src/server/routes/cron-emitter.test.ts:56-68`) — a poller that increments a persisted counter and probes an outbound connection every 30 minutes:

````ts
// events/poller.ts
export default {
  type: 'cron',
  every: '30m',
  connections: ['tavily'],
  emits: { 'tick.happened': { payload: { n: 'number', called: 'boolean' } } },
  async emit(ctx) {
    const prev = (await ctx.state.get('n')) ?? 0;
    const n = prev + 1;
    await ctx.state.set('n', n);
    let called = false;
    try {
      await ctx.callConnection('tavily', { path: '/x' });
      called = true;
    } catch {
      called = false;
    }
    return [{ event: 'tick.happened', payload: { n, called } }];
  },
};
````

## See also

- [events overview](./README.md) — the producer/consumer pipeline and shared `emits` vocabulary
- [`webhook` emitter](./webhook.md) — external-caller producer
- [`db` emitter](./db.md) — project-db-write producer
- [`internal` emitter](./internal.md) — lmthing runtime-signal producer
