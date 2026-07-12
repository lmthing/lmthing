# Project-app runtime behavior

How a project-app actually *runs* in the pod: its SQLite store, the worker-isolated api
runtime, the error contract, in-process hook automation, the ordered boot sequence, and the
safety properties that bound all of it.

File formats are specified elsewhere — see [../format/project/database/README.md](../format/project/database/README.md),
[../format/project/hooks/README.md](../format/project/hooks/README.md), the
[api](../format/project/api/README.md) and [pages](../format/project/pages/README.md) formats.
The agent-facing `db` / `apiCall` globals are in [../runtime-globals/data-db.md](../runtime-globals/data-db.md).
URL mounts are in [./routes.md](./routes.md); the store install path is in
[../cli-api/rest/apps.md](../cli-api/rest/apps.md).

---

## 1. The two-layer model

A **space** is agent capability; a **project** is the app plus its data. The app layer lives at
the project root as siblings of `spaces/` — `database/`, `pages/`, `api/`, `hooks/`
`sdk/org/libs/cli/src/app/loader.ts:7-10`. `loadProjectApp` reads `database/*.json` (table name =
file basename), runs core's fail-loud `validateSchemaSet`, and reports which app dirs exist
`sdk/org/libs/cli/src/app/loader.ts:56-99`.

`hasApp` is the OR of all four dirs, so a **spaces-only project** (the synthetic `system` project)
loads to an empty app with `hasApp: false` and never throws
`sdk/org/libs/cli/src/app/loader.ts:31-41,67-68`.

Six apps ship in the store catalog today — `blog`, `demo-feed`, `health`, `homes`, `kitchen`,
`trips` (`store/projects/`, indexed by `store/projects/manifest.json`).

---

## 2. Data — the project-rooted SQLite store

One SQLite database per project at `<projectRoot>/.data/app.db`, opened WAL with foreign keys on
`sdk/org/libs/cli/src/app/store.ts:270-276`. This is the only `better-sqlite3` import in the
codebase (`store.ts`, `openProjectDb`).

**Two typed surfaces, one store.** `ProjectDb.db` is the **synchronous** agent-side `DbApi`
(a same-process host call — see [../runtime-globals/data-db.md](../runtime-globals/data-db.md));
`ProjectDb.async` is the `Promise`-returning `AsyncDbApi` mirror handed to Node api handlers and
hooks — today a thin `Promise.resolve(sync)` wrapper
`sdk/org/libs/cli/src/app/store.ts:542-572`. Both expose the same seven methods
(`query`, `tables`, `insert`, `update`, `remove`, `createTable`, `addColumn`)
`sdk/org/libs/core/src/db/types.ts:55-85` · `sdk/org/libs/cli/src/app/store.ts:564-572`.

**Marshalling at the boundary.** Declared `ColumnType` → SQLite storage: `number`→REAL,
`boolean`→INTEGER, everything else (`string`/`date`/`json`) → TEXT
`sdk/org/libs/cli/src/app/store.ts:104-116`. Values are converted on write (`boolean`→0/1,
`json`→`JSON.stringify`, `date`→ISO string) and back on read
`sdk/org/libs/cli/src/app/store.ts:128-161`.

**Write listener seam.** Every *committed* row mutation fires `WriteListener({table, event, rows})`
synchronously, main-process — this is the sole hook-dispatch trigger
`sdk/org/libs/cli/src/app/store.ts:536-562`. Note the payload asymmetry: `insert` passes the
inserted row(s); `update` and `remove` notify with an **empty `rows` array**
`sdk/org/libs/cli/src/app/store.ts:551-559`.

**Backup is a `.sql` dump**, not a file copy — `dumpToSql()` emits a deterministic,
diff-friendly text file that dodges WAL-file races
`sdk/org/libs/cli/src/app/store.ts:27-28,503-504`; `restoreFromSql` rebuilds a fresh db from it,
removing any existing `app.db`/`-wal`/`-shm` first
`sdk/org/libs/cli/src/app/store.ts:591-604`.

---

## 3. Execution — worker-isolated api handlers

