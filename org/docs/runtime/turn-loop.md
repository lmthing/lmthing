# The Turn Loop

The eval loop is the heart of the runtime: the model streams TypeScript, the host splits it into
top-level statements, typechecks and evaluates each one in a QuickJS WASM sandbox, and — when a
statement calls a *value-yielding* global — aborts the stream, resolves the call host-side, binds the
result back into the VM, and re-prompts the model with a `VARIABLES` block.

Implementation: `sdk/org/libs/core/src/eval/turn-loop.ts` (`runTurnLoop`), with the sandbox in
`sdk/org/libs/core/src/sandbox/{quickjs,boundary,host-bridge}.ts` and the yield table in
`sdk/org/libs/core/src/eval/yield-router.ts`.

Related: [typecheck](./typecheck.md) · [runtime globals](../runtime-globals/README.md) ·
[fork & tasklists](./fork-and-tasklists.md) · [delegation](./delegation.md) · [sessions](./sessions.md)

---

## 1. Entry point and contract

`runTurnLoop(deps: TurnLoopDeps): Promise<'done' | 'error'>` —
`sdk/org/libs/core/src/eval/turn-loop.ts#runTurnLoop`. It is the *only* loop: the session, every fork and
every delegate call the same function with different `deps`
(`sdk/org/libs/core/src/session/session.ts:353` — `start`, `:206` — `continue`, `:490` — `resume`;
`sdk/org/libs/core/src/fork/fork.ts:536` — a fork's own loop, and again at `:563` for the
forced-resolve nudge).

Key `TurnLoopDeps` fields (`turn-loop.ts:248-289`):

| field | meaning |
|---|---|
| `vm` | the QuickJS VM (`sandbox/quickjs.ts` `VM`) |
| `history` | `MessageHistory` — the prompt messages (`context/history.ts`) |
| `systemBlock`, `ambientDts` | system prompt + the ambient `.d.ts` every statement typechecks against |
| `streamFn(opts) → StreamSession` | provider stream (`eval/stream-types.ts:37-52`) |
| `processYield(req) → Promise<unknown>` | host resolver for a `YieldRequest` |
| `maxRetries` | default **3** (`turn-loop.ts:355`) |
| `budget` | `Budget` — episodes / tool calls / wall clock (`eval/budget.ts`) |
| `initialContext` / `onContextSnapshot` | cross-turn typecheck scope carried by the Session |
| `beforeTurn()` | transient per-turn reminder — the composed soft-reminder block (top-level session only: open todos + an unnamed-session naming nudge) |
| `streamIdleMs` | no-token watchdog, default **60000** (`turn-loop.ts:490`) |
| `maxContinueNudges` | default **4** (`turn-loop.ts:386`) |
| `tracer` / `scope` / `traceContext` / `model` | observability + per-request model override |

Return value is `'done'` (model finished, or `process.exit(...)`) or `'error'` (retries exhausted /
unrecoverable stream error). A **budget breach does not return** — it throws
`BudgetExceededError` out of `runTurnLoop` (`turn-loop.ts:394,691`).

---

## 2. One turn, end to end

```
while (attempt < maxRetries)                       // turn-loop.ts:388
  budget.tickEpisode()                             // :394  — counts THIS LLM request
  messages = history.getPromptMessages() + beforeTurn()?   // :396-402 (reminder is transient)
  stream = streamFn({ system, messages, model })   // :405
  for each chunk (raced against an idle timer):    // :497-511
     text  = fenceFilter.feed(chunk)               // :515  strip ``` fences / partial lang tags
     stmts = detector.feed(text)                   // :515  complete top-level TS statements
     for each stmt:                                // :517
        stmt = sanitize(stmt)                      // :524  comment out leaked model habits (e.g. </think>)
        processStatement(stmt)                     // :525
          prose? → drop           typecheck fail? → abort stream, turnError
          eval fail? → abort stream, turnError     pendingYield? → abort stream
  flush fenceFilter + detector tail                // :593-606 (only when not aborted)
  history.append(assistant: parsedStatements)      // :645
  if turnError   → error block, retry (or 'error')            // :648-666
  if pendingYield→ resolve yields, bind, VARIABLES, attempt=0 // :668-815
  if no statements → 'done'                                   // :826-829
  if last stmt was a non-yielding call-binding → CONTINUATION_NUDGE, attempt=0  // :838-846
  → 'done'
```

### Statement pipeline (`processStatement`, `turn-loop.ts:435-475`)

Before a statement enters the pipeline it passes through the `sanitize` closure
(`turn-loop.ts:483-487`) at *both* statement sites (streaming loop `:524`, trailing flush `:600`),
which neutralizes known **model output habits** — see [§2.1](#21-model-output-habits) below. The
returned text is what every downstream step (log, trace, `processStatement`) sees, so the trace stays
honest with what actually ran.

1. **prose drop** — `looksLikeProse(stmt)` (`:225-246`). A natural-language sentence the model
   narrated instead of code never parses as TS, so dropping it avoids burning a retry. Conservative:
   bails on any code punctuation (`=(){}[];\`<>`, `=>`, `.\w`, `await`), on a TS keyword start
   (`TS_KEYWORD_START`, `:207`), and on <3 words; requires an English function word
   (`ENGLISH_FUNCTION_WORDS`, `:212-217`) — but an apostrophe contraction ("I'll start by") is
   unambiguously prose (`:239`). Dropped statements are logged and traced as
   `/* dropped non-code prose: … */` (`:527-528`).
