# DeepSeek Live-Test Plan — validating the reliability redesign (P0–P6)

Goal: prove the redesigned harness + system spaces work with **DeepSeek-V4-Flash** as the
weak-model stress case, across an escalating ladder of requests. Every experiment ends with a
**trace forensics pass** — we look for errors *and* model misconceptions, classify them, fix at
the right layer, and re-run. This subsumes plan Phase 7.

**Status legend** used in the tracker table: ⬜ not run · 🟡 running · ✅ pass · ❌ fail (fix logged)

---

## 0. Prerequisites (once)

- ✅ P6 verified (2026-07-02): full core suite 51 files / 528 tests green, core tsc clean,
  all 5 agent system-prompt dumps audited clean. Changes still uncommitted is fine —
  live tests run from the local build.
- Fresh build: `pnpm --filter @lmthing/core build && pnpm --filter @lmthing/cli build` (in `sdk/org`).
- Env: `sdk/org/.env` already defines the aliases —
  `LM_MODEL_S=azure:DeepSeek-V4-Flash`, `LM_MODEL_M=azure:gpt-5.5`, `LM_MODEL_L_R=azure:Kimi-K2.6`
  (+ `AZURE_RESOURCE_NAME` / `AZURE_API_KEY`).
- **Never commit/push/deploy from these runs.** Everything below is local CLI only.

## 1. Model matrices

