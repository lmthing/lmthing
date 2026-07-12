# Pod REST — Sessions & the session ledger

Routes that create, list, drive, delete and account for agent sessions on the compute pod. See [`./README.md`](./README.md) for the rest of the pod API surface, and [`../../chat/features.md`](../../chat/features.md) for the browser client that drives these routes.

All routes are registered on the pod's `Router` in `sdk/org/libs/cli/src/server/serve.ts:164-194`; first match wins, and the handlers live in `sdk/org/libs/cli/src/server/routes/sessions.ts` + `sdk/org/libs/cli/src/server/routes/session-ledger.ts`.

| Method | Path | Handler |
|---|---|---|
| `POST` | `/api/sessions` | `handleCreateSession` `sdk/org/libs/cli/src/server/serve.ts:164` |
| `GET` | `/api/sessions` | `handleListSessions` `sdk/org/libs/cli/src/server/serve.ts:165` |
| `GET` | `/api/session-ledger` | `handleListSessionLedger` `sdk/org/libs/cli/src/server/serve.ts:168` |
| `DELETE` | `/api/sessions/:id` | `handleDeleteSession` `sdk/org/libs/cli/src/server/serve.ts:193` |
| `*` | `/api/sessions/:id/*` | `handleSessionSubRoute` (catch-all → the agent API) `sdk/org/libs/cli/src/server/serve.ts:194` |
| `WS` | `/api/ws?sessionId=<id>` | `handleAgentWsUpgrade` `sdk/org/libs/cli/src/server/ws/agent.ts:121-149` |

> The pod server has no authentication of its own on these routes — none of the handlers in `routes/sessions.ts` or `router.ts` check a token. The pod is protected by its network position (one pod per user namespace, behind the gateway/Envoy). `sdk/org/libs/cli/src/server/router.ts:49-83`

---

## POST /api/sessions — create (or resume) a session

Body (all fields optional) `sdk/org/libs/cli/src/server/routes/sessions.ts:20-25`:

```jsonc
{
  "spaceDir": "/abs/path",          // legacy/bare mode
  "agentSlug": "thing",
  "spaceRef": "curation/curator",   // project-relative space[/agent]
  "model": "azure:DeepSeek-V4-Flash",
  "projectId": "user",
  "resumeSessionId": "<uuid>",      // resume a persisted session (project mode)
  "budget": { "maxEpisodes": 0, "maxToolCalls": 0, "maxForkDepth": 0, "maxWallClockMs": 0 }
}
```

Responses: `201 { sessionId }` on success `sdk/org/libs/cli/src/server/routes/sessions.ts:36`; `400 { error }` when `createSession` throws `sdk/org/libs/cli/src/server/routes/sessions.ts:37-39`; `503 { error }` with `Retry-After: 5` when the in-pod memory watchdog reports pressure — a new QuickJS VM is refused rather than risking an OOMKill `sdk/org/libs/cli/src/server/routes/sessions.ts:15-19`.

`createSession` is **synchronous and returns the id immediately**; the real session is built asynchronously and errors surface on the session's own renderHost (i.e. over the WS as an `error` event), not in the HTTP response `sdk/org/libs/cli/src/server/session-manager.ts:944-1002`.

### Three resolution paths

1. **Resume** (project mode + `resumeSessionId`) — validates the id, returns immediately if the session is already resident, else locates the snapshot dir (`<project>/spaces/<spaceId>/sessions/<id>` when `spaceRef` is given, else `<project>/sessions/<id>`) and throws `no saved session found: <id>` if `snapshot.json` is absent. A placeholder entry with `needsResume: true` is registered, and the snapshot + persisted trace are loaded asynchronously. `sdk/org/libs/cli/src/server/session-manager.ts:866-937`
2. **Project mode** (`lmthingRoot` set) — `projectId` defaults to `'user'`, `agentSlug` to `'thing'`; a `spaceRef` binds the session to `<project>/spaces/<space>` (and its `agent` segment overrides the slug) and selects the per-space snapshot dir. `sdk/org/libs/cli/src/server/session-manager.ts:954-1002`
3. **Legacy mode** (no `lmthingRoot`) — `spaceDir` from the body or the server's `defaultSpaceDir` (throws `no spaceDir provided and no defaultSpaceDir configured`), `agentSlug` defaults to `'default'`. `sdk/org/libs/cli/src/server/session-manager.ts:1005-1019`