2. **typecheck** — `runTsc({ ambientDts: fullAmbient(), sessionContext: accumulatedContext, statement })`
   (`:438`). See [typecheck.md](./typecheck.md).
3. **transpile + globalThis propagation** — `transpileStatement(stmt)` then, for each name from
   `extractBindingNames(stmt)`, append `try { globalThis['<n>'] = <n>; } catch {}` (`:449-455`).
   This is load-bearing: **every `evalStatement` is its own ES module**, so without the propagation a
   later statement cannot see an earlier `const`.
4. **eval** — `vm.evalStatement(jsCode)` (`:456`).
5. **pending-yield check** — if `vm.pendingYields` is non-empty the statement suspended on a
   value-yielding call; record it and hand back to the loop (`:463-469`).
6. **commit** — push to `parsedStatements`, append to `accumulatedContext`, and set
   `lastStmtNonYieldBinding` = "bound a name AND contains a call" (`:471-474`).

#### 2.1 Model output habits

Some models have consistent, *harmless* habits that leak non-code into the statement stream — noise,
never intent — and each one would otherwise fail typecheck and burn a whole retry. These are handled
generically by a **habit registry**, not by branching on the provider:
`sdk/org/libs/core/src/eval/model-habits.ts#sanitizeModelHabits` walks
`sdk/org/libs/core/src/eval/model-habits.ts#MODEL_HABITS`, each a
`sdk/org/libs/core/src/eval/model-habits.ts#ModelHabit` (a cheap `matches` + a `clean` rewrite), and
returns the cleaned text plus the names of the habits that fired (which the turn loop logs).

| habit | what leaks | example | fix |
|---|---|---|---|
| `reasoning-tags` | a chain-of-thought tag — `<think>`/`</think>` and variants `<thinking>`, `<reasoning>`, `<reflection>`, `<scratchpad>`, `<analysis>`, … | DeepSeek streams a stray closing `</think>` ahead of its first real statement | comment the artifact out |
| `control-tokens` | a chat-template / harmony control token `<\|…\|>` — `<\|im_start\|>`, `<\|end\|>`, `<\|channel\|>`, … | ChatML/GPT-harmony/Qwen leaks a lone control token | comment the artifact out |

Two design points make this safe and useful:

- **Comment, don't drop.** Unlike the prose/fence filters (which delete), a habit *comments the
  artifact out* (`commentOut` prefixes each non-blank line with `//`, preserving line count). The
  result is a valid no-op — a lone comment typechecks clean and transpiles to nothing — that stays
  **visible** in the trace/history, so a leaked `</think>` shows up as `// </think>` rather than
  silently vanishing.
- **Only rewrite a pure-artifact statement.** `commentIfPureMarkup` comments a statement out *only*
  when stripping its markup leaves nothing but whitespace. A statement with surviving code — including
  a legitimate string literal that merely contains the markup, e.g. `display("</think>")` — is returned
  untouched, so real code is never corrupted. This is possible because the `BoundaryDetector` reliably
  carves a leaked tag into its *own* statement, separate from the real code that follows (verified:
  `</think>\nconst x = 1` splits into `</think>` + `const x = 1`).

