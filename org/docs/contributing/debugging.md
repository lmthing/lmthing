# Debugging the eval loop and a running pod

Everything the runtime does is observable through **one event spine** — the `Tracer`
(`sdk/org/libs/core/src/sandbox/trace.ts:104-191`), which writes NDJSON to a file **and** fans out to
in-process subscribers (`trace.ts:104-135`). Every debugging tool below is a different reader of that
same spine: the terminal log, the `--trace` file, the HTTP agent API, the browser DevPanel, and the
scenario harness.

Start by picking the loop that matches what you're debugging — the tools differ, the spine doesn't.

| What broke | Run it like this | Read it with |
|---|---|---|
| A statement the model wrote (typecheck / eval / yield) | `node libs/cli/dist/cli/bin.js --space <spaceDir> "…"` (`bin.ts:602`) | the terminal log (§1), `--trace` + jq (§2) |
| A fork/delegate/tasklist deep in a tree | `lmthing serve --port 8080` + `POST /api/sessions` | the HTTP agent API (§3) |
| Anything a human should look at | the pod's `/chat` SPA | the DevPanel (§4) |
| A regression you must reproduce deterministically | `--mock <file>` (`args.ts:164-169`) | §5 |
| A whole product flow against prod | `sdk/org/scenarios/**` | §8 |
| A live user pod | `kubectl -n user-<id> logs deploy/lmthing` | §9 |

Related: [turn loop](../runtime/turn-loop.md) · [typecheck](../runtime/typecheck.md) ·
[fork & tasklists](../runtime/fork-and-tasklists.md) · [sessions](../runtime/sessions.md) ·
[pod REST API](../cli-api/rest/README.md) · [testing](./testing.md)

---

## 1. Reading the log

`runTurnLoop` narrates every step through `renderHost.log()`
(`sdk/org/libs/core/src/eval/turn-loop.ts`). In the CLI that host is `InkRenderHost`, whose `log()` is
a plain `process.stdout.write` (`sdk/org/libs/cli/src/render/ink-renderer.tsx#InkRenderHost.log`) — so the log
is identical with or without `--claude`; the flag only switches `ask()` from an interactive Ink form
to direct stdin reads (`ink-renderer.tsx:272-275`, `bin.ts:464`).

A healthy turn:

```
[turn 0] streaming...                                        ← turn-loop.ts:424
[stmt] const dish = await ask(<ConfirmDish dish="pasta" />); ← turn-loop.ts:463 (split + typechecked + evaled)
[model response]
const dish = await ask(<ConfirmDish dish="pasta" />);        ← turn-loop.ts:566 (what went into history)
[/model response]
> yes
[variables] dish                                             ← turn-loop.ts:711 (yield resolved, VARIABLES appended)
[turn 0] streaming...                                        ← attempt reset to 0, new turn
[turn 0] done                                                ← turn-loop.ts:763
```

Every line you can see, and what it means:

| Line | Emitted at | Means |
|---|---|---|
| `[turn N] streaming...` | `turn-loop.ts:424` | request issued; `N` is the retry `attempt` (cap `maxRetries`, default **3** — `turn-loop.ts:302`) |
| `[stmt] <code>` | `turn-loop.ts:463` | a complete top-level statement was detected and is about to be typechecked + evaled |
| `[stmt] (dropped prose) …` | `turn-loop.ts:458` | the model narrated instead of coding; the line is dropped, **not** retried (it would be a guaranteed typecheck error) |
| `[model response] … [/model response]` | `turn-loop.ts:566` | the parsed statements appended to history (incomplete trailing stream text is excluded) |
| `[error] <msg>` | `turn-loop.ts:592` | typecheck or eval failure → an `ERROR (attempt n of m)` block is fed back and the turn retries (`error-rewind.ts:45-63`) |
| `[yield error] <msg>` | `turn-loop.ts:664` | the *host* side of a yield threw; surfaced to the model, retryable |
| `[variables] a, b` / `[inspect] N value(s)` / `[resumed]` | `turn-loop.ts:711-715` | the yield resolved; a VARIABLES continuation is being sent |
| `[warn] failed to inject function "X": …` | `session.ts:661` | a space/project function failed to transpile or eval — the message is the real error |
| `[turn N] stream idle >60000ms — …` | `turn-loop.ts:442` | the per-stream idle watchdog fired (`streamIdleMs`, default 60s); treated as transient, retried |
| `[process.exit] intentional termination` | `turn-loop.ts:583` | the model called `process.exit()`; a clean stop, never retried |
| `[turn N] ended on a non-yielding binding — nudging…` | `turn-loop.ts:756` | the model bound a value and stopped; the loop nudges it to continue |

