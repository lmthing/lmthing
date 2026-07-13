# The core runtime — how a turn runs

`@lmthing/core` (`sdk/org/libs/core/src/index.ts`) is the whole agent runtime: a QuickJS WASM sandbox, the streaming statement pipeline, the yield protocol, spaces/forks/delegates, budgets and the trace spine. It has **no** provider and **no** renderer — the host passes in a `streamFn` (`sdk/org/libs/core/src/session/types.ts#SessionDeps`) and a `RenderHost` (`display` / `ask` / `log`, `sdk/org/libs/core/src/session/types.ts#RenderHost`).

The model does not call tools. **The model writes TypeScript**, one statement at a time, and the host evaluates each statement in the sandbox as it streams in. A call to a *value-yielding* global (`ask`, `fork`, `delegate`, `tasklist`, `inspect`, `fetch`, `db`-adjacent app globals, …) suspends the VM, aborts the model stream, is resolved host-side, and the resolved values are injected back as a `VARIABLES` block that starts the next turn.

---

## 1. The pipeline of one turn

`runTurnLoop` (`sdk/org/libs/core/src/eval/turn-loop.ts#runTurnLoop`) is the loop. One iteration of its `while (attempt < maxRetries)` is one LLM request:

```
budget.tickEpisode()                         turn-loop.ts:L341
  → streamFn({ system, messages, model })    turn-loop.ts:L352
  → per chunk:  FenceLineFilter.feed         turn-loop.ts:L450  (strips ``` fences / partial lang tags)
                BoundaryDetector.feed        sandbox/boundary.ts:L16  (complete top-level TS statements)
  → per statement (processStatement, turn-loop.ts:L382-L422):
        looksLikeProse?      → drop          turn-loop.ts:L383
        runTsc(...)          → typecheck gate turn-loop.ts:L385
        transpileStatement + globalThis propagation  turn-loop.ts:L396-L402
        vm.evalStatement(js)                 turn-loop.ts:L403
        vm.pendingYields.length > 0 ? yield  turn-loop.ts:L410-L416
  → on yield / error: stream.abort()         turn-loop.ts:L474, L481, L488
  → resolve yields, bind results, append VARIABLES, attempt = 0, loop  turn-loop.ts:L598-L739
  → no statements at all → 'done'            turn-loop.ts:L742-L746
```

Statements are extracted from the *live* stream — the loop does not wait for the response to finish. Chunks are fed through `FenceLineFilter` (`turn-loop.ts:L111-L150`, only ever drops **complete** lines so a mid-statement token like `JSON` arriving as its own chunk is never swallowed) into `BoundaryDetector` (`sandbox/boundary.ts:L44-L90`), which re-parses the buffer with `ts.createSourceFile` and emits a statement only when it ends in `;`/`}` and contains no missing/error tokens.

### Prose drop

Models sometimes narrate instead of coding. `looksLikeProse` (`turn-loop.ts:L172-L193`) discards a "statement" that has no code punctuation, no TS keyword start, ≥3 word-like tokens and an English function word — dropping it costs nothing, whereas typechecking it would burn a retry. The boundary detector cooperates: a bare identifier carved out of a longer line (`I'll start by…` parses as `I` + an unterminated string) is widened to the whole physical line so the prose filter can see it (`sandbox/boundary.ts:L58-L70`).

---

## 2. The sandbox

`createVM` (`sdk/org/libs/core/src/sandbox/quickjs.ts#createVM`) builds one QuickJS runtime + context per VM, with a **64 MB memory limit** and a **5 s per-statement interrupt deadline** (`quickjs.ts:L62-L63`, `L92`).

