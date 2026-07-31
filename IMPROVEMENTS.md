# IMPROVEMENTS — Running lmthing on a small model (DeepSeek-V4-Flash class)

Plan synthesized from a 5-axis audit of `sdk/org/libs/core` + `sdk/org/libs/cli`
(prompt weight · turn-loop forgiveness · typecheck gate · orchestration · provider/CLI plumbing),
2026-07-31. All paths below are relative to `sdk/org/` unless prefixed otherwise.

## Status (2026-08-01)

Six items shipped, tested, and committed by five parallel implementation agents (four Opus
subagents + inline work) in one session. Full core suite green throughout (108 files / 1355
tests) plus `pnpm docs:check` (127 docs, 5528 citations, all resolve). Commit trail, in
`sdk/org` unless noted:

| Item | What shipped | Commit(s) |
|---|---|---|
| 0.1 | Self-dep instruct.md duplication killed (THING's own system block ~9.5k tokens lighter); non-self deps now get `charterBody`, never the full `instructBody` | `fc59b513` |
| 0.2 | `types: []` on the typecheck compilerOptions; `console` given its own COMMON_DTS declaration | `fc59b513` |
| 0.3 | ALREADY-EXECUTED echo bounded on the success path (previously only the error path was capped) + deduped to a single echo on the latest variables block via `Message.alreadyExecuted` | `fc59b513` |
| 2.1 | The two stale `sandboxApiHint` entries (fetch, fs) rewritten to point at the real surface; new hint for the `@types/node` install suggestion `types:[]` makes reachable | `fc59b513` |
| 0.4 | `lintMissingAwait` (write-time error on an un-awaited yielding call) + `bindYieldResults` binding-preference fix (`vmValueIsPromise` via QuickJS `getPromiseState`, never trusts a dumped `{}`) | `2c1dda4a`, wired in `949980bf` |
| 1.2 + 1.4 | `StreamOpts.params` (temperature/maxOutputTokens/stopSequences/providerOptions) plumbed into `streamText`; `StreamSession.finishReason` surfaced; `finishReason:'length'` treated as retry-or-continue, never silent completion; `LM_STREAM_PARAMS` env seam ahead of the full ModelProfile table | `75427766`, wired in `949980bf` |
| 4.1 | `TaskNode.model` / `ForkTask.model` frontmatter override; `Session.effectiveModel = agent.model ?? opts.modelAlias` (top-level session now honors agent frontmatter `model:`, previously delegate-only) | `aef7d5b0` |
| 5.1 | `mockFromTrace` (sequential + fingerprint replay of a recorded `--trace` transcript); `.ndjson`/`.jsonl` auto-routing in `--mock`; fixtures/ scaffold for 5.2 | `8a3858dc`, wired in `949980bf` |

Parent-repo doc sync + submodule bump: `c82d0658`.

**Not done this session:** 0.5 (envelope-ize bare `fork()`), the rest of Phase 1 (the actual
`ModelProfile` table/`profiles.ts` — 1.2/1.4 shipped the plumbing it hooks into, not the table
itself; 1.3 retry economics; 1.5 cost visibility), the rest of Phase 2 (2.2–2.8: capability-aware
TS2304 rewriter, did-you-mean, position/caret formatting, prose demotion, unterminated-literal
repair, AST-based binding extraction), Phase 3 (context-window fitting), the rest of Phase 4
(4.2 retry-time escalation, 4.3 code-node-first tasklists, 4.4 `forkEach`, 4.5 entry
actions/templates), and 5.2/5.3 (the failure-fixture bank beyond the one seeded fixture, and the
live lmauto judge campaign). Three implementation agents (0.4, per-node model, mockFromTrace) hit
a session rate limit mid-run and were asked to wrap up with what they had rather than continue —
their reports and the passing test suite are the only verification of completeness; treat as
tested-and-working but not independently re-audited.

One pre-existing untracked file, `libs/core/src/spaces/build-live-project-contract-additive.test.ts`,
sat in the worktree throughout (predates this session, unrelated to small-model work — a
contract-additivity regression test for the app builder) and was deliberately left uncommitted
and untouched.

**Thesis.** The architecture already fits a small model: capability gating via DTS absence
produces retryable typecheck errors instead of runtime throws, tasklists put the DAG (not the
model) in charge of control flow, code nodes run with no model at all, and the pre-typecheck
mercy layers (`model-habits.ts`, fence filter, prose drop, redeclare shadowing) are genuinely
load-bearing. `DeepSeek-V4-Flash` is already the production default for the small model slots
(`cloud/gateway/src/lib/compute.ts:512-513`) and resolves through `lmthingcloud:` →
`createOpenAI(...).chat()` (`libs/cli/src/providers/resolve.ts:49-57`). What is missing:

1. **Nothing is tunable per model** — sampling params, retry budgets, nudge budgets,
   strictness, prompt variant are all hardcoded or global.
2. **The error-feedback channel assumes a strong reader** — raw tsc prose, position info
   discarded, two stale hints that prescribe forbidden calls, no capability-awareness.
3. **Five outright bugs** hurt every model but are fatal to a small-context one
   (prompt duplication, `@types/node` leak, quadratic history echo, missing-await `{}`
   binding, fork envelope discard).

Phases are ordered by (impact × ease) and by dependency. Phase 0 is pure bug-fixing and
lands first; Phase 1 is the seam every later phase keys off.

---

## Phase 0 — Bugs to fix regardless of model

Each item is small, high-value, and correct for frontier models too. No new config surface.

### 0.1 Kill the self-dep instruct.md duplication (−9.5k tokens/request for THING)

- **Problem.** THING's system block is 97,860 chars ≈ 24.5k tokens, charged on **every**
  statement-cycle (yield-resume, retry, nudge — each is a full new LLM request,
  `libs/core/src/eval/turn-loop.ts:516-525`). 38,243 of those chars are THING's own
  38KB instruct.md rendered a **second time** under `# Delegatable Agents`: the
  `canDelegateTo` entry `user-thing/thing#organize_material` is a self-dep, and
  `libs/core/src/context/system-block.ts:370` renders `${depAgent.instructBody}` in full.
  (It is the *only* dep that renders — `system-*` refs don't resolve through `findSpace`
  because `mergeSystemInto` at `libs/core/src/spaces/system.ts:190-198` never adds system
  spaces to `dependentSpaces`; delegation to them works via yield-time resolution.)
- **Change.** In `buildSystemBlock` (`system-block.ts:355-373`):
  - self-dep (`depSpace.dir === space.dir && depAgent === agent`): render title + allowed
    actions only, no body;
  - non-self deps: render `charterBody` (≤1.2KB) instead of `instructBody`.
- **Test.** Snapshot test on the dump for `user-thing/thing`: assert the instruct body
  appears exactly once; assert total system-block size < 60KB. Re-measure with
  `node libs/cli/dist/cli/bin.js --space libs/core/system-spaces/user-thing --agent thing --dump-system-prompt out.txt`.
- **Size.** ~5 lines + test.

### 0.2 `types: []` — stop `@types/node` leaking into the typecheck gate

- **Problem.** `libs/core/src/typecheck/tsc.ts:54-66` sets no `types: []`, so
  `ts.createCompilerHost` auto-includes `node_modules/@types/*` from cwd. Verified live:
  `fetch(...)`, `setTimeout(...)`, `Buffer.from(...)`, `require("child_process")` all
  **typecheck OK** in a dev tree against a fork-leaf DTS. This voids the documented fetch
  ban (`fetch` IS injected at runtime in every VM, `libs/core/src/typecheck/library-dts.ts:504-511`
  removed it from the DTS as the 06-tanzania secrets fix) — a secrets-hygiene hole, and it
  makes the gate behave differently on a pod vs. a dev checkout. `setTimeout` (declared
  FORBIDDEN in `libs/core/src/exec/preamble.ts:33`) passes typecheck and dies as a runtime
  ReferenceError — the worse feedback path.
- **Change.** Add `types: []` to `compilerOptions` in `tsc.ts`. Then map the
  newly-reachable TS2591 ("try `npm i @types/node`" — actively harmful advice for a model)
  to a curated sandbox hint (see 2.2).
- **Test.** Unit test: `fetch("x")`, `setTimeout(f, 1)`, `Buffer.from("x")` each fail
  typecheck with TS2304 in a session context AND a fork context, in a tree where
  `@types/node` is installed. Update `org/docs/runtime/typecheck.md` citation if line
  anchors move.
- **Size.** 1 line + hint mapping + tests.

### 0.3 Bound + dedupe the ALREADY-EXECUTED echo (quadratic → linear history)

- **Problem.** `emitVariables` (`libs/core/src/context/variables.ts:22-24`) appends the
  **entire accumulated program** under `ALREADY EXECUTED:` into every VARIABLES block —
  after every yield — with no cap. `accumulatedContext` grows per statement
  (`turn-loop.ts:428-432`) and persists across conversational turns
  (`session.ts:321`, reset only in `start()` at `session.ts:437`). Each VARIABLES message
  stays in history (`turn-loop.ts:949`): after Y yields over a program of C chars, history
  carries ~Y×C of repeated text. The error path already fixed exactly this —
  `boundAlreadyExecuted` caps at `ALREADY_EXECUTED_WINDOW_CHARS = 8_000`
  (`libs/core/src/eval/error-rewind.ts:68,78-93`) and its doc comment names the quadratic
  blow-up.
- **Change.** Two independent mechanisms:
  - (a) apply `boundAlreadyExecuted` inside `emitVariables` (import from `error-rewind.ts`;
    typecheck still uses the full context host-side — zero correctness cost, same argument
    as `error-rewind.ts:60-67`);
  - (b) in `MessageHistory.getPromptMessages()` (`libs/core/src/context/history.ts:20`),
    strip the `ALREADY EXECUTED` section from every `blockType: 'variables'` message
    **except the last** — each block supersedes the previous. Prompt-build-time only;
    stored history and snapshots untouched.
- **Test.** Simulate a 10-yield turn with a growing program; assert prompt size grows
  linearly (each VARIABLES block ≤ old-block-minus-echo + 8KB) and that the last block
  retains the bounded echo. Existing yield-binding tests must stay green.
- **Size.** ~15 lines + tests.

### 0.4 Missing `await` on a yielding call must not bind `{}`

- **Problem.** Yields register at **call time** (`libs/core/src/exec/bootstrap.ts:208-210`),
  so `const r = ask("…");` (no `await`) still suspends the turn and the host resolves the
  value correctly — but `bindYieldResults` (`turn-loop.ts:384-411`) prefers
  `vm.getVar('r')`, which dumps the QuickJS **Promise object** as `{}` (not `undefined`),
  overwriting the correct value (`turn-loop.ts:887-890`). The model sees `r: {}`, concludes
  the tool "returned nothing", and hallucinates. Typecheck only catches property access on
  the `Promise<T>`-typed binding — `display(r)`, `JSON.stringify(r)`, passing `r` onward
  all typecheck clean.
- **Change.** Two layers (per the "prefer write-time feedback" directive, the lint is the
  primary fix; the binding fix is the safety net):
  - (a) **write-time lint** post-typecheck: AST-walk the statement; a call to a known
    yielding global (the bootstrap knows the set) not under `await`/`.then`/`Promise.all`
    fails with a custom one-liner: `` `ask(...)` must be awaited: `const r = await ask(...)` `` —
    before eval runs, retryable;
  - (b) in `bindYieldResults`, when the host-resolved value exists and the VM value dumps
    as an empty plain object while the resolved value isn't — prefer the resolved value
    (or better: use `ctx.getPromiseState` to detect "is a Promise" and skip vm-preference).
- **Test.** Statement `const r = ask("q")` (no await) → lint error naming the fix.
  With lint bypassed (direct loop test), `r` binds the resolved value, not `{}`.
- **Size.** ~40 lines + tests.

### 0.5 Envelope-ize bare `fork()` — stop discarding the degradation signal

- **Problem.** `ForkEngine.forkWithMeta` returns `{value, degraded, reason}`
  (`libs/core/src/fork/fork.ts:31-36`; salvage produces neutral empties via `salvageData`,
  `libs/core/src/exec/envelope.ts:39-50`), but the model-facing `fork()` unwraps to
  `.value` only (`fork.ts:197-200`). A direct `fork()` caller gets `{summary: "", items: []}` —
  indistinguishable from a genuinely empty result. The envelope mechanism exists because a
  *frontier* model went off-script on salvage prose (`envelope.ts:1-16`); a small parent has
  no chance against a signal that is absent. Fabricated-negative failure mode.
- **Change.** `fork()` resolves the same envelope shape as `tasklist()`:
  `{ok, degraded, data, reason?}` — change at `fork.ts:199`, update `FORK_DTS`
  (`libs/core/src/typecheck/library-dts.ts:25`) and the prompt examples
  (`system-block.ts:183-196`). Per the no-back-compat directive: replace outright, rewrite
  every in-repo caller (system-space instructs, tests) in the same change.
- **Test.** Fork whose model never resolves → caller sees `ok: false, degraded: true` with
  `reason`. Grep system-space instruct.md files for `fork(` usage examples and update.
- **Size.** ~1 line core + DTS/prompt/instruct/test sweep (~a day).

**Phase 0 exit criteria.** `pnpm test` green from `sdk/org`; THING dump < 60KB; a 10-yield
mock turn shows linear prompt growth; `fetch` fails typecheck in a dev tree; docs pages
(`org/docs/runtime/turn-loop.md`, `typecheck.md`, `fork-and-tasklists.md`) updated in the
same change per SYNC.md.

---

## Phase 1 — The `ModelProfile` seam

The keystone. One config object, longest-prefix matched on the **resolved** model spec,
that every later knob keys off. Without it, every small-model accommodation becomes another
hardcoded global.

### 1.1 `libs/cli/src/providers/profiles.ts`

```ts
interface ModelProfile {
  params?: {                    // → 1.2, spread into streamText
    temperature?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    providerOptions?: Record<string, unknown>;
  };
  maxRetries?: number;          // → 1.3
  streamIdleMs?: number;
  maxContinueNudges?: number;
  proseNudges?: number;         // new TurnLoopDeps field, default 1 (current behavior)
  diagnosticSoftlist?: number[];// → 2.5, TS codes filtered post-hoc
  promptVariant?: 'standard' | 'strict'; // → 3.3
}
profileFor(resolvedSpec: string): ModelProfile
```

Resolution order: built-in table (`{'*:DeepSeek-V4-Flash*': FLASH_PROFILE}`) ←
`.lmthing/models.json` ← `LM_MODEL_PROFILE_<ALIAS>` JSON env. Hook points: `bin.ts` where
`streamFn` is built (`libs/cli/src/cli/bin.ts:370-373` — it already sees the resolved
spec) and where Session/SessionManager opts are assembled.

**Shipped default `FLASH_PROFILE`:**
`temperature 0.2 · maxOutputTokens 3000 · maxRetries 6 · maxContinueNudges 6 ·
proseNudges 3 · streamIdleMs 120000 · diagnosticSoftlist [7006,7031,7053,18046,18048,2571] ·
promptVariant 'strict'`.

### 1.2 Params plumbing (today: none exists at all)

- **Problem.** The only `streamText` call site passes exactly
  `{model, system, messages, abortSignal}` (`libs/cli/src/stream/stream.ts:70-75`);
  `StreamOpts` (`libs/core/src/eval/stream-types.ts:37-44`) has no channel for params.
  Everything runs at provider defaults — including temperature, for a runtime that is
  100% code emission. `maxOutputTokens` also bounds the abort-waste problem: the loop
  aborts the stream on **every** yield/typecheck/eval error (`turn-loop.ts:663,670,677-679`),
  and cheap OpenAI-compat endpoints often keep generating (and billing) after the socket
  drops. ~3000 tokens caps the worst case at cents.
- **Change.** Add `params?` to `StreamOpts` (core), populate from `profileFor()` CLI-side,
  spread into `streamText` in `createStream`. Same seam fork-role model overrides already
  flow through (`stream-types.ts:40-43`).
- **Size.** ~15 lines.

### 1.3 Retry economics: configurable, tier-defaulted, progress-aware

- **Problem.** `maxRetries = deps.maxRetries ?? 3` (`turn-loop.ts:415`) but forks and
  delegates **hardcode 3**: `fork.ts:635, :674`, `delegate.ts:551, :586`. No CLI flag sets
  it. The counter resets only on clean yield/nudge (`turn-loop.ts:960,979,995,1027,1040`) —
  never because statements succeeded — and **transient stream failures consume the same
  counter** (`turn-loop.ts:626-631, :697-707`). At a small model's error rate, 3 attempts
  makes multi-cycle turns statistically doomed; retries on a cheap model cost ~nothing and
  the hard `Budget` (`libs/core/src/eval/budget.ts:71-99`) already bounds true runaways.
- **Change.**
  - Thread `maxRetries` into `ForkEngineOpts` and `runDelegate` opts (kill the four
    literals); add `--max-retries` / `LM_MAX_RETRIES`; default from profile.
  - Progress-aware: in the error path (`turn-loop.ts:772-789`), reset/decrement `attempt`
    when `parsedStatements.length > 0` this cycle (mirrors the `:960` reasoning).
  - Separate transient-stream retry counter (own small budget at `:697-707`), not `attempt`.
  - Make the nudge budgets (`droppedProseNudges < 1` at `turn-loop.ts:974-985`,
    `NO_OUTPUT_NUDGE` `:456-457`, `maxContinueNudges` `:446`) profile-sourced
    `TurnLoopDeps` fields.
- **Test.** Mock streamFn scripting: (a) 5 cycles each with one error but net statement
  progress → turn completes under `maxRetries 3`; (b) two consecutive prose-only responses
  under `proseNudges 3` → nudged, not `'error'`; (c) injected stream disconnects don't
  consume model-mistake attempts.

### 1.4 `finishReason` surfacing — length cuts must not look like completion

- **Problem.** `textDeltaStream` forwards only `text-delta`, throws on `error`, and drops
  everything else including `finish` with `finishReason: 'length'`
  (`libs/cli/src/stream/stream.ts:19-29`). Cheap endpoints apply low default `max_tokens`;
  a length-cut leaves a partial statement that either burns a retry with a misleading
  error or lets the turn settle `'done'` mid-program. Currently completely invisible.
- **Change.** Set `finishReason` on `StreamSession` from the `finish` part; in the turn
  loop treat `'length'` like a stream error → retry (transient counter), and log it.
- **Size.** ~20 lines across `stream.ts` / `stream-types.ts` / `turn-loop.ts`.

### 1.5 Cost visibility + cost-denominated budget

- **Problem.** Usage is skipped whenever the stream was aborted
  (`turn-loop.ts:741` — and every yield aborts), so the **majority of real turns record
  zero tokens**; `computeTurnCost` (`libs/cli/src/server/pricing.ts:25-36`, consumed at
  `session-manager.ts:385-388`, `session-ledger.ts:180`) systematically undercounts —
  worst for the cheap model whose economics you're trying to prove. `BudgetLimits` is
  denominated in episodes/toolCalls/forkDepth/wallClock only
  (`libs/core/src/eval/budget.ts:16-25`) — never tokens/USD, so "flash gets 10× the
  episodes for the same dollar cap" needs per-deploy hand-scaling.
- **Change.** (a) On abort, estimate `outputTokens ≈ assistantContent.length/4` and input
  from the prompt (both in scope at `turn-loop.ts:758`); emit on the `llm_response` trace
  event marked `estimated: true`. (b) Add `maxCostUsd?` to `BudgetLimits` with a
  `tickTokens(model, in, out)` fed by the same `prices` table the ledger loads.
- **Test.** Mock aborted stream → ledger shows non-zero estimated usage; budget test:
  `maxCostUsd` trips after N estimated-cost episodes.

**Phase 1 exit criteria.** `LM_MODEL_S=lmthingcloud:DeepSeek-V4-Flash` runs get temperature
0.2, capped output, 6 retries, 3 prose nudges — verified via `--trace` NDJSON; ledger shows
estimated usage on aborted turns.

---

## Phase 2 — The error-feedback rewriter

Highest leverage per line of code. All at one choke point:
`buildErrorBlock` (`libs/core/src/eval/error-rewind.ts`) + the diagnostic join at
`turn-loop.ts:558-563`. The hint machinery exists (`redeclareHint`, `sandboxApiHint`);
it knows two mistake families out of ~6, and two of its hints are actively wrong.

### 2.1 Fix the two stale hints (guaranteed retry-burn loops today)

- `error-rewind.ts:42-44`: the `fetch` hint says *"Use the host global `await fetch(...)`"* —
  but `fetch` was removed from every model DTS (`library-dts.ts:504-511`). Following the
  hint reproduces the identical TS2304. Rewrite: *"`fetch` is not available to you — use
  `webSearch`/`webFetch`."*
- `error-rewind.ts:46-48`: the fs hint prescribes `readFile`/`writeFile`/`readFileRaw`/
  `writeFileRaw` — generic fs is absent from every non-engineer DTS and the Raw pair has
  **no DTS fragment anywhere** (`bootstrap.ts:474-479`, `library-dts.ts:125-141`).
  Rewrite: *"use `listProjectDir`/`readProjectFile` + the `writeProject*` writers; only
  the engineer has scratch fs."*

### 2.2 Capability-aware TS2304 rewriter

- **Problem.** `ask()` in a fork → bare `TS2304: Cannot find name 'ask'.` — indistinguishable
  from a typo, so a small model retries spelling variants for all attempts. The host knows
  the full global universe (fragment names in `library-dts.ts` + `CAPABILITY_DTS_FRAGMENTS`
  `:489-502`) and this context's grant set (`buildAmbientDts`, `bootstrap.ts:452-496`) —
  and discards both.
- **Change.** On TS2304/2552: if the missing name is a known lmthing global **not** granted
  here, emit one prescriptive line:
  - `ask`/`fork`/`tasklist` in fork/delegate → *"`ask` exists but not HERE: forks run
    headless. Work from your instruction/seed and resolve via your output schema — do not
    retry `ask`."*
  - `db` ungranted → *"`db` requires a db:* capability this agent doesn't hold — use your
    granted functions."*
  - TS2591 after 0.2 → replace the "npm i @types/node" advice with the sandbox hint.
- Static table generated from the fragment registry; test asserts every fragment name has
  a rewriter entry or an explicit exemption (write-time completeness gate).

### 2.3 Did-you-mean against the *granted* globals

On TS2304 with no capability match: Levenshtein against the ~30 granted names (host holds
`ambientDts` at `turn-loop.ts:558`; extract `declare (const|function) X` once per turn) →
`HINT: there is no 'searchWeb'; did you mean 'webSearch'?`. Tighter than tsc's own TS2552
window, which ranks against all symbols.

### 2.4 Formatting: position, caps, caret, hint-first, resend detection

- Stop discarding `line`/`col` (computed in `tsc.ts:94-100`, thrown away at
  `turn-loop.ts:560`). Multi-line statement → `line N, col M:` + quote **only the
  offending line** with a `^` caret; cap the full-statement echo at ~15 lines
  (`error-rewind.ts:113` currently echoes every line — a swallowed mega-statement echoes
  hundreds).
- ≤2 diagnostics, first line of each flattened chain, ~300 chars each; strip
  `IntrinsicAttributes & ` noise from JSX prop errors.
- HINT line **above** the raw diagnostic (small models weight the top of a block).
- Full ALREADY-EXECUTED echo only on attempt 1; attempts ≥2 get hint + scope names only.
  Cap the "Still in scope" list at last ~40 names + count (`error-rewind.ts:124-128` joins
  all names unbounded).
- Hash the failing statement; on identical resend prepend *"You re-sent the SAME
  statement — it fails identically. Change the named part or emit a different statement."*
  (The `redeclareHint` doc comment `error-rewind.ts:4-10` records models doing exactly this.)

### 2.5 Per-model diagnostic softlist (do NOT flip `strict` off)

Post-hoc filter in `runTsc`/call-site keyed off the profile (`deps.model` already exists on
`TurnLoopDeps`, `turn-loop.ts:268`): small models drop `[7006, 7031, 7053, 18046, 18048, 2571]`
(implicit-any and unknown-flow pedantry — the transpiler erases types; runtime is untyped).
Verified: everything the capability/schema gate depends on (TS2304/2552, TS2339,
TS2345 + TS2561/2353 literal-union + excess-property checks) survives independently.
`strict` itself stays on (flipping it changes inference).

### 2.6 Prose must not burn retries

- **Problem.** `looksLikeProse` (`turn-loop.ts:225-246`) bails to "code" on ANY of
  `[=(){}[];<>]`, so `1) Fetch the data`, `- fetch results (using webSearch)`,
  `Step 2: parse;` all go to tsc, fail, set `turnError`, **abort the stream**
  (`turn-loop.ts:662-667`) — discarding every not-yet-streamed statement — and burn an
  attempt. This is the single most common small-model failure event.
- **Change.**
  - Typechecker-as-oracle demotion at the failure site (`turn-loop.ts:558-564`): if the
    dominant diagnostic is TS2304/TS1005/TS1128 AND a relaxed prose check passes
    (≥60% word-like tokens, no `=`, no call-shape `.method(`; parens/digits/`#`/`-`/`:`
    allowed) → demote to `{kind:'dropped'}` instead of `typecheck_error`. Same
    "guaranteed-error, safe-to-drop" argument already used for fences (`:220-224`).
  - `looksLikeProse` learns list/heading shapes: `/^\s*(?:[-*#>]|\d+[.)])\s+[A-Za-z]/`
    with no `=` and no assignment-call.
  - **Don't abort the stream** on dropped-class failures — only on errors needing a model
    retry.
- **Test.** Fixture bank of real DeepSeek narration lines (collect from traces) — all
  demoted, zero attempts consumed, following statements still evaluated.

### 2.7 Unterminated-literal auto-repair + first-fault position

- **Problem.** An unclosed backtick/brace never satisfies the boundary detector
  (`libs/core/src/sandbox/boundary.ts:44-90`), so the entire rest of the response
  accumulates and flushes as ONE failing mega-statement (`turn-loop.ts:713-726`) with a
  bottom-of-fragment diagnostic pointing hundreds of lines from the typo.
- **Change.** (a) At the flush site, try appending the parser-reported missing tokens
  (`` ` ``, `}`, `)`, `;`); if the repaired text parses AND typechecks → run it, log a
  `sanitized` note (same philosophy as `model-habits.ts`). (b) In `BoundaryDetector`,
  when the buffer exceeds ~4KB without a statement, snapshot the earliest parse-error
  position so the eventual error names the *first* fault line. (c) Hint on
  TS1160-family: *"you opened a template literal at line N and never closed it — re-emit
  just that statement, shorter."*

### 2.8 AST-based binding extraction (silent name loss → wrong-statement blame)

- **Problem.** Regex extraction (`variables.ts:72-152`) drops: destructuring with defaults
  (`const {data = []} = res`), nested patterns (`const {a: {b}} = x`), rest elements
  (`...rest`), multi-line LHS. Typecheck passes (full context host-side) but the *next*
  statement's eval throws `'data' is not defined` — blamed on the innocent statement.
  Strong models pattern-match out; small models re-emit the innocent statement forever.
- **Change.** Replace the regexes with the TS AST — `declaredNames` in `tsc.ts:107-122`
  already walks binding patterns correctly; export and reuse. Belt-and-braces: when an
  eval error matches `'X' is not defined` and `X` appears in `accumulatedContext`, hint
  *"'X' was declared earlier but did not survive statement isolation — re-declare it."*
- **Test.** Table-driven: each gap shape above → all names propagate via
  `globalThis['x'] = x`.

**Phase 2 exit criteria.** Error-block fixture tests (input diagnostic → exact emitted
block) for every rewriter; trace replay (Phase 5) shows recorded DeepSeek failure turns now
recover in ≤1 retry where the failure was hint-addressable.

---

## Phase 3 — Fit the context window

A DeepSeek-flash-class model has a 32–64k usable window and weak long-context recall.
Today the host lets the prompt reach ~100k tokens before doing anything.

### 3.1 Model-aware compaction thresholds

- **Problem.** Turn-boundary summarization requires `opts.maxHistoryTurns`, which the
  top-level session never sets (`session.ts:707-709`); the only default bound is
  `DEFAULT_MAX_PROMPT_CHARS = 400_000` (`session.ts:79`) ≈ 100k tokens. A flash session
  silently exceeds its window and degrades unrecoverably long before the host compacts.
  The compaction digest itself keeps `var:` lines at up to 4KB each
  (`libs/core/src/context/summarize.ts:53-60` + `serialize.ts:16` cap).
- **Change.** Derive `maxPromptChars = min(400_000, contextTokens*4*0.5)` from a
  `contextTokens` field on the ModelProfile at session construction
  (`SessionOpts`, `libs/core/src/session/types.ts`); default `maxHistoryTurns ≈ 8` for
  profiles marked small. Re-serialize digest `var:` lines with `strCap: 80`.

### 3.2 Elide aged knowledge/document blocks from prompt messages

- **Problem.** `loadKnowledge`/`readDocument` bodies are appended into the `'variables'`
  history message (`turn-loop.ts:940-946`; caps 20,000 / 100,000 chars) and **re-sent on
  every subsequent request** until 400k compaction. The prompt-split premise ("an aspect's
  body costs a turn") is false in practice: it costs every remaining turn.
- **Change.** Mark these blocks (`blockType: 'knowledge'` or sentinel prefix); in
  `getPromptMessages()` elide once ≥N messages old, replaced by
  `[knowledge <name> was read here — reload if needed]`. The reload-don't-recall rule is
  already in the RUNTIME_PREAMBLE ground-truth section.
- **Test.** Load knowledge, advance N turns, assert prompt no longer carries the body but
  carries the marker; assert a re-`loadKnowledge` still works.

### 3.3 Compact authoring surface (`promptVariant: 'strict'`)

- **Instruct:** per-agent `instruct.small.md` (or frontmatter `compactInstruct:`) selected
  by the profile's prompt variant — same philosophy as the existing weak-model
  `defaultAction` routing (`session.ts:442-451`, which exists explicitly "for less-capable
  models"). Target ≤6KB vs THING's 38KB. Compress the Knowledge routing table's per-aspect
  descriptions to one line (`system-block.ts:299-313`, currently 8KB).
- **UI catalog:** `catalogSummary()` (`libs/core/src/ui/catalog.ts`) lists all 78
  components (~4.9KB) — a confusion surface (Badge/Tag/Pill, Alert/Banner/Callout invite
  wrong-prop guesses that burn typecheck retries). Split: core tier always-on
  (~15: Stack, Heading, Table, Callout, Form, TextField, Select, ConfirmButtons, Markdown,
  KeyValue, …) + rest behind a `loadKnowledge('ui','components','all')` aspect. The DTS
  overlay keeps declaring **all** components so usage still typechecks (typecheck failure
  is retryable; the model never sees the DTS — `streamFn` gets only `system` + `messages`,
  `turn-loop.ts:525,558`).
- **Statement protocol:** the `'strict'` variant tightens `STATEMENT_PROTOCOL`
  (`exec/preamble.ts`) with worked statement examples and an explicit
  one-statement-then-stop framing for yield-prone paths (also lets the server end the
  stream itself, reducing abort waste). Enrich `DROPPED_PROSE_NUDGE` with a worked example
  wrapping the exact prose the model just produced in `display("…")` — small models
  imitate better than they comply.

**Phase 3 exit criteria.** A 20-turn mock session under a 64k-token simulated window never
exceeds `maxPromptChars`; THING under `'strict'` dumps ≤ ~30KB system block.

---

## Phase 4 — Mixed-model topology (the strategic answer)

Don't make flash do everything. Per-request model resolution is already wired end-to-end
(`bin.ts:370-373` resolves `StreamOpts.model` per call with lazy cache;
`runTurnLoop` threads `model` per loop, `turn-loop.ts:266-268`; per-role fork models exist
via `LM_MODEL_ROLE_*` → `modelForRole`, `libs/core/src/fork/roles.ts:65-71`, consumed at
`fork.ts:640`; delegate honors agent frontmatter `model:` at `delegate.ts:184`). What's
missing is the authoring surface.

### 4.1 `model:` on `TaskNode` + honor agent `model:` at top level

- Add `model?: string` to `TaskNode` (`libs/core/src/spaces/tasklist-load.ts:8-60`,
  validate in `buildTaskNode` `:123-239`), to `ForkTask` (`fork.ts:69-108`), pass in
  `orchestrator.ts:404-422`, use `task.model ?? modelForRole(...) ?? defaultModel` at
  `fork.ts:640`. Four files.
- Top-level session: read `agent.model` (mirror `delegate.ts:184`) where `modelAlias` is
  passed (`session.ts:323, :1037`) — today frontmatter `model:` works only on the delegate
  path, so a system space can't pin itself strong while the pod default stays small.
- Optionally: `roleModels` declarable in tasklist `index.md` frontmatter (today env-only,
  pod-global, three coarse buckets).
- **Target topology:** in `build_live_project`, pin `03-plan_app` and `17-fix` strong;
  the `implement_endpoints` forEach leaves run the pod-default flash.

### 4.2 Retry-time escalation ("small drives, strong rescues")

- On attempt ≥2 of a turn (or on a fork's resolve-nudge, `fork.ts:653-682`), re-issue the
  request on a configured `escalateModel` (session opts / profile, threaded exactly like
  `roleModels`). History and error blocks are model-agnostic — no prompt changes. Flash
  handles the happy path; frontier price is paid only on demonstrated failure.
- **Test.** Mock: attempt 1 fails on model A; assert attempt 2's `streamFn` call carries
  model B; assert trace records the escalation.

### 4.3 Code-node-first tasklist authoring

- Promote deterministic verdict/relay agent nodes to `.ts` code nodes. Exemplar:
  `libs/core/system-spaces/system-appbuilder/tasklists/build_live_project/18-finalize.md`
  is an agent node computing a boolean conjunction over ~10 typed upstream outputs, guarded
  by 40 lines of prose — the exact class `reconcileOk` (`delegate.ts:128-168`) proves even
  strong models flub ("prose … patched TWICE for this exact failure"). 7 of 22 nodes in
  that tasklist are already `.ts`; the pattern is proven, and code nodes get the full ctx
  (`libs/cli/src/server/tasklist-runner.ts:110-145`) including `ctx.delegate`.
- **The inversion primitive:** a code node that is the loop AND the judge, calling
  `ctx.delegate` only for generation leaves — host-deterministic control flow, flash
  confined to fill-in-the-blank. Document the shape in
  `org/docs/format/space/tasklists/` and teach the architect scaffolding to prefer it.
- **Guardrail:** every ctx member is an async RPC stub (sync reads silently `undefined` —
  `libs/cli/src/app/worker-load-entry.ts:L127-L130`); ship a typed `CodeNodeCtx` DTS + a
  write-time `no-floating-promises` check for code-node files (write-time feedback
  directive).

### 4.4 `forkEach` — declarative top-level batch

- **Problem.** `forEach` exists only in tasklist frontmatter; at top level the sanctioned
  pattern is `Promise.all(items.map(x => fork(...)))` while the protocol forbids yields in
  loop bodies ("code after a nested yield is lost", `exec/preamble.ts:39-41`) — a syntax
  needle a small model threads wrong, and one rejection sinks the whole `Promise.all`
  with no per-item retry/salvage.
- **Change.** `forkEach(items, opts)` global routing to the orchestrator's existing
  fan-out (`orchestrator.ts:437-468`: semaphore parallelism, `item`/`index` seeded,
  `FOREACH_ITEM_ATTEMPTS=3` per element, salvage, `degradedTasks`-style envelope).
  Extraction, not construction.

### 4.5 Entry actions + fork templates (shrink top-level judgment to classification)

- Extend the `defaultAction` fast path (`session.ts:308-341`) to several named *entry
  actions* with trigger descriptions — the small top-level model's only decision becomes
  "which action id", a classification task, not composition.
- **Fork templates:** space-authored `{instruction-template, output-schema, role}` presets
  invokable as `fork('summarize_files', {paths})` — schema-authoring judgment moves to the
  space author. Also tighten `checkField` (`libs/core/src/tasklist/schema.ts:37-39`):
  unknown type strings currently disable validation for that field silently → load-time
  warning.

**Phase 4 exit criteria.** A tasklist run with per-node models shows (via trace) different
model specs per node; an escalation test shows model B on retry; `18-finalize` converted
and its prose guard deleted; `forkEach` covered by orchestrator-equivalent tests.

---

## Phase 5 — Verification infrastructure (start before Phases 2–4 land)

Per the launch-automation directive: verify via the lmauto judge campaign, not manual
replays. But most of this plan is testable **free**, offline:

### 5.1 `mockFromTrace` — replay recorded transcripts through the host pipeline

- The entire model boundary is one injected `streamFn`
  (`libs/core/src/testing/mock-provider.ts:1-13`, `mockScript`/`mockMatch` builders,
  keyless via `--mock`/`LM_MOCK`, `bin.ts:202-214`). The tracer already records full
  `llm_request`/`llm_response` NDJSON pairs (`turn-loop.ts:523, :761-768`). Missing piece:
  `mockFromTrace(ndjsonPath)` — replay recorded responses sequentially or matched by
  request fingerprint.
- **What it proves:** the host pipeline (boundary carving, habit sanitization, prose
  demotion, typecheck, yield binding, error rewriting) processes known-good streams
  identically under every prompt/parser change; and against **recorded DeepSeek failure
  transcripts**, that a given fix actually neutralizes the recorded failure. What it can't
  prove: that flash *generates* better under a new prompt — that stays live.
- **CI gate:** one recorded frontier run + one recorded flash run per scenario, replayed
  on every PR touching `eval/`, `sandbox/`, `context/`, `typecheck/`.

### 5.2 Failure-fixture bank

Harvest real flash output from traces into fixtures: narration lines (2.6), unterminated
literals (2.7), missing-await statements (0.4), hallucinated globals (2.2/2.3),
`<think>` leaks (already covered by `model-habits.ts` tests). Every mercy-layer change runs
against the bank.

### 5.3 Live judge campaign

Once Phases 0–2 land: lmauto campaign comparing `flash-only`, `flash+escalation`, and
`frontier-only` across the existing scenarios; judge against prior runs. Metrics now
meaningful because 1.5 un-blinded the token/cost ledger. One live scenario run at a time
(per the live-runs rule).

---

## Rollout order & dependency graph

```
0.1  0.2  0.3  0.4  0.5      (independent; land first, each its own commit)
              │
        1.1 profiles.ts ──► 1.2 params ──► 1.3 retries/nudges ──► 1.4 finishReason ──► 1.5 cost
              │
        5.1 mockFromTrace + 5.2 fixtures        (parallel with Phase 1)
              │
        2.1–2.5 rewriter ──► 2.6 prose ──► 2.7 repair ──► 2.8 AST bindings
              │
        3.1 compaction ──► 3.2 elision ──► 3.3 strict variant + small instructs
              │
        4.1 node model ──► 4.2 escalation ──► 4.3 code-node-first ──► 4.4 forkEach ──► 4.5 templates
              │
        5.3 live judge campaign
```

Every phase: `pnpm test` from `sdk/org` green, matching `org/docs/` page updated in the
same change (SYNC.md), commit + push per coherent piece (submodule first, then the parent
gitlink). File `.issues/` entries for 0.2 (`@types/node` leak — also a secrets issue) and
0.4 (missing-await binding) immediately; delete when fixed.

## If only three things ship

1. **Phase 0 items 0.1–0.3** (~30 lines): −40% prompt weight, linear history — the changes
   that make a small context window *survivable at all*.
2. **Phase 2 rewriter core (2.1–2.4, 2.6)**: converts the #1 death spiral (unexplained
   TS2304 retry-burn; prose burning attempts) into one-shot recovery.
3. **Phase 1.1–1.3 + Phase 4.1–4.2**: `ModelProfile` + per-node `model:` + retry
   escalation — makes "flash executes, strong rescues" a config line instead of a redesign.