Sessions created this way are marked `interactive: true`, which is what gates the consent prompter — headless runs deliberately leave it unset so consent-marked calls fail closed instead of hanging on an ask nobody will answer `sdk/org/libs/cli/src/server/session-manager.ts:166-169`, `sdk/org/libs/cli/src/server/session-manager.ts:1012-1018`.

### Capacity, eviction and reaping

`maxSessions` (default `8`, or `MAX_SESSIONS`) bounds resident VMs `sdk/org/libs/cli/src/server/session-manager.ts:278`. On overflow the manager does **not** refuse: `ensureCapacity` evicts the least-recently-active *non-running* session, persisting it first so it resumes transparently when reopened; only when every resident session is actively running does creation throw `max sessions reached (<n>) — all active sessions are busy` `sdk/org/libs/cli/src/server/session-manager.ts:784-817`, `sdk/org/libs/cli/src/server/session-manager.ts:939-943`. A reaper disposes sessions idle beyond `idleTtlMs` (default 15 min, `IDLE_TTL_MINUTES`) on a 60 s tick `sdk/org/libs/cli/src/server/session-manager.ts:280`, `sdk/org/libs/cli/src/server/session-manager.ts:2195-2208`.

---

## GET /api/sessions — list resident sessions

Returns `{ sessions: SessionMeta[] }` for the **in-memory** pool only (never the persisted history) `sdk/org/libs/cli/src/server/routes/sessions.ts:42-49`, `sdk/org/libs/cli/src/server/session-manager.ts:1239-1248`:

```ts
export interface SessionMeta {
  sessionId: string;
  spaceDir: string;
  agentSlug: string;
  lastActivity: number;
  started: boolean;
  status: SessionStatus;
}
```
`sdk/org/libs/cli/src/server/session-manager.ts:121-128`

This route doubles as the pod's readiness probe and as the browser's "pod edge is wired" check (any status other than an Envoy 503/504 means the pod is reachable) — see [`../../chat/features.md`](../../chat/features.md).

Persisted (non-resident) conversations are listed elsewhere: `GET /api/projects/:projectId/sessions` → `PersistedSessionMeta[]`, read from each `<sessions-dir>/<id>/meta.json`, newest-first by `lastActivity` `sdk/org/libs/cli/src/server/projects.ts:405-450`.

---

## DELETE /api/sessions/:id

`404 { error: 'unknown session "<id>"' }` when not resident; otherwise the session is persisted, its VM disposed, dropped from the pool, finalized in the ledger, and `200 { ok: true }` returned `sdk/org/libs/cli/src/server/routes/sessions.ts:51-62`, `sdk/org/libs/cli/src/server/session-manager.ts:1382-1394`.

---

## `* /api/sessions/:id/*` — the per-session agent API

The router's trailing `/*` captures the remainder as `params.rest` `sdk/org/libs/cli/src/server/router.ts:37-42`. `handleSessionSubRoute` 404s an unknown id, then rewrites the path to `/api/<rest>` and delegates to the single-session `handleAgentApi`, so every sub-route below is the *same* code the `--web` DevTools server serves `sdk/org/libs/cli/src/server/routes/sessions.ts:69-86`.