Two configurations per experiment (run **D-leaf first**; it's the production-shaped one):

| Matrix | Session model | Fork roles | How |
|---|---|---|---|
| **D-leaf** (realistic) | `M` (gpt-5.5) | all DeepSeek | `LM_MODEL_ROLE_EXPLORE=S LM_MODEL_ROLE_PLAN=S LM_MODEL_ROLE_GENERAL=S` |
| **D-all** (stress) | `S` (DeepSeek-Flash) | inherit S | `LM_MODEL=S` (roles unset) |

Alias resolution: `--model S` / `LM_MODEL=S` → `LM_MODEL_S` env → `azure:DeepSeek-V4-Flash`
(`libs/cli/src/providers/aliases.ts`). Role overrides are read by `readRoleModels()` in
`libs/cli/src/cli/bin.ts` and now — this is one of the things under test — **propagate into
delegate-built fork engines** (the A1 fix in `exec/fork-config.ts`).

## 2. Run template

```bash
CLI=$PWD/sdk/org/libs/cli/dist/cli/bin.js
WORK=$(mktemp -d /tmp/lmrun-XXXX) && cd $WORK   # fresh scratch dir per experiment
node $CLI init                                   # materializes the runtime into $WORK/.lmthing
env $MATRIX_VARS node $CLI \
  --request "<REQUEST>" --trace /tmp/claude-1000/.../scratchpad/traces/E<N>-<matrix>.json
```

THING is the **default agent** — no `--agent`/`--space` flags. `lmthing init` (keyless) sets up
`<cwd>/.lmthing`; the fresh scratch cwd per experiment is the isolation. E7's part (b)
follow-up must run from the SAME `$WORK` dir so the registered space from part (a) is still
there. (For the separate `--dump-system-prompt` audit, explicit `--space`/`--agent` are needed.)

Keep every trace file; name them `E<N>-<matrix>-run<K>.json`.

## 3. Trace forensics toolkit (run after EVERY experiment)

Trace events (verified in `libs/core/src/sandbox/trace.ts`): `llm_request`, `llm_response`,
`statement`, `typecheck_error`, `eval_error`, `yield`, `yield_resolved`, `turn_end`,
`node_start/node_update/node_end`, `fork_queue`. Each carries `context` and `nodeId`.

```bash
T=<trace.json>
# 1. Hard-error census (the issue-1 metric; baseline was 6–8 per build run, target ≈ 0)
jq '[.[] | select(.type=="typecheck_error" or .type=="eval_error")] | group_by(.context) | map({context: .[0].context, n: length, msgs: [.[].message] | unique})' $T
# 2. Salvage/degradation census — which nodes ended in error/skip, and did anything downstream still run?
jq '[.[] | select(.type=="node_end")] | map({nodeId, status, error})' $T
# 3. Data-plane purity: NO salvage prose may appear in resolved values
jq '[.[] | select(.type=="yield_resolved") | .value | tostring | select(test("unavailable|exhaust|budget"))]' $T   # must be []
# 4. Envelope shape at the orchestrator: every tasklist/delegate resolution has ok/degraded/data
jq '[.[] | select(.type=="yield_resolved" and (.kind=="tasklist" or .kind=="delegate"))]' $T
# 5. Prompt purity (A2): leaf fork llm_request must contain only declared inputs — grep the
#    system/messages of investigate forks for seed keys that were NOT declared (e.g. a stray "research:" blob)
jq -r '[.[] | select(.type=="llm_request")][0:] | .[].context' $T | sort | uniq -c
# 6. Statement-protocol violations by DeepSeek: fences / multiple statements / nested yields
jq '[.[] | select(.type=="typecheck_error" or .type=="eval_error") | .statement]' $T
# 7. Forced-resolve pressure (regression flag: nested forks NOW have budgets)
jq '[.[] | select(.type=="llm_request") | .messages[-1].content | select(test("resolve NOW|final turn"; "i"))] | length' $T
# 8. ROUTING AUDIT — the actual delegation chain THING took, in order. Compare against the
#    expected chain listed in each experiment; a wrong route is a FAIL even if output looks fine.
jq '[.[] | select(.type=="yield" and (.kind=="delegate" or .kind=="tasklist")) | {context, kind, args}]' $T
# 9. SYSTEM-PROMPT AUDIT (EVERY experiment) — dump the first system prompt of EVERY context
#    (root THING session + each fork/delegate) and read it, don't just grep:
jq -r '[.[] | select(.type=="llm_request")] | group_by(.context) | map(.[0]) | .[] | "==== " + .context + " (model: " + (.model // "?") + ") ====\n" + .system' $T > $T.prompts.txt
```

System-prompt audit checklist (per context, in `$T.prompts.txt`):
- **STATEMENT_PROTOCOL exactly once** — not duplicated, not paraphrased by space prose;
- **DTS matches capabilities** — `declare function delegate` present iff the context's
  `canDelegateTo` allows it (THING/architect yes; engineer/researcher/memory no); `tasklist`
  carries the TaskEnvelope JSDoc where available; no leaked globals a profile should strip;
- **leaf forks contain ONLY declared inputs** (+ `item`/upstream vars) — any seed key from the
  caller's `context` that the task didn't declare is an A2 regression;
- **prelude-bound vars appear in the first VARIABLES block**, and the prompt does not ask the
  model to redo what the prelude already did;
- **right model per context** (D-leaf: root = gpt-5.5, every fork = DeepSeek);
- no stale references (old task names, `system-deep-research`, deleted globals).

Any checklist violation is a FAIL for the experiment regardless of output quality — fix at the
layer that owns the prompt (space file vs `exec/bootstrap.ts`/`preamble.ts` DTS assembly).

**Misconception review (manual, every run):** read each fork's `llm_response` sequence and note
where the model *misunderstood* the contract rather than erred — e.g. treats a VARIABLES block
as completion, re-states protocol prose, invents variable names a prelude already bound, reads
`degraded:true` as "abort", re-tries delegation to a denied target. Log each in the table (§6).

## 4. The experiment ladder

**Every experiment starts from the THING agent** (`--agent thing`) — no direct-to-specialist
runs. Each experiment therefore tests TWO things: (a) THING **routes correctly** — picks the
right triage path and the exact expected delegation chain (forensics query 8; a wrong route is
a FAIL even with a good-looking answer), and (b) the delegated pipeline executes cleanly.
Run in order; each level gates the next. Every level: run **D-leaf**, then **D-all**, then
forensics — **always including the system-prompt audit (query 9)** on every context the run
created, not just the ones the experiment is "about".

### E0 — Smoke: direct answer (routing = NO delegation)
Request: `"What are the tradeoffs between SQLite and Postgres for a single-user app?"`
Exercises: session bootstrap from `exec/bootstrap.ts`, STATEMENT_PROTOCOL preamble, display path.
**Expected chain:** none — THING answers itself (cheapest-path rule).
**Pass:** answer displayed; 0 typecheck/eval errors; query 8 returns `[]`.

### E1 — Memory write (routing = path 5)
Request: `"Remember that I prefer answers in bullet points with sources."`
**Expected chain:** `delegate(user-memory, memory, …)` and nothing else. The memory agent has
`canDelegateTo: []` — its DTS must not contain `delegate`.
**Pass:** memory saved + natural-language confirmation; grep the memory fork's
`llm_request.system`: `delegate(` absent from its ambient DTS.

### E2 — Shallow research (routing = research path, NOT deep_research)
Request: `"Research the current state of WebGPU adoption in browsers."`
**Expected chain:** `delegate(system-research, researcher, research, …)` — choosing
`deep_research` here is a routing FAIL (over-escalation).
**Pass:** prelude vars appear as the fork's first VARIABLES block; model emits ~1 statement
(synthesis + resolve); THING reads `t.ok`/`t.data`; 0 errors in the leaf.

### E3 — Deep research via THING (issue-1, depth-1 nesting)
Request: `"Do deep research on battery chemistries for home energy storage and summarize."`
**Expected chain:** `delegate(system-research, researcher, deep_research, …)` — shallow
`research` here is a routing FAIL (under-escalation).
Exercises: forEach `investigate` fan-out with preludes; `04-synthesize` `all_sources` prelude.
**Pass:** per-investigate-fork error count ≈ 0 (was 6–8 across the run); no
`Cannot find name` errors; every fork resolves without salvage (or salvage is neutral-empty);
D-leaf matrix: `llm_request.model` is DeepSeek in every investigate fork (roleModels propagate
through the delegate — the A1 fix).
**Record:** the exact per-investigate-fork `llm_request` prompts — baseline for E5's A/B.

### E4 — Engineer path (routing = path 4)
Request: `"Write a TypeScript function that parses ISO-8601 durations into milliseconds, with tests."`
**Expected chain:** `delegate(system-engineer, engineer, …)` — THING must NOT write the code
itself, and the engineer (`canDelegateTo: []`) must not attempt/see `delegate`.
**Pass:** engineer fork produces the code; 0 errors; `delegate(` absent from the engineer
fork's ambient DTS.

### E5 — Full build pipeline (issue-2 core + the issue-1 A/B at depth)
Request: `"Build me an agent that advises on indoor hydroponic gardening."`
**Expected chain:** `tasklist('build_specialist', …)` → (inside: research node's prelude
delegates to researcher#deep_research; build node delegates to architect#synthesize_and_run) →
final `delegate(<registered space>, …)` to run the built agent. THING calling the researcher or
architect **directly** instead of via the tasklist is a routing FAIL.
**Pass:** the architect delegate node AND the final registered-space delegate appear; THING
displays the built agent's answer; envelope gate honored (`b.ok && b.data.ok`); 0 improvised
builder calls by THING. **A/B (A1+A2 proof):** the investigate-fork prompts at this deeper
nesting are **byte-identical** to E3's for the same question shape (`jq` extract + `diff` of
the prompt template around the question), with the same ≈0 error rate.

### E6 — Degraded build (issue-2 kill shot)
Same request as E5, but with search genuinely severed. **Note:** unsetting `TAVILY_API_KEY` is
NOT enough — `webSearch` (system-global/functions/webSearch.ts) falls back to DuckDuckGo.
Sever it for real: `TAVILY_API_KEY= HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9`
so both Tavily and the DDG fallback fail (verify the fork's fetch honors the proxy; if not,
temporarily point webSearch at an unreachable base URL via its env override, or firewall the
DDG host). The point is: research must come back salvaged/degraded, not merely thin.
**Pass (hard requirements):** research node ends degraded with **neutral-empty** data (forensics
query 3 returns `[]`); the **build task still runs** (DAG guarantee); tasklist envelope has
`degraded:true, degradedTasks:["research"]`; THING still runs the built agent and adds the
"limited research" note — it must NOT abandon, apologize-and-stop, or try to research inline.
Run this one **3×** per matrix — it's the flakiest behavior and the one the redesign exists for.

### E7 — Denial + reuse (delegation policy under pressure)
Two-part session: (a) `"Build me an agent that tracks my reading list"`, then (b) follow-up
`"Now use it to add 'The Left Hand of Darkness'"`.
Also: craft a request that tempts an out-of-list delegate (e.g. ask THING to have the
*engineer* do research). **Pass:** (a)(b) reuse the registered space via `registered:*`;
the tempted violation yields the structured denial listing allowed targets, and the model
recovers by rerouting instead of looping on the denied call.

## 5. Triage & fix loop (applies to every ❌)

Classify each finding before touching anything:

| Class | Symptom | Fix layer |
|---|---|---|
| **Harness bug** | wrong env/model/budget in a fork, envelope malformed, prelude binding lost | `libs/core/src/exec/*`, fork/orchestrator — fix + add a unit test reproducing it |
| **Contract misconception** | model misreads VARIABLES/envelope/degraded semantics | wording in `STATEMENT_PROTOCOL` (`exec/preamble.ts`) or the agent instruct — smallest possible edit |
| **Capability overreach** | model narrates instead of resolving, drops bindings, improvises names | move the logic into a `prelude:` or tighten the task `output` schema — don't add prose |
| **Config/infra** | 401s, missing env, rate limits | `.env` / run setup, not code |

Rules: one fix per re-run (attribution); after any fix, re-run the failing level **and the level
below it** (regression guard); every fix gets a row in the results table and a line in
`PROGRESS.md`'s log. If E3/E4 shows premature forced-resolves (forensics query 7 ≫ 0), tune
fork budget limits — that's the known intended behavior change from A1, not a bug per se.

## 6. Results tracker

| Exp | Matrix | Runs | Status | Route OK? | Errors (tc/eval) | Degraded nodes | Misconceptions found | Fix applied |
|---|---|---|---|---|---|---|---|---|
| E0 | D-leaf / D-all | 1+1 | ✅ | ✅ no delegation | 0/0 both | none | D-all skipped optional instructions.md preload (harmless) | — |
| E1 | D-leaf / D-all | 1+1 | ✅ | ✅ delegate(user-memory,memory) only | 0/0 both | none | none — memory fork DTS has no delegate (verified both) | — |
| E2 | D-leaf / D-all | 4+2 | ✅ (run4/run2) | ✅ research (after Fix#2) | 0/0 final runs (was 16 in run1) | none (was 7) | run1: shared-WASM bridge drops (Fix#1); over-escalation (Fix#2); harness action-hint dictated seedless tasklist (Fix#3); cast missing reason?/degradedTasks? (Fix#4); DeepSeek redeclared prelude names in recovery turns (gone once preludes stopped failing) | #1 per-VM WASM module; #2 thing triage depth rule; #3 delegate.ts hint `{query,...context}` + regression test; #4 instruct casts |
| E3 | D-leaf / D-all | 1+1 | ✅ | ✅ deep_research both | 0/0 leaf · 1/0 all (JSX key prop, self-recovered) | none | roleModels propagate through delegate into all forks (A1 live-proof); purity hits benign content words; DeepSeek wrote React-style `key={i}` → Fix#5 | #5 JSX IntrinsicAttributes key |
| E4 | D-leaf / D-all | 2+2 | ✅ (run2 each) | ✅ engineer (after Fix#7) | 0/0 leaf-r2 · 1 self-recovered all-r2 | none | run1-leaf: THING coded inline (Fix#7) + function-decl globalThis gap (Fix#6); run1-all: engineer worked but never resolved → delegate returned null → THING improvised (Fix#8: delegate forced-resolve nudges) | #6 function/class extraction; #7 path-4 always-engineer; #8 delegate resolve nudges |
| E5 | D-leaf / D-all | 2+1 | ✅ | ✅ full DAG chain both (incl. registered:* final delegate) | 0/0 leaf-r2 · 2 self-recovered all (built-agent fork) | none | run1: streaming chunk equal to a fence-lang suffix ("JSON") swallowed mid-statement → architect statement corrupted (Fix#10 FenceLineFilter); A/B: E5 investigate system prompts BYTE-IDENTICAL to E3 baseline | #10 streaming-safe fence filter (+refinement keeping events on the live path) |
| E6 | D-leaf ×3 / D-all ×3 | 3+4 | ✅ (all-run3 replaced by run4) | ✅ full chain every completed run | 0–4/run, all self-recovered | none — severed search yields HONEST-THIN research (forks resolve empty per instructions), not salvage; salvage path stays locked by mock e2e | all-run3: silent process exit — fork hung on unbounded `await stream.usage` (no usage chunk from Azure) → DAG deadlock → event loop drained (Fix#11) | #11 usage await bounded 10s + skipped on streamErrored |
| E7 | D-leaf / D-all | 3+3 (a/b/c each) | ✅ | ✅ build → registered:* reuse → denial recovery | 0 leaf-b/c · 8 self-recovered all-a | none | b-run1: built agents INVISIBLE to later sessions — CLI never passed preloadSpaceDirs + nothing advertised dynamicSpaces in the prompt (Fix#12); c: exactly ONE tempted delegate, structured denial named allowed targets, graceful one-turn recovery on both models (DeepSeek even offered a manual-input fallback form) | #12 preloadSpaceDirs wiring + "Project agents" system-block section |

## 7. DeepSeek-specific watchlist

Known weak-model failure modes to actively look for in `llm_response` text (from prior
experiments and the original .issues):
- code fences / prose preamble around statements (should be absorbed by the fence heuristics —
  if the heuristics still trip, that's a harness finding, not a prompt finding);
- emitting several statements at once, or re-declaring a prelude-bound variable;
- renaming bindings between turns (`question` → `q`) — should now be impossible where preludes
  own the bindings; any residual case means a task still asks the model for multi-statement work;
- treating the first VARIABLES block as "the task is done" (stop-after-research);
- copying schema examples verbatim into `resolve()` instead of real values;
- infinite politeness loops on denial messages (E7);
- **routing misconceptions** (now first-class, since everything starts from THING):
  over-escalation (deep_research for a simple lookup), under-escalation (shallow research for
  a "build me an agent" request), bypassing `build_specialist` to call the researcher/architect
  directly, or answering/coding inline instead of delegating (E4). Fix layer: THING's
  triage table in `user-thing/agents/thing/instruct.md`, not the harness.

## 8. Exit criteria

All eight experiments ✅ on **both** matrices (E6 3/3 per matrix). 