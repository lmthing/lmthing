# `tasklists/<slug>/` — DAG workflow

An action's step-by-step workflow. A tasklist is a directory `tasklists/<slug>/` containing an
`index.md` (frontmatter + overview) and numbered step files `NN-<task-id>.md`. Steps are sorted
lexically and executed per their `dependsOn` DAG. An agent action opts into a tasklist via
`actions[].tasklist` (see [../agents/](../agents/)).

## `index.md`

````md
---
input: {}                    # the tasklist's input contract (typeStrings)
connections: [slack]         # optional: providers the run may reach
---

Refresh every active source end-to-end: load active sources + known URLs, fetch each in parallel,
record only genuinely new raw_items. Never fabricate a title/URL/excerpt.
````

## `NN-<task-id>.md` — a step

Frontmatter + a markdown body whose ` ```ts ` snippets the runtime evaluates, resolving with
`currentTask.resolve(...)`:

````md
---
id: fetch_each
dependsOn: [load_sources]              # DAG edges (task ids)
forEach: load_sources.sourceIds        # fan-out: run once per array element (`item` = element)
optional: true                         # a failure here doesn't sink the run
role: general                          # execution role
functions:                             # ALLOWLIST — also gates system fns (webFetch/webSearch/fetch)
  - parseFeedEntries
  - webFetch
output:                                 # this task's output contract (typeStrings)
  ok: boolean
---

Fans out over each source id … load the source, fetch by `kind`, dedupe, insert new raw_items.

```ts
const source = db.query('sources', { where: { id: item } })[0];
currentTask.resolve({ ok: true });
```
````

## Step frontmatter fields

| Field | Purpose |
|---|---|
| `id` | Task id (referenced by other tasks' `dependsOn` and `<id>.<output>`). |
| `dependsOn` | Array of task ids that must resolve first (the DAG edges). `[]` = a root. |
| `output` | This task's output contract (typeStrings: `string`/`number`/`boolean`/`array`/…). |
| `role` | Execution role (e.g. `general`). |
| `forEach` | Optional fan-out: `"<taskId>.<field>"` array → the step runs once per element, exposed as `item`. |
| `optional` | Optional: a failure drops this branch instead of sinking the run. |
| `functions` | Optional **allowlist** — gates both space [functions](../functions/) AND system functions (`webFetch`/`webSearch`/`fetch`); anything not listed is stripped from the fork. |

A later task reads an earlier task's output by `<taskId>.<outputField>` (e.g.
`load_sources.sourceIds`). `index.md`'s `connections:` narrows which providers the run may reach
(intersected with the space's own provider(s)).

Real example: `store/projects/blog/spaces/newsroom/tasklists/refresh/{index,01-load_sources,02-fetch_each}.md`.
