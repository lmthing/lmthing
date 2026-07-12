# Hooks — list, disable, run

Three HTTP routes plus the cron plumbing that drives them. The design principle is stated at the top of the module: **one authoritative run path** — Studio's "Run now", the pod's `crond`, the boot catch-up and the in-process fallback tick all funnel through `POST /api/projects/:projectId/hooks/:slug/run` (`sdk/org/libs/cli/src/server/routes/hooks.ts:L2-L20`).

For the *file format* of a hook (`type`, `trigger` vs `handler`, event addresses, loop guards) see [../../format/project/hooks/README.md](../../format/project/hooks/README.md). This page is the wire surface.

| Method | Path | Handler |
|---|---|---|
| `GET` | `/api/hooks` | `createHooksListHandler` — pod-global list, every project + installed space (`sdk/org/libs/cli/src/server/serve.ts:L225`) |
| `POST` | `/api/projects/:projectId/hooks/:slug/disabled` | `createHookDisableHandler` (`serve.ts:L226`) |
| `POST` | `/api/projects/:projectId/hooks/:slug/run` | `createHookRunHandler` — the one authoritative run path (`serve.ts:L222`) |

All three live under the reserved `/api/*` prefix, so they are matched by the router before the SPA catch-all (`serve.ts:L221-L226`). Like the rest of the pod API they carry **no authentication of their own** — see [./README.md](./README.md).

---

## `GET /api/hooks`

Pod-global: enumerates every project (the synthetic `system` project is skipped), loads that project's hooks **and** its installed spaces' hooks via `loadAllHooks`, and returns a read-only projection — it never executes a handler (`sdk/org/libs/cli/src/server/routes/hooks.ts:L495-L534`). A project whose hooks fail to load is skipped rather than failing the whole list (`:L509-L512`). With no project root configured the response is `{ hooks: [] }` (`:L499-L502`).

Each row is a `HookSummary` (`sdk/org/libs/cli/src/server/routes/hooks.ts:L462-L475`):

```json
{
  "hooks": [
    {
      "projectId": "blog",
      "slug": "refresh-feed",
      "owner": "project",
      "type": "cron",
      "every": "1h",
      "trigger": "newsroom/curator#refresh",
      "hasHandler": false,
      "disabled": false
    },
    {
      "projectId": "blog",
      "slug": "integration-slack:on-message",
      "owner": "integration-slack",
      "type": "event",
      "on": "integration-slack/message.received",
      "hasHandler": true,
      "disabled": true
    }
  ]
}
```

`owner` is `'project'` for a project hook, else the owning space id; a space hook's slug is namespaced `<spaceId>:<basename>` (`sdk/org/libs/cli/src/app/hooks/loader.ts:L278-L285`). `disabled` is the **effective** value — the hook's own `disabled: true` export OR the settings overlay listing its slug (`sdk/org/libs/cli/src/app/hooks/state.ts:L116-L121`, applied at `routes/hooks.ts:L528`).

This backs the settings dialog's Hooks tab, which fetches `${COMPUTER}/api/hooks` and groups the rows by type client-side (`sdk/org/libs/ui/src/elements/settings/hooks/index.tsx:L65-L69`).

---

## `POST /api/projects/:projectId/hooks/:slug/disabled`

Body `{ disabled: boolean }` (anything but `true` is read as `false` — `sdk/org/libs/cli/src/server/routes/hooks.ts:L553-L559`). The slug is added to / removed from the project's `.data/hooks-state.json` `disabled` array — **the hook source is never rewritten** — and the pod then republishes so a disabled cron/webhook drops out of the schedule and the manifest live (`:L560-L572`). Response: `{ ok: true, slug, disabled }` (`:L573`). No project root ⇒ `404 { error: { status: 404, message: 'no project root configured' } }` (`:L549-L551`).

```bash
curl -X POST localhost:8080/api/projects/blog/hooks/refresh-feed/disabled \
  -H 'content-type: application/json' -d '{"disabled":true}'
# {"ok":true,"slug":"refresh-feed","disabled":true}
```

