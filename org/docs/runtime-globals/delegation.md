# Delegation globals — `delegate`, `fork`, `tasklist`, `currentTask`

The globals an agent uses to put work on other agents/VMs. `delegate`, `fork` and `tasklist` are **value-yielding**: calling one pushes a `YieldRequest` onto the VM's pending queue, ends the turn, and the host binds the resolved value back into scope for the next turn (`sdk/org/libs/core/src/globals/delegate.ts#createDelegateGlobal`, `sdk/org/libs/core/src/globals/fork.ts#createForkGlobal`, `sdk/org/libs/core/src/globals/tasklist.ts#createTasklistGlobal`); all three are resolved by the one shared router (`sdk/org/libs/core/src/eval/yield-router.ts:155-183`). `currentTask.resolve()` is the counterpart on the child side — a **synchronous** host call that records a fork's/delegate's result (`sdk/org/libs/core/src/exec/bootstrap.ts:114-119`).

Injection and DTS are driven from one `CapabilityProfile` per VM context, so a global that is not injected is also not declared — a stray call fails **typecheck**, not at runtime (`sdk/org/libs/core/src/exec/capability.ts:36-45`, `sdk/org/libs/core/src/exec/bootstrap.ts#buildAppCapabilityDts`). See [./README.md](./README.md) for the whole globals surface.

| Global | Yield kind | Gate (`CapabilityProfile`) | session | delegate VM | fork leaf |
|---|---|---|---|---|---|
| `fork` | `fork` | `orchestrate` — `sdk/org/libs/core/src/exec/bootstrap.ts:165-168` | ✅ | ✅ | ❌ |
| `tasklist` | `tasklist` | `orchestrate` — same check | ✅ | ✅ | ❌ |
| `delegate` | `delegate` | `delegate` (from the unified `canDelegateTo` policy) — `sdk/org/libs/core/src/exec/bootstrap.ts:169` | policy | policy | only via task `canDelegateTo` + a wired `delegateRunner` |
| `currentTask` | — (sync) | `ChildVMOpts.currentTaskResolve` present — `sdk/org/libs/core/src/exec/bootstrap.ts:114-119` | ❌ | ✅ | ✅ |

`orchestrate` is `true` for sessions and delegates and `false` for fork leaves, so a leaf cannot spawn its own subtree and bypass the concurrency semaphore / depth accounting (`sdk/org/libs/core/src/exec/capability.ts:52-55`, `:84-107`).

---

## `delegate(packageName, agentName, action?, opts?)`

```ts
declare function delegate(packageName: string, agentName: string, opts?: DelegateOpts): Promise<any>;
declare function delegate(packageName: string, agentName: string, action?: string, opts?: DelegateOpts): Promise<any>;
```
(`sdk/org/libs/core/src/typecheck/library-dts.ts#DELEGATE_DTS`)

- `action` is **optional**. With an action id the child runs that action (its tasklist if it has one); without one the child runs model-driven and sees its own actions/tasklists in its system prompt (`sdk/org/libs/core/src/globals/delegate.ts:13-21`).
- For ergonomics `delegate(pkg, agent, opts)` is accepted — an object in the `action` slot is re-read as `opts` (`sdk/org/libs/core/src/globals/delegate.ts#createDelegateGlobal`).
- `DelegateOpts = { query?: string; context?: unknown; attachmentIds?: string[] }` (`sdk/org/libs/core/src/globals/delegate.ts#DelegateOpts`; DTS twin at `sdk/org/libs/core/src/typecheck/library-dts.ts:87-93`). `attachmentIds` are upload ids the session resolves to real bytes/notes before handing them to the delegate — images ride as a `MediaPart`, files become an id-anchored note telling the specialist to call `readDocument(id)` (`sdk/org/libs/core/src/session/session.ts:1071-1079`). Each id must exactly match one seen in this session's `attachmentNote()` (the delegating agent retypes it by hand — there is no copy-by-reference); an id that matches NONE of them throws a named, actionable error listing the mismatched id(s) and every real attachment (filename + id) so a retry can self-correct, instead of silently handing the delegate zero attachment info indistinguishable from "nothing was ever attached" (`sdk/org/libs/core/src/session/session.ts:1043-1070`).
- The return type is `any` by convention, so `result.field` reads without a cast.

