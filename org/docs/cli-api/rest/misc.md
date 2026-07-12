# Pod REST — misc routes (prices, restart/keepalive, session ledger, backup/restore, report-bug)

Everything in `sdk/org/libs/cli/src/server/routes/` that the sibling pages don't
own, plus the two route helpers and the request-dispatch tail. See
[./README.md](./README.md) for the router, the context object and the auth model.

| Route | Handler | Module |
|---|---|---|
| `GET /api/prices/azure` | `handlePricesAzure` | `routes/prices.ts` |
| `POST /api/restart` | inline (anonymous) | `server/serve.ts` |
| `POST /api/keepalive` | inline (anonymous) | `server/serve.ts` |
| `GET /api/session-ledger` | `handleListSessionLedger` | `routes/session-ledger.ts` |
| `POST /api/backup` | `handleBackupNow` | `routes/backup.ts` |
| `GET /api/backup/status` | `handleBackupStatus` | `routes/backup.ts` |
| `POST /api/restore` | `handleRestore` | `routes/backup.ts` |
| `POST /api/report-bug` | `handleReportBug` | `routes/report-bug.ts` |

All eight are registered in the one route table built by `startSessionServer` `sdk/org/libs/cli/src/server/serve.ts:134-211`.

---

## `GET /api/prices/azure` — model price table

Streams `libs/cli/prices/azure.json` verbatim with `Content-Type: application/json`; the file is resolved **relative to the module** (`dirname(fileURLToPath(import.meta.url))` + `../prices/azure.json`) rather than to `process.cwd()`, because tsup flattens every chunk into `dist/` `sdk/org/libs/cli/src/server/routes/prices.ts:13-20`. A missing file answers `404 { error: 'prices not available' }` `sdk/org/libs/cli/src/server/routes/prices.ts:21-23`.

The payload is a `modelId → { inputPer1K, outputPer1K }` map `sdk/org/libs/cli/prices/azure.json:1-9`:

```json
{
  "DeepSeek-V4-Flash": { "inputPer1K": 0.00019, "outputPer1K": 0.00051 },
  "DeepSeek-V4-Pro":   { "inputPer1K": 0.00174, "outputPer1K": 0.00348 }
}
```

Consumers: the chat sidebar's live per-token session cost, and the Models settings card (see [../../chat/features.md](../../chat/features.md)). It is also the pricing input the pod uses for turn cost accounting (`computeTurnCost`, `ModelPricing`) `sdk/org/libs/cli/src/server/session-ledger.ts:3`.

## `POST /api/restart` — restart the pod process

Answers `200 {ok:true}` and then **exits the process** 100 ms later, letting Kubernetes restart the container `sdk/org/libs/cli/src/server/serve.ts:143-147`:

```ts
router.add('POST', '/api/restart', async (_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true }));
  setTimeout(() => process.exit(0), 100);
});
```

It has no exported symbol — it is an anonymous inline handler in the route registry. Callers poll `GET /api/env` until it answers again and then reload (see [./env.md](./env.md) and [../../chat/features.md](../../chat/features.md)).

## `POST /api/keepalive` — keep-warm heartbeat

Returns `200 {ok:true}` and nothing else `sdk/org/libs/cli/src/server/serve.ts:154-157`. Its value is the **verb**: the server's activity wrapper only counts non-`GET`/`HEAD`/`OPTIONS` requests, so a `POST` bumps `lastMutatingRequestAt` for free and keeps the self-idle watchdog from scaling the pod to zero while a tab is open `sdk/org/libs/cli/src/server/serve.ts:149-153` · `sdk/org/libs/cli/src/server/serve.ts:344-357`. A hidden/closed tab stops pinging and the pod idles out normally `sdk/org/libs/cli/src/server/serve.ts:149-153`. The same `lastActivityMs`/`isBusy` pair feeds `startSelfIdleWatchdog` `sdk/org/libs/cli/src/server/serve.ts:519-528`.

## `GET /api/session-ledger` — session + delegate accounting

`{ sessions: SessionLedgerRecord[] }`, newest-first, capped at **200** `sdk/org/libs/cli/src/server/routes/session-ledger.ts:10-17` · `sdk/org/libs/cli/src/server/session-ledger.ts:243-247`. It takes no query params — the limit is hard-coded at the call site (`ctx.manager.listSessionLedger(200)`).