- **A WASM module per VM.** `getWASMModule()` (`quickjs.ts:L51-L59`) instantiates a fresh module for every VM; sharing one module across a session and its concurrently-running fork/delegate VMs silently dropped host-bridge calls under load (`quickjs.ts:L39-L50`). `LM_QJS_DEBUG=1` swaps in the assertion-tracking debug variant.
- **Sync eval, manual job driving.** `evalStatement` uses `ctx.evalCode(..., { type: 'module' })` — *not* `evalCodeAsync`, which would deadlock on a host promise that only settles after user input — then drives `executePendingJobs(1)` until either the jobs drain or a yield appears (`quickjs.ts:L90-L169`). A top-level `await` that rejected (e.g. calling a global that was never injected) is surfaced by inspecting the module promise's state instead of being swallowed as an unhandled rejection (`quickjs.ts:L121-L143`).
- **Each statement is its own module ⇒ variables do not persist.** The turn loop appends `try { globalThis['x'] = x; } catch {}` for every bound name (`turn-loop.ts:L396-L402`), which is how the next statement sees `x`. Binding names are extracted syntactically — simple, array- and object-destructuring, multi-declarator, no-initializer, `function`/`class` declarations (`sdk/org/libs/core/src/context/variables.ts#extractBindingNames`).
- **Host bridge.** A host function returning a `Promise` becomes a QuickJS deferred that is disposed **on settle, not on creation** — `resolve()`/`reject()` are no-ops after `dispose()`, so eager disposal permanently neutered any `await` nested inside another async function (`sdk/org/libs/core/src/sandbox/host-bridge.ts#marshalToQuickJS`). Un-settled deferreds are force-disposed at teardown via a per-context registry (`host-bridge.ts:L12-L40`).
- **Teardown never throws.** `dispose()` drains pending jobs, then swallows QuickJS's `list_empty(&rt->gc_obj_list)` assertion — it is catchable and benign, but propagating it turned an already-produced fork result into a spurious rejection (`quickjs.ts:L213-L247`).

---

## 3. The typecheck gate

Every statement is typechecked **before** it is evaluated (`turn-loop.ts:L385-L391`). `runTsc` (`sdk/org/libs/core/src/typecheck/tsc.ts#runTsc`) builds a two-file in-memory program — `__ambient__.d.ts` (the DTS) plus `__session__.tsx` = `export {};` + the accumulated context + the new statement — under `strict`, `jsx: React`, `jsxFactory: React.createElement`, and reports only diagnostics that land in the new statement's line range. A failure never reaches the VM: the loop aborts the stream and appends an ERROR block to history (`turn-loop.ts:L578-L596`).

The DTS is assembled **additively from the capability profile** by `buildAmbientDts` (`sdk/org/libs/core/src/exec/bootstrap.ts#buildAmbientDts`, whose app-grant half is `buildAppCapabilityDts`, `bootstrap.ts:L311-L343`), so "not granted ⇒ not injected **and** absent from the DTS" — a call to a global this context does not have fails typecheck (a clean, retryable model error) rather than throwing at runtime. Passing statements are transpiled with `ts.transpileModule` (`sdk/org/libs/core/src/typecheck/transpile.ts#transpileStatement`), which strips types and lowers JSX to the injected `React.createElement` shim (`exec/bootstrap.ts:L241-L264`).

Detail → [./typecheck.md](./typecheck.md).

### Error blocks

`buildErrorBlock` (`sdk/org/libs/core/src/eval/error-rewind.ts#buildErrorBlock`) tells the model the failing statement, the message, a targeted hint when it reached for a non-existent API (`child_process`, `fs`, `axios`, `process.cwd`… → `sandboxApiHint`, `error-rewind.ts:L9-L34`), the names still in scope, and the full ALREADY-EXECUTED context. The accumulated typecheck context is deliberately **not** rolled back on error: earlier statements really did bind their variables in the VM, so rolling back would make tsc reject valid references (`turn-loop.ts:L586-L591`).

---

## 4. The yield protocol

A yielding global does not do work in the sandbox. It pushes a `YieldRequest` and returns a pending promise:

```ts
// sdk/org/libs/core/src/eval/yield.ts#YieldRequest
export interface YieldRequest {
  kind: 'ask' | 'inspect' | 'loadKnowledge' | 'sleep' | 'tasklist' | 'fork' | 'delegate' | 'registerSpace' | 'fetch' | 'setSessionMeta' | 'apiCall' | 'callConnection' | 'readDocument' | 'tool' | 'integrationStatus' | 'consent' | 'storeSearch' | 'storeInspect' | 'installSpace' | 'emitEvent';
  args: unknown[];
  deferred: { resolve: (v: unknown) => void; reject: (e: unknown) => void };
  vmPromiseHandle: QuickJSHandle | undefined;
}
```