The `[error]` block the model actually sees is built by `buildErrorBlock`
(`error-rewind.ts:45-70`) and includes a **sandbox hint** when the message reaches for a Node/Bun API
that doesn't exist in QuickJS (`sandboxApiHint`, `error-rewind.ts:9-43`) — e.g. `child_process` →
"use the host global `execShell(cmd)`". If you see the model burn retries on `require(...)`, the hint
table is where to add a redirect.

---

## 2. The `--trace` file (NDJSON + jq)

`--trace <file>` (`sdk/org/libs/cli/src/cli/args.ts:115-120`) constructs the `Tracer` with a path;
every event is appended as one JSON line (`trace.ts:108-118`). The event union is exhaustive —
`session_start`, `llm_request`, `llm_response`, `statement`, `typecheck_error`, `eval_error`, `yield`,
`yield_resolved`, `turn_end`, `node_start`/`node_update`/`node_end`, `fork_queue`, `display`,
`variables`, `llm_progress`, `user_message`, `session_meta` (`trace.ts:56-86`). Each scope
(session → run → fork → delegate → tasklist → task) mints a `nodeId`/`parentId` via
`tracer.child()`/`end()` (`trace.ts:143-190`), and the flat `context` label is preserved verbatim so
older jq recipes still work (`trace.ts:9-18`).

```bash
node libs/cli/dist/cli/bin.js --space <spaceDir> --claude \
  --trace /tmp/run.jsonl "make pasta"

jq -r '.type' /tmp/run.jsonl | sort | uniq -c                              # event histogram
jq -c 'select(.type=="node_end" and .status=="error") | {nodeId, error}' /tmp/run.jsonl
jq -c 'select(.type=="typecheck_error") | {statement, message, attempt}' /tmp/run.jsonl
jq -rc 'select(.type=="llm_response" and (.context|test("fork:"))) | {attempt, text: .text[0:200]}' /tmp/run.jsonl
```

Two gotchas, both in the code:

- **`llm_progress` is never in the file.** It is subscriber-only — `FILE_EXCLUDED`
  (`trace.ts:90`, filtered at `:111`). Don't grep for it.
- **`lmthing serve` writes no trace file.** The serve branch constructs the `SessionManager` without
  `traceFile` (`bin.ts:357-363`), and `POST /api/sessions` has no `traceFile` field in its body
  (`server/routes/sessions.ts:20-24`). On a server/pod the trace lives **in memory** in a `TraceHub`
  ring (20 000 events, structural events retained under compaction —
  `sdk/org/libs/cli/src/rpc/trace-hub.ts#TraceHub`, `:9-16`) and you read it over HTTP (§3).

`buildTraceTree(events)` (`sdk/org/libs/core/src/sandbox/trace-tree.ts`, exported from `@lmthing/core`)
rebuilds the whole node tree from a parsed array — it is what both the HTTP API and the browser use.

---

## 3. The DevTools HTTP API (no browser)

The API is `handleAgentApi` (`sdk/org/libs/cli/src/web/agent-api.ts#handleAgentApi`), a plain-text-by-default
HTTP surface over the `TraceHub`. It is **self-describing**: `GET /api/help` prints the whole thing
(`agent-api.ts:185-207`). Full agent-facing quickstart: `sdk/org/libs/cli/src/web/AGENT.md`.

| Route | Handler | What you get |
|---|---|---|
| `GET /api/state` | `agent-api.ts:257-266` | one-screen ASCII execution tree + pending asks + `lastSeq` (`renderState`, `:74-112`) |
| `GET /api/node/<id>?tab=llm\|statements\|yields\|variables\|raw` | `:269-281` | node detail (`renderNodeDetail`, `:115-183`); `&limit`/`&offset` |
| `GET /api/events?since=<seq>` | `:284-300` | incremental tail; `&type=csv`, `&node=<id>`, `&limit=N` |
| `GET /api/asks` | `:303-308` | open ask forms with descriptors |
| `POST /api/message` `{"content":"…"}` | `:311-318` | send a user message (first → `start`, then `continue`) |
| `POST /api/ask/<id>` `{"value":…}` · `DELETE /api/ask/<id>` | `:321-335` | answer / cancel an open form |
| `POST /api/ui` `{"select":"<id>","tab":"llm"}` | `:338-344` | drive a human's open browser |

