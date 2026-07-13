# Forks & Tasklist DAG Execution

A **fork** is an isolated child VM: a fresh QuickJS sandbox, its own turn loop, its own budget, and a one-way result channel (`currentTask.resolve`). The parent sees only the object the fork resolves — a natural context firewall (`sdk/org/libs/core/src/fork/roles.ts:3-9`). A **tasklist** is a DAG of tasks, each executed as a fork (or a host code node), scheduled by dependency edges (`sdk/org/libs/core/src/tasklist/orchestrator.ts` `runTasklist`).

Both `fork()` and `tasklist()` are value-yielding globals injected **only** into orchestrating contexts (top-level session, delegate) — never into a fork leaf, so a leaf cannot spawn its own subtree and bypass the concurrency semaphore or depth accounting (`sdk/org/libs/core/src/exec/capability.ts:52-55`, `sdk/org/libs/core/src/exec/bootstrap.ts:166-167`).

---

## `fork()`

### The global

`fork(opts)` and `tasklist(name, seed?)` are thin yield-pushers that abort the current turn and hand control to the host (`sdk/org/libs/core/src/globals/fork.ts#createForkGlobal`, `sdk/org/libs/core/src/globals/tasklist.ts#createTasklistGlobal`). The yield router resolves them against a lazily-built `ForkEngine`:

```ts
case 'fork': {
  if (!ctx.getForkEngine) return { handled: false }; // fork leaves have no fork()
  const engine = await ctx.getForkEngine();
  const task = req.args[0] as ForkTask;
  if (ctx.scope && !task.parentScope) task.parentScope = ctx.scope;
  const value = await engine.fork(task);
  return { handled: true, value };
}
```

`sdk/org/libs/core/src/eval/yield-router.ts:155-172`. A single `ForkEngine` is memoized per session (`sdk/org/libs/core/src/session/session.ts#Session.getForkEngine`).

Model-facing DTS (present only when `capabilities.orchestrate` is true):

```ts
declare function fork<T>(opts: ForkOpts<T>): Promise<T>;
```

with `ForkOpts` = `{ instruction; output: Record<string,string>; seed?; timeout?; role? }` (`sdk/org/libs/core/src/typecheck/library-dts.ts#FORK_DTS`, `:78-85`). The DTS surface is deliberately smaller than the internal `ForkTask` (`sdk/org/libs/core/src/fork/fork.ts#ForkTask`): fields like `functions`, `canDelegateTo`, `prelude`, `upstreamOutputs`, `taskId`, `tasklistDescription`, `parentScope` are set by the **orchestrator**, not written by the model in a bare `fork()` call.

### ForkEngine — concurrency semaphore

`ForkEngine` gates every fork through a counting semaphore capped at `maxConcurrentForks` (default 4; `sdk/org/libs/core/src/session/session.ts:737`). A fork over the cap is queued and released FIFO as slots free (`sdk/org/libs/core/src/fork/fork.ts:166-189`). The scope is minted `'queued'` *before* `acquireSlot()` so wait time is visible in the trace, then `activate`d once the slot is held (`sdk/org/libs/core/src/fork/fork.ts#ForkEngine.forkWithMeta`).

### Depth accounting & budget

Each fork asserts nesting depth **before** spending anything on a VM: `budget.assertForkDepth(depth)` throws `BudgetExceededError('forkDepth', …)` when `forkDepth > maxForkDepth` (`sdk/org/libs/core/src/fork/fork.ts:231-237`, `sdk/org/libs/core/src/eval/budget.ts#Budget.assertForkDepth`). A session's top-level forks default to depth 1 (`sdk/org/libs/core/src/session/session.ts:749-750`). Each fork runs its own fresh `Budget` from `budgetLimits` (`sdk/org/libs/core/src/fork/fork.ts:231`); the budget is a **hard** cost ceiling — a `BudgetExceededError` propagates and rejects the fork rather than salvaging (`sdk/org/libs/core/src/fork/fork.ts:528-530`).

### What a fork VM contains

