# The `tasklists/` directory — a DAG workflow

A **tasklist** is a directory `tasklists/<slug>/` inside a space that holds a multi-step workflow: one `index.md` header plus numbered step files, executed as a dependency DAG of subagent forks (`sdk/org/libs/core/src/spaces/load.ts` `loadTasklists` :355-399). The runtime discovers tasklists per space (slug → `TasklistDir`) and each `TasklistDir` records the sorted node files, the `index.md` body, and its declared `input`/`connections` (`sdk/org/libs/core/src/spaces/load.ts#TasklistDir`).

## Directory shape

A tasklist directory contains an `index.md` (the header — see [index-file.md](./index-file.md)) plus step files named `NN-<task-id>.md` for agent nodes (`sdk/org/libs/core/src/spaces/load.ts:366-377`). Sibling `NN-<task-id>.ts` files are **code nodes** — they carry the same `NN-` prefix and interleave with the `.md` nodes in file order (`sdk/org/libs/core/src/spaces/load.ts:366-377`). `index.md` is the tasklist header and is explicitly excluded from the node list, and `.d.ts` files are never nodes (`sdk/org/libs/core/src/spaces/load.ts:368-374`).

Step files are collected and **sorted lexically** (`.sort()`), so the `NN` numeric prefix drives their order across both `.md` and `.ts` kinds (`sdk/org/libs/core/src/spaces/load.ts:370-377`). Each node's `id` defaults to the filename with its leading numeric prefix stripped (`01-load_sources.md` → `load_sources`), unless an explicit `id:` in frontmatter overrides it (`sdk/org/libs/core/src/spaces/tasklist-load.ts:99-101`).

## How steps execute — the DAG

Steps are **not** run in file order; file order only fixes the id sequence and the fallback goal. Execution follows the `dependsOn` DAG: each step declares the task ids that must resolve before it, and the orchestrator repeatedly finds ready tasks (all deps done or skipped) and runs them in parallel (`sdk/org/libs/core/src/tasklist/orchestrator.ts:145-179`, `findReadyTasks` `sdk/org/libs/core/src/tasklist/dag.ts#findReadyTasks`). Before running, `validateDag` checks every `dependsOn` reference resolves, that any `forEach` head is also a dependency, and that there are no cycles (DFS three-colour) or multiple explicit goals (`sdk/org/libs/core/src/tasklist/dag.ts#validateDag`).

Each agent node runs as a subagent **fork** over the step's markdown body as its instruction, with the step's `output` schema; the fork resolves by calling `currentTask.resolve({...})` (`sdk/org/libs/core/src/tasklist/orchestrator.ts:229-282`, `sdk/org/libs/core/src/fork/fork.ts:268-320`). `currentTask.resolve` is the fork's completion global: it records the value only after `validateOutput` confirms it matches the declared `output` schema, else it fails the fork (`sdk/org/libs/core/src/fork/fork.ts:268-276`). The user message handed to the fork appends the output schema and the instruction `When done, call: currentTask.resolve({ ...output })` (`sdk/org/libs/core/src/fork/fork.ts:319-320`).

A code node (`.ts`) instead runs its exported `run(ctx, inputs)` via a host-injected `codeNodeCtxFactory`; core never imports or executes the module, and if no factory is wired the code node fails as a required-task error (`sdk/org/libs/core/src/tasklist/orchestrator.ts:200-227`).

Downstream tasks read an upstream task's resolved output by the upstream **task id**: upstream outputs are injected into each fork as named variables keyed by dependency id (`sdk/org/libs/core/src/tasklist/orchestrator.ts:121-129`, `sdk/org/libs/core/src/fork/fork.ts:300-301`). A `forEach: "<taskId>.<field>"` step fans out once per element of that upstream array, injecting each element as `item` (+ `index`) and collecting the results (`sdk/org/libs/core/src/tasklist/orchestrator.ts:260-278`, `resolveForEachItems` :12-20).

## Goal, salvage, and the result envelope

The tasklist's **goal task** is the one marked `goal: true`, or the last task in file order when none is marked (`resolveGoalTask` `sdk/org/libs/core/src/tasklist/dag.ts#resolveGoalTask`). `runTasklist` returns a `TaskEnvelope` wrapping the goal task's output: `{ ok, degraded, data, reason?, degradedTasks? }`, where `ok` is false if the goal task itself salvaged and `degraded` is true if any task or `forEach` element salvaged (`sdk/org/libs/core/src/tasklist/orchestrator.ts:333-347`). An `optional: true` step that fails is skipped rather than sinking the run; a non-optional failure throws `Required task "…" failed` (`sdk/org/libs/core/src/tasklist/orchestrator.ts:293-306`).

The runtime **seed** is validated against the tasklist's declared `input` schema, and when a schema is declared the fork receives ONLY the declared keys (a hard filter of stray baggage) (`sdk/org/libs/core/src/tasklist/orchestrator.ts:75-99`). See [index-file.md](./index-file.md) for the `input`/`connections` header fields.

## Opting in — an agent action

A tasklist is not invoked directly by name from a step; an agent **opts into** it by declaring an `actions[]` entry whose `tasklist:` names the directory slug (`ActionDef` `sdk/org/libs/core/src/spaces/load.ts#ActionDef`, parsed from `actions:` frontmatter at `sdk/org/libs/core/src/spaces/load.ts:493-505`). Loading fails loudly if an action names a tasklist that does not exist (`sdk/org/libs/core/src/spaces/load.ts:662-670`). The action is declared in the agent's `instruct.md` frontmatter — see [../agents/instruct-file.md](../agents/instruct-file.md).

## Worked example

From the real `newsroom` space's `refresh` tasklist — a two-step DAG: `load_sources` (a root, `dependsOn: []`) feeds `fetch_each`, which fans out over each source id (`store/projects/blog/spaces/newsroom/tasklists/refresh/01-load_sources.md`, `store/projects/blog/spaces/newsroom/tasklists/refresh/02-fetch_each.md`):

````md
---
id: fetch_each
dependsOn: [load_sources]
forEach: load_sources.sourceIds   # fan out once per source id (item = element)
optional: true                    # one flaky source must not sink the run
role: general
functions: [parseFeedEntries, dedupeByUrl, webFetch, webSearch, fetch]
output:
  ok: boolean
---

Fans out over each source id produced by `load_sources`; `item` is one source id.

```ts
const source = db.query('sources', { where: { id: item } })[0];
// …fetch, dedupe against load_sources.knownUrls, insert new raw_items…
currentTask.resolve({ ok: true });
```
````

The `fetcher` agent opts into it via `actions[].tasklist: refresh` (also its `defaultAction`) in `store/projects/blog/spaces/newsroom/agents/fetcher/instruct.md:3-8`.

## See also

- [index-file.md](./index-file.md) — the `index.md` header: overview body, `input`, `connections`.
- [step-file.md](./step-file.md) — a step file's frontmatter (`id`, `dependsOn`, `output`, `forEach`, `optional`, `role`, `functions`, `canDelegateTo`, `condition`, `prelude`) and body.
- [../agents/instruct-file.md](../agents/instruct-file.md) — declaring the `actions[]` that opt into a tasklist.