### The `canDelegateTo` policy — one evaluator, one gate

A raw `canDelegateTo` declaration (agent `instruct.md` frontmatter, or task frontmatter) is evaluated into a `DelegatePolicy` by `evaluateDelegatePolicy(entries, level)` (`sdk/org/libs/core/src/exec/target-match.ts#evaluateDelegatePolicy`):

| Declaration | agent level | task level |
|---|---|---|
| key omitted | `unrestricted` (back-compat) | `none` |
| `[]` | `none` | `none` |
| `["*"]` | `unrestricted` | `unrestricted` |
| explicit list | `allowlist` | `allowlist` |
| `registered:*` (may accompany entries) | any space registered at runtime via `registerSpace()` | same |

The loader deliberately preserves *omitted vs empty* (`sdk/org/libs/core/src/spaces/load.ts:36-44`, `:445-447`) — that tri-state is what makes `[]` mean "no delegation" instead of "default".

The policy is enforced **twice**, from the same value:

1. **Injection + DTS.** `policy.mode !== 'none'` becomes `CapabilityProfile.delegate`, so an agent with `canDelegateTo: []` has no `delegate` global *and* no `DELEGATE_DTS` — a stray call fails typecheck (`sdk/org/libs/core/src/session/session.ts:262`, `:641`; `sdk/org/libs/core/src/delegate/delegate.ts:143`, `:157`; `sdk/org/libs/core/src/exec/bootstrap.ts:318`). The system prompt drops its delegation section too (`omitDelegate`, `sdk/org/libs/core/src/delegate/delegate.ts:152`).
2. **Yield time.** Every delegate path — session VM, delegate VM, fork leaf — calls the *same* `isDelegateAllowed(policy, packageName, agentName, dynamicSpaces)` (`sdk/org/libs/core/src/exec/target-match.ts#isDelegateAllowed`) and, on refusal, throws `formatDelegateDenial(...)` — an actionable, retryable message naming the allowed targets (`sdk/org/libs/core/src/exec/target-match.ts#formatDelegateDenial`). Call sites: session `sdk/org/libs/core/src/session/session.ts:915-922`, delegate `sdk/org/libs/core/src/delegate/delegate.ts:376-380`, fork leaf `sdk/org/libs/core/src/fork/fork.ts:450-457`.