A request into `…/api/*` (or an agent's `apiCall(name, …)`) enters the **same** main-process
runtime `sdk/org/libs/cli/src/app/api/runtime.ts:305-317`. The pipeline per call:

1. **Route match** — file-based discovery: `api/<route-dir>/<METHOD>.ts`, `[id]` → `:id`;
   `export const name` is the stable agent-facing id, **required and unique per project**
   (a duplicate route or a duplicate name is a fail-loud throw)
   `sdk/org/libs/cli/src/app/api/loader.ts:78-94,122`.
2. **Method-aware Input assembly** — `Input` is ONE object; where each field travels is derived
   from the method, not declared per field. `GET`/`DELETE` take the base from the query string,
   `POST`/`PATCH`/`PUT` from the JSON body; **path params always merge last and win on clash**.
   A non-object body degrades leniently to `{}` `sdk/org/libs/cli/src/app/api/input.ts:40-53`.
3. **ajv validation** — one validator compiled per endpoint at generation time with
   `coerceTypes: true, allErrors: true, useDefaults: true`, so a GET's `"true"` becomes a boolean
   and a `[id]` path string becomes a number when the schema says so
   `sdk/org/libs/cli/src/app/build/validate.ts:36,45-51`. A mismatch → `400` before any handler runs
   `sdk/org/libs/cli/src/app/api/runtime.ts:211-213`.
4. **Transpile** — esbuild `.ts` → CJS, cached by file mtime
   `sdk/org/libs/cli/src/app/api/runtime.ts:170-183`.
5. **Run in a fresh worker** — `new Worker(source, { eval: true, workerData: job })`
   `sdk/org/libs/cli/src/app/api/runtime.ts:236`. The worker entry is esbuild-bundled once per
   process into a self-contained CJS string, so it runs identically under vitest (source) and the
   built CLI `sdk/org/libs/cli/src/app/api/runtime.ts:117-133`.

### The worker is a crash boundary, not a data path

The handler's `ctx` is `{ db, apiCall, spawn }`, and **every member is a proxy**: each call posts
a correlated `{type:'proxy', id, kind, payload}` message to the main thread and awaits the reply
`sdk/org/libs/cli/src/app/api/worker.ts:115-152`. The main process services them against the real
db / apiCall resolver / spawn runner `sdk/org/libs/cli/src/app/api/runtime.ts:273-303`. So **every
db write executes in the main process** — the worker holds no state and never touches the
filesystem or db directly `sdk/org/libs/cli/src/app/api/worker.ts:12-16`.

A handler that throws, `process.exit()`s or segfaults takes down only its thread; the runtime
catches `error`/`exit` and settles a generic `500` (the real message logged, never leaked)
`sdk/org/libs/cli/src/app/api/runtime.ts:253-263`.

This is explicitly a **crash boundary, not a security boundary — the pod is the boundary**
`sdk/org/libs/cli/src/app/api/runtime.ts:8-12` · `sdk/org/libs/cli/src/server/routes/app-api.ts:11-13`.

`spawn(ref, input)` is fire-and-forget: it starts an **isolated headless agent session** through
`SessionManager.runHeadless` (exactly like a declarative hook `trigger`)
`sdk/org/libs/cli/src/server/session-manager.ts:680-697`. A *synchronous* runner failure is folded
into the proxy reply and delivered to `opts.onError` before the promise resolves
`sdk/org/libs/cli/src/app/api/worker.ts:144-150` · `sdk/org/libs/cli/src/app/api/runtime.ts:285-292`.

A real handler (`store/projects/demo-feed/api/mark-read/POST.ts`):

```ts
export const name = 'markRead';
export const description = 'Mark a single feed item as read.';

export interface Input { id: string; }
export interface Output { ok: boolean; }

export default async function handler(input: Input, ctx: Ctx): Promise<Output> {
  const count = await ctx.db.update('feed_items', {
    where: { id: input.id },
    set: { read: true },
  });
  return { ok: count > 0 };
}
```

---

## 4. `HttpError` — the error contract

A handler controls its HTTP status by throwing `new HttpError(status, message, details?)`; the
runtime maps it to that status with body `{ error: { status, message, details? } }`
`sdk/org/libs/cli/src/app/api/errors.ts:26-38,57-61,94-102`. **Any other throw → a generic `500`**;
the real error is logged pod-side and deliberately never placed in the body
`sdk/org/libs/cli/src/app/api/errors.ts:6-8,101` · `sdk/org/libs/cli/src/app/api/runtime.ts:247-248`.
An ajv mismatch → `400 { error: { status: 400, message: 'invalid input', details: <ajv errors> } }`
`sdk/org/libs/cli/src/app/api/errors.ts:109-111` · `sdk/org/libs/cli/src/app/api/runtime.ts:213`.

| Thrown in the handler | Response |
|---|---|
| `HttpError(404, 'not found')` | `404` `{error:{status:404,message:'not found'}}` |
| `HttpError(422, 'bad', {field:'x'})` | `422` `{error:{…,details:{field:'x'}}}` |
| any other `Error` | `500` `{error:{status:500,message:'internal error'}}` |
| ajv input mismatch (before the handler) | `400` `{error:{…,message:'invalid input',details:[…]}}` |
| unroutable path / unknown `apiCall` name | `404` `sdk/org/libs/cli/src/app/api/runtime.ts:308,315` |

Because handlers run in a worker, an `HttpError` **cannot cross the thread boundary as a class
instance** (`postMessage` structured-clone drops the prototype). The worker serializes it to a
tagged `{__httpError:true, status, message, details}` object; the main runtime reconstructs the
response with `errorResponseFor` `sdk/org/libs/cli/src/app/api/errors.ts:10-15,64-83` ·
`sdk/org/libs/cli/src/app/api/worker.ts:166-172` · `sdk/org/libs/cli/src/app/api/runtime.ts:243-245`.

There are **two `HttpError` classes with one wire contract**: pages import the browser one from
`@app/runtime` (`sdk/org/libs/cli/src/app/runtime/client.ts`), api handlers get the server one via
the `@app/runtime` require-shim inside the worker
`sdk/org/libs/cli/src/app/api/handler-module.ts` (`loadHandlerFromCode`, `APP_RUNTIME_MODULE`).
The agent's `apiCall` surfaces the same error object as a thrown yield error
`sdk/org/libs/cli/src/app/api/runtime.ts:186-198` — one error shape across browser and agent.

---

## 5. Automation — hooks running in-proc

Three hook kinds discover from `<projectRoot>/hooks/*.ts` (project scope) and
`<projectRoot>/spaces/<id>/hooks/*.ts` (space scope, slug-namespaced `<spaceId>:<basename>`)
`sdk/org/libs/cli/src/app/hooks/loader.ts:4-9,278-305`. Because a hook may carry an imperative
`handler`, discovery must actually *import* the module — unlike the api loader, which static-parses
`sdk/org/libs/cli/src/app/hooks/loader.ts:36-42`.

> **`{type:'database'}` hooks are removed, no back-compat.** A file still declaring one is dropped
> with a migration error and the rest of the project still loads
> `sdk/org/libs/cli/src/app/hooks/loader.ts:50-54,485-491`. Subscribe to the synthetic event
> instead (below).

### db write → event → hook

A committed write fires the store's `onWrite` seam, which `ProjectHookRuntime.onDbWrite` turns into
events `sdk/org/libs/cli/src/app/hooks/runtime.ts:124-151`:

1. a **synthetic** `project/db.<table>.<insert|update|remove>` event whose payload IS the written
   row — enqueued synchronously `sdk/org/libs/cli/src/app/hooks/runtime.ts:133-141`;
2. any `{type:'db'}` **emitter def's** typed events — the def's pure `emit(row)` runs
   worker-isolated (5 s default, `LMTHING_EMITTER_EMIT_TIMEOUT_MS`), its output is validated against
   the def's `emits`, and each surviving event is enqueued at `<scope>/<event>`
   `sdk/org/libs/cli/src/app/hooks/runtime.ts:15,156-201`.

> **Gotcha (grounded):** `update`/`remove` notify with `rows: []`
> `sdk/org/libs/cli/src/app/store.ts:551-559`, so `row` is `undefined`
> `sdk/org/libs/cli/src/app/hooks/runtime.ts:131` — the synthetic `…update`/`…remove` event fires
> with an **empty payload** `{}` `sdk/org/libs/cli/src/app/hooks/runtime.ts:135-140`, and
> `enqueueDbEmitterEvents` returns early, so `{type:'db'}` emitter defs effectively only fire on
> `insert` `sdk/org/libs/cli/src/app/hooks/runtime.ts:161-162`.

### The decoupled queue (non-re-entrant by construction)

`HookDispatcher.enqueue` synchronously computes which hooks subscribe and pushes queue entries,
then **returns — it never runs a hook** `sdk/org/libs/cli/src/app/hooks/dispatcher.ts:6-14,104`.
The queue drains on the next event-loop tick (`setImmediate`), after the current eval unwinds
`sdk/org/libs/cli/src/app/hooks/runtime.ts:203-210`. A write made *by* a running hook therefore
enqueues into the **next** cycle, not the one in flight
`sdk/org/libs/cli/src/app/hooks/dispatcher.ts:11-14`; the drain re-arms itself if anything queued
during it `sdk/org/libs/cli/src/app/hooks/runtime.ts:247-252`.

### The loop guard (pure, host-enforced)

Three guards, all injected-clock pure functions
`sdk/org/libs/cli/src/app/hooks/loop-guard.ts:84-100`:

| Guard | Rule | Constant |
|---|---|---|
| Depth cap | an event already `HOOK_DEPTH_CAP` levels deep in a cascade fires no further hooks | `HOOK_DEPTH_CAP = 3` `sdk/org/libs/cli/src/app/hooks/loop-guard.ts:52` |
| Self-write exclusion | a hook never fires on an event produced by its own triggered session (`originatingHookSlug === hook.slug`) | `loop-guard.ts:89-91` |
| Cooldown / coalesce | at most one fire per window; a burst collapses to one fire | `HOOK_COOLDOWN_MS = 5_000` `sdk/org/libs/cli/src/app/hooks/runtime.ts:11` |

Coalescing is two-sided: **queue coalesce** keeps at most one entry per hook slug (a later event
replaces the earlier), and cooldown-suppressed events are *deferred, not dropped* — a single timer
promotes them once the window elapses, so the tail of a burst is still processed
`sdk/org/libs/cli/src/app/hooks/dispatcher.ts:19-22` · `sdk/org/libs/cli/src/app/hooks/runtime.ts:254-276`.

**Budget-exhaustion queue:** when a hook's run reports budget exhaustion, ≤1 pending entry per slug
is kept and retried on the next drain (the pod gets no push signal when the budget window rolls)
`sdk/org/libs/cli/src/app/hooks/dispatcher.ts:23-25,183-222` ·
`sdk/org/libs/cli/src/server/routes/hooks.ts:299-311,358,367,373`.

### Dispatch itself

`runHook` is the one dispatch point. A **declarative** hook (`trigger: 'space/agent#action'`)
runs a headless agent session with the event payload threaded into the kickoff message; an
**imperative** hook (`handler`) is invoked with a `{db, delegate, callConnection, tasklist, input}`
ctx and runs **no agent at all**
`sdk/org/libs/cli/src/server/routes/hooks.ts:313-376` · `sdk/org/libs/cli/src/app/hooks/loader.ts:75-97`.
A disabled hook is inert (the export-level `disabled` OR'd with the `.data/hooks-state.json`
overlay) `sdk/org/libs/cli/src/server/routes/hooks.ts:327-330` ·
`sdk/org/libs/cli/src/app/hooks/state.ts:28-30`.

**Space hooks never run in-proc.** A space (store-downloaded) hook's def data is extracted in a
worker and its handler invoked worker-isolated through a shim — running store code with the pod's
privileges is exactly what this avoids
`sdk/org/libs/cli/src/app/hooks/loader.ts:42-46,278-305` · `sdk/org/libs/cli/src/app/worker-load.ts`
(`loadDefaultInWorker`, `invokeDefaultFnInWorker`, `DEFAULT_TIMEOUT_MS = 10_000` at
`sdk/org/libs/cli/src/app/worker-load.ts:36`).

### Cron

Cron is pure decision + an external tick. `parseEvery('30m'|'2h'|'1d')` is **clamped to ≥5 minutes**
(`MIN_CRON_INTERVAL_MS`) `sdk/org/libs/cli/src/app/hooks/cron.ts:22,31-38`; `nextRunAt` gives the
wall-clock-accurate next fire (a `daily:'HH:MM'` fires at that time, not 24 h after the last catch-up)
`sdk/org/libs/cli/src/app/hooks/cron.ts:65-76`; `dueCronHooks` is what makes **boot catch-up** work —
a window missed while the pod was down runs once, coalesced
`sdk/org/libs/cli/src/app/hooks/cron.ts:85-92`. `nextCrontabLines` renders one crontab line per hook,
each hitting the local hook-run endpoint `sdk/org/libs/cli/src/app/hooks/cron.ts:100-104`.

The system crontab is only written when `LM_ENABLE_CRONTAB=1` (the compute-pod image sets it);
otherwise an in-process 60 s tick drives cron hooks
`sdk/org/libs/cli/src/server/routes/hooks.ts:582-611,975,1011-1012`.

Persisted state is the only I/O in the hooks module — `<projectRoot>/.data/hooks-state.json` with
`lastFiredAt` (cooldown), `cron[slug].lastRunAt` (catch-up), `pending[]` (budget retry) and
`disabled[]` (settings overlay) `sdk/org/libs/cli/src/app/hooks/state.ts:1-31`.

A real event hook (`store/projects/demo-feed/hooks/enrich-on-add.ts`):

```ts
export default {
  type: 'event' as const,
  on: { event: 'project/db.feed_items.insert' },
  handler: async ({ input, db }) => {
    if (!input?.id) return;
    if (!input.summary || input.summary.trim() === '') {
      await db.update('feed_items', {
        where: { id: input.id },
        set: { summary: `Saved: ${input.title ?? 'untitled'}` },
      });
    }
  },
};
```

(It listens on `insert` and writes an `update`, so it cannot re-trigger itself — and the self-write
guard would stop it anyway.)

---

## 6. Boot sequence (per project, ordered)

`bootProjectApp(projectRoot)` owns steps 1–3 and returns the open `ProjectDb`, or `null` for a
spaces-only project / an app with no tables
`sdk/org/libs/cli/src/app/boot.ts:50-90`.

| # | Step | Where |
|---|---|---|
| 1 | **Restore (DR only)** — rebuild `.data/app.db` from `.data/app.sql` **only when `app.db` is absent**. If it exists, never touch it (never clobber live PVC data). | `boot.ts:60-64` |
| 2 | **Open db** — WAL + `PRAGMA foreign_keys=ON`. | `boot.ts:66-67` · `store.ts:270-276` |
| 3 | **Reconcile schemas** — `database/*.json` is the sole source of truth: create missing tables, **additively** `ALTER TABLE ADD COLUMN` for new columns, **fail loud** on any non-additive divergence. | `boot.ts:69-87,98-149` |
| 4 | **Generate types/contracts** — endpoints + ajv validators + the agent's `apiCall` DTS + `types/generated.d.ts`, once and cached. | `session-manager.ts:720-729` · `app/build/contracts.ts` (`generateProjectContracts`) |
| 5 | **Build pages if stale** — content-hash-cached esbuild bundle. | `app/build/pages.ts:122-147` |
| 6 | **Regenerate the crontab** (guarded) | `server/serve.ts:402-406` · `server/routes/hooks.ts:582-611` |
| 7 | **Boot catch-up** — run each overdue cron hook once. | `server/serve.ts:442-447` · `hooks/cron.ts:85-92` |
| 8 | **Serve** | `server/serve.ts:217-218,306` |

Step 3's fail-loud set is explicit: a **live column absent from the JSON** (a drop or rename), a
**primary-key move**, or an unambiguous **text↔numeric type conflict** all throw with a message
naming the table and column `sdk/org/libs/cli/src/app/boot.ts:105-141`. The open handle is closed
before the throw so a failed reconcile leaks nothing `sdk/org/libs/cli/src/app/boot.ts:79-87`.

**Ordering constraints that actually bind:** the db must be open before reconcile, reconcile before
the api runtime is created (`getApiRuntime` awaits `getProjectDb` and builds nothing without it)
`sdk/org/libs/cli/src/server/session-manager.ts:669-702`, and serving comes last. In the running
server, all of steps 4–7 are deliberately pushed **off the readiness path** — the HTTP server is
already listening, so the K8s startup probe (`GET /api/sessions`) is never blocked by a synchronous
`better-sqlite3` open or an overdue cron hook that runs a full agent turn
`sdk/org/libs/cli/src/server/serve.ts:422-441`.

### Caches and their invalidation

- `SessionManager.getProjectDb` boots once and **caches `null`** for a spaces-only project
  `sdk/org/libs/cli/src/server/session-manager.ts:515-545`. So the first authored table must drop
  that cached "no db" — `onSchemaWrite` → `reloadProjectDb` does exactly that
  `sdk/org/libs/cli/src/server/session-manager.ts:583-590`.
- A live page/api authoring write (`onAppWrite`) invalidates the typed contracts and disposes the
  api runtime; **page compilation is deliberately not done on write** — the caller POSTs
  `/app/build` `sdk/org/libs/cli/src/server/session-manager.ts:591-609`.
- The served page bundle is cached per project in `serve.ts` and dropped on install
  `sdk/org/libs/cli/src/server/serve.ts:251,263,276,292-306`.
- A newly authored hook must join the live db-write dispatch set (wiring happens once, when the db
  first boots) — `republish` → `refreshProjectHooks` handles it, else the hook would not fire until
  a pod restart `sdk/org/libs/cli/src/server/session-manager.ts:570-582` ·
  `sdk/org/libs/cli/src/app/hooks/runtime.ts:104-113`.

### The page build

`buildProjectPages` is content-hash cached over the project's own files plus a `BUILDER_VERSION`
constant — currently `'4'` — which is the **only** way a runtime-only fix reaches an already-cached
pod `sdk/org/libs/cli/src/app/build/pages.ts:76-89,122-147`. It runs on boot / save / install, never
per request. Each build peaks ~100 MB, so builds are serialized process-wide and wait (bounded 30 s)
for memory-pressure headroom `sdk/org/libs/cli/src/app/build/pages.ts:97-116`.

---

## 7. Safety properties

**No app auth — the pod is the boundary.** A project-app is single-user. The api handler
(`createAppApiHandler`) performs no token check, no session lookup, no authorization
`sdk/org/libs/cli/src/server/routes/app-api.ts:22-56`; neither does the page server
`sdk/org/libs/cli/src/app/pages-serve.ts:91-153`. In production the only auth is the platform
deciding *which pod* a request reaches. Worker isolation is a **crash** boundary, not a security
boundary `sdk/org/libs/cli/src/app/api/runtime.ts:8-12`.

**Strict CSP on every served page response** — LLM-authored pages render third-party content, which
is an XSS surface, so the shipped policy is
`sdk/org/libs/cli/src/app/pages-serve.ts:44-46`:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
connect-src 'self'; img-src 'self' data: https:; base-uri 'self'; frame-ancestors 'self'
```

- `script-src 'self'` with **no `'unsafe-inline'`** — poisoned content can carry markup but cannot
  execute injected script `sdk/org/libs/cli/src/app/pages-serve.ts:33-35`.
- `connect-src 'self'` — even a self-XSS cannot exfiltrate to a third party or reach the top-level
  admin `/api/*`; the page can only talk to its own `…/api/*`
  `sdk/org/libs/cli/src/app/pages-serve.ts:36-38`.
- `base-uri 'self'` blocks `<base>` hijacking; `frame-ancestors 'self'` allows only the same-origin
  Studio preview iframe `sdk/org/libs/cli/src/app/pages-serve.ts:41-42`.
- The one inline script (`window.__APP_BASE__`) runs under a **per-response random nonce**, so the
  strict `script-src` is not weakened `sdk/org/libs/cli/src/app/pages-serve.ts:178-195`.

**Path traversal is rejected at the page server** independently of the asset manifest — the resolved
sub-path must live inside `outDir` `sdk/org/libs/cli/src/app/pages-serve.ts:120-126`. Serving is
**asset-manifest-match, not filesystem probing**, which is what makes a dotted dynamic param
(`/items/my.v2.id`) route client-side instead of 404-ing
`sdk/org/libs/cli/src/app/pages-serve.ts:13-21,128-152`.

**Store code never runs with pod privileges in-proc** — space hooks and emitter defs are
worker-isolated with a timeout, and only serializable data crosses back (functions are elided; a
JSON round-trip guarantees clone-safety)
`sdk/org/libs/cli/src/app/api/worker.ts:67-97` · `sdk/org/libs/cli/src/app/worker-load.ts:36,186-202`.

**Automation is bounded by the host, not by what an agent authors** — depth cap, self-write
exclusion, cooldown/coalesce and the budget-pending queue are all enforced in the dispatcher/loop
guard regardless of hook contents (§5).

**Not defended against:** the api handler worker has **no wall-clock timeout** — a handler that
hangs never settles its response (`runWorker` installs no timer;
`sdk/org/libs/cli/src/app/api/runtime.ts:220-269` contains no `setTimeout`), unlike the
worker-load seam which is timeout-bounded `sdk/org/libs/cli/src/app/worker-load.ts:186-202`.
`pages:write` can also pull npm dependencies into the pod, so dependency installs are a supply-chain
surface that must be gated outside this layer.

**Nor is SSRF: there is no egress filter, at this layer or under it.** A handler's import surface is
the `@app/runtime` shim plus a *real*, cwd-anchored `require`, so any Node builtin (`node:http`,
`node:net`) and any project npm dep resolves inside the worker
`sdk/org/libs/cli/src/app/api/handler-module.ts:34-38,48-52`, and the worker is launched with no
permission or resource restriction (`new Worker(source, { eval: true, workerData })` and nothing
else) `sdk/org/libs/cli/src/app/api/runtime.ts:236` — so a handler reaches the cluster network, the
node metadata endpoint and the public internet unimpeded. The CSP's `connect-src 'self'` binds the
*browser* page only, never the server-side handler `sdk/org/libs/cli/src/app/pages-serve.ts:34-36`.
The platform does not close it either: the cluster runs Calico and does enforce `NetworkPolicy`, but
the only policy in the repo is a render-service **Ingress** rule
`devops/argocd/core/render.yaml:89-112`, and pod provisioning creates a namespace, pull secret, PVC,
env secret, Deployment and Service — no `NetworkPolicy`, no egress restriction
`cloud/gateway/src/lib/compute.ts:543-640`.

---

## 8. Cross-references

| Topic | Doc |
|---|---|
| `database/<table>.json` schema format | [../format/project/database/README.md](../format/project/database/README.md) |
| `hooks/<slug>.ts` def format (cron / event / webhook) | [../format/project/hooks/README.md](../format/project/hooks/README.md) |
| `api/<route>/<METHOD>.ts` format | [../format/project/api/README.md](../format/project/api/README.md) |
| `pages/` format + client routing | [../format/project/pages/README.md](../format/project/pages/README.md) |
| Agent-side `db` / `apiCall` globals + capability gates | [../runtime-globals/data-db.md](../runtime-globals/data-db.md) |
| Store install (`GET /api/apps`, `POST /api/apps/install`) | [../cli-api/rest/apps.md](../cli-api/rest/apps.md) |
| Hook run/list/disable endpoints | [../cli-api/rest/hooks.md](../cli-api/rest/hooks.md) |
| URL mounts (`/app/<id>/…`, root mount) | [./routes.md](./routes.md) |
| `@app/runtime` client surface | [./views.md](./views.md) |
