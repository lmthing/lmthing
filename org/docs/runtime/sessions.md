# Sessions & persistence

A **session** is one conversation with a top-level agent: a live QuickJS VM plus
the message history and cross-turn state that drive it. Core owns the session
object and its lifecycle (`sdk/org/libs/core/src/session/session.ts`); the pod's
CLI server owns the *pool* of live sessions and their on-disk persistence
(`sdk/org/libs/cli/src/server/session-manager.ts`). This file is the single
source of truth for how a session is born, kept in memory, named, persisted,
resumed, and accounted for.

Related: the REST surface that drives sessions from the browser →
[../cli-api/rest/sessions.md](../cli-api/rest/sessions.md); the turn loop that
runs inside each turn → [turn-loop.md](turn-loop.md); the tracer that carries
every session event → [../runtime-globals/](../runtime-globals/README.md).

---

## 1. The `Session` object (core)

`class Session` (`session.ts:89`) is constructed with `SessionOpts` + `SessionDeps`
(`session/types.ts:21-115`) and holds all live per-conversation state as private
fields (`session.ts:90-153`):

| Field | What it is |
|---|---|
| `vm` | The QuickJS VM (`null` until `start`/`resume`) — `session.ts:92` |
| `history` | `MessageHistory` — the full turn transcript — `session.ts:93` |
| `space` | The loaded + system-merged `Space` — `session.ts:94` |
| `sessionId` | `randomUUID()` at construction; overwritten by a snapshot's id on resume — `session.ts:159`, `session.ts:423` |
| `pendingAttachments` | The CURRENT turn's image/file uploads, keyed by id, for id-based delegation — `session.ts:102` |
| `dynamicSpaces` | Spaces added at runtime via `registerSpace`/`installSpace` — a shared `Map` visible to later `delegate()` calls and forks — `session.ts:113` |
| `delegatePolicy` | The agent's evaluated `canDelegateTo` policy — `session.ts:120` |
| `appCapabilities` | The agent's `capabilities:` grants (project-app globals) — `session.ts:125` |
| `budget` | Host-enforced per-run `Budget`, reset each run — `session.ts:144` |
| `turnContext` | Accumulated typecheck scope carried ACROSS turns (see §3) — `session.ts:153` |
| `tracer` | The single event spine for this session — `session.ts:160` |

`SessionDeps` is just `{ streamFn }` — the provider-bound model stream
(`types.ts:113-115`). Core never imports a provider; the CLI wires `streamFn`.

### Lifecycle methods

- **`start(message)`** (`session.ts:232`) — loads the space + merges system
  spaces (`loadMergedSpace`, `session.ts:575`), preloads project spaces into
  `dynamicSpaces` (`session.ts:238-245`), resolves the agent (falling back to the
  first agent when the slug is `'default'`, `session.ts:248-258`), builds the
  system block + ambient DTS, creates the VM (`createSessionVM`, `session.ts:632`),
  appends the framed user message to history, emits a `session_start` trace event
  (`session.ts:301`), then runs the turn loop. Resets `turnContext` to `''` — a
  fresh program (`session.ts:305`).
- **`continue(message)`** (`session.ts:187`) — requires an already-started
  session (`session.ts:188-190`); appends the user message, runs
  `maybeSummarizeHistory` (§4), resets `budget`, and re-runs the turn loop on the
  **existing VM + scope**. `turnContext` is preserved so a variable bound in an
  earlier turn still typechecks.
- **`resume(snapshotDir, message)`** (`session.ts:415`) — see §6.
- **`dispose()`** (`session.ts:516`) — tears down the VM (`vm.dispose()`); safe to
  call more than once.