Add `?format=json` to any GET for JSON (`agent-api.ts:244-245`).

`/api/state` renders one line per node — `glyph id [kind] label duration retries`:

```
⟳ session_1_… [session] session  [q:0/4]
  ✓ run_2_…     [run] session  8.9s
    ✓ fork_3_…  [fork] fork:general  528ms
    ✗ fork_4_…  [fork] fork:general  402ms  ×2     ← ×N = N statements failed typecheck/eval
```

Glyphs: `○` queued · `⟳` running · `✓` done · `✗` error · `⊘` skipped (`STATUS_GLYPH`,
`agent-api.ts:50-56`). The `×N` retry tag counts statements with errors — the direct "the model's code
failed" signal (`retryCount`, `agent-api.ts:67-71`). The queue tag `[q:active/max]` comes from
`fork_queue` events.

### Where the API actually lives: `lmthing serve`

In server mode every route above is mounted **per session** under `/api/sessions/:id/*`:
`handleSessionSubRoute` rewrites the path to `/api<rest>` and reuses the exact same handlers
(`sdk/org/libs/cli/src/server/routes/sessions.ts#handleSessionSubRoute`; registered at
`sdk/org/libs/cli/src/server/serve.ts:194`). The pod's own HTTP server has no auth (Envoy does JWT at
the edge in prod), so locally this is just curl:

```bash
node libs/cli/dist/cli/bin.js serve --port 8080          # bin.ts:334-374
SID=$(curl -s -X POST localhost:8080/api/sessions -H 'content-type: application/json' \
        -d '{"projectId":"user"}' | jq -r .sessionId)     # routes/sessions.ts:7-38
curl -s -X POST localhost:8080/api/sessions/$SID/message -H 'content-type: application/json' \
        -d '{"content":"build me a blog"}'
curl -s localhost:8080/api/sessions/$SID/state                       # ASCII tree
curl -s "localhost:8080/api/sessions/$SID/node/fork_4_ab12?tab=llm"  # why that fork failed
curl -s "localhost:8080/api/sessions/$SID/events?since=120"          # incremental tail
curl -s localhost:8080/api/sessions/$SID/asks                        # blocked on a form?
```

This is the fastest way to answer *"why did that fork fail?"* — `tab=statements` shows the exact code
it emitted (and the `phase` of each error), `tab=llm` shows the raw model text per `attempt`.

> **`--web <port>` is dead — use `lmthing serve` instead.** The single-session `--web` launcher
> throws before the server ever listens. `startWebServer` bundles the browser app first
> (`sdk/org/libs/cli/src/web/serve.ts#startWebServer`), and that bundle goes through `resolveUiAssets`
> (`serve.ts:29`, called at `:78`), which resolves `@lmthing/ui/package.json` (`serve.ts:37`) — a
> subpath the `@lmthing/ui` `exports` map does not expose (`sdk/org/libs/ui/package.json:8-18`), so
> Node raises `ERR_PACKAGE_PATH_NOT_EXPORTED`. Even past that, the bundle entry
> `<uiRoot>/src/chat/app/main.tsx` (`serve.ts:39`) no longer exists — it was deleted in `283b31d`
> ("remove dead chat-app code"). The **handlers are fine** (`agent-api.ts` is shared and is what the
> pod serves); only the launcher is dead.

---

## 4. The browser DevPanel

The `/chat` SPA ships the same tree + inspector as a resizable panel (`DevPanel`,
`sdk/org/libs/ui/src/chat/app/DevPanel.tsx:29-90`): execution tree on top (`tree.tsx`), tab inspector
below (`inspector.tsx`), playback bar in replay mode.

- **Open it**: `?inspect=1` on load (`AppShell.tsx:41-44`), or click any node chip in the transcript /
  activity strip (`Message.tsx:99-104`, `ActivityStrip.tsx:14-28`).
- **Deep-link a view**: `?node=<nodeId>&tab=<tab>&follow=0` — read on load and written back on every
  selection change (`url-state.ts:6-31`), so a URL reproduces the exact inspector state. `POST /api/ui`
  drives it remotely (`agent-api.ts:338-344`).