`ask` is the shape of them all: validate, `pushYield`, return a promise the host settles (`sdk/org/libs/core/src/globals/ask.ts#createAskGlobal`). The VM suspends because its module promise is pending; `evalStatement` returns as soon as `pendingYields` is non-empty (`quickjs.ts:L114-L119`).

**Servicing.** When a statement yields, the turn loop aborts the stream and drains yields in *rounds* until the VM has none left, bounded by `MAX_SEQUENTIAL_YIELDS = 64` (`turn-loop.ts:L28`, `L614-L652`). A statement normally yields once, or one concurrent batch (`await Promise.all([fork(...), fork(...)])`) — but a model-awaited helper can await host calls back-to-back (`webFetch`'s plain→render fallback, `webSearch`'s provider chain), and each later await only becomes visible after `vm.drivePendingJobs()` resumes the previous one (`turn-loop.ts:L645`).

**Binding is host-side.** The QuickJS post-`await` continuation does not re-run in this sync eval model, so `bindYieldResults` (`turn-loop.ts:L271-L298`) maps resolved values onto the statement's binding pattern (`simple`/`array`/`object`, from `extractBindingPattern`), treating multiple yields as a `Promise.all` array — then **prefers the VM's own `vm.getVar(name)`** where it diverges, which is what recovers the correct value when the yield was nested inside another async function the model awaited (e.g. `webSearch()` internally awaiting `fetch()`). The values are re-injected with `vm.setVar` (`turn-loop.ts:L679-L682`).