`buildSystemPrompt()` (`session.ts:387`) builds the system block + ambient DTS
*without* a VM or model call (used by the CLI's `--dump-system-prompt`); it never
starts a session.

### The `defaultAction` fast path

When the resolved agent declares a `defaultAction` whose action carries a
tasklist (and `noDefaultAction` is not set), `start()` bypasses the model-driven
turn loop and runs that action via the host delegate path
(`session.ts:315-350`) — a deterministic first turn for weaker models. This path
is exempt from the model-facing `canDelegateTo` gate (it is host policy). A build
action that returns `{spaceKey, agentSlug}` coordinates is chained to a second
delegate so the final answer shows (`session.ts:340-342`).

---

## 2. Message history

`MessageHistory` (`context/history.ts:13`) is an ordered array of `Message`
(`history.ts:5-11`):

```ts
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  attachments?: MediaPart[];      // multimodal image/file parts
  blockType?: 'normal' | 'variables' | 'error' | 'system';
}
```

Every turn appends messages: the user turn (`role:'user'`, `blockType:'normal'`),
the model's statements, `VARIABLES` blocks with resolved yield values
(`blockType:'variables'`), and errors (`blockType:'error'`). `getHistory()`
(`session.ts:172`) returns `history.messages` — this is exactly what gets
persisted (§5). A user turn's text is *framed* (`User request:\n\n…`) on
`start`/`continue`, but NOT on `resume` (`ingestUserTurn`, `session.ts:178-185`;
`frame:false` at `session.ts:454`). Attachments are recorded into
`pendingAttachments` and summarized into an id-anchored note appended to the text
— the raw bytes never go on a text agent's message (`session.ts:71-81`).

---

## 3. Cross-turn state: what survives between turns

Two distinct kinds of state carry across `continue()`/`resume()`:

1. **VM variables** — every statement a turn binds stays live in the QuickJS VM
   (variables are re-exposed via `globalThis['x'] = x` after each statement, see
   [turn-loop.md](turn-loop.md)). `continue()` re-runs on the same VM so these
   persist for free.
2. **Typecheck scope** (`turnContext`, `session.ts:145-153`) — the VM keeps the
   variables, but each `runTurnLoop` starts with an empty *typecheck* scope. Without
   `turnContext`, a `continue()` turn referencing an earlier variable would fail
   `tsc` with "Cannot find name". It is seeded as `initialContext` and updated via
   `onContextSnapshot` (`session.ts:219-220`), reset to `''` by `start()` only.

`dynamicSpaces` (registered/installed spaces) and `budget` are also session-scoped
— `budget` is reset per run, `dynamicSpaces` accumulate.

---

## 4. History summarization

`maybeSummarizeHistory()` (`session.ts:528`) runs at the top of every
`continue()`. When `maxHistoryTurns` is set (the CLI's default builder uses `20`,
`session-manager.ts:437`) AND `history.messages.length > maxHistoryTurns * 2`, it
collapses old turns into one `[CONTEXT SUMMARY]` message and keeps the last **6**
verbatim (`summarizeHistory` → `history.summarize(summary, 6)`,
`session.ts:531-533`; `history.ts:31-42`).

`summarizeHistory` (`context/summarize.ts:16`) uses an LLM only if a `streamFn`
is passed; the session calls it **without one** (`session.ts:531`), so it takes
the **deterministic digest** branch (`summarize.ts:44-66`): it preserves the
original task line, resolved `VARIABLES` values, and first-line errors — no extra
model call.

---

## 5. Persistence: snapshot, meta, trace

### The core snapshot format

`Snapshot` (`session/snapshot.ts:5-12`) is written to `<dir>/snapshot.json` by
`saveSnapshot(dir, snapshot)` and read back by `loadSnapshot(dir)`
(`snapshot.ts:14-28`):

```ts
export interface Snapshot {
  sessionId: string;
  agentSlug: string;
  spaceDir: string;
  history: Message[];
  scope: Record<string, unknown>;   // JSON-serializable VM scope vars
  createdAt: number;
}
```

> **The server persists an EMPTY `scope`.** Although `Snapshot` carries a
> `scope` field intended for VM variables, the pod's `persistSession` writes
> `scope: {}` (`session-manager.ts:1252`), as does `runHeadlessThreaded`
> (`session-manager.ts:1726`). A server-side resume therefore rehydrates the
> **message history only**: the VM starts fresh with empty `seedVars`, so VM
> variables are **not** restored on resume for the pod path. (Core's `resume()`
> *does* pass `snapshot.scope` as `seedVars` to the new VM —
> `session.ts:479-484` — but the server never fills it.)

### On-disk layout (pod / project mode)

`persistSession` (`session-manager.ts:1243`) writes three files into the session's
snapshot dir (best-effort; a failure never disturbs the run):

| File | Written from | Contents |
|---|---|---|
| `snapshot.json` | `saveSnapshot` (`session-manager.ts:1247`) | The `Snapshot` — history + empty scope |
| `meta.json` | `session-manager.ts:1271` | `PersistedSessionMeta` (§7) — title, slug, cost, counts |
| `trace.json` | `session-manager.ts:1274` | The session hub's trace events (`entry.hub.snapshot().events`) — replayed to seed the UI on resume |

The **snapshot dir** depends on whether the session is bound to a project space:

- **Plain project session** → `<root>/<projectId>/sessions/<sessionId>/`
  (`sessionsDir`, `projects.ts:424-426`).
- **Space-bound session** (created with a `spaceRef`) →
  `<root>/<projectId>/spaces/<spaceId>/sessions/<sessionId>/`
  (`spaceSessionsDir`, `projects.ts:455-457`).

`<root>` is the pod's `lmthingRoot` (`<cwd>/.lmthing`). `snapshotDir` is fixed on
the `SessionEntry` at creation (`session-manager.ts:1013-1016`, `936` for resume).
Persistence only happens in project mode — `persistSession` early-returns unless
`lmthingRoot`, `projectId`, `session`, and `snapshotDir` are all set
(`session-manager.ts:1244`).

> Note: `SessionManager.snapshotsDir` (default `/data/snapshots`,
> `session-manager.ts:279`) is a vestigial field. It is assigned from
> `--snapshots-dir` / `SNAPSHOTS_DIR` but is not read by the active
> project-mode persistence path, which derives dirs from `lmthingRoot` + the
> project/space tree.

### When persistence fires

`persistSession` is called after each turn completes or errors
(`session-manager.ts:1415`, `1422`), when the agent sets session meta
(`session-manager.ts:317`), on eviction (`session-manager.ts:858`), and on
explicit `disposeSession` (`session-manager.ts:1430`).

---

## 6. Resume

Two independent resume paths exist:

**Core `Session.resume(snapshotDir, message)`** (`session.ts:415`) —
`loadSnapshot(snapshotDir)`, restore `sessionId` + the space + agent, rebuild the
history message-by-message (`session.ts:443-446`), append the new (unframed) user
message, rebuild the system block/DTS/functions, create a fresh VM seeded with
`snapshot.scope` (empty in practice — see above), then run the turn
loop. Throws if no snapshot or the agent is missing (`session.ts:417-419`,
`438-440`).

**Server resume (chat)** — `createSession({ resumeSessionId, … })`
(`session-manager.ts:911-982`) validates the id, returns the live entry if already
resident, resolves the snapshot dir, and (if `snapshot.json` exists) registers a
**placeholder entry with `needsResume:true`** (`session-manager.ts:952-970`).
`_initResumedSession` (`session-manager.ts:1154`) then loads `meta.json` to restore
title/slug/createdAt/messageCount/cost (`session-manager.ts:1176-1187`), builds the
session, and seeds the entry's hub from `trace.json` so a reconnecting client sees
the prior conversation immediately (`session-manager.ts:1222-1231`). The first
`sendMessage` calls `session.resume()` instead of `start()`/`continue()` because
`needsResume` is set (`session-manager.ts:1390-1401`); the flag is cleared after.

Persisted sessions are listed via `listProjectSessions` / `listSpaceSessions`
(`projects.ts:432`, `464`) — both scan the sessions dir, read each `meta.json`,
skip corrupt entries, and sort by `lastActivity` desc. The manager wraps these at
`session-manager.ts:1996` / `2046`.

---

## 7. Session meta (naming a session)

A session's display name has two sources:

1. **Auto** — the first user message's first 80 chars become the title on the
   first `sendMessage` (`session-manager.ts:1373`).
2. **Agent-chosen** — the agent calls the top-level-only global
   `setSessionMeta({ title, slug })` (`globals/set-session-meta.ts:25`). Like
   `ask`, it is NOT injected into forks/delegates. It is **fire-and-forget** — a
   synchronous host hook that does NOT end the turn (it was turn-ending before), so
   the agent names the session inline alongside its work
   (`globals/set-session-meta.ts#createSetSessionMetaGlobal`). The hook is
   `recordSessionMeta` (`session.ts#Session.recordSessionMeta`): it slugifies the
   slug (lowercase, non-alphanumerics → `-`, capped 60 chars) and title (trimmed,
   capped 120), sets `sessionNamed`, and emits a `session_meta` trace event
   **instead of persisting directly** — core stays persistence-free
   (`session.ts:876-889`).

   Because the agent so often answered without naming, a **soft naming nudge** runs
   as a `beforeTurn` reminder provider: `namingNudge` re-surfaces a prompt to call
   `setSessionMeta` once the session still isn't named after two conversational
   turns — `turnNo` is incremented once per `start`/`continue`/`resume`, not per
   episode (`session.ts#Session.namingNudge`), and `sessionNamed`/`turnNo` reset in
   `start()` (`session.ts:338-339`). See the reminder registry in
   [turn-loop.md](./turn-loop.md).

> **Not everything on the tracer is persisted.** The sibling `activity` trace event
> — the agent's live "currently doing" status from `setActivity` — is deliberately
> **ephemeral**: it is in `FILE_EXCLUDED` alongside `llm_progress`, so the `Tracer`
> never writes it to the trace file, and nothing ingests or persists it
> (`sdk/org/libs/core/src/sandbox/trace.ts#FILE_EXCLUDED`). It exists only to stream
> the status to the client for the duration of the turn →
> [../runtime-globals/session-and-utils.md](../runtime-globals/session-and-utils.md).

The server ingests that trace event: `wireTracer` (`session-manager.ts:314-318`)
adopts `title`/`slug` onto the `SessionEntry` and calls `persistSession`. The
persisted shape is `PersistedSessionMeta` (`projects.ts:405-421`):

```ts
export interface PersistedSessionMeta {
  sessionId: string;
  projectId: string;
  agentSlug: string;
  spaceDir: string;
  spaceId?: string;           // set for space-bound sessions
  title: string;
  slug?: string;              // agent-set, URL-safe
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  status: string;
  totalCostUsd?: number;
}
```

---

## 8. The live session pool (`SessionManager`)

`SessionManager` (`session-manager.ts:235`) owns a `Map<sessionId, SessionEntry>`
of resident sessions, each a live QuickJS VM with its OWN `WebRenderHost` +
`TraceHub` so display/ask/trace events never cross sessions
(`SessionEntry`, `session-manager.ts:87-118`).

- **Capacity** — `maxSessions` (default `8` or `MAX_SESSIONS`,
  `session-manager.ts:278`). `ensureCapacity` (`session-manager.ts:829`) evicts the
  least-recently-active **non-running** session before admitting a new/resumed one.
- **Eviction is persist-first** — `evictOneIdle` (`session-manager.ts:843`) removes
  the entry from the map synchronously (freeing the slot), then persists +
  disposes in the background, so an evicted chat resumes transparently when
  reopened. A running turn is never evicted. The in-pod memory watchdog reuses this
  to shed idle sessions under pressure.
- **Idle TTL** — `idleTtlMs` (default 15 min, `session-manager.ts:280`) backs the
  reaper.

`sendMessage(id, content, attachmentIds?)` (`session-manager.ts:1367`) is the
single entry point: sets the title from the first message, increments
`messageCount`, assembles attachments, writes a `user_message` trace event, then
dispatches to `resume()` (if `needsResume`), `continue()` (if started), or
`start()` (`session-manager.ts:1389-1401`), and persists on completion/error.

### Headless (unregistered) sessions

- `runHeadless` (`session-manager.ts:1467`) runs one turn and tears the VM down.
  The session is **ephemeral** — never in `this.sessions`, never persisted, no hub;
  used by hooks / code-node / api `spawn`.
- `runHeadlessThreaded` (`session-manager.ts:1654`) is bound to a **stable**
  caller-supplied `sessionId` (e.g. a webhook thread) so repeated inbound events
  continue ONE persisted multi-turn session. It resolves the same snapshot dirs as
  the resume path, `resume()`s if a snapshot exists else `start()`s, and
  `saveSnapshot`s back afterward (`session-manager.ts:1721-1728`). Concurrent calls
  for the same id are serialized via `runExclusive` (`session-manager.ts:1619`) so
  they can't race on the snapshot file.

---

## 9. The session ledger

`SessionLedger` (`session-ledger.ts:69`) is a **pod-global** append-only record of
every session (chat + hook/code-node headless) and the delegates each made, with
token/cost accounting at both levels. It is distinct from the per-session
snapshot/meta files above.

- **Records** — `SessionLedgerRecord` (`session-ledger.ts:28-41`): `sessionId`,
  `source` (`chat` / `hook:<slug>` / `code-node` / `headless`), `projectId`,
  `title`, timestamps, `status`, session token totals, and `delegates[]`. Each
  `DelegateEntry` (`session-ledger.ts:8-23`) carries the target (`pkg/agent#action`),
  a truncated `query` preview, its own token/cost/duration/status, and delegation
  `depth`.
- **Fed from the tracer** — `trackTracer` (`session-ledger.ts:131`) subscribes to a
  session's `Tracer`. `ingest` (`session-ledger.ts:154`) reacts to trace events:
  `node_start` (kind `delegate`) opens a delegate entry; `llm_response` adds
  `inputTokens`/`outputTokens`/cost to the session total AND the nearest enclosing
  delegate (`nearestDelegate` walks the node lineage, `session-ledger.ts:217`);
  `node_end` finalizes a delegate + flushes; `session_meta` sets the title;
  `turn_end` throttle-flushes (min 2 s apart, `session-ledger.ts:207-211`). Costs
  come from `computeTurnCost` against `prices/azure.json`.
- **Persistence** — JSONL at `<lmthingRoot>/sessions-ledger.jsonl` (in-memory only
  when no `lmthingRoot`, `session-manager.ts:283-286`). Append-only; on load the
  latest snapshot per `sessionId` wins and the newest `MAX_RECORDS = 500` are kept
  (`session-ledger.ts:59`, `83-101`). `finalize` (`session-ledger.ts:231`) marks a
  session done/error, settles any still-running delegate, and flushes on teardown.
- **Read** — `list(limit=200)` newest-first (`session-ledger.ts:243`), surfaced by
  `GET /api/session-ledger` (`routes/session-ledger.ts`) for the settings Sessions
  tab.

The `SessionManager` wires the ledger for interactive sessions in `wireTracer`
(`source:'chat'`, `session-manager.ts:298-302`) and for headless runs in
`runHeadless` (`source: origin?.source ?? 'headless'`, `session-manager.ts:1498`).

---

## 10. Where each piece of state lives — summary

| State | In memory | On disk |
|---|---|---|
| Message history | `Session.history` | `snapshot.json` → `history[]` |
| VM variables | QuickJS VM (live) | **not persisted** (`scope: {}`) |
| Typecheck scope (`turnContext`) | `Session.turnContext` | not persisted (rebuilt from history) |
| Title / slug / counts / cost | `SessionEntry` | `meta.json` (`PersistedSessionMeta`) |
| Trace events (UI replay) | `TraceHub` per entry | `trace.json` |
| Registered/installed spaces | `Session.dynamicSpaces` | not persisted (re-preloaded on resume from `<project>/spaces/`, `session.ts:427-434`) |
| Token/cost accounting | `SessionLedger` (pod-global) | `sessions-ledger.jsonl` |