- **Replay a trace**: replay is driven by a **file picker**, not a URL. The "📂 Load trace" control in
  the chat view parses an NDJSON `--trace` file (both `{seq,event}` and bare-event lines) into the
  store (`ChatView.tsx:200` → `replay.tsx:5-41`), and `PlaybackBar` scrubs it (`replay.tsx:43-…`,
  mounted at `DevPanel.tsx:81-86`). **No component reads a `?trace=` query param** — the only
  trace-param support is server-side, in the dead `--web` launcher, which serves the file at
  `/trace.jsonl` (`sdk/org/libs/cli/src/web/serve.ts:191-201`).
- **Automatable DOM**: tree rows carry `data-node-id` (`tree.tsx:35`), tabs carry
  `data-testid="inspector-tab-<name>"` (`common.tsx:74`), and the panel is landmarked
  `aside[aria-label="developer tools"]` (`DevPanel.tsx:35-36`).

---

## 5. Reproducing without a model (`--mock`, `--dump-system-prompt`)

**`--mock <file>` / `LM_MOCK=<file>`** skips `resolveModel`/`createStream` entirely — no API key, fully
deterministic (`bin.ts:301-307`, `args.ts:164-169`). The module's default export is either a
`string[]` (one entry per turn, via `mockScript` —
`sdk/org/libs/core/src/testing/mock-provider.ts#mockScript`) or a `MockHandler`
`(opts, ctx) => string | string[] | AsyncIterable<string>` (`mock-provider.ts:31-34`, wired by
`createMockStreamFn`, `:45-78`); anything else throws a clear error (`bin.ts:193-199`).

```js
// /tmp/repro.mjs — turn 0 yields, turn 1 finishes. Reproduces a yield-binding bug with zero tokens.
export default [
  'const dish = await ask(<ConfirmDish dish="pasta" />);',
  'display(<Text>cooking {dish}</Text>);',
];
```

```bash
node libs/cli/dist/cli/bin.js --space <spaceDir> --claude \
  --mock /tmp/repro.mjs --trace /tmp/run.jsonl "make pasta"
```

**`--dump-system-prompt <file>`** writes the exact resolved system prompt (+ ambient DTS) and exits,
without running the model (`bin.ts:256-277`, `args.ts:176-181`). This is the tool for "the agent
doesn't know about my new global/function/component" — if it isn't in the dump, the DTS or the space
merge is the bug, not the model.

---

## 6. Failure playbook (eval / yield pipeline)

Symptoms, in the order they actually bite:

**`X is not defined` on a variable from an earlier statement.** Each statement is its own module eval,
so bindings are propagated by appending `globalThis['x'] = x` after the statement — driven by
`extractBindingNames` (`sdk/org/libs/core/src/context/variables.ts#extractBindingNames`). A binding form that
`extractBindingNames` doesn't recognize (an exotic destructuring pattern) is the usual culprit; extend
it there.

**`X is not defined` on a *yield-resolved* variable in the next turn.** Yield-result binding is
host-side, not the QuickJS post-`await` continuation: the loop extracts the binding pattern
(`extractBindingPattern`, `variables.ts:56`), calls `vm.setVar(...)`, appends the yielding statement to
the accumulated typecheck context, and resets `attempt = 0` before continuing
(`turn-loop.ts:596-763`). If the variable vanishes across turns, the accumulated context is being
rebuilt instead of preserved.

**`unexpected token '<'` in the VM.** The statement reached QuickJS as raw JSX. `transpileStatement`
(`sdk/org/libs/core/src/typecheck/transpile.ts`) must run before `vm.evalStatement`.

**`React is not defined` / `ComponentName is not defined`.** The React shim and the per-component stubs
are injected at **VM bootstrap** — `createVM` sets `globalThis.React = { createElement, Fragment }` and
one `{ displayName }` stub per catalog/space component (`sdk/org/libs/core/src/exec/bootstrap.ts:206-240`).
(The standalone `JSX_RUNTIME_CODE` string, `sandbox/jsx-runtime.ts:6-16`, is the exported source of the
same shim.) If a space component is missing, check `componentNames` reaching bootstrap
(`session.ts:635-654`, `delegate.ts:205`, forks pass `[]` — `fork.ts:295`).

**A space function isn't callable.** Look for `[warn] failed to inject function "X": …`
(`session.ts:655-662`) — the message is the transpile/eval error. Then check the function is listed in
the agent's `functions:` frontmatter and that `functions/<name>.ts` exports that exact name
([format/space](../format/space/README.md)).