Matching tolerates the ref grammar (`self` / `space/agent` / `npm:pkg/agent`, each with an optional `#action`; split on the LAST `/` so scoped npm names work) — `sdk/org/libs/core/src/delegate/ref.ts#parseDelegateRef` — plus symmetric directory-suffix tolerance (`"a/b/c" ~ "c"`) (`sdk/org/libs/core/src/exec/target-match.ts:25-50`). `registered:*` is satisfied when the package name matches a key/dir/packageName in the session-shared `dynamicSpaces` map at call time (`sdk/org/libs/core/src/exec/target-match.ts#matchesRegisteredSpace`); the agent-existence check is deliberately NOT done there, so a wrong agent slug fails downstream with a precise "agent not found" rather than a misleading policy denial (`sdk/org/libs/core/src/exec/target-match.ts:153-158`). Spaces land in that map via `registerSpace(dir)` (documented in [./session-and-utils.md](./session-and-utils.md#registerspacedir)) or via the consent-gated `installSpace()` (`sdk/org/libs/core/src/eval/yield-router.ts:303-311`, see [./store-and-consent.md](./store-and-consent.md)).

**Action narrowing.** An allowlist entry may carry `#action`. A match with no `#action` allows every action; otherwise only the listed ones (`sdk/org/libs/core/src/exec/target-match.ts#resolveTaskDelegate`). The resulting `allowedActions` is passed into `runDelegate`, which rejects a disallowed action id (`sdk/org/libs/core/src/delegate/delegate.ts:118-122`).

Real declaration (THING) — `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:9-19`:

````md
canDelegateTo:
  - system-research/researcher
  - system-architect/architect
  - system-engineer/engineer
  - system-appbuilder/automator
  - system-store/finder
  - system-vision/vision
  - system-files/dispatch
  - user-memory/memory
  - "registered:*"
````

### What a delegate run does

`runDelegate` (`sdk/org/libs/core/src/delegate/delegate.ts#runDelegate`):

- rejects past a recursion cap — `depth >= maxDepth` throws `Maximum delegation depth (N) exceeded…` (`:94-98`); the session wires `depth: 0, maxDepth: 5` for a model-initiated delegate (`sdk/org/libs/core/src/session/session.ts:969-970`) and `depth: 1, maxDepth: 5` for one initiated by a task fork (`sdk/org/libs/core/src/session/session.ts:701-702`); each nested layer recurses with `depth + 1` (`sdk/org/libs/core/src/delegate/delegate.ts:284`).
- resolves the target from a `DelegateRegistry` built from the space, its dependent spaces, **all system spaces**, and `dynamicSpaces` (`sdk/org/libs/core/src/session/session.ts:924-938`).
- runs the delegated agent's own turn loop under `delegateCapabilities(...)`: **no `ask`**, no `registerSpace`, no `progress()`, but full `orchestrate` (its own `fork`/`tasklist`) and its own `canDelegateTo` policy and app grants — project-rooted at the **parent's** `projectRoot` (`sdk/org/libs/core/src/exec/capability.ts:106-108`; `sdk/org/libs/core/src/delegate/delegate.ts:157`, `:193-220`).
- captures the result via `currentTask.resolve` (`:209-212`), and **auto-captures** the action's tasklist envelope if the model forgets to resolve (`:175-177`, `:362-367`).
- if still unresolved, forces up to 2 resolve-only nudge turns on a fresh `Budget({maxEpisodes:4})` before returning `undefined` (`:397-430`).

---

## `fork(opts)`

```ts
declare function fork<T>(opts: ForkOpts<T>): Promise<T>;
```
(`sdk/org/libs/core/src/typecheck/library-dts.ts#FORK_DTS`; `ForkOpts` at `:78-85`)

`ForkGlobalOpts = { instruction, output, seed?, timeout?, taskId?, upstreamOutputs?, role? }` — `output` is **required**: it is the schema the fork must `currentTask.resolve()` (`sdk/org/libs/core/src/globals/fork.ts#ForkGlobalOpts`).

**Roles.** `role: 'explore' | 'plan' | 'general'` (default `general`). `explore`/`plan` are read-only: `roleProfile(role).allowWrite === false` withholds `writeFileRaw` and mutating shell **at injection**, and the role's system-prompt preamble says so (`sdk/org/libs/core/src/fork/roles.ts#PREAMBLES`, `:79-82`; `sdk/org/libs/core/src/exec/capability.ts:94-97`). App grants are intersected the same way — a read-only role keeps only `db:read`, `api:call`, `connections:use`, `store:read`; every write/authoring grant is dropped (`sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps`). The read-only DTS also drops `execShell`/`writeFileRaw` (`sdk/org/libs/core/src/exec/bootstrap.ts:324-325`).

**Fork-leaf capability profile** (`forkCapabilities`, `sdk/org/libs/core/src/exec/capability.ts:94-97`): no `ask`, no `orchestrate` (so no nested `fork`/`tasklist` — the DTS omits both, `sdk/org/libs/core/src/exec/bootstrap.ts:316-317`), no `setSessionMeta`, `registerSpace` only when `allowWrite`, and `delegate` only when the task's policy allows it **and** the engine has a `delegateRunner` (`sdk/org/libs/core/src/fork/fork.ts:243-245`).

**Execution** (`ForkEngine.forkWithMeta` → `runFork`, `sdk/org/libs/core/src/fork/fork.ts#ForkEngine`):

- a concurrency semaphore (`maxConcurrentForks`, default 4) queues forks; wait time is traced as a `queued` scope (`:146-189`; default at `sdk/org/libs/core/src/session/session.ts:737`).
- a fresh `Budget` per fork; `budget.assertForkDepth(depth)` rejects a too-deep fork with `BudgetExceededError` **before** a VM is built (a session's top-level forks are depth 1) (`sdk/org/libs/core/src/fork/fork.ts:231-236`; `sdk/org/libs/core/src/eval/budget.ts#Budget.assertForkDepth`).
- `currentTask.resolve(value)` is schema-validated against `output`; a mismatch is an error, not a silent pass (`sdk/org/libs/core/src/fork/fork.ts:268-276`).
- if the model finishes without resolving, up to 2 forced resolve-only turns run on a fresh `Budget({maxEpisodes:4})` (`:538-567`); if it still never resolves and the task set **no `timeout`**, the host salvages a schema-valid neutral placeholder (`""`/`0`/`false`/`[]`/`{}` — never prose) and flags `degraded` (`:579-590`; `sdk/org/libs/core/src/exec/envelope.ts#salvageData`). An explicit `timeout` opts out of salvage and rejects (`:214-227`, `:579`).
- a `BudgetExceededError` raised by the fork's OWN turn loop propagates and rejects — the budget is a hard cost ceiling, so it never reaches the salvage path (`:528-530`).

`seed` and `upstreamOutputs` are injected as **real VM variables** (and ambient `declare const` names) before the first turn (`sdk/org/libs/core/src/fork/fork.ts:301`, `:332-343`).

---

## `tasklist(name, seed?)` and the `TaskEnvelope`

```ts
/** Runs a named tasklist. Resolves to { ok, degraded, data, reason?, degradedTasks? } — branch on r.ok/r.degraded; the goal output is r.data. */
declare function tasklist(name: string, seed?: Record<string, unknown>): Promise<any>;
```
(`sdk/org/libs/core/src/typecheck/library-dts.ts#TASKLIST_DTS`)

The yield routes to `runTasklist({ name, space, forkEngine, seed, tracer, parentScope, codeNodeCtxFactory })` — the same shared `ForkEngine` as `fork()`, so one semaphore bounds both (`sdk/org/libs/core/src/eval/yield-router.ts:164-172`).

`runTasklist` returns a **`TaskEnvelope`** (`sdk/org/libs/core/src/exec/envelope.ts#TaskEnvelope`):

```ts
interface TaskEnvelope<T = unknown> {
  ok: boolean;            // goal task resolved un-salvaged
  degraded: boolean;      // any salvage anywhere in the DAG (incl. forEach elements)
  data: T;                // ALWAYS schema-shaped; salvaged fields are neutral empties
  reason?: 'no_resolve' | 'schema_mismatch' | 'budget' | 'timeout';
  degradedTasks?: string[]; // e.g. ["investigate[3]"]
}
```

Built at the tasklist boundary (`sdk/org/libs/core/src/tasklist/orchestrator.ts:333-346`). Hard failures — invalid seed, stuck DAG, skipped goal, budget/timeout rejections — still **throw** and surface as retryable yield errors (`:82-86`, `:325-331`, `:337-338`).

- The `seed` is validated against the tasklist's declared `input` schema and then **filtered to the declared keys only** (extra baggage a delegator packed in is dropped); no declared schema ⇒ full passthrough (`sdk/org/libs/core/src/tasklist/orchestrator.ts:75-99`).
- Each agent task is run through `forkEngine.forkWithMeta`, forwarding the step file's `role`, `functions`, `canDelegateTo`, `prelude` and the tasklist goal as standing context (`sdk/org/libs/core/src/tasklist/orchestrator.ts:232-247`) — the frontmatter fields defined in `sdk/org/libs/core/src/spaces/tasklist-load.ts#TaskNode`. See [../format/space/tasklists/step-file.md](../format/space/tasklists/step-file.md).
- `forEach: "<upstreamTask>.<field>"` fans a task out over an upstream array, in parallel, injecting `item`/`index` — the model never writes the loop (`sdk/org/libs/core/src/tasklist/orchestrator.ts:263-269`; validated in `sdk/org/libs/core/src/tasklist/dag.ts:26-33`).
- When a **delegate** runs a capturable action tasklist, the envelope is captured **untouched** and returned to the delegator, so a `delegate()` caller sees the same contract as a direct `tasklist()` caller (`sdk/org/libs/core/src/delegate/delegate.ts:359-367`).

A real task that combines all of it — `sdk/org/libs/core/system-spaces/user-thing/tasklists/build_specialist/01-research.md:1-14`:

````md
---
id: research
output:
  report: object
dependsOn: []
optional: true
goal: false
role: explore
functions: []
canDelegateTo:
  - system-research/researcher#deep_research
prelude: |
  const researchEnv = request ? await delegate('system-research', 'researcher', 'deep_research', { query: String(request) }) : { ok: false, degraded: true, data: {} };
---
````

`role: explore` ⇒ read-only fork; `functions: []` ⇒ no space functions at all; `canDelegateTo` ⇒ `delegate` is injected into the leaf but gated to exactly that one target+action; the `prelude` runs host-side in the fork VM before the model's first turn, and its yields route through the same router as model statements (`sdk/org/libs/core/src/fork/fork.ts:463-509`).

---

## `currentTask.resolve(value)`

```ts
declare const currentTask: { resolve: (value: unknown) => void };
```
(`sdk/org/libs/core/src/exec/bootstrap.ts:246`)

Injected **only** when the host supplies `currentTaskResolve` — i.e. fork leaves and delegates, never the top-level session (`sdk/org/libs/core/src/exec/bootstrap.ts:114-119`). It is the sole channel by which a child context's value reaches its parent: a fork's parent sees only what it resolves (the context firewall described in the role preamble, `sdk/org/libs/core/src/fork/roles.ts#FIREWALL_TAIL`). Implementations must not dispose the VM from inside the callback — they record the value and the caller disposes after the turn loop exits (`sdk/org/libs/core/src/exec/bootstrap.ts:110-113`, `sdk/org/libs/core/src/fork/fork.ts:262-267`).

- **fork**: the value is schema-validated against the task's `output` (`sdk/org/libs/core/src/fork/fork.ts:268-276`).
- **delegate**: the value is captured as the delegate's return value (`sdk/org/libs/core/src/delegate/delegate.ts:209-212`, `:437`).

---

## Role & budget forwarding

Both `ForkEngine` construction sites — the session (`sdk/org/libs/core/src/session/session.ts#Session.getForkEngine`) and each delegate (`sdk/org/libs/core/src/delegate/delegate.ts:294-326`) — go through `forkEngineOptsFrom(...)`, a mapped type in which **every** `ForkEngineOpts` field must be spelled out. This is the structural fix for the A1 drift bug where the delegate site silently dropped `budgetLimits` / `roleModels` / `forkDepth` / `dynamicSpaces`, so leaf forks under a delegate ran uncapped, on the wrong model, with meaningless depth accounting (`sdk/org/libs/core/src/exec/fork-config.ts:3-27`).

What is forwarded down a delegation chain:

| Thing | Forwarded as | Where |
|---|---|---|
| Host budget caps (`maxEpisodes`, `maxToolCalls`, `maxForkDepth`, `maxWallClockMs`) | `budgetLimits` — a fresh `Budget` per fork; the delegate's own turn loop has none | `sdk/org/libs/core/src/delegate/delegate.ts:76-81`, `:313`; `sdk/org/libs/core/src/eval/budget.ts#BudgetLimits` |
| Per-role fork models | `roleModels` (`explore`/`plan`/`general`) → `modelForRole()` | `sdk/org/libs/core/src/fork/roles.ts:65-71`; `sdk/org/libs/core/src/fork/fork.ts:525`; CLI env `LM_MODEL_ROLE_EXPLORE/_PLAN/_GENERAL` at `sdk/org/libs/cli/src/cli/bin.ts#readRoleModels` |
| Delegated agent's own model | `agent.model` frontmatter overrides the inherited one for its turns | `sdk/org/libs/core/src/delegate/delegate.ts:102-105`; `sdk/org/libs/core/src/spaces/load.ts:45-50` |
| Fork nesting depth | `forkDepth: opts.depth + 1` — forks under a nested delegate are one level deeper | `sdk/org/libs/core/src/delegate/delegate.ts:315-318` |
| Registered spaces | the **same** `dynamicSpaces` Map reference, so a `registerSpace()` inside a fork/delegate is visible to the parent's later `delegate()` | `sdk/org/libs/core/src/delegate/delegate.ts:85-88`, `:319`; `sdk/org/libs/core/src/session/session.ts:754` |
| Project scope + app grants | `projectRoot`/`projectId`/`projectSpacesDir`, `appGlobals`, and `parentAppCapabilities` (role-intersected in the fork) | `sdk/org/libs/core/src/delegate/delegate.ts:306-311` |
| Attachments resolver | `documentResolver` — a fork/delegate can `readDocument(id)`, including when a session task fork delegates again | `sdk/org/libs/core/src/delegate/delegate.ts:L324-L326` · `sdk/org/libs/core/src/session/session.ts:L684-L733` |

The delegate leg also re-exposes its own `delegate()` to its tasks: a task's `delegate()` is routed through `delegateRunner`, which recurses with `depth + 1` under the same `maxDepth` bound (`sdk/org/libs/core/src/delegate/delegate.ts:269-285`, `:320-323`; session equivalent at `sdk/org/libs/core/src/session/session.ts#Session.runDelegateForFork`, `:763`).

---

## Error contract (what the model sees)

| Situation | Result |
|---|---|
| `delegate()` in an agent/task with `canDelegateTo: []` | not injected + not declared ⇒ **typecheck** error (`sdk/org/libs/core/src/exec/bootstrap.ts:169`, `:318`) |
| `delegate()` to a target outside the allowlist | thrown yield error: `delegate("x","y") is not permitted from this agent — allowed targets: …` (`sdk/org/libs/core/src/exec/target-match.ts#formatDelegateDenial`) |
| `delegate()` with a disallowed `#action` | `Delegate target "s/a" does not allow action "x" — allowed actions: …` (`sdk/org/libs/core/src/delegate/delegate.ts:118-122`) |
| delegation deeper than `maxDepth` (5) | `Maximum delegation depth (5) exceeded at target "…"` (`sdk/org/libs/core/src/delegate/delegate.ts:94-98`) |
| `delegate()` from a fork task with no `delegateRunner` wired | `delegation is not available in this context` (`sdk/org/libs/core/src/fork/fork.ts:455`) |
| `fork()`/`tasklist()` inside a fork leaf | not injected + not declared ⇒ **typecheck** error; the yield router also leaves those kinds unhandled (`sdk/org/libs/core/src/eval/yield-router.ts:156`, `:165`) |
| fork resolves a value that does not match `output` | `Fork output does not match schema {…}` (`sdk/org/libs/core/src/fork/fork.ts:271-273`) |
| fork never resolves, no `timeout` | salvaged neutral value, `degraded: true`, `reason: 'no_resolve' \| 'budget'` (`sdk/org/libs/core/src/fork/fork.ts:579-590`) |
| fork never resolves, explicit `timeout` | rejects (`Fork timed out after Nms`, or `Fork completed without calling currentTask.resolve()`) (`sdk/org/libs/core/src/fork/fork.ts:217-225`, `:600`) |
| tasklist seed fails its `input` schema | `Tasklist "x" received an invalid seed: …` (`sdk/org/libs/core/src/tasklist/orchestrator.ts:82-86`) |
| tasklist goal skipped by an unmet condition | `Tasklist "x" produced no result: its goal task "…" was skipped …` (`sdk/org/libs/core/src/tasklist/orchestrator.ts:325-331`) |

---

## See also

- [../format/space/agents/delegation.md](../format/space/agents/delegation.md) — authoring `canDelegateTo` in agent frontmatter (the declaration side of the policy above).
- [../format/space/tasklists/step-file.md](../format/space/tasklists/step-file.md) — the task frontmatter (`role`, `functions`, `canDelegateTo`, `forEach`, `prelude`, `output`) this page's fork/tasklist behaviour is driven by.
- [./README.md](./README.md) — the full runtime-globals surface and the capability→{inject, DTS} registry.