The child VM is built by the shared `createChildVM` (`sdk/org/libs/core/src/fork/fork.ts:283-305`) with a **fork** capability profile (`forkCapabilities`, `sdk/org/libs/core/src/exec/capability.ts:94-97`): headless (no `ask`), non-orchestrating (no `fork`/`tasklist`), `delegate` only when the task opts in, and write/`registerSpace` gated by the role. A stray `ask()`/`fork()`/`tasklist()` call fails **typecheck** (a clean retryable error) because those declarations are absent from the fork's ambient DTS — not injected, not declared (`sdk/org/libs/core/src/fork/fork.ts:326-343`, `sdk/org/libs/core/src/typecheck/library-dts.ts:3-13`).

The fork's user message is assembled from the task `instruction`, a seed-variable summary, an upstream-inputs summary, the JSON output schema, and a final `currentTask.resolve({...})` instruction (`sdk/org/libs/core/src/fork/fork.ts:307-320`). The system prompt carries the role preamble, the parent agent's **charter** (fork-safe identity — `instruct.md` is deliberately NOT injected), the overall tasklist goal, the built-in-globals list, and full AST-derived signatures of the allowlisted space functions (`sdk/org/libs/core/src/fork/fork.ts:345-426`). Generic filesystem/shell is advertised **only** when the fork carries `fs:scratch` (an engineer general fork whose parent had the grant) — then the list offers `createScratch()` plus a scratch-jailed `readFile`/`writeFile`/`editFile`/`execShell`; every other fork is told explicitly there is NO filesystem and NO shell, and a fork that needs to run or persist code returns it to its delegator (only the engineer persists code, through the delegator's typed writers) (`sdk/org/libs/core/src/fork/fork.ts:369-404`).

### Roles

`role` selects a read-only preamble + host-tools profile (`sdk/org/libs/core/src/fork/roles.ts#PREAMBLES`):

| role | write? | preamble |
|---|---|---|
| `explore` | no | read/search/web only; write tools + mutating shell blocked (`roles.ts:32-40`) |
| `plan` | no | read-only architect; design a plan, don't implement (`roles.ts:41-48`) |
| `general` (default) | yes | full toolkit (`roles.ts:49-53`) |

Read-only is enforced physically: `roleProfile(role).allowWrite` is false for explore/plan (`sdk/org/libs/core/src/fork/roles.ts#roleProfile`), which blocks the internal `writeFileRaw` host write and rejects mutating shell commands at injection (`sdk/org/libs/core/src/globals/host-tools.ts:223-228`, `:186-187`). Those raw primitives are internal-only — never on any agent's model DTS regardless of role — so there is no model declaration to drop; a fork's generic scratch fs/shell is instead gated on `fs:scratch` (above). Read-only roles also lose `registerSpace` and get the `allowWrite`-intersected subset of app capabilities — every mutating grant (`db:write`/`pages:write`/…) is dropped, and because `intersectAppCaps` does not keep `fs:scratch` a read-only fork drops scratch too (`scratchFs:false`) (`sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps`, `:101-105`). Per-role model assignment (`roleModels`) lets cheap explore/plan forks run on a cheaper model (`sdk/org/libs/core/src/fork/roles.ts:60-71`).

### `prelude` — host-executed setup

A task's `prelude` (TS statements) runs in the fork VM **before** the model's first turn, through the same statement pipeline as the turn loop (yields allowed). Seed vars — including forEach `item`/`index` — are already injected, so the prelude can read them. Its bound values become the fork's first VARIABLES block, and per-statement failures bind the name `undefined` and are noted there — they never kill the fork (`sdk/org/libs/core/src/fork/fork.ts:59-63`, `:468-509`, `sdk/org/libs/core/src/exec/prelude.ts`). The prelude typechecks against an ambient **without** `currentTask` — resolving is the model's job (`sdk/org/libs/core/src/fork/fork.ts:480-487`).

### `currentTask.resolve` — the result channel

`currentTask` is injected only when the caller supplies a `currentTaskResolve` (`sdk/org/libs/core/src/exec/bootstrap.ts:114-117`, DTS at `:246`). For a fork it is a **schema-validating recorder** (`sdk/org/libs/core/src/fork/fork.ts:267-276`):

```ts
const currentTaskResolve = (value: unknown): void => {
  if (didResolve) return;              // first resolve wins
  didResolve = true;
  if (!validateOutput(outputSchema, value)) {
    resolvedError = new Error(`Fork output does not match schema ${JSON.stringify(outputSchema)}`);
  } else {
    resolvedValue = value;
  }
};
```

`validateOutput` checks each declared field's type (`string`/`number`/`boolean`/`object`/`array`/`any`), with a trailing `?` marking a field optional (`sdk/org/libs/core/src/tasklist/schema.ts#validateOutput`). It deliberately does **not** call `vm.dispose()` — the VM is disposed only after the turn loop exits, because disposing mid-QuickJS-call-frame aborts `JS_FreeRuntime` (`sdk/org/libs/core/src/fork/fork.ts:262-266`, `:592-594`).

### Salvage guarantee

After the main turn loop, a fork that returned **without** calling `resolve()` gets up to 2 forced resolve-only nudge turns — a fresh small `Budget({maxEpisodes:4})`, tools forbidden, hammered to emit exactly one `currentTask.resolve({...})` (`sdk/org/libs/core/src/fork/fork.ts:536-567`). If it still never resolves, the engine **salvages** a schema-valid neutral placeholder via `salvageData(task.output)` so orchestration can proceed (`sdk/org/libs/core/src/fork/fork.ts:579-590`).

Two exceptions bypass salvage:
- A **hard budget cap** on the main loop propagates as `BudgetExceededError` and rejects (`:528-530`).
- An **explicit `timeout`** opts into a hard time bound: the fork rejects on non-completion instead of guessing (`sdk/org/libs/core/src/fork/fork.ts:214-227`, `:579`). Tasklist tasks, delegates, and role forks set no timeout, so they always salvage.

Degradation is a **control-plane** signal, never prose inside the data: `forkWithMeta` returns `{ value, degraded, reason? }` (`ForkResultMeta`, `sdk/org/libs/core/src/fork/fork.ts:28-34`, `:142-162`); the bare `fork()` unwraps to just `.value` (`:133-135`). `reason` is `'budget'` (nudge turns exhausted their fresh budget) or `'no_resolve'` (model simply finished) (`sdk/org/libs/core/src/fork/fork.ts:585-589`).

### Per-task delegation

A fork has **no** `delegate()` unless the task opts in via `canDelegateTo` **and** the engine has a `delegateRunner` wired (`sdk/org/libs/core/src/fork/fork.ts:243-245`). The policy is parsed by `evaluateDelegatePolicy` (unified semantics: omitted/`[]` = none, `["*"]` = unrestricted, list of `"space/agent"` or `"space/agent#action"`, `"registered:*"` = any runtime-registered space). At yield time `isDelegateAllowed` gates the target; a disallowed target throws a clear denial naming the allowed targets (retryable), never a silent `undefined` (`sdk/org/libs/core/src/fork/fork.ts:450-457`). Full delegation semantics → [./delegation.md](./delegation.md).

---

## Tasklist DAG execution

`runTasklist(opts)` loads the tasklist, validates the DAG, and runs it to a `TaskEnvelope` (`sdk/org/libs/core/src/tasklist/orchestrator.ts#runTasklist`). Task node shape and on-disk format → [../format/space/tasklists/step-file.md](../format/space/tasklists/step-file.md).

### Seed validation & input hard-filter

If the tasklist declares an `input` schema (`tasklists/<name>/index.md` frontmatter), the runtime seed is validated against it (`validateInput`, throwing on a missing/mistyped field) (`sdk/org/libs/core/src/tasklist/orchestrator.ts:76-88`). A declared schema also **hard-filters** the seed: forks receive ONLY the declared keys, so stray delegator baggage never rides into leaf prompts — making a leaf's prompt a pure function of `(task file, declared inputs, upstream outputs, forEach item)` (`sdk/org/libs/core/src/tasklist/orchestrator.ts:90-99`). Host-injected `item`/`index` are added after the filter.

### DAG validation

`validateDag` enforces (`sdk/org/libs/core/src/tasklist/dag.ts#validateDag`):
- **At most one** explicit `goal: true` task (`:8-11`).
- Every `dependsOn` entry references a known task (`:15-23`).
- A `forEach` reference's head segment names a known task that is **also** in `dependsOn` (`:26-34`).
- **No cycles** — a WHITE/GRAY/BLACK DFS throws on a back-edge (`:37-58`).

### The goal task

`resolveGoalTask` returns the explicit `goal: true` task, else the **last task in file order** (object insertion order, which `loadTasklist` preserves in NN-prefix/file order) (`sdk/org/libs/core/src/tasklist/dag.ts:61-72`).

### Scheduling loop

The orchestrator loops until `done + skipped` covers all tasks (`sdk/org/libs/core/src/tasklist/orchestrator.ts:145`):

1. **`findReadyTasks`** returns every not-done/not-skipped task whose deps are all `done`-or-`skipped` AND whose `condition` (if any) evaluates true (`sdk/org/libs/core/src/tasklist/dag.ts#findReadyTasks`). A condition that throws is treated as not-met (`:112-120`).
2. All ready tasks run **in parallel** via `Promise.allSettled` (bounded further by the fork semaphore) (`sdk/org/libs/core/src/tasklist/orchestrator.ts:179-284`).
3. If **no** task is ready but tasks remain, any remaining task whose deps are satisfied and that is `optional` or has a `condition` is **skipped** (its condition/optional prerequisite can't be met). If nothing gets skipped, the tasklist is **stuck** and throws (`sdk/org/libs/core/src/tasklist/orchestrator.ts:148-171`).

Each fork is spawned via `forkWithMeta` seeded with the (filtered) tasklist input plus its upstream outputs keyed by dependency id (`getUpstreamOutputs`), carrying `role`/`functions`/`canDelegateTo`/`prelude`/`tasklistDescription` from the task node (`sdk/org/libs/core/src/tasklist/orchestrator.ts:120-129`, `:232-248`).

### `dependsOn` & upstream outputs

A task's resolved output is stored in `allOutputs[id]` (`sdk/org/libs/core/src/tasklist/orchestrator.ts:288-290`) and passed to dependents as `upstreamOutputs` — each dependency's output injected as a named variable matching its task id (`sdk/org/libs/core/src/fork/fork.ts:301`, `:313-317`). Upstream values stay **raw** schema data; degradation metadata never leaks into them (`sdk/org/libs/core/src/tasklist/orchestrator.ts:60-66`).

### `forEach` fan-out

When a task declares `forEach: "<upstreamTaskId>.<field>"` (or bare `"<upstreamTaskId>"`), the host resolves the referenced upstream array and runs the task **once per element in parallel**, injecting `item` + `index` as extra seed, and collects the resolved values into an array for dependents (`resolveForEachItems` + the `Promise.all` map, `sdk/org/libs/core/src/tasklist/orchestrator.ts:10-20`, `:263-278`). A non-array / missing reference resolves to `[]` (`:19`). The model never writes the loop. A salvaged element is labelled `"<taskId>[<index>]"` in the degradation aggregation (`:270-272`).

### `optional` tasks

An `optional` task that **fails** (its fork rejects) is skipped rather than failing the tasklist; a **required** (non-optional) task that fails throws `Required task "<id>" failed: <msg>`, aborting the whole run (`sdk/org/libs/core/src/tasklist/orchestrator.ts:293-306`).

### `condition` DSL

`condition` is a tiny, `eval`-free expression language (`sdk/org/libs/core/src/tasklist/condition-dsl.ts:1-13`):

```
expr    = clause (("AND"|"OR") clause)*
clause  = path op literal
op      = "==" | "!=" | ">" | "<" | ">=" | "<="
literal = string | number | true | false | null
```

`path` is dotted lookup into accumulated `outputs` (e.g. `plan.status`); `==`/`!=` use loose-null semantics (`undefined == null`); AND/OR combine left-to-right with **no precedence** (`sdk/org/libs/core/src/tasklist/condition-dsl.ts:61-153`). An unmet condition skips the task at scheduling time (`sdk/org/libs/core/src/tasklist/dag.ts:111-121`).

### Code nodes (`kind: 'code'`)

A tasklist node can be an `NN-<id>.ts` file exporting `const node = {…}` metadata + an async `run(ctx, inputs)`. Core **never** imports or executes the module — `loadTasklist` statically AST-extracts the `node` literal and confirms a `run` export (`sdk/org/libs/core/src/spaces/tasklist-load.ts#loadTasklist`, `:161-233`); the metadata goes through the same field validators as md frontmatter (`buildTaskNode`, `:92-159`). The host runs `run(ctx, inputs)` via an injected `codeNodeCtxFactory`; when that factory is **absent**, encountering a code node fails that task as a required-task error (`sdk/org/libs/core/src/tasklist/orchestrator.ts:36-57`, `:200-227`). A code node's `inputs` mirror exactly what an agent fork would receive (seed-filtered input + upstream outputs + `item`/`index`); it has **no salvage path** — `run` either returns or throws. `forEach` can fan out over a code node (`:210-224`).

### `TaskEnvelope` — the boundary result

Only the tasklist **boundary** is enveloped. The goal task's degradation determines `ok`/`reason`; any salvage anywhere in the DAG sets `degraded` and appends to `degradedTasks` (`sdk/org/libs/core/src/tasklist/orchestrator.ts:114-119`, `:250-282`, `:339-347`):

```ts
const envelope: TaskEnvelope = {
  ok: !goalDegraded,               // goal resolved un-salvaged
  degraded: degradedTasks.length > 0,
  data: goalOutput,                // goal task's RAW schema output
  ...(goalDegraded ? { reason: goalReason ?? 'no_resolve' } : {}),
  ...(degradedTasks.length > 0 ? { degradedTasks } : {}),
};
```

The model-facing DTS declares `tasklist()` as `Promise<any>` (branch on `r.ok`/`r.degraded`; payload is `r.data`) (`sdk/org/libs/core/src/typecheck/library-dts.ts#TASKLIST_DTS`).

**Hard failures still throw** (surfacing as retryable yield errors, not envelopes): invalid seed, stuck DAG, a required task failing, budget/timeout rejects, and a **skipped goal task**. A skipped goal means the pipeline short-circuited on an unmet upstream condition; the orchestrator fails loudly, folding in any upstream `errors`/`error` fields so the model sees *why* (`sdk/org/libs/core/src/tasklist/orchestrator.ts:310-331`) — this replaced the old silent-`null` failure mode.

---

## The per-task function allowlist

`functions: [...]` in a task node scopes which of the parent agent's space functions the fork can call (least privilege — fewer tools, shorter prompt) (`sdk/org/libs/core/src/spaces/tasklist-load.ts:29-31`). `pickAllowed` filters both the source and bundled-JS maps (`sdk/org/libs/core/src/fork/fork.ts:252-260`):

```ts
const fnAllow = task.functions;
const pickAllowed = <T,>(rec: Record<string, T>): Record<string, T> => {
  if (!fnAllow) return rec;              // omit → ALL functions
  const out: Record<string, T> = {};
  for (const name of fnAllow) if (name in rec) out[name] = rec[name]!;
  return out;                            // [] → NO functions at all
};
```

Semantics:
- **Omitted** → all of the parent's space functions are injected + advertised.
- **`[]`** (empty array) → **no** space functions at all — including `webSearch`/`webFetch` if those are provided as functions.
- **`["a","b"]`** → exactly those, if present.

Only the allowlisted functions get injected into the VM (`sdk/org/libs/core/src/fork/fork.ts:259-260`, `:293-294`), listed in the system prompt with full signatures (`:348-355`), and declared in the ambient DTS overlay (`:329-331`) — so a call to a non-allowlisted function fails typecheck. **Never forbid a tool in prose — disable it in frontmatter.**

---

## Cross-links

- [../format/space/tasklists/step-file.md](../format/space/tasklists/step-file.md) — the on-disk task node format (frontmatter fields, code-node files).
- [./delegation.md](./delegation.md) — `delegate()`, the registry, and `canDelegateTo` gating shared by forks.
- [./turn-loop.md](./turn-loop.md) — the per-turn statement/yield pipeline each fork runs internally.
- [./typecheck.md](./typecheck.md) — the ambient-DTS gating that makes an un-injected global fail typecheck.