| Sub-route | Behaviour |
|---|---|
| `GET …/help` | The agent-facing quickstart text `sdk/org/libs/cli/src/web/agent-api.ts:185-207`, `:251-254` |
| `GET …/state` | `{ lastSeq, rootId, nodes, asks }` (JSON) or an ASCII execution tree `sdk/org/libs/cli/src/web/agent-api.ts:257-266` |
| `GET …/node/<nodeId>?tab=&limit=&offset=` | Node detail; `tab` = `llm\|statements\|yields\|variables\|raw` (default `statements`) `sdk/org/libs/cli/src/web/agent-api.ts:269-281` |
| `GET …/events?since=&type=&node=&limit=` | Incremental trace tail → `{ events, lastSeq }` (default limit 500) `sdk/org/libs/cli/src/web/agent-api.ts:284-300` |
| `GET …/asks` | Open `ask()` forms with descriptors `sdk/org/libs/cli/src/web/agent-api.ts:303-308` |
| `POST …/message` `{content}` | Sends a user message → `202 { ok:true }`; `400 { error:'missing content' }` if `content` isn't a string `sdk/org/libs/cli/src/web/agent-api.ts:311-318` |
| `POST …/ask/<askId>` `{value}` | Submit an open form → `200 { ok:true }` `sdk/org/libs/cli/src/web/agent-api.ts:321-329` |
| `DELETE …/ask/<askId>` | Cancel an open form `sdk/org/libs/cli/src/web/agent-api.ts:330-334` |
| `POST …/ui` (a `UiControlAction`) | Broadcast a UI-control action to connected browsers — the agent driving the human's UI `sdk/org/libs/cli/src/web/agent-api.ts:338-344` |

Every `GET` renders plain text by default; append `?format=json` for JSON `sdk/org/libs/cli/src/web/agent-api.ts:244-245`. An unknown sub-path 404s with `{ error: 'unknown API route <METHOD> <path>' }` `sdk/org/libs/cli/src/web/agent-api.ts:346`; a throw inside a handler becomes `500 { error }` `sdk/org/libs/cli/src/web/agent-api.ts:348-350`.