A record covers a chat session *or* a headless run spawned by a hook / code node, with its own token totals plus every delegate it made `sdk/org/libs/cli/src/server/session-ledger.ts:25-41`:

```ts
export interface SessionLedgerRecord {
  sessionId: string;
  /** Origin of the session: `chat`, `hook:<slug>`, or `code-node`. */
  source: string;
  projectId?: string;
  title?: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'done' | 'error';
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  delegates: DelegateEntry[];
}
```

Each `DelegateEntry` carries `target` (`pkg/agent#action`, or `pkg/agent` when model-driven), a truncated `query` preview, its own token/cost/model/duration, `status` and the delegation `depth` `sdk/org/libs/cli/src/server/session-ledger.ts:5-23`. Backs the Sessions tab of the settings dialog `sdk/org/libs/cli/src/server/routes/session-ledger.ts:6-8`.

---

## Backup & restore — `POST /api/backup`, `GET /api/backup/status`, `POST /api/restore`

The three routes are thin wrappers over the engine in `server/backup.ts`; all three
require a workspace root and answer **400** `{ error: 'workspace backup unavailable (no project root)' }` when `ctx.effectiveLmthingRoot` is undefined (non-project mode) `sdk/org/libs/cli/src/server/routes/backup.ts:12-18`.

| Endpoint | Body | Response |
|---|---|---|
| `POST /api/backup` | — | `200 BackupResult` from `runBackup({trigger:'manual', workTree})`; `500 {error}` on failure `sdk/org/libs/cli/src/server/routes/backup.ts:20-34` |
| `GET /api/backup/status` | — | `200 BackupStatus` from `readBackupStatus(root)` `sdk/org/libs/cli/src/server/routes/backup.ts:36-46` |
| `POST /api/restore` | — | `200` when `result.ok`, else **409**, body = `RestoreResult`; `500 {error}` on throw `sdk/org/libs/cli/src/server/routes/backup.ts:48-62` |

Result shapes `sdk/org/libs/cli/src/server/backup.ts:50-71`:

```ts
interface BackupResult  { ok: boolean; reason?: string; committed?: boolean; sha?: string }
interface RestoreResult { ok: boolean; reason?: string; restored?: number; branch?: string; commitSha?: string }
interface BackupStatus  { status: 'ok'|'error'|'idle'; lastBackupAt: string|null;
                          lastCheckedAt: string|null; lastCommitSha: string|null; error: string|null }
```

### How the engine works

- **Target** — the pod's workspace (`/data/.lmthing` on the PVC in production), pushed to a GitHub repo on the branch `lmthing-backup` (overridable by `GITHUB_BACKUP_BRANCH`) `sdk/org/libs/cli/src/server/backup.ts:11-31` · `sdk/org/libs/cli/src/server/backup.ts:158-160`.
- **The `.git` dir lives OUTSIDE the work-tree** (`<workTree>.git`), so nothing git-related is ever committed or restored and the repo can't nest inside itself `sdk/org/libs/cli/src/server/backup.ts:17-19` · `sdk/org/libs/cli/src/server/backup.ts:99-101`.
- **Exclusions go in `$GIT_DIR/info/exclude`, never a committed `.gitignore`**, so secrets are never even tracked: `.env`, `.env.*`, `**/sessions/`, `**/conversations/`, `node_modules/`, `.cache/`, `**/.data/app.db`, `**/.data/app.db-*` `sdk/org/libs/cli/src/server/backup.ts:33-48` · `sdk/org/libs/cli/src/server/backup.ts:197-205`. An older repo that tracked a secret is untracked belt-and-suspenders on every `ensureRepo` `sdk/org/libs/cli/src/server/backup.ts:201-205`.
- **The binary project-app db is never committed** — before staging, `dumpAllProjectDbs` regenerates `<root>/<id>/.data/app.sql` from each live `app.db`; the `.sql` dump is the tracked, restorable form. Each project dumps defensively (a corrupt db logs and is skipped, never aborting the backup) `sdk/org/libs/cli/src/server/backup.ts:274-314` · `sdk/org/libs/cli/src/server/backup.ts:331-333`.
- **No token is ever persisted.** Per push/pull the pod asks the gateway `POST /api/backup/token` (authed with the injected `LMTHING_BACKUP_JWT`) for a short-lived repo-scoped installation token `sdk/org/libs/cli/src/server/backup.ts:20-23` · `sdk/org/libs/cli/src/server/backup.ts:164-181` · `cloud/gateway/src/routes/backup.ts:167`. It is passed only through an env-reading git credential helper — never to argv or on-disk config `sdk/org/libs/cli/src/server/backup.ts:117-122` — and any leaked credential is scrubbed out of stderr before it is logged or returned `sdk/org/libs/cli/src/server/backup.ts:75-80`.
- **Not configured ⇒ `{ok:false, reason:'not-configured'}`** (no `LMTHING_BACKUP_JWT` and no `LM_BACKUP_TEST_REMOTE`) `sdk/org/libs/cli/src/server/backup.ts:185-187` · `sdk/org/libs/cli/src/server/backup.ts:322-323`. Tests point `LM_BACKUP_TEST_REMOTE` at a `file://` bare repo to run fully offline `sdk/org/libs/cli/src/server/backup.ts:149-162`.
- **Serialized** — a promise-chain lock makes the manual "Back up now", the auto timer and the SIGTERM flush mutually exclusive, so concurrent `git` can't corrupt the repo `sdk/org/libs/cli/src/server/backup.ts:82-95`.
- **Push policy** — plain push first; on a non-fast-forward the pod is authoritative for its own backup branch, so it fetches and re-pushes with `--force-with-lease` `sdk/org/libs/cli/src/server/backup.ts:244-270`.
- **Nothing dirty ⇒ `{ok:true, committed:false}`** (status file gets a fresh `lastCheckedAt`) `sdk/org/libs/cli/src/server/backup.ts:336-342`; otherwise commit + push and record `{status:'ok', lastBackupAt, lastCommitSha}` `sdk/org/libs/cli/src/server/backup.ts:344-355`.
- **Restore is non-destructive** — `git checkout FETCH_HEAD -- .` overwrites tracked files and recreates missing ones, but local-only files stay and excluded paths (`.env*`, `sessions/`, `conversations/`) are never touched because they were never committed. A branch that doesn't exist yet answers `{ok:false, reason:'no-backup'}` → HTTP 409 `sdk/org/libs/cli/src/server/backup.ts:370-406`.
- **Status is a JSON file inside the git dir** (`<workTree>.git/last-backup.json`); absent ⇒ the `idle` default `sdk/org/libs/cli/src/server/backup.ts:103-105` · `sdk/org/libs/cli/src/server/backup.ts:229-242`.
- All git calls are async `execFile` (never `execSync`) so a slow network op can't block the server's event loop or trip the idle watchdog `sdk/org/libs/cli/src/server/backup.ts:24-25` · `sdk/org/libs/cli/src/server/backup.ts:107-138`.

### Automatic backups (not routes)

`startBackupTimer(root)` runs a backup every `GITHUB_BACKUP_INTERVAL_MIN` minutes (default 60, floor 5) — **only** when `GITHUB_BACKUP_AUTO=1` `sdk/org/libs/cli/src/server/backup.ts:410-428`. `startSessionServer` starts it and also installs a `SIGTERM` handler that flushes a final `trigger:'shutdown'` backup, capped at 25 s so the pod still exits inside its termination grace period `sdk/org/libs/cli/src/server/serve.ts:539-553`.

> The repo/branch selection UI (`GET /api/backup/install-url`, `GET|PUT /api/backup/config`) lives on the **cloud gateway**, not the pod `cloud/gateway/src/routes/backup.ts:31` · `cloud/gateway/src/routes/backup.ts:64` · `cloud/gateway/src/routes/backup.ts:88`.

---

## `POST /api/report-bug` — browser → pod → gateway broker

Body `{ title, message, sessionId, screenshot? }`. `title`/`message`/`sessionId` must be non-empty strings and `screenshot` (when present) a string, else **400** with a per-field `{error}`; a body that isn't JSON is **400** `{ error: 'invalid JSON body' }` `sdk/org/libs/cli/src/server/routes/report-bug.ts:17-46`.

