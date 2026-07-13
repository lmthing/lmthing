# The `NN-<task-id>.md` step file

A tasklist step is one node in the tasklist DAG. Each `NN-<task-id>.md` (or `NN-<task-id>.ts` code node) sibling of the tasklist's `index.md` is loaded into a `TaskNode` by `loadTasklist`, which walks the interleaved node files and builds one node per file `sdk/org/libs/core/src/spaces/tasklist-load.ts:47-84`. A `.md` file is an **agent node** — its YAML frontmatter is parsed by `parseFrontmatter` and its Markdown body becomes the fork's instruction `sdk/org/libs/core/src/spaces/tasklist-load.ts:73-79`. A `.ts` file is a **code node** — its `const node = {…}` metadata literal is statically AST-extracted (never imported or executed by core) and it must export an async `run(ctx, inputs)` `sdk/org/libs/core/src/spaces/tasklist-load.ts:52-72`. Both paths feed the SAME field validator `buildTaskNode`, so a code node's `id`/`dependsOn`/`output`/… behave identically to an agent node's `sdk/org/libs/core/src/spaces/tasklist-load.ts:86-159`.

See also [`index-file.md`](./index-file.md) for the tasklist's `index.md` (goal + `input` schema), [`README.md`](./README.md) for tasklist structure, and [`../functions/README.md`](../functions/README.md) for the space functions a step's `functions:` allowlist selects from.

## The node id

The node `id` comes from an explicit `id:` frontmatter key, else from the filename with its leading numeric prefix (`01-`, `001_`, …) stripped `sdk/org/libs/core/src/spaces/tasklist-load.ts:99-101`. Ids are the keys of the loaded `tasks` record and thus the names other steps reference in `dependsOn`/`forEach` and read as upstream variables `sdk/org/libs/core/src/spaces/tasklist-load.ts:80`.

## Frontmatter fields

| Field | Meaning |
|---|---|
| `id` | Node id (overrides the filename-derived id) `sdk/org/libs/core/src/spaces/tasklist-load.ts:99-101` |
| `dependsOn` | Array of upstream task ids that must finish before this task is ready `sdk/org/libs/core/src/spaces/tasklist-load.ts:121-123` |
| `output` | Declared result schema (`field: type`); coerced to `field → String(type)` `sdk/org/libs/core/src/spaces/tasklist-load.ts:103-108` |
| `input` | Declared per-step input schema, parsed but see note below `sdk/org/libs/core/src/spaces/tasklist-load.ts:113-119` |
| `condition` | DSL expression; when it evaluates false the task is skipped `sdk/org/libs/core/src/spaces/tasklist-load.ts:124-126` |
| `optional` | `true` ⇒ a failing branch is skipped, not fatal `sdk/org/libs/core/src/spaces/tasklist-load.ts:127-129` |
| `goal` | `true` marks this the goal (envelope) task `sdk/org/libs/core/src/spaces/tasklist-load.ts:130-132` |
| `role` | Fork capability profile — `explore`/`plan` (read-only) or `general` (write); default `general` `sdk/org/libs/core/src/spaces/tasklist-load.ts:133-135` |
| `functions` | Allowlist of function names available to the fork (least privilege) `sdk/org/libs/core/src/spaces/tasklist-load.ts:136-138` |
| `forEach` | `"<upstreamTask>.<field>"` (or bare `"<upstreamTask>"`) — host-driven fan-out `sdk/org/libs/core/src/spaces/tasklist-load.ts:139-141` |
| `canDelegateTo` | Per-task delegation allowlist (`"space/agent"` or `"space/agent#action"`) `sdk/org/libs/core/src/spaces/tasklist-load.ts:142-144` |
| `prelude` | Host-executed TS statements run in the fork VM before the model's first turn `sdk/org/libs/core/src/spaces/tasklist-load.ts:145-156` |

### `dependsOn` and the DAG

`dependsOn` names upstream tasks; `validateDag` rejects a reference to an unknown task and detects cycles `sdk/org/libs/core/src/tasklist/dag.ts:15-59`. A task becomes ready only once every `dependsOn` entry is done or skipped `sdk/org/libs/core/src/tasklist/dag.ts:105-108`.

### `output` and its type vocabulary

`output` is a `field → type` map validated at resolve time by `validateOutput`; the accepted base types are `string`, `number`, `boolean`, `object`, `array`, `any`, and a trailing `?` marks a field optional `sdk/org/libs/core/src/tasklist/schema.ts:75-121`. The output schema string is also embedded in the fork's user message so the model knows the shape to resolve `sdk/org/libs/core/src/fork/fork.ts:319-320`.

### `role`

`role` is one of `explore`, `plan`, `general` `sdk/org/libs/core/src/spaces/tasklist-load.ts:133-135`; read-only roles have write host-tools (e.g. `writeFileRaw`, mutating `execShell`) withheld at VM injection and the fork prompt advertises only the read-only I/O it actually has `sdk/org/libs/core/src/fork/fork.ts:371-380`.

### `functions` — an allowlist that also gates system functions

When `functions` is set, the fork receives only those functions, intersected out of the engine's available set by `pickAllowed`; an empty array means no functions at all, and omitting it gives all `sdk/org/libs/core/src/fork/fork.ts:250-259`. The engine's function set is the merge of the agent's own space functions PLUS the universal **system toolkit** (`systemFunctionSources`) `sdk/org/libs/core/src/session/session.ts:599-601`. Because `webSearch` and `webFetch` are system-toolkit space functions `sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts` `sdk/org/libs/core/system-spaces/system-global/functions/webFetch.ts`, an explicit `functions:` list must include them or they are stripped from the fork — so the allowlist gates system functions, not just the agent's own.

The built-in **`fetch` global is NOT gated** by this allowlist. `pickAllowed` filters only the *space-function* record (`agentFunctions`/`agentFunctionsBundled` `sdk/org/libs/core/src/fork/fork.ts:250-260`), while `fetch` is injected into every child VM unconditionally by the shared bootstrap `sdk/org/libs/core/src/exec/bootstrap.ts:159`, and the fork's system prompt always advertises it `sdk/org/libs/core/src/fork/fork.ts:396`. There is no `functions/fetch.ts` in the system toolkit (`sdk/org/libs/core/system-spaces/system-global/functions/` holds `webFetch.ts`/`webSearch.ts`/`todoWrite.ts`/… but no `fetch`; the generic fs wrappers `readFile`/`grep` live in `system-engineer`, not here), so listing `fetch` in a `functions:` array is a harmless no-op — `pickAllowed` simply finds no such key `sdk/org/libs/core/src/fork/fork.ts:253-258`. Only `webFetch`/`webSearch` (real system-toolkit space functions) must be listed.

### `forEach` — host-driven fan-out that exposes `item`

`forEach: "<task>.<field>"` names an upstream array; the host resolves it (`resolveForEachItems`) and runs this task once per element in parallel (within the fork concurrency cap), injecting the element as `item` and its position as `index`, then collects the resolved values into an array for dependents `sdk/org/libs/core/src/tasklist/orchestrator.ts:263-278` · `sdk/org/libs/core/src/tasklist/orchestrator.ts:12-20`. The `forEach` head segment must also appear in `dependsOn`, enforced by `validateDag` `sdk/org/libs/core/src/tasklist/dag.ts:26-34`. The model never writes the loop — it just uses `item`.

### `optional` — drop the branch on failure

If an `optional` task's fork rejects, the orchestrator marks it skipped instead of throwing; a NON-optional (required) task failure throws `Required task "<id>" failed` and aborts the tasklist `sdk/org/libs/core/src/tasklist/orchestrator.ts:293-306`. An `optional` task whose dependencies were skipped (or whose `condition` is unmet) is likewise skipped rather than run `sdk/org/libs/core/src/tasklist/orchestrator.ts:153-162`.

### `condition`

`condition` is a DSL expression evaluated against accumulated outputs by `findReadyTasks`; when it is false (or throws) the task is not selected and is later skipped `sdk/org/libs/core/src/tasklist/dag.ts:111-121`.

### `canDelegateTo`

`canDelegateTo` is the per-task delegation allowlist; the fork gets a `delegate()` global only when this policy is non-empty AND the engine has a delegate runner, and the prompt lists exactly the allowed targets `sdk/org/libs/core/src/fork/fork.ts:243-245` · `sdk/org/libs/core/src/fork/fork.ts:401-416`.

### `prelude`

`prelude` is a YAML block scalar of TypeScript statements the host runs in the fork VM BEFORE the model's first turn — deterministic setup executed with host reliability instead of being re-emitted by the model `sdk/org/libs/core/src/spaces/tasklist-load.ts:39-44`. At load time only a non-empty-string check runs; deep validation is deferred to run time through `runPrelude` `sdk/org/libs/core/src/spaces/tasklist-load.ts:145-156` · `sdk/org/libs/core/src/exec/prelude.ts:108`.

## The body: instruction and evaluated TS

For an agent node the trimmed Markdown body becomes the fork's `instruction`, sent as the user message that opens the fork conversation `sdk/org/libs/core/src/spaces/tasklist-load.ts:78` · `sdk/org/libs/core/src/fork/fork.ts:319-320`. The fenced ` ```ts ` blocks in the body are the statements the fork is expected to emit; the runtime evaluates the model's TypeScript one statement at a time in the QuickJS sandbox (the standard turn loop) — the body is guidance, not code the loader executes. Deterministic setup that should NOT depend on the model re-emitting it belongs in `prelude` instead (host-executed, above).