**Routing.** `routeCommonYield` (`sdk/org/libs/core/src/eval/yield-router.ts#routeCommonYield`) is the single resolver shared by the session, delegate and fork-leaf VMs: `sleep`, `fork`, `tasklist`, `delegate`, `fetch`, `apiCall`, `callConnection`, `tool`, `readDocument`, `integrationStatus`, `consent`, `storeSearch`/`storeInspect`/`installSpace`, `emitEvent`, plus `loadKnowledge`/`registerSpace` for fork leaves. Kinds it returns `{handled:false}` for (`ask`, `inspect`, and the session's own `loadKnowledge`/`registerSpace`/`setSessionMeta`) are handled by the caller — `Session.handleYield` (`sdk/org/libs/core/src/session/session.ts#Session.handleYield`). A missing host resolver throws an actionable error instead of binding `undefined` (e.g. `yield-router.ts:L194-L196`, `L338-L340`).

**Consent is enforced in the router, before any resolver runs.** A consent-marked kind (`CONSENT_MARKED_YIELD_KINDS` — `installSpace` today) goes through `enforceConsent` first, and **fails closed** when there is no prompter (headless runs, forks, delegates, hooks) (`yield-router.ts:L140-L145`). Consent-marked *space functions* reach the same gate via the internal `consent` yield kind (`yield-router.ts:L250-L258`).

**What the model sees next.** The loop appends a `VARIABLES` message (`turn-loop.ts:L718-L736`) built by `emitVariables` (`sdk/org/libs/core/src/context/variables.ts#emitVariables`) — the bound names (serialized, lossy previews), a `SCOPE (already declared — do not redeclare)` list and the full `ALREADY EXECUTED` block. Folded in on top:
- `inspect()` results, even with no binding (`turn-loop.ts:L704-L725`);
- full `DOCUMENT CONTENTS` for any `readDocument` yield, because the 200-char VARIABLES preview would otherwise be all the model ever sees of a file (`formatReadDocuments`, `turn-loop.ts:L47-L65`, appended at `L732-L733`);
- a `BUDGET WARNING` when a limit is close (`turn-loop.ts:L734-L735`).

**Yield errors are retryable, not silent.** A failed yield (e.g. `delegate()` to a hallucinated space key) becomes a turn error the model sees, and its bound names are declared ambient `any` + seeded `undefined` so a retry that re-references them still typechecks (`turn-loop.ts:L327-L331`, `L661-L674`). A `BudgetExceededError` inside a yield is re-thrown — a hard stop, never swallowed (`turn-loop.ts:L639`).

Full detail → [./turn-loop.md](./turn-loop.md) · the globals themselves → [../runtime-globals/README.md](../runtime-globals/README.md).

---

## 5. Termination, retries, watchdogs

| Condition | Behaviour | Where |
|---|---|---|
| Model emits no statements | turn ends `'done'` (`turn_end` reason `no_statements`) | `turn-loop.ts:L742-L746` |
| Typecheck / eval error | ERROR block into history, retry (default `maxRetries` 3); exhausted ⇒ `'error'` | `turn-loop.ts:L302`, `L578-L596` |
| Error message mentions `process.exit(` | intentional termination — `'done'`, no retry | `turn-loop.ts:L582-L585` |
| Stream throws a non-abort error with no output | transient — backoff (`min(2000, 300×attempt)`) and re-issue the request | `turn-loop.ts:L496-L518` |
| Stream emits no token for `streamIdleMs` (default 60 000) | treated as a transient failure and retried | `turn-loop.ts:L425-L446` |
| Model stops right after binding from a **non-yielding** call | `CONTINUATION_NUDGE` re-prompt, up to `maxContinueNudges` (default 4) | `turn-loop.ts:L243-L247`, `L332-L333`, `L754-L761` |
| A yield resolved | `attempt` resets to 0 and the loop continues | `turn-loop.ts:L738-L739` |

The idle watchdog cannot fire while a *synchronous* host call blocks the Node event loop — `execShell` is a plain `execSync` (`sdk/org/libs/core/src/globals/host-tools.ts#runShell`, injected at `host-tools.ts:L186`), not a yield. `fetch` *is* a real non-blocking yield, so it is not in that category (`yield-router.ts:L184-L189`).

Token usage is awaited only on a clean end and is bounded by a 10 s race — a provider that ends a stream without the final usage chunk would otherwise hang the turn forever (`turn-loop.ts:L538-L561`).

---

## 6. Capabilities: one profile drives injection *and* the DTS

`CapabilityProfile` (`sdk/org/libs/core/src/exec/capability.ts#CapabilityProfile`) is the single description of what a VM context may do: `kind`, `ask`, `orchestrate` (`fork`+`tasklist`), `delegate`, `registerSpace`, `setSessionMeta`, `allowWrite`, `scratchFs` (the engineer's `fs:scratch` code sandbox — `createScratch()` + a scratch-rooted `execShell`), and the parsed project-app grants `app` (`capabilities:` frontmatter). Three constructors:

- `sessionCapabilities` — full toolkit incl. interactive `ask` (`capability.ts:L91-L93`);
- `forkCapabilities` — headless (no `ask`), non-orchestrating (no `fork`/`tasklist`); `delegate` only when the task's `canDelegateTo` allows it; write + `registerSpace` follow the role, and read-only roles (`explore`/`plan`) get an `intersectAppCaps`-narrowed grant set (`capability.ts:L16-L28`, `L101-L105`);
- `delegateCapabilities` — autonomous but a full orchestrator over its own actions/tasklists; no `registerSpace` (`capability.ts:L114-L116`).

`createChildVM` (`exec/bootstrap.ts:L100-L267`) is the *one* implementation of VM wiring for all three contexts: seed vars → `currentTask.resolve` → space functions → host tools (console, `execShell`, `process.env`, `readFileRaw`/`writeFileRaw`, `progress()`) → app globals → the `fs:scratch` sandbox when `scratchFs` (which *overrides* `execShell` with the scratch-rooted one, `bootstrap.ts:L154-L167`) → the yielding globals gated by the profile → the React/JSX shim + component stubs. `buildAmbientDts` emits exactly the matching declarations (`exec/bootstrap.ts:L345-L369`), which is what keeps injection and typecheck in lockstep — note the generic fs/shell primitives are *never* declared for an ordinary agent: `execShell`/`createScratch` are emitted only under `scratchFs`, and `readFileRaw`/`writeFileRaw` are internal-only (`bootstrap.ts:L354-L361`).

---

## 7. Sessions

`Session` (`sdk/org/libs/core/src/session/session.ts#Session`) owns the VM, history, spaces, budget and tracer:

| Method | What it does |
|---|---|
| `start(message)` | load space + merge system spaces (`session.ts:L575-L582`), preload `preloadSpaceDirs` into `dynamicSpaces` (`L238-L245`), resolve the agent + its `canDelegateTo` policy (`L262-L263`), build the system block + ambient DTS (`L266-L280`), create the VM (`L287-L290`), run the turn loop (`L353-L371`) |
| `continue(message)` | append the user turn, maybe summarize history, fresh `Budget`, re-run the loop on the same VM (`session.ts:L187-L230`) |
| `resume(snapshotDir, message)` | rehydrate history + scope from a snapshot onto a **fresh** VM (`session.ts:L415-L514`) |
| `dispose()` | tear the VM down (`session.ts:L516-L521`) |

Cross-cutting session behaviour:

- **Typecheck scope survives turns.** The VM keeps every variable a turn bound, but each `runTurnLoop` starts with an empty typecheck context — so the Session carries `turnContext` across turns via `initialContext` + `onContextSnapshot` (`session.ts:L146-L153`, `L219-L220`). `start()` resets it; `continue()`/`resume()` preserve it (`session.ts:L305`).
- **History economy.** Past `maxHistoryTurns * 2` messages, old turns collapse into a deterministic digest keeping the last 6 verbatim — no extra LLM call (`session.ts:L528-L536`).
- **Soft todos.** `beforeTurn` re-injects open items from `<spaceDir>/.lmthing/todos.json` into **every** top-level turn as a transient (never persisted) user message (`session.ts:L777-L793`, consumed at `turn-loop.ts:L346-L349`). Forks/delegates do not set it.
- **`defaultAction` fast path.** If the agent declares a `defaultAction` bound to a tasklist (and `noDefaultAction` is not set), `start()` skips the model-driven loop and runs it through the delegate path, chaining a second delegate when the action returns `{spaceKey, agentSlug}` coordinates (`session.ts:L315-L350`). Host-driven, so it is exempt from the model-facing `canDelegateTo` gate.
- **`dynamicSpaces`.** One shared `Map` written by `registerSpace()` (session `session.ts:L816-L826`, fork leaves `yield-router.ts:L355-L370`) and by a consented `installSpace()` (`yield-router.ts:L303-L310`) — so a space registered anywhere in the run is immediately reachable by later `delegate()` calls, and is advertised to the model in a "Project agents (already built & registered)" system-block section (`session.ts:L545-L568`).
- **Attachments.** Images ride as a `MediaPart`; files carry no bytes — the session hands a text agent only an id-anchored note and the specialist fetches content itself with `readDocument(id)` (`session.ts:L71-L81`, `L940-L957`).
- **Tracing.** Every session/run/fork/delegate/tasklist scope mints a `nodeId` via `tracer.child()` and every turn-loop event carries it (`session.ts:L858-L866`, `turn-loop.ts:L350`, `L459-L470`).

Detail → [./sessions.md](./sessions.md) · [./spaces-loading.md](./spaces-loading.md).

---

## 8. Budgets

`Budget` (`sdk/org/libs/core/src/eval/budget.ts#Budget`) is a **host-side** counter — set by the caller (Session / ForkEngine), never reachable from inside the VM, so a model cannot lift its own ceiling (`budget.ts:L1-L14`). Four coarse limits (`BudgetLimits`, `budget.ts:L16-L25`):

| Limit | Ticked | Where |
|---|---|---|
| `maxEpisodes` | once per LLM turn, **before** the request | `turn-loop.ts:L341` → `budget.ts:L71-L77` |
| `maxToolCalls` | once per resolved yield (per batch) | `turn-loop.ts:L621-L623` → `budget.ts:L80-L86`; preludes tick it too (`exec/prelude.ts:L190`) |
| `maxForkDepth` | asserted before a fork spends a VM (top-level fork = depth 1) | `fork/fork.ts:L231-L236` → `budget.ts:L89-L93` |
| `maxWallClockMs` | asserted on every episode/tool tick | `budget.ts:L96-L100` |

Breaching any limit throws `BudgetExceededError` (`budget.ts:L29-L38`), which propagates out of the turn loop for the caller to dispose the VM on. Before the hard stop, `nearLimitWarning()` — ≤2 LLM turns remaining, or ≥80 % of the tool-call allowance consumed, or ≥80 % of the wall clock elapsed (`budget.ts:L108-L131`) — is appended to the VARIABLES block so the model can wrap up and `currentTask.resolve()` (`turn-loop.ts:L734-L735`). The VM can *read* its own spend through the `progress()` host tool (`session.ts:L651`, `globals/host-tools.ts:L26-L29`). A fresh `Budget` is minted per `start()`/`continue()`/`resume()` (`session.ts:L203`, `L304`, `L487`) and per fork (`fork/fork.ts:L231`).

---

## 9. The statement protocol (what the model is told)

`STATEMENT_PROTOCOL` (`sdk/org/libs/core/src/exec/preamble.ts:L19-L41`) is injected **once per context** at the top of every system prompt (session/delegate via `buildSystemBlock`, `sdk/org/libs/core/src/context/system-block.ts#RUNTIME_PREAMBLE`, `L209`). Its load-bearing rules mirror the runtime exactly:

````text
If you want to think out loud, explain your reasoning, or narrate a plan, write it INSIDE a `// comment`.
  // First load the knowledge, then diagnose from the user's query.
  const k = await loadKnowledge("espresso", "fundamentals", "overview.md");

ABSOLUTELY FORBIDDEN — these will cause parse errors or runtime errors:
  - ```typescript or ```ts or ``` (markdown code fences of any kind)
  - Bare English text or explanations OUTSIDE of a `//` comment
  - function wrappers, IIFE patterns, or async IIFEs
  - setTimeout, setInterval, clearTimeout, clearInterval, queueMicrotask (not available — use sleep() instead)

STATEMENT SHAPE — statements are evaluated ONE AT A TIME:
  - Keep value-yielding calls FLAT at top level — never inside if/try/catch/loop bodies or nested callbacks
    (code after a nested yield is lost when the turn resumes).
  - Declare a variable and use it in the same statement where possible.
````

Those are not style preferences: a fence is stripped by `FenceLineFilter`, an IIFE hides the yield from `pendingYields` inspection, and code *after* a nested yield is lost because the host — not the QuickJS continuation — binds the result (§4). The rest of the preamble (context economy, "the VARIABLES block is a LOSSY PREVIEW — never re-type a truncated value") lives in `context/system-block.ts:L124-L135`.

---

## 10. Host-executed preludes

A leaf task can declare frontmatter `prelude:` — statements the **host** runs in the fork VM before the model's first turn, through the exact same pipeline (typecheck → transpile → globalThis propagation → eval → yield routing → `bindYieldResults`) (`sdk/org/libs/core/src/exec/prelude.ts#runPrelude`). It exists because every yield is a turn boundary a small model can fumble; setup statements that need zero judgment should not be re-emitted by the model at all. A failing prelude statement does **not** kill the fork: its names are bound `undefined`, declared ambient `any`, and the failure is reported in the fork's first VARIABLES block (`prelude.ts:L131-L141`, `L256-L271`). Prelude yields tick the fork's tool-call budget; prelude statements are not episodes (`prelude.ts:L36-L39`, `L190`).

---

## Nav

| Page | Covers |
|---|---|
| [./turn-loop.md](./turn-loop.md) | the streaming statement pipeline, the yield protocol, retries, prose-drop, budget ticks |
| [./typecheck.md](./typecheck.md) | `runTsc`, the DTS (`library-dts.ts` fragments, `buildAmbientDts`), the function/component overlay, transpile + the JSX runtime |
| [./fork-and-tasklists.md](./fork-and-tasklists.md) | `ForkEngine`, roles, the concurrency semaphore, salvage/`TaskEnvelope`, the tasklist DAG, `forEach`, code nodes |
| [./delegation.md](./delegation.md) | `delegate()`, the registry, `canDelegateTo` policies, actions, auto-capture |
| [./spaces-loading.md](./spaces-loading.md) | `loadSpace`, system-space merge, functions/knowledge/components/tasklists, project functions |
| [./sessions.md](./sessions.md) | `Session` API, snapshots/resume, history summarization, tracing |
| [../runtime-globals/README.md](../runtime-globals/README.md) | every global the model can call, and the capability that gates it |