**Typecheck error on a component's props.** The DTS overlay extracts `interface Props` from the
component source, renames it `<ComponentName>Props`, and makes function-typed members optional
(`sdk/org/libs/core/src/typecheck/overlay.ts:19-51`). A component declared with `type Props = …`
instead of `interface Props` produces no declaration — every prop then looks wrong.

**A hard cap, not a bug.** `BudgetExceededError` (`sdk/org/libs/core/src/eval/budget.ts#BudgetExceededError`) is
thrown by `Budget` on `maxEpisodes`/`maxToolCalls`/`maxForkDepth`/`maxWallClockMs`
(`budget.ts:74-108`; CLI flags `--max-episodes`, `--max-tool-calls`, `--max-fork-depth`,
`--max-wallclock-ms` — `args.ts:148-163`). It propagates rather than being salvaged.

**VM teardown crash / a successful fork reported as failed.** `vm.dispose()`
(`sdk/org/libs/core/src/sandbox/quickjs.ts`) drains pending jobs and swallows QuickJS's
`list_empty(&rt->gc_obj_list)` abort. When hunting a genuine handle leak, set **`LM_QJS_DEBUG=1`** to
load the assertion-tracking debug WASM variant, whose `dispose()` throws a descriptive
"handle not disposed" error with the creation stack instead of a fatal abort (`quickjs.ts:52-59`).

---

## 7. A session on disk

The runtime root is `LMTHING_ROOT`, defaulting to `<cwd>/.lmthing` (`bin.ts:209-213`). On the compute
pod the container's `WORKDIR` is `/data` (a mounted volume, `cloud/gateway/src/lib/compute.ts:243`), so
the root is **`/data/.lmthing`** (`devops/argocd/compute/Dockerfile`, "Runtime root" comment +
`WORKDIR /data`).

```
<root>/
  system/spaces/…                                    # system + user spaces (the synthetic `system` project)
  <projectId>/
    sessions/<sessionId>/snapshot.json               # projects.ts:424-426
    spaces/<spaceId>/sessions/<sessionId>/snapshot.json   # project-space agent chats — projects.ts:455-457
  sessions-ledger.jsonl                              # session-manager.ts:283-286
```

A `snapshot.json` is `{ sessionId, agentSlug, spaceDir, history, scope, createdAt }`
(`sdk/org/libs/core/src/session/snapshot.ts:5-18`) — `history` is the full message list and `scope` the
JSON-serializable VM variables, which is exactly what `Session.resume(dir, message)` rehydrates onto a
fresh VM (`session.ts:415-483`). So `jq '.history[-3:]' snapshot.json` shows the last thing the model
was told, and `jq '.scope | keys' snapshot.json` shows what it had in hand. Each session dir also
carries a `meta.json` (title/slug/lastActivity — `projects.ts:404-450`), which is what
`GET /api/projects/:id/sessions` lists. Note the split: a project-app agent's chat persists under
`<project>/spaces/<spaceId>/sessions/`, **not** `<project>/sessions/` (`session-manager.ts:900-936`).

---

## 8. Running a scenario (end-to-end)

`sdk/org/scenarios/` holds end-to-end specs played against a real `lmthing serve` with a live LLM — a
real project, a real THING session, real model calls (`sdk/org/scenarios/README.md`). The current
scenarios are declarative `scenario.yaml` files (`06-tanzania`, `07-life-admin`) played by the generic
runner `run-yaml.mjs`, **local by design**. It writes per-step evidence — `step-NN.json` (compact) +
`.full.json` (raw) + `trace.md` — into `<scenario>/.run/` for a judge to score
(`sdk/org/scenarios/lib/runner.mjs#ScenarioRunner`, `sdk/org/scenarios/lib/evidence.mjs#compactStep`).

```bash
node sdk/org/scenarios/harness/local-server.mjs up               # a throwaway `lmthing serve` on :8080
node sdk/org/scenarios/run-yaml.mjs 06-tanzania --fresh-server    # play every step, write evidence
node sdk/org/scenarios/run-yaml.mjs 06-tanzania --plan --through 5  # dry-plan / verify-rerun steps 1..5
```