`manager.republish()` is best-effort — a failure is swallowed, because every activation site already honors the overlay independently (`:L567-L572`). It runs three isolated steps: republish the webhook manifest, regenerate the crontab, clear the emitter-def scan cache (`sdk/org/libs/cli/src/server/republish.ts:L53-L61`). The overlay is enforced in three places: a disabled cron hook never comes due (`sdk/org/libs/cli/src/app/hooks/cron.ts:L86-L91`), it gets no crontab line (`routes/hooks.ts:L640`), and `runHook` refuses to dispatch it at all (`routes/hooks.ts:L330`).

The optimistic toggle in the settings UI posts exactly this and rolls back on a non-2xx (`sdk/org/libs/ui/src/elements/settings/hooks/index.tsx:L77-L95`).

---

## `POST /api/projects/:projectId/hooks/:slug/run`

The authoritative run path. In order (`sdk/org/libs/cli/src/server/routes/hooks.ts:L404-L455`):

1. No project root ⇒ `404 { error: { status: 404, message: 'no project root configured' } }` (`:L408-L411`).
2. A `@emitter:<scope>:<name>` pseudo-slug is **not a hook** — it routes to the cron-emitter path and answers `200 { ok: true }` (`:L415-L420`; see [cron emitters](#cron-emitters) below).
3. Load the project's hooks and find `:slug`; absent ⇒ `404 { error: { status: 404, message: 'hook "<slug>" not found in project "<id>"' } }` (`:L422-L435`).
4. Fold the disable overlay into the hook so a stale crontab line for a disabled hook no-ops (`:L438-L440`).
5. Dispatch through `runHook`, injecting the space-tasklist runner so a handler's `ctx.tasklist.run('<spaceId>/<slug>', seed)` works (`:L445-L447`; runner at `sdk/org/libs/cli/src/server/tasklist-runner.ts:L189-L196`).
6. Record the fire in `.data/hooks-state.json` and answer (`:L449-L454`).

| Outcome | Body |
|---|---|
| ran | `200 { "ok": true, "result": <handler/agent return> }` |
| budget-deferred | `200 { "queued": true }` |
| unknown slug | `404 { "error": { "status": 404, "message": "hook \"…\" not found in project \"…\"" } }` |

State writes: a run stamps `lastFiredAt[slug]` **and** `cron[slug].lastRunAt` and clears any pending entry; a queued run stamps `lastFiredAt` and appends the slug to `pending` (`:L380-L388`, called at `:L449-L452`).

Studio's app Manifest tab "Run now" button posts this URL (`sdk/org/apps/web/src/routes/studio/$projectId/app/-lib/appApi.ts:L112-L116`).

```bash
curl -X POST localhost:8080/api/projects/blog/hooks/refresh-feed/run
# {"ok":true,"result":{"ok":true,"result":"…","sessionId":"…"}}
```

### Dispatch: `trigger` vs `handler`

`runHook` is pure dispatch — its callers own the state I/O (`sdk/org/libs/cli/src/server/routes/hooks.ts:L313-L376`).

- A hook that is **effectively disabled** returns `{ queued: false }` immediately, without firing and without emitting a signal (`:L330`).
- Every real dispatch emits the `hook.fired` internal signal, stamped with the originating slug and an **incremented cascade depth**, so a `hook.fired`-derived event can never re-trigger the same hook and deep cascades are cut at the shared depth cap (`:L337-L341`).
- **`trigger: 'space/agent#action'`** → a headless agent run (below).
- **`handler: async (ctx) => …`** → invoked in-proc with `{ db, delegate, callConnection, tasklist, row?, input? }` (`:L362-L369`; ctx built at `:L240-L297`). `db` is the project's async data API (`:L364-L365`); `callConnection` is gated — a project hook may reach exactly its declared `connections:`, a **space** hook only `declared ∩ the space's own provider(s)`, so a store space can never reach past what it itself declares (`:L211-L232`, `:L270-L280`).
- Neither ⇒ `throw new Error('hook "<slug>" has neither a trigger nor a handler')` (`:L371`).

---

## How a trigger hook launches a headless agent run

`parseTrigger` splits `space/agent#action` on `#`; the agent slug is the last `/`-segment of the space ref (`sdk/org/libs/cli/src/server/routes/hooks.ts:L189-L195`). `runHook` then builds a kickoff message and calls `manager.runHeadless` (`:L343-L359`):

```ts
// routes/hooks.ts:L344-L357 (abridged)
const { spaceRef, agentSlug, action } = parseTrigger(hook.trigger);
const base = `Scheduled hook "${hook.slug}" fired` + (action ? ` — perform the "${action}" action.` : '.');
const message = base + (opts.input !== undefined ? `\nInput: ${safeStringify(opts.input)}` : '');
const result = await manager.runHeadless({
  projectId, spaceRef, agentSlug, message,
  budget: hook.budget,
  origin: { source: `hook:${hook.slug}` },
});
```

An event hook's structured payload rides into the run as a `\nInput: <json>` suffix on that message — there is no separate seed channel (`:L349`, serializer at `:L199-L205`).

`SessionManager.runHeadless` (`sdk/org/libs/cli/src/server/session-manager.ts:L1422-L1481`):

- Mints a `sessionId`, builds project-mode session args, and constructs an **ephemeral** `Session` — never registered in `this.sessions`, so it does not count against `maxSessions`, is never persisted, and is isolated from the interactive session lifecycle (`:L1403-L1407`, `:L1434-L1442`).
- Resolves the space dir from `spaceRef`: the **leading segment** under `<root>/<projectId>/spaces/<space>` (a trailing `/agent` is ignored here); with no `spaceRef` the project dir itself (`:L1526-L1535`). The run gets the project's system + preloaded spaces, project functions, app globals and typed `apiCall` DTS (`:L1536-L1564`).
- Renders into a throwaway `WebRenderHost` that swallows `display`/`ask`/`log` — no hub is wired, so an `ask()` in a hook-driven run has nobody to answer it (`:L1406-L1407`, `:L1519`).
- Subscribes to the session's own tracer to capture `display` descriptors, and registers the run in the session ledger under `source: 'hook:<slug>'` — which is why hook runs show up in `GET /api/session-ledger` (`:L1447-L1458`; `sdk/org/libs/cli/src/server/session-ledger.ts:L30`).
- Returns `{ ok: true, result, sessionId }` where `result` is the **last `display(...)` descriptor**, falling back to the last history message's content; any throw becomes `{ ok: false, error, sessionId }` (`:L1461-L1476`).

A **handler** hook reaches the same machinery through `ctx.delegate(spaceRef, action?, { input?, message? })`, which emits an `agent.delegated` signal, threads `input` into the kickoff message, calls `runHeadless` with the hook's budget and `origin: 'hook:<slug>'`, and normalizes a bare return into `{ ok: true, result }` (`sdk/org/libs/cli/src/server/routes/hooks.ts:L249-L268`). Unlike an older fire-and-forget version, it **returns** the run's result.

---

## Budget forwarding

A hook may declare `budget: { maxEpisodes?, maxWallClockMs? }`, validated fail-loud at load (`sdk/org/libs/cli/src/app/hooks/loader.ts:L510-L528`). It is carried verbatim through the whole chain:

```
hook def .budget                                  (app/hooks/loader.ts:L510-L528)
  → Hook.budget                                   (routes/hooks.ts:L58-L63, L80, L155)
  → runHeadless({ budget })                       (routes/hooks.ts:L355, L262)
  → BuildSessionArgs.budget                       (session-manager.ts:L144-L149, L1519, L1551)
  → new Session({ budget })                       (session-manager.ts:L436)
  → Budget / BudgetExceededError                  (libs/core/src/eval/budget.ts:L29-L37, L75-L98)
  → inherited by the session's forks + delegates  (libs/core/src/session/session.ts:L716)
```

The host enforces four caps — `episodes`, `toolCalls`, `forkDepth`, `wallClock` — each throwing a structured `BudgetExceededError` (`sdk/org/libs/core/src/eval/budget.ts:L26-L37`, `:L75-L98`). A hook that declares no budget runs unbounded.

**Budget exhaustion → `{ queued: true }`.** `runHook` treats a tagged result *or* a tagged throw as exhaustion, tolerantly matching `budgetExhausted: true`, `status: 'budget-exhausted'`, `name: 'BudgetExceededError'` or `code: 'BUDGET_EXHAUSTED'` (`routes/hooks.ts:L299-L311`, checked at `:L358`, `:L367`, `:L373`). The run endpoint then records the slug in the `pending` array instead of stamping a fire (`:L386-L388`, `:L450`). The same `{ queued: true }` convention drives the db-write dispatcher's retry queue, which keeps ≤1 pending entry per slug and retries it on the next drain (`sdk/org/libs/cli/src/app/hooks/dispatcher.ts:L200-L232`).

> **Gap — a budget-exhausted *trigger* hook does not currently surface as `queued`.** `runHeadless` catches every throw and returns a plain `{ ok: false, error: 'Budget exceeded: …' }` object (`session-manager.ts:L1471-L1476`), which carries none of the four tag fields `isBudgetExhausted` looks for (`routes/hooks.ts:L302-L311`). So the endpoint answers `200 { ok: true, result: { ok: false, error: … } }` rather than `{ queued: true }`. The `{ queued: true }` path is exercised only against a mocked manager returning `{ status: 'budget-exhausted' }` (`routes/hooks.test.ts:L341-L349`). Imperative `handler` hooks that throw/return a tagged shape are unaffected.

> **Gap — nothing re-reads the `pending` array the run endpoint writes.** `HooksState.pending` is persisted (`app/hooks/state.ts:L25-L26`) and surfaced in the app manifest as `AppHook.pending` (`sdk/org/libs/cli/src/server/routes/app-admin.ts:L237`), but the retry queue that actually drains pending entries is the dispatcher's **in-memory** map (`app/hooks/dispatcher.ts:L82`, `:L200-L232`) — a `grep` for readers of `state.pending` finds only those two. A queued cron hook is effectively retried by its next cron tick, not by a pending-drain.

---

## Cron: crontab, boot catch-up, fallback tick

`bootCatchUpAndSchedule` is boot steps 6+7 (`sdk/org/libs/cli/src/server/routes/hooks.ts:L989-L1028`), wired in the background boot block *after* the server is listening so an overdue cron never delays the readiness probe (`sdk/org/libs/cli/src/server/serve.ts:L402-L447`). It:

1. **Regenerates the crontab** (guarded), one line per cron hook **and** per `{type:'cron'}` emitter def (`:L1001`, `:L630-L660`).
2. **Runs each overdue cron hook and cron emitter once** — coalesced, dedup-safe (`:L1004-L1007`).
3. **With no crond, starts an in-process 60s tick** driving the same two paths; the handle is returned so `serve` can clear it on shutdown (`:L1010-L1027`, `TICK_INTERVAL_MS` at `:L975`).

The crontab is **opt-in only**: `crontabUnavailable()` returns true unless `LM_ENABLE_CRONTAB=1` (which the compute pod image sets), and `LM_NO_CRONTAB=1` forces it off — merely having a `crontab` binary is *not* consent, because a dev machine has one too (`:L582-L595`). Lines are piped into `crontab -` (`:L677-L688`); each line is a `curl` POST back to this pod's own run endpoint (`:L635`):

```
*/30 * * * * curl -fsS -X POST http://localhost:8080/api/projects/blog/hooks/refresh-feed/run
0 7 * * *    curl -fsS -X POST http://localhost:8080/api/projects/blog/hooks/daily-digest/run
0 */2 * * *  curl -fsS -X POST http://localhost:8080/api/projects/blog/hooks/@emitter:integration-rss:poll/run
```

The schedule field is built by `crontabSchedule` from `every` / `daily`, clamped to **≥5-minute granularity** (`sdk/org/libs/cli/src/app/hooks/cron.ts:L22`, `:L31-L37`, `:L106-L117`). Dueness for catch-up compares `now` against `nextRunAt(def, state.cron[slug].lastRunAt)`, so **a window missed while the pod was down runs once on boot** (`cron.ts:L85-L92`; catch-up at `routes/hooks.ts:L928-L972`). A run that throws is still marked fired — "dedup wins over retry-storming a broken hook every tick" (`routes/hooks.ts:L950-L958`).

The boot catch-up drives the run **endpoint**, not `runHook` directly: `serve` injects a `runHookFn` that `fetch`es `POST /api/projects/<id>/hooks/<slug>/run` on localhost, keeping the "one authoritative path" invariant intact (`serve.ts:L442-L446`).

### Cron emitters

A `{type:'cron'}` **emitter def** has no hook slug, so it rides the same endpoint under the reserved pseudo-slug `@emitter:<scope>:<name>` — `@` cannot start a real hook or space slug, so it never collides (`routes/hooks.ts:L692-L709`). `runCronEmitter` builds a gated ctx (a per-def `state` KV + a `callConnection` locked to declared ∩ own/installed providers), runs the def's `emit(ctx)` **worker-isolated** under a 5 s ceiling (`LMTHING_EMITTER_EMIT_TIMEOUT_MS`), validates the output against the def's `emits` schema, and dispatches the surviving events to subscribing event hooks. It never throws — a failure is logged (`:L765`, `:L774-L817`). Dueness is tracked in the same `hooks-state.json` `cron` map under the pseudo-slug (`:L862-L912`).

---

## `.data/hooks-state.json`

The only I/O in the hooks module; everything that *decides* (cron, loop-guard) is pure and takes this state as data (`sdk/org/libs/cli/src/app/hooks/state.ts:L1-L13`).

```jsonc
{
  "lastFiredAt": { "refresh-feed": 1752300000000 },  // per-slug cooldown clock
  "cron":        { "refresh-feed": { "lastRunAt": 1752300000000 } }, // boot catch-up
  "pending":     [],                                 // budget-exhausted retry slugs
  "disabled":    ["integration-slack:on-message"]    // the settings-UI overlay
}
```

Shape at `state.ts:L20-L30`. A missing or corrupt file yields a fresh empty state — "state is a cache, not truth" (`:L46-L61`). The event-dispatch drain reads the `disabled` overlay **synchronously** (`disabledSlugsSync`) to avoid perturbing microtask ordering with an `await` (`:L96-L109`).

---

## Gotchas

- **The run endpoint only finds *project* hooks.** It calls `loadHooks(projectRoot)` (`routes/hooks.ts:L425`), which reads `<projectRoot>/hooks/` only (`app/hooks/loader.ts:L213-L215`). `GET /api/hooks` uses `loadAllHooks`, which *also* walks `spaces/<id>/hooks/` (`loader.ts:L314-L328`) — so an installed space's hook is listed and can be disabled, but a `POST …/hooks/<spaceId>:<slug>/run` against it 404s. Space hooks fire through the event dispatcher, not this endpoint.
- **`.data/hooks-state.json` lives under the project root**, not the pod root (`state.ts:L38-L40`).
- **Disabling is an overlay, not an edit.** The hook file is untouched; re-enabling just removes the slug (`routes/hooks.ts:L560-L566`).
- **A hook run is a mutating POST**, so it bumps the self-idle watchdog's `lastMutatingRequestAt` and keeps the pod from scaling to zero mid-run (`serve.ts:L328-L340`).
- **`type: 'database'` is gone.** React to writes with an `event` hook on `project/db.<table>.<insert|update|remove>` — see [../../format/project/hooks/README.md](../../format/project/hooks/README.md).

---

## See also

- [../../format/project/hooks/README.md](../../format/project/hooks/README.md) — the hook file format, event addresses, loop guards.
- [./README.md](./README.md) — the full pod REST surface, and why it has no auth of its own.
- [./webhooks.md](./webhooks.md) — `POST /api/inbound/:path`, the external ingress that also drives headless runs.
- [./sessions.md](./sessions.md) — the interactive session API a hook run deliberately bypasses.