The pod is a broker, not the filer: `reportBug` looks the session up (**404** `{error:'session not found'}` if unknown), serializes that session's whole trace history from the hub snapshot to NDJSON, and `POST`s `{title, message, trace, screenshot}` to `${LMTHING_GATEWAY_URL || http://gateway.lmthing.svc.cluster.local:3000}/api/issues` — **relaying the caller's `Authorization` header** — then echoes the gateway's status and body verbatim `sdk/org/libs/cli/src/server/report-bug.ts:9-50` · `sdk/org/libs/cli/src/server/routes/report-bug.ts:48-58`. A network failure to the gateway becomes **502** `{error}` `sdk/org/libs/cli/src/server/report-bug.ts:51-53`; an unexpected throw in the route becomes **500** `sdk/org/libs/cli/src/server/routes/report-bug.ts:59-61`. The gateway route that actually files the GitHub issue is `POST /api/issues` `cloud/gateway/src/routes/issues.ts:25`.

Together with `GET /api/budget` (see [./budget.md](./budget.md)) this is one of only two pod routes that relay a gateway JWT; the pod never verifies it.

---

## Route helpers — `routes/utils.ts`

Not a route module. Two functions every other module imports `sdk/org/libs/cli/src/server/routes/utils.ts:3-12`:

```ts
export async function readBody(req: IncomingMessage): Promise<string>   // buffers the body to utf8
export function sendJson(res: ServerResponse, status: number, obj: unknown): void
```

`sendJson` always writes `Content-Type: application/json; charset=utf-8`.

## The dispatch tail (unmatched requests)

The `Router` is first-match-wins over registration order; `:param` captures one non-slash segment and a trailing `/*` captures the remainder as `params.rest`; a handler that rejects becomes a `500 {error}` `sdk/org/libs/cli/src/server/router.ts:33-82`. When nothing matches `sdk/org/libs/cli/src/server/serve.ts:358-369`:

- a path under `/api/` → `404 { error: "unknown API route <METHOD> <path>" }`;
- anything else → the Vite dev middleware when `LM_DEV_WEB` is set, otherwise the pre-built unified SPA (`staticApps.handle`).

WebSocket upgrades are **not** in the Router — they are matched in the `upgrade` listener: `/api/terminals/<id>` → the terminal socket, everything else → the agent socket (see [./sessions.md](./sessions.md)) `sdk/org/libs/cli/src/server/serve.ts:376-387`.

## Route modules documented elsewhere

| Module | Endpoints | Doc |
|---|---|---|
| `routes/app-api.ts` | `* /app/:projectId/api/*` (and the root-mounted `* /:projectId/api/*`) `sdk/org/libs/cli/src/server/serve.ts:217-218` · `sdk/org/libs/cli/src/server/serve.ts:322-326` | [../../app/README.md](../../app/README.md) |
| `routes/app-admin.ts` | `GET|POST /api/projects/:projectId/app/build`, `GET /api/projects/:projectId/app/data/:table`, `PATCH …/app/data/:table/:id`, `GET|PUT …/app/files/*`, `GET /api/projects/:projectId/app` `sdk/org/libs/cli/src/server/serve.ts:240-246` | [../../app/features.md](../../app/features.md) |
| `routes/prices.ts`, `routes/budget.ts` | see above / [./budget.md](./budget.md) | — |
| `routes/env.ts` · `routes/fs.ts` · `routes/uploads.ts` · `routes/hooks.ts` · `routes/webhooks.ts` | — | [./env.md](./env.md) · [./fs.md](./fs.md) · [./uploads.md](./uploads.md) · [./hooks.md](./hooks.md) · [./webhooks.md](./webhooks.md) |
| `routes/sessions.ts` · `routes/projects.ts` · `routes/spaces.ts` · `routes/apps.ts` · `routes/store-spaces.ts` | — | [./sessions.md](./sessions.md) · [./projects.md](./projects.md) · [./spaces.md](./spaces.md) · [./apps.md](./apps.md) · [./store-spaces.md](./store-spaces.md) |

Files in `routes/` that are **not** route modules: `utils.ts` (helpers, above) and the co-located `*.test.ts` suites. Note `routes/cron-emitter.test.ts` tests emitter code that lives in `hooks.ts` — there is no `cron-emitter.ts` module.