```bash
# drive a session entirely over HTTP (no browser)
SID=$(curl -s -XPOST localhost:8080/api/sessions -d '{"projectId":"user"}' \
        -H 'content-type: application/json' | jq -r .sessionId)
curl -s -XPOST "localhost:8080/api/sessions/$SID/message" \
     -H 'content-type: application/json' -d '{"content":"summarize my notes"}'
curl -s "localhost:8080/api/sessions/$SID/state"
curl -s "localhost:8080/api/sessions/$SID/events?since=0&format=json"
```
(The loop above is the one documented in the pod's own `HELP_TEXT` `sdk/org/libs/cli/src/web/agent-api.ts:199-204`.)

---

## Streaming — `WS /api/ws?sessionId=<id>`

The WS upgrade is matched in `serve.ts`'s `upgrade` handler, not the Router. `handleAgentWsUpgrade` destroys any socket whose pathname isn't `/api/ws`; **with no `sessionId` it registers a control socket** (terminal multiplexing, used by `/computer`); an unknown `sessionId` is refused with a raw `HTTP/1.1 404` `sdk/org/libs/cli/src/server/ws/agent.ts:121-149`.

On connect the server sends, in order: `hello` (protocolVersion, sessionId, spaceName, agentSlug), a full `trace_snapshot` (events + `lastSeq` + `truncatedBefore`), and `ask_pending` when forms are open `sdk/org/libs/cli/src/server/ws/agent.ts:68-80`. Each socket is attached to that session's own `TraceHub`, so live `trace` events fan out per-session and never cross sessions `sdk/org/libs/cli/src/server/ws/agent.ts:57-66`, `sdk/org/libs/cli/src/server/session-manager.ts:85-91`.

Client → server messages `sdk/org/libs/cli/src/server/ws/agent.ts:82-112`, typed in `sdk/org/libs/cli/src/rpc/events.ts:45-48`:

| Message | Effect |
|---|---|
| `{type:'sendMessage', content, attachments?}` | `manager.sendMessage(id, content, attachmentIds)`; async errors are pushed back as an `error` event `sdk/org/libs/cli/src/server/ws/agent.ts:87-92` |
| `{type:'submitForm', id, value}` | Resolve an open `ask()` `sdk/org/libs/cli/src/server/ws/agent.ts:93-95` |
| `{type:'cancelAsk', id}` | Cancel an open `ask()` `sdk/org/libs/cli/src/server/ws/agent.ts:96-99` |
| `{type:'subscribeTrace', sinceSeq?}` | Re-send a `trace_snapshot` from `sinceSeq` `sdk/org/libs/cli/src/server/ws/agent.ts:100-104` |

Server → client event union (`display`, `ask_start`, `ask_end`, `variables`, `error`, `done`, `hello`, `trace`, `trace_snapshot`, `ask_pending`, `ui_control`, …) is `ServerEvent` in `sdk/org/libs/cli/src/rpc/events.ts:12-30`.

### What `sendMessage` actually does

First message → `session.start()`; later messages → `session.continue()`; a resumed entry (`needsResume`) → `session.resume(snapshotDir, input)` `sdk/org/libs/cli/src/server/session-manager.ts:1344-1356`. The title is taken from the first user message (first 80 chars) unless the agent overrides it with `setSessionMeta()` `sdk/org/libs/cli/src/server/session-manager.ts:1328`, `sdk/org/libs/cli/src/server/session-manager.ts:312-318`. Attachment ids are re-read from disk server-side (only the id is trusted) and audio transcripts fold into the text `sdk/org/libs/cli/src/server/session-manager.ts:1294-1317`. The user message is written into the trace as a `user_message` event so it appears in the transcript `sdk/org/libs/cli/src/server/session-manager.ts:1339-1342`. On settle the entry flips to `idle`/`error`, emits `done`/`error`, and is persisted `sdk/org/libs/cli/src/server/session-manager.ts:1364-1378`.

Persistence writes three files under the session's snapshot dir — `snapshot.json` (history), `meta.json` (`PersistedSessionMeta`: title/slug/messageCount/status/totalCostUsd), `trace.json` `sdk/org/libs/cli/src/server/session-manager.ts:1198-1233`.

---

## GET /api/session-ledger — token & cost accounting

`{ sessions: SessionLedgerRecord[] }`, newest-first, capped at 200 `sdk/org/libs/cli/src/server/routes/session-ledger.ts:10-17`, `sdk/org/libs/cli/src/server/session-ledger.ts:243-247`. It backs the Sessions tab of the settings dialog.

The ledger is **pod-global**: it records chat sessions *and* headless runs (hook / code-node / webhook), plus every delegate each one made:

```ts
export interface SessionLedgerRecord {
  sessionId: string;
  source: string;              // 'chat' | 'hook:<slug>' | 'code-node' | 'headless'
  projectId?: string;
  title?: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'done' | 'error';
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  delegates: DelegateEntry[];  // target `pkg/agent#action`, query, tokens, costUsd, model, durationMs, status, depth
}
```
`sdk/org/libs/cli/src/server/session-ledger.ts:28-41`, `sdk/org/libs/cli/src/server/session-ledger.ts:8-23`

How it is fed: `trackTracer` subscribes to a session's `Tracer` — chat sessions with `source:'chat'` at wire-up `sdk/org/libs/cli/src/server/session-manager.ts:295-302`, headless runs with their `origin.source` before `start()` `sdk/org/libs/cli/src/server/session-manager.ts:1452-1457`. `ingest` then folds trace events into the record: `node_start` of kind `delegate` opens a `DelegateEntry`; `llm_response` adds tokens + `computeTurnCost(...)` to the session totals **and** to the nearest enclosing delegate (walking `parentId` up the node lineage, so a nested delegate keeps its own tokens); `node_end` settles a delegate; `session_meta` adopts the title `sdk/org/libs/cli/src/server/session-ledger.ts:154-227`.

Durability: append-only JSONL at `<lmthingRoot>/sessions-ledger.jsonl` (in-memory only when there is no `lmthingRoot`) `sdk/org/libs/cli/src/server/session-manager.ts:283-286`. On reload the latest line per `sessionId` wins and the map is trimmed to `MAX_RECORDS = 500` `sdk/org/libs/cli/src/server/session-ledger.ts:59`, `sdk/org/libs/cli/src/server/session-ledger.ts:83-110`. Flushes happen as each delegate completes, and at most every `FLUSH_THROTTLE_MS = 2000` on `turn_end` `sdk/org/libs/cli/src/server/session-ledger.ts:61`, `sdk/org/libs/cli/src/server/session-ledger.ts:194-212`. `finalize(id, status)` — called on delete, on eviction and at the end of a headless run — settles any still-running delegate and writes a final snapshot `sdk/org/libs/cli/src/server/session-ledger.ts:231-240`, `sdk/org/libs/cli/src/server/session-manager.ts:810`, `sdk/org/libs/cli/src/server/session-manager.ts:1392`, `sdk/org/libs/cli/src/server/session-manager.ts:1469-1473`.

---

## Headless runs — how they are kicked off

There is **no HTTP route that creates a headless session**. Headless runs are started in-process through two `SessionManager` methods, and are never registered in the resident pool — they don't count against `maxSessions`, are not persisted (except the threaded variant), get a throwaway `WebRenderHost` with no hub, and are torn down when the turn ends `sdk/org/libs/cli/src/server/session-manager.ts:1402-1407`.

### `runHeadless(opts)` — one-shot, ephemeral

`{ projectId?, spaceRef?, spaceDir?, agentSlug, message, budget?, traceFile?, origin? }` → `{ ok, result?, error?, sessionId }`, where `result` is the last `display(...)` descriptor, falling back to the last history message `sdk/org/libs/cli/src/server/session-manager.ts:1422-1482`. It uses the *same* project wiring as an interactive session (app db, typed `apiCall`, system + preload spaces) via `buildProjectSessionArgs` `sdk/org/libs/cli/src/server/session-manager.ts:1501-1509`, subscribes the ledger with `origin.source` (default `'headless'`), and always disposes the VM in a `finally` `sdk/org/libs/cli/src/server/session-manager.ts:1475-1481`.

Callers (all in-process, none of them a public route that names a session):

| Caller | Entry |
|---|---|
| A hook's declarative `trigger` / a hook handler's `ctx.delegate(...)` | `sdk/org/libs/cli/src/server/routes/hooks.ts:257-266`, `sdk/org/libs/cli/src/server/routes/hooks.ts:350` — reached over `POST /api/projects/:projectId/hooks/:slug/run` (see [`./hooks.md`](./hooks.md)) |
| An inbound webhook with **no** thread key | `sdk/org/libs/cli/src/server/routes/webhooks.ts:216` |
| An api handler's `spawn(ref, input)` (fire-and-forget; returns a `runId`) | `sdk/org/libs/cli/src/server/session-manager.ts:684-697` |
| A tasklist **code node**'s `ctx.delegate(...)` | `sdk/org/libs/cli/src/server/session-manager.ts:490-500` |
| An event hook dispatch | `sdk/org/libs/cli/src/server/event-dispatch.ts:151` |

### `runHeadlessThreaded(opts)` — persisted, multi-turn

`{ sessionId, projectId?, spaceRef?, agentSlug, message, budget? }`. Project-mode only. Bound to a **caller-supplied stable `sessionId`** so repeated inbound events on the same external thread continue ONE persisted session: if `snapshot.json` exists in the snapshot dir it `resume()`s, else it `start()`s, and either way the turn is saved back to the same dir `sdk/org/libs/cli/src/server/session-manager.ts:1609-1690`. Concurrent calls for the same `sessionId` are serialized through a per-id promise chain (`runExclusive`), so two near-simultaneous events can't race on the same snapshot file `sdk/org/libs/cli/src/server/session-manager.ts:1566-1586`.

Callers: an inbound webhook **with** a thread key (session id minted by the webhook-thread store) `sdk/org/libs/cli/src/server/routes/webhooks.ts:217-224`, an OpenClaw plugin route `sdk/org/libs/cli/src/server/openclaw-host.ts:114`, and threaded event dispatch `sdk/org/libs/cli/src/server/event-dispatch.ts:158`.

### From the CLI

`lmthing --request "<msg>"` is the terminal single-shot equivalent (THING agent, boots the project app, runs one turn, exits) — see [`../commands.md`](../commands.md).

---

## Cross-links

- [`./README.md`](./README.md) — the full pod REST route table.
- [`../../chat/features.md`](../../chat/features.md) — the chat client that consumes `POST /api/sessions`, `WS /api/ws`, and `GET /api/session-ledger`.
- [`./hooks.md`](./hooks.md) — `POST /api/projects/:projectId/hooks/:slug/run`, the authoritative HTTP entry point into a headless run.
- [`./webhooks.md`](./webhooks.md) — `POST /api/inbound/:path`, the public ingress that drives `runHeadless` / `runHeadlessThreaded`.