## Resolving with `currentTask.resolve`

A fork completes by calling `currentTask.resolve(value)`; the host records the value only if it passes `validateOutput` against the node's `output` schema, otherwise it records a schema-mismatch error `sdk/org/libs/core/src/fork/fork.ts:268-276`. The fork's system prompt instructs the model to call it with an object matching the output schema `sdk/org/libs/core/src/fork/fork.ts:418`. `currentTask` exists only inside a task fork — it is declared in the fork's ambient DTS but excluded from the prelude's DTS, so a `currentTask.resolve()` in a prelude fails typecheck `sdk/org/libs/core/src/fork/fork.ts:338-343` · `sdk/org/libs/core/src/fork/fork.ts:478-485`.

## A later step reads an earlier step's output as `<id>.<field>`

Each finished task's output is stored in `allOutputs` under its id `sdk/org/libs/core/src/tasklist/orchestrator.ts:290`, and a dependent task's upstream outputs are gathered from its `dependsOn` list `sdk/org/libs/core/src/tasklist/orchestrator.ts:121-129`. Those upstream outputs are injected into the fork VM as named variables keyed by the upstream task id and declared in the ambient DTS as `declare const <id>: any` `sdk/org/libs/core/src/fork/fork.ts:300-301` · `sdk/org/libs/core/src/fork/fork.ts:332-334`. So a step reads an upstream result as `<upstreamId>.<field>` — e.g. `load_sources.knownUrls` in the fan-out step below.

## Worked example

Two real steps from the `blog` project-app's `newsroom/refresh` tasklist. `01-load_sources.md` resolves two arrays; `02-fetch_each.md` fans out over one of them, reads the other as `load_sources.knownUrls`, and is `optional` so a dead feed doesn't sink the run (adapted from `store/projects/blog/spaces/newsroom/tasklists/refresh/01-load_sources.md` and `.../02-fetch_each.md`):

````markdown
---
id: load_sources
role: general
dependsOn: []
output:
  sourceIds: array
  knownUrls: array
---
Load the active sources and the set of URLs already recorded.

```ts
const active = db.query('sources').filter(s => s.active !== false);
const known = db.query('raw_items').map(r => r.url);
currentTask.resolve({ sourceIds: active.map(s => s.id), knownUrls: known });
```
---
id: fetch_each
dependsOn: [load_sources]
forEach: load_sources.sourceIds   # `item` is one source id per parallel branch
optional: true                    # one flaky source must not sink the whole run
role: general
functions:                        # allowlist ALSO gates the system webFetch/webSearch
  - parseFeedEntries
  - webFetch
  - webSearch
output:
  ok: boolean
---
Fetch the source `item`, dedupe against `load_sources.knownUrls`, insert new raw_items.

```ts
const source = db.query('sources', { where: { id: item } })[0];
currentTask.resolve({ ok: true });
```
````

Source: `store/projects/blog/spaces/newsroom/tasklists/refresh/01-load_sources.md:1-18` and `store/projects/blog/spaces/newsroom/tasklists/refresh/02-fetch_each.md:1-80` (frontmatter at `02-fetch_each.md:1-19`). Note that the shipped `02-fetch_each.md` also lists `fetch` in its `functions:` allowlist with a comment claiming it would otherwise be stripped — that comment is wrong (see [`functions`](#functions--an-allowlist-that-also-gates-system-functions) above); the entry is an inert no-op, and the example here drops it.

## Note on the `input` field

A step-level `input:` frontmatter map is parsed into `TaskNode.input` `sdk/org/libs/core/src/spaces/tasklist-load.ts:113-119`, but **nothing reads it** — `TaskNode.input` is written at load time and never consumed by the orchestrator or the fork engine (the only other `.input` in the tasklist path is `tasklistDir.input`, the tasklist-level `index.md` schema). A per-step `input:` is therefore **declarative/documentation only**: it is not validated, not injected, and not enforced at runtime.

What a task actually receives is composed by the orchestrator: the seed **filtered to the tasklist-level `input` keys** (the hard filter at `sdk/org/libs/core/src/tasklist/orchestrator.ts:90-99`), merged with the upstream outputs of its `dependsOn` and, for a `forEach` element, `{ item, index }` `sdk/org/libs/core/src/tasklist/orchestrator.ts:236-248` · `sdk/org/libs/core/src/tasklist/orchestrator.ts:263-270`; the fork engine injects that union into the child VM as named variables `sdk/org/libs/core/src/fork/fork.ts:300-301`. Only the tasklist-level schema is validated against the seed, by `validateInput` `sdk/org/libs/core/src/tasklist/orchestrator.ts:75-88`.