Add a new habit by appending one entry to `MODEL_HABITS` — the turn loop needs no changes. (Preludes
are host-authored, not model-generated, so they do **not** run through this; see [§12](#12-host-executed-preludes-reuse-this-pipeline).)

### Streaming input hygiene

- `BoundaryDetector` (`sandbox/boundary.ts:9-91`) accumulates chunks and emits a statement only when
  TS parses it as complete: it must end in `;` or `}` and contain no missing/synthetic tokens
  (`boundary.ts:78-84`, `hasMissingOrErrorTokens` at `:97-104`). A prose guard stops it carving a bare identifier out of `I'll start by…` —
  it returns the whole physical line instead so the prose-drop can discard it (`boundary.ts:66-70`).
- `FenceLineFilter` (`turn-loop.ts:164-203`) strips markdown fences from the live stream, making drop
  decisions **only on complete lines** so a mid-statement token that arrives as its own chunk
  (`JSON`, ` on`, `ts`) is never swallowed. The static `stripMarkdownFences` (`:145-150`) is safe only on
  final text. `FENCE_LANG_SUFFIXES` (`:128-134`) catches a fence tag split across chunks
  (` ```typ ` + `escript`).
- **Model output habits** are neutralized per statement by `sanitizeModelHabits` — a leaked reasoning
  tag or chat control token is commented out before it can burn a retry. See [§2.1](#21-model-output-habits).

---

## 3. The sandbox

`createVM()` — `sdk/org/libs/core/src/sandbox/quickjs.ts#createVM`.

- **One WASM module per VM** — `getWASMModule()` calls `newQuickJSAsyncWASMModule()` per VM
  (`quickjs.ts:51-59`). Sharing a module across the session VM and concurrent fork/delegate VMs
  silently dropped host-bridge calls (a `delegate()` whose yield never registered, `fetch()` resolving
  `undefined` inside `webSearch`) — see the comment at `quickjs.ts:39-50`. `LM_QJS_DEBUG=1` loads the
  assertion-tracking `DEBUG_ASYNC` variant, whose `dispose()` throws a descriptive handle-leak error.
- **Limits** — memory `64 MiB`, per-statement interrupt deadline `5000 ms`
  (`quickjs.ts:62-63`, applied via `shouldInterruptAfterDeadline`, `:92`). `createChildVM` calls
  `createVM()` with no overrides (`exec/bootstrap.ts:102`), so those defaults are what every session /
  fork / delegate VM runs with.
- **Sync eval, not `evalCodeAsync`** — `evalStatement` uses `ctx.evalCode(code, '_session.tsx',
  { type: 'module' })` (`quickjs.ts:97`) and then drives jobs manually. `evalCodeAsync` would block the
  Node event loop forever when the VM awaits a host promise that only settles after user input.
- **`drivePendingJobs()`** (`quickjs.ts:150-169`) pumps `runtime.executePendingJobs(1)` one job at a
  time, returning as soon as `pendingYields` is non-empty (the VM is suspended on a yield) or the job
  queue drains.
- **Rejected module promise surfaces as a turn error** — after jobs drain with no yield,
  `evalStatement` inspects the module's evaluation promise with `ctx.getPromiseState`; a top-level
  `await` that threw (e.g. `await missingGlobal()`) would otherwise be swallowed as an unhandled
  rejection (`quickjs.ts:126-143`).
- **Teardown never throws** — `dispose()` force-disposes un-settled bridged deferreds
  (`disposePendingDeferreds`), drains residual jobs, then swallows QuickJS's
  `list_empty(&rt->gc_obj_list)` assertion (`quickjs.ts:213-247`). Letting it propagate turned an
  already-produced fork result into a spurious rejection.
- **`setVar` / `getVar`** — `setVar` marshals a host value onto `ctx.global` *and* records it in the
  host-side `scope` (`quickjs.ts:175-180`); `getVar` dumps a global back out (`:182-191`). Both are
  used by the post-yield binding (§5).

### Host bridge

A host function marshalled into the VM (`marshalToQuickJS`, `sandbox/host-bridge.ts:46`) that returns
a `Promise` gets a QuickJS deferred (`ctx.newPromise()`, `:68`), which is **disposed on settle, never
eagerly** — `resolve`/`reject` are no-ops after `dispose()` in quickjs-emscripten, so an early dispose
permanently neuters a promise a *nested* `await` depends on (`host-bridge.ts:67-118`; the dispose fires
in the `finally` of each settle handler, `:96,111`). Un-settled
deferreds are tracked per context (`pendingDeferreds`, `:12-25`) so VM teardown can free them
(`disposePendingDeferreds`, `:31-40`).

---

## 4. What a yield is

Every value-yielding global is a host closure that pushes a `YieldRequest` and returns a promise that
only settles when the host resolves it. The type (`eval/yield.ts:3-8`):

```ts
export interface YieldRequest {
  kind: 'ask' | 'inspect' | 'loadKnowledge' | 'sleep' | 'tasklist' | 'fork' | 'delegate' | 'registerSpace' | 'fetch' | 'apiCall' | 'callConnection' | 'readDocument' | 'tool' | 'integrationStatus' | 'consent' | 'storeSearch' | 'storeInspect' | 'installSpace' | 'emitEvent';
  args: unknown[];
  deferred: { resolve: (v: unknown) => void; reject: (e: unknown) => void };
  vmPromiseHandle: QuickJSHandle | undefined;
}
```

That union is the complete set — **20 kinds** (`sdk/org/libs/core/src/eval/yield.ts#YieldRequest.kind`).

The push seam is a single closure created at VM bootstrap and handed to every global factory:

```ts
const pushYield = (req: YieldRequest) => {
  vm.pendingYields.push(req);
};
```
`sdk/org/libs/core/src/exec/bootstrap.ts:175-177`; the globals are injected right below it
(`bootstrap.ts:179-235`), each gated by the capability profile. Example producer —
`createAskGlobal` (`globals/ask.ts:64-92`) validates the JSX descriptor, mints an id, and returns
`new Promise((resolve, reject) => pushYield({ kind: 'ask', args: [id, descriptor], deferred: { resolve, reject }, vmPromiseHandle: undefined }))`.

Adding a kind → [contributing/add-a-global.md](../contributing/add-a-global.md); the full catalogue of
globals → [runtime-globals/README.md](../runtime-globals/README.md).

---

## 5. Yield servicing and binding

When `processStatement` sees `vm.pendingYields.length > 0` it aborts the model stream
(`turn-loop.ts:556-560`) and the loop takes over (`:668-815`).

**Sequential batches.** A statement normally yields once, or one *concurrent* batch
(`await Promise.all([fork(…), fork(…)])`). But a model-awaited helper can await host calls
sequentially — `webFetch` does a plain fetch and then, for a JS-rendered page, a second fetch to the
render service; `webSearch`'s `auto` chain falls Tavily→Bing→DuckDuckGo. Each later await only appears
as a pending yield *after* `drivePendingJobs()` resumes the previous one. So the loop drains in rounds
until `vm.pendingYields` is empty, bounded by `MAX_SEQUENTIAL_YIELDS = 64` (`turn-loop.ts:29`,
`:684-722`):

```ts
let batch = vm.pendingYields.splice(0);
for (let guard = 0; batch.length > 0 && guard < MAX_SEQUENTIAL_YIELDS; guard++) {
  const base = resolvedValues.length;
  for (const y of batch) { yields.push(y); resolvedValues.push(undefined); }
  deps.budget?.tickToolCalls(batch.length);
  await Promise.all(batch.map(async (yieldReq, i) => { /* processYield → deferred.resolve */ }));
  vm.drivePendingJobs();
  if (yieldErrors.length > 0) break;
  batch = vm.pendingYields.splice(0);
}
```

Each batch is resolved **in parallel** with `Promise.all`; every resolved yield ticks
`budget.tickToolCalls` and emits `yield` / `yield_resolved` trace events with a per-turn `yieldId`
(`:694-701`).

There is no one-by-one `await` loop and no `await Promise.resolve()` microtask flush: a batch is
resolved with a single parallel `Promise.all`, then `vm.drivePendingJobs()` drains the VM's job queue
(`turn-loop.ts:684-722`).

**Binding is host-side.** In this sync-eval model the QuickJS continuation *after* `await` does not
re-run the binding, so `bindYieldResults` (`turn-loop.ts:324-351`, exported) maps values onto the
statement's binding pattern (`extractBindingPattern`, `context/variables.ts:56-65`):

- `simple` (`const x = …`) → the single resolved value, or the **array** of values when the statement
  yielded more than once (it awaited a combinator like `Promise.all`) — `turn-loop.ts:334,342-344`;
- `array` (`const [a, b] = …`) → positional (`turn-loop.ts:337-339`);
- `object` (`const { a, b } = …`) → by key (`turn-loop.ts:340-342`).

Then, for every bound name, the VM's **own** computed value wins where it diverges:

```ts
for (const name of pattern.names) {
  const vmValue = vm.getVar(name);
  if (vmValue !== undefined) variables[name] = vmValue;
}
```
`turn-loop.ts:346-349`. They agree whenever the yielding call *is* the awaited expression; they
diverge when the yield is nested inside another async function the model awaited (e.g. `webSearch()`
awaiting `fetch()` internally) — there the raw resolved value is the *inner* yield's value, while the
VM's bytecode (resumed by `drivePendingJobs()` plus the per-statement `globalThis[name] = name`
propagation) already computed the correct outer one. Finally each name is written back with
`vm.setVar(name, value)` (`:750-752`), which puts it on `ctx.global` and in the host scope for the
next turn.

**Then the model is re-prompted.** The yielding statement is appended to `accumulatedContext`
(`:764`) and a `user` message with `blockType:'variables'` is appended (`:811`), built from:

- `emitVariables(variables, accumulatedContext)` (`context/variables.ts:9-28`) — a `VARIABLES` list
  (values via `serialize`: 200-char string cap, depth cap 6, 4 KiB byte cap by default —
  `globals/serialize.ts#SerializeOpts`), a `SCOPE (already declared — do not redeclare)` line, and an
  `ALREADY EXECUTED` block;
- `formatInspectResult(inspectArgs)` lines folded into the same `VARIABLES` header — `inspect()` is
  normally called *without* a binding, so without this a bare `inspect(x)` would surface nothing
  (`turn-loop.ts:774-795`). Its own `serialize` call raises the string cap to 20,000 chars
  (`globals/inspect.ts#INSPECT_STR_CAP`, byte cap 24,000) instead of the standard 200 — `inspect()`
  *is* the model's explicit escape hatch from the standard preview cap, so re-applying that same cap
  to its output would silently defeat the tool. `applyQuery`'s `slice` query narrows a STRING result
  the same way it narrows an array (`globals/inspect.ts#applyQuery`) — both a big value's raw preview
  and a `slice`-narrowed window of it are shown in full, not re-truncated;
- `formatReadDocuments(yields, resolvedValues)` (`:48-66`) — the **full** text of any successfully
  read document, because the `VARIABLES` preview would only show its first 200 chars;
- `formatLoadKnowledgeContents(yields, resolvedValues)` (`eval/turn-loop.ts#formatLoadKnowledgeContents`)
  — the identical **full-text** treatment for `loadKnowledge`, closing the same 200-char-preview gap
  `formatReadDocuments` already closed for `readDocument`. A loaded knowledge file is exactly as much
  "the thing to ground an answer in" as an uploaded document; before this, anything past char 200 was
  silently invisible to the model, which then free-invented the rest instead of quoting it — confirmed
  in production by a classification guide whose decisive exception clause landed past char 200 (never
  read), and a grounded-answer task that fabricated facts a longer knowledge file held in full while
  still citing that file as its "source". `exec/prelude.ts` gets the identical treatment for a task's
  declarative `prelude:` `loadKnowledge` statements (its own independent yield-batch loop);
- `budget.nearLimitWarning()` when close to a cap (`:809-810`).

On a **clean** resolution `attempt` is reset to `0` and the loop continues (`:822`) — a resolved yield
starts a *fresh* turn, it does not consume a retry. The reset is **withheld when the turn's yields
errored** and execution only reached here because `attempt >= maxRetries` (the fall-through binds the
failed names to `undefined` to limp forward, `:731`): that is not progress, so `attempt` keeps climbing
and the loop terminates with `'error'`. Otherwise a model that stubbornly re-emits the same failing
yield (e.g. a forbidden `delegate`) would zero its retry budget every cycle and loop forever, each cycle
appending another error+VARIABLES block until the history string overflows V8's max length ("Invalid
string length") `sdk/org/libs/core/src/eval/turn-loop.ts:822`.

---

## 6. The yield router

`processYield` is supplied by the caller. The session handles its own session-only kinds and defers
everything else to the shared router (`session/session.ts:795-851`):

| kind | resolved by |
|---|---|
| `ask` | `renderHost.ask(id, descriptor)` — session only (`session.ts:797-801`) |
| `inspect` | returns `args[0]` (query already applied in the global) (`session.ts:802-805`) |
| `loadKnowledge` | reads `<spaceDir>/knowledge/<rel>` (`session.ts:806-815`); fork leaves resolve it in the router (`yield-router.ts:345-354`) |
| `registerSpace` | `loadSpace(dir)` → `dynamicSpaces` (`session.ts:816-826`; fork-leaf twin `yield-router.ts:355-370`) |
| `sleep` | `ctx.clock ?? setTimeout` (`yield-router.ts:147-154`) |
| `fork` | `ForkEngine.fork(task)`; absent for fork leaves (`yield-router.ts:155-163`) |
| `tasklist` | `runTasklist({ name, space, forkEngine, seed, codeNodeCtxFactory })` (`yield-router.ts:164-173`) |
| `delegate` | `ctx.runDelegate(...)` — supplied per caller (`yield-router.ts:174-183`) |
| `fetch` | `resolveFetchYield` — real non-blocking Node I/O (`yield-router.ts:184-189`) |
| `apiCall` · `callConnection` · `tool` · `readDocument` · `integrationStatus` · `storeSearch` · `storeInspect` · `installSpace` · `emitEvent` | host-supplied resolvers; **absent resolver ⇒ a clear, retryable `throw`** rather than a silent `undefined` (`yield-router.ts:190-344`) |
| `consent` | the gate a `@consent`-marked *space function* yields through (`yield-router.ts:250-258`) |

> `setSessionMeta` is **not** in this table — it is no longer a yield. It is a fire-and-forget
> host hook (`onSessionMeta`) that runs synchronously without ending the turn; the session records
> it in `recordSessionMeta` (`session.ts#Session.recordSessionMeta`) → [session naming](../runtime-globals/session-and-utils.md).

Two host-enforced behaviours live here:

- **Consent runs before the switch.** A kind in `CONSENT_MARKED_YIELD_KINDS` (`installSpace` today) is
  routed through `enforceConsent(ctx.requestConsent, …)` *before* any resolver can execute; no prompter
  (headless / fork / delegate / hook) ⇒ **fail closed** (`yield-router.ts:140-145`).
- **`installSpace` order is consent → install → live-register → republish** — the installed dir is
  inserted into the shared `dynamicSpaces` map so `delegate()` reaches it in the same session
  (`yield-router.ts:279-332`).

Unhandled kinds return `{ handled: false }` (`yield-router.ts:371-372`); the session then binds
`undefined` (`session.ts:848`).

---

## 7. Budget and episodes

`Budget` (`eval/budget.ts:46-137`) is a **host-side** counter set by the caller — the sandbox can never
lift its own ceiling. The Session mints a fresh one per run (`session.ts:203,304,487`, from
`SessionOpts.budget`).

| limit | ticked where | on breach |
|---|---|---|
| `maxEpisodes` | `tickEpisode()` once per LLM request, **before** the stream (`turn-loop.ts:394`) | `BudgetExceededError('episodes', …)` |
| `maxToolCalls` | `tickToolCalls(batch.length)` per resolved yield batch (`turn-loop.ts:693`) | `BudgetExceededError('toolCalls', …)` |
| `maxForkDepth` | `assertForkDepth(depth)` from the fork engine (`budget.ts:89-93`) | `BudgetExceededError('forkDepth', …)` |
| `maxWallClockMs` | `assertWallClock()` inside both ticks (`budget.ts:73,82`, impl `:96-100`) | `BudgetExceededError('wallClock', …)` |

Notes:

- `tickEpisode()` is deliberately **outside** the stream `try/catch` so a budget throw can never be
  swallowed as an abort (`turn-loop.ts:390-394`). It counts *retries* too — every LLM request is an
  episode.
- A `BudgetExceededError` raised *inside* a yield (e.g. a fork rejected by the depth cap) is
  re-thrown, not converted into a tool error: `if (err instanceof BudgetExceededError) throw err;`
  (`turn-loop.ts:709`).
- **Soft warning first.** `nearLimitWarning()` (`budget.ts:108-131`) returns a "wrap up immediately and
  call `currentTask.resolve()` now" message when ≤2 episodes remain or ≥80 % of the tool-call /
  wall-clock cap is spent; the turn loop appends it to the `VARIABLES` block (`turn-loop.ts:809-810`).
- `snapshot()` (`budget.ts:134-136`) backs the in-VM `progress()` global (`session.ts:651`,
  `exec/bootstrap.ts:73-76`).
- Forks catch `BudgetExceededError` from their *nudge* loop only (`fork/fork.ts:569-572`); a breach in
  the main fork loop propagates and rejects, and the VM is disposed after the loop exits
  (`fork.ts:599-600`).

---

## 8. Error handling

| failure | behaviour |
|---|---|
| **typecheck error** | abort stream, `typecheck_error` trace, error block → retry (`turn-loop.ts:542-547`) |
| **eval error** | abort stream, `eval_error` trace, error block → retry (`:497-502`) |
| **yield error** (non-budget) | surfaced as a normal retryable turn error, **not** a silent `undefined` (`:679-692`) |
| **`process.exit(...)`** | intentional termination — returns `'done'` without retrying (`:600-603`) |
| **stream idle > `streamIdleMs`** | abort + `streamErrored = true` → retried as transient (`:454-459`) |
| **non-abort stream error, no statements** | retried with backoff `min(2000, 300 × attempt)`; `'error'` once retries are exhausted (`:525-535`) |
| **retries exhausted** | `turn_end{reason:'max_retries'}`, return `'error'` (`:795-796`) |
| **`BudgetExceededError`** | propagates out of `runTurnLoop` (caller disposes the VM) |

**The error block.** `buildErrorBlock(failingStatement, message, attempt, maxRetries, accumulatedContext)`
(`eval/error-rewind.ts:45-76`) is appended to history as a `user` message with `blockType:'error'`
(`turn-loop.ts:663`). Its real shape:

```
ERROR (attempt 2 of 3)
// const x = badCall();
// badCall is not defined

// HINT: …                                          ← sandboxApiHint(), when it matches

// Still in scope from earlier successful statements (do NOT redeclare): a, b
// ALREADY EXECUTED (do not repeat — fix the failing statement and continue from there):
<accumulatedContext>
```

`sandboxApiHint(message)` (`error-rewind.ts:9-34`) maps the model's recurring dead ends to the real
host primitives: `child_process`/Bun/Deno/`execSync`/`require(` → *there is no generic shell* — running
code is only possible inside the engineer's scratch sandbox (`execShell` there, after `createScratch()`),
otherwise delegate to the engineer and persist what it returns (`error-rewind.ts:12-16`);
`axios`/`node-fetch`/a missing `fetch` → `await fetch(url, opts?)` (`:18-20`); `node:fs` →
`readFile`/`writeFile`/`editFile` or the host globals `readFileRaw`/`writeFileRaw` (`:22-24`);
`TextDecoder`/`TextEncoder`/`Buffer` → not available (`:26-28`); `process.cwd` → `process` is an
env-only shim (`:30-32`).

**No rewind of `accumulatedContext`.** Statements that ran earlier in the turn already bound their
variables in the VM and persist into the retry, so removing them from the typecheck context would make
`tsc` reject valid references with "Cannot find name" (`turn-loop.ts:656-661`, `error-rewind.ts:36-44`).
The failing statement was never appended (it errors before the commit), so nothing partial is left.

**Bounded `ALREADY EXECUTED` echo.** The re-embedded `<accumulatedContext>` is capped to a rolling
last-`ALREADY_EXECUTED_WINDOW_CHARS` (8 000) window, cut on a statement boundary and prefixed with an
"N earlier statements omitted" marker (`error-rewind.ts#boundAlreadyExecuted`, applied at
`error-rewind.ts:131`). On a long turn the full context is thousands of statements re-sent on **every**
retry — a quadratic driver of the runaway-turn history blow-up (the "Invalid string length" V8 overflow).
This echo is **model-facing only**: the complete set of live bindings is still advertised in full on the
"Still in scope" line above (derived from the *entire* context), and typecheck still runs against the
full `accumulatedContext` host-side (`turn-loop.ts:470`), so bounding the echo is a pure prompt-size cap
with **zero** typecheck-correctness cost.

**Yield-error scope preservation.** When a yield throws, the failed statement is *not* committed, so a
retry that references its bound names would fail typecheck. The loop therefore adds those names to
`yieldErrorNames`, seeds them `undefined` in the VM, and declares them ambient `any`
(`declare const <n>: any;`) for subsequent typechecks — a re-emitted `const <name> = …` simply shadows
the declaration (`turn-loop.ts:374-384,720-723`). On the **final** attempt the loop falls through and
binds the `undefined` values so the run can still limp forward (`:679`).

---

## 9. Nudges and terminal guards the loop applies

**Continuation nudge** (`CONTINUATION_NUDGE`, `turn-loop.ts:296-300`, fired at `:838-846`). Only
*yields* surface their result to the model; a non-yielding space function (`writeTaskFile`,
`validateSpace`, `listScaffoldedSpaces`) does not. A model that stops right after binding one is
stranded mid-program. `lastStmtNonYieldBinding` — "bound a name AND the statement contains a call"
(`:421`) — triggers a `user` message telling it to `inspect(<var>)` if it must see the value, or else
keep emitting statements. Bounded by `maxContinueNudges` (default 4); `attempt` resets to 0.

**Soft reminders** (`beforeTurn`). The top-level session wires `beforeTurn` on all three of
`continue`/`start`/`resume` (`session.ts:254,403,545`) to `this.reminders.collect()`
(`session.ts#Session.beforeTurn`). `reminders` is a generic `ReminderRegistry`
(`sdk/org/libs/core/src/context/reminders.ts#ReminderRegistry`) that composes any number of
independent providers into one block (blank-line separated, order = registration order), isolating a
provider that throws. The session registers two in its constructor (`session.ts:177-179`):
`readTodoReminder` — open items from `.lmthing/todos.json` as an "Open todos …" block
(`session.ts#Session.readTodoReminder`) — and `namingNudge` — a prompt to call `setSessionMeta` if the
session still isn't named after two conversational turns (`session.ts#Session.namingNudge`). The block
is appended to **this request only** and never written to history (`turn-loop.ts:398-402`), so it is
re-evaluated fresh each turn and never duplicates. Add a reminder by registering another provider — the
turn loop needs no changes. Forks and delegates do not set `beforeTurn`.

**Anti-silent dropped-prose guard** (`DROPPED_PROSE_NUDGE`, `turn-loop.ts:317`, applied at
`turn-loop.ts:871-884`). A turn whose *entire* output was natural-language prose — every "statement"
dropped by `looksLikeProse` — ran nothing and saved nothing, yet returning a clean `'done'` would
silently discard it (the "wrote a plan in prose, saved nothing" failure). A turn-level `everRanStatement`
flag (declared at `turn-loop.ts:408`, set whenever any cycle ran a real statement at `turn-loop.ts:642`)
tells this apart from a turn that did real work and *then* signed off in prose — the latter is a
legitimate `'done'`. When `!everRanStatement && assistantContent.trim() !== ''`, the loop re-prompts
**once** (`turn_end{reason:'dropped_prose_nudge'}`, `attempt` reset to 0); if the very next cycle is prose
again it returns `'error'` (`turn_end{reason:'dropped_prose_error'}`) — never a silent empty `'done'`. A
genuinely empty response (no prose either) still falls through to a real `'done'`. Narrowed to the
dropped-prose case only; a turn that ran a no-op writer is out of scope (covered by the write_fact /
resolve_flagged_figure re-read pattern).

**Delegate structural termination** (`shouldStop`, `turn-loop.ts:307`, checked at `turn-loop.ts:427`). A
delegate's main loop sets no `beforeTurn` and, left alone, would re-prompt forever after its action
tasklist resolves — only a real model voluntarily emits no further statements; a weak or looping model
re-emits the same call every cycle. `TurnLoopDeps.shouldStop?()` is checked at the **top of the loop**,
before the next LLM request, and returns `'done'` when true. `runDelegate` passes
`shouldStop: () => resultCaptured` (`delegate.ts:364`), so once the delegate's result is captured (auto-
captured from its action tasklist, or explicitly resolved) the next turn short-circuits deterministically —
the termination guarantee is **structural**, not dependent on the model choosing to stop.

---

## 10. Context, history and usage

- `accumulatedContext` lives **outside** the retry loop (`turn-loop.ts:368`) and grows via
  `appendContext` (`:317-320`), which also calls `onContextSnapshot` so the Session can carry the
  typecheck scope into the next turn (the VM still holds the values across `continue()`/`resume()`).
  Only a fresh `start()` resets it (`session.ts:305`).
- History gets the **parsed statements**, not the raw stream text, so an incomplete trailing fragment is
  never persisted: `parsedStatements.join('\n')` (`turn-loop.ts:634`, appended at `:593` with
  `blockType:'normal'`).
- **Mid-turn compaction by size.** `runTurnLoop` calls `deps.maybeCompact?.()` at the **top of every
  cycle** (`turn-loop.ts:421`) — before the prompt is built, so it covers error-retry, yield-resume and
  nudge cycles alike. The Session wires it to `maybeCompactHistoryBySize` on all three of `continue`/
  `start`/`resume` (`session.ts:277,446,607`), which collapses old turns to the same deterministic digest
  as `maybeSummarizeHistory` once `history.totalChars()` (`history.ts#MessageHistory.totalChars`) crosses
  `SessionOpts.maxPromptChars` — DEFAULT-ON at `DEFAULT_MAX_PROMPT_CHARS` (400 000 chars ≈ 100 k tokens;
  `session.ts#Session.maybeCompactHistoryBySize`). This is **independent of `maxHistoryTurns`**: a long
  *single* turn (many yield-resume cycles) never crosses the turn boundary where `maybeSummarizeHistory`
  runs, so `maxHistoryTurns` alone let its history grow until the concatenated prompt overflowed V8's max
  string length (the runaway-turn crash the top-level THING session hit — it never sets `maxHistoryTurns`).
  Compaction rewrites **only** `history`, and `keepLast` (6) preserves the just-appended `VARIABLES` block;
  the in-flight yield's binding lives in the VM + `accumulatedContext`, never in `history`, so it survives
  untouched.
- **Token usage** is awaited only when the stream ended normally, and is raced against a 10 s timeout —
  the usage promise can stay pending forever when a provider ends a stream without its final chunk, and
  a fork blocking there once deadlocked a whole DAG (`turn-loop.ts:608-631`). Usage rides the
  `llm_response` trace event (`:585-592`).

---

## 11. Trace events emitted

All via `tracer.write(...)` (`sandbox/trace.ts`); `NULL_TRACER` disables. Each carries `context`
(`scope.label ?? traceContext ?? 'session'`) and, when a `scope` is present, `nodeId`
(`turn-loop.ts:356-359`).

`llm_request` (`:351`) · `statement` (`:476,481`) · `llm_progress` (throttled ≥250 ms, `:487`) ·
`typecheck_error` (`:493`) · `eval_error` (`:500`) · `yield` (`:644`) · `yield_resolved` (`:647`) ·
`variables` (`:708`) · `llm_response` (`:586`) · `turn_end` with `reason` ∈
`stream_error` (`turn-loop.ts:610`) | `dropped_prose_nudge` (`turn-loop.ts:875`) |
`dropped_prose_error` (`turn-loop.ts:882`) | `no_statements` (`turn-loop.ts:886`) |
`continue` (`turn-loop.ts:899`) | `done` (`turn-loop.ts:906`) | `max_retries` (`turn-loop.ts:910`).

---

## 12. Host-executed preludes reuse this pipeline

A fork task's frontmatter `prelude:` is run by the **host** before the model's first turn, through the
exact same steps (typecheck → transpile → globalThis propagation → eval → yield rounds →
`bindYieldResults`): `sdk/org/libs/core/src/exec/prelude.ts#runPrelude`. It imports the turn loop's own
`bindYieldResults` rather than reimplementing it (`prelude.ts:8,228-234` — "the getVar preference is
load-bearing for nested yields"), splits its trusted source with a single `ts.createSourceFile` parse
instead of the streaming boundary heuristics (`splitPreludeStatements`, `:98-103`), drains nested yields
in rounds bounded by `MAX_NESTED_YIELD_ROUNDS = 32` (`:106,186`), ticks the fork's tool-call budget
(`:190`), and — unlike the turn loop — **degrades per statement** rather than retrying: a failed prelude
statement binds its names `undefined`, declares them ambient `any`, and execution continues
(`:131-141,223-226`). Its `context` seeds the turn loop's `initialContext` and its `variablesBlock` is
the fork's first `VARIABLES` message (`:74-90`). Detail → [fork-and-tasklists.md](./fork-and-tasklists.md).

---

## 13. Gotchas

- **Variables do not persist between evals by themselves** — each `evalStatement` is an isolated
  module; the `globalThis['x'] = x` suffix is what makes them visible (`turn-loop.ts:449-455`). The
  `try/catch` form is deliberate: it propagates even `undefined` values.
- **`extractBindingNames` also propagates `function`/`class` declarations and un-initialized
  `let`s** (`context/variables.ts:122-149`) — without that, typecheck (which sees the accumulated
  context) accepts a later call while eval throws "not defined".
- **The trailing-buffer flush is intentionally asymmetric** with the streaming loop: it emits no
  statement/progress/error trace events and never touches `stream`/`aborted` (the stream has already
  ended) — `turn-loop.ts:589-606`.
- **The idle watchdog cannot fire while a synchronous host call blocks the event loop** (e.g.
  `execShell`). `fetch` is *not* in that category — it is a real non-blocking yield
  (`yield-router.ts:184-189`).
- **`pendingYield` records the last pending request** for the presence check (`turn-loop.ts:464`), but
  servicing takes the whole queue with `vm.pendingYields.splice(0)` (`:635`).