The harness is zero-dependency Node ESM driving the pod's HTTP/WS API directly (no browser). The
runner uses the local, token-free path (`sdk/org/scenarios/harness/lib/local.mjs#freshLocalServer`);
`smoke.mjs` and manual prod runs use the gateway path and a minted JWT — the signing key is read from
`<repo>/.etc/.gateway-jwt-secret.b64` (`harness/lib/jwt.mjs:22-27`), fetched with the
`kubectl get secret lmthing-secrets` one-liner in that file's header comment (`jwt.mjs:1-20`; mind the
double base64). Prod targets default to `https://lmthing.cloud` (`lib/gateway.mjs:16`, override
`LM_GATEWAY`) and `https://lmthing.chat` (`lib/gateway.mjs:199`, override `LM_POD_BASE`).

```js
import { getUser } from './provision.mjs';              // register → pod → keys → ready (provision.mjs:37-60)
import { Pod } from './lib/pod.mjs';
import { ThingSession, approveAllConsent } from './lib/thing.mjs';

const user  = await getUser('my-scenario');
const pod   = new Pod({ base: user.pod, token: user.token });
const thing = new ThingSession(pod, { onAsk: approveAllConsent, verbose: true });
await thing.start();                                    // POST /api/sessions  (thing.mjs:64)
const turn = await thing.send('install a slack integration and watch #eng');

turn.yields;     // every yielding global THING called   (thing.mjs:317)
turn.delegates;  // ['system-store/finder/…', …]         (thing.mjs:318-320)
turn.errors;     // eval_error / typecheck_error events  (thing.mjs:321-323)
turn.tokens;     // { in, out }                          (thing.mjs:324-330)
```

Everything `ThingSession` reports is derived from `GET /api/sessions/:id/events?since=N&format=json`
(`thing.mjs:87`) — the same spine as §2/§3. Triage discipline (harness bug vs product bug, the
image-rebuild loop, hot-patching a system-space prompt) and the scenario document format both live in
[`sdk/org/scenarios/README.md`](../../../sdk/org/scenarios/README.md).

---

## 9. Debugging a live user pod

Each user gets a namespace `user-<userId>` containing exactly one Deployment named `lmthing`, one
container `compute` on port 8080 with `/data` mounted (`cloud/gateway/src/lib/compute.ts#namespace`,
`:188-196`, `:221-243`).

```bash
kubectl logs -n user-<id> deploy/lmthing -f                # boot + hook-load + turn-loop stdout
kubectl exec -n user-<id> deploy/lmthing -- ls /data/.lmthing   # projects, spaces, snapshots (§7)
kubectl rollout restart deploy/lmthing -n user-<id>
```

The pod's stdout **is** the turn-loop log from §1: in `serve` mode the render host is `WebRenderHost`,
whose `log()` writes turn-loop chatter to the server console rather than the browser
(`sdk/org/libs/cli/src/rpc/server.ts#WebRenderHost.log`). Use it for what the trace can't show: process boot,
emitter/hook load failures, worker-entry resolution, OOM.

- The pod is scaled to zero when idle; a `GET /api/sessions` is the K8s startup probe
  (`compute.ts:253-260`), so it is also the cheapest liveness check.
- To run a fixed image on one test pod (there is no ArgoCD auto-roll for `user-*` namespaces):
  `kubectl set image deployment/lmthing compute=lmthingacr.azurecr.io/compute:<7-char-sha> -n user-<id>`
  then `kubectl rollout status …` — the old pod serves until the new one is ready
  (`sdk/org/scenarios/README.md`).
- A **system-space prompt** can be hot-patched without a rebuild:
  `PUT /api/projects/system/spaces/<spaceId>/files/<rel>` `{content}`
  (`handlePutProjectSpaceFile`, registered at `sdk/org/libs/cli/src/server/serve.ts:183`; read back with
  `GET …/files`, `:180`). Code changes (core/cli) still need a new image.

Cluster-wide services (`gateway`, `litellm`, `render`, …) live in the `lmthing` namespace →
[../devops/infrastructure.md](../devops/infrastructure.md).

---

## Which org doc to update

- Changed a **log line, a trace event, or a retry rule** → [../runtime/turn-loop.md](../runtime/turn-loop.md)
  and this file's §1/§2 tables.
- Changed an **API route** on the pod (including `/api/sessions/:id/*`) →
  [../cli-api/rest/sessions.md](../cli-api/rest/sessions.md) and this file's §3 table.
- Changed a **CLI flag** → [../cli-api/commands.md](../cli-api/commands.md).
- Fixed the **`--web` launcher** (§3) → say so here and in
  [../cli-api/commands.md](../cli-api/commands.md), in the same change ([`../SYNC.md`](../SYNC.md)).
</content>
</invoke>
