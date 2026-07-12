# `agents/<slug>/` — the AI specialists

Each agent is a directory `agents/<agent-slug>/` holding **two** files:

- **`charter.md`** — the persona / system preamble (plain markdown, no frontmatter).
- **`instruct.md`** — YAML frontmatter (config) + the operating-instructions body.

## `charter.md` — persona preamble

Plain markdown, **no frontmatter**. The agent's identity, voice, and hard guardrails — prepended
to its system prompt:

```md
You are the Fetcher for the lmthing.blog newsroom. You poll active sources and record new raw
items. You never fabricate URLs, titles, or excerpts — only what you actually fetched. You do not
write articles; synthesis happens downstream.
```

## `instruct.md` — config + instructions

YAML frontmatter (validated against an allow-list — an unknown key throws) followed by the
operating-instructions markdown body:

```yaml
---
title: Fetcher                       # display name
defaultAction: refresh               # optional freeform fallback action
actions:                             # the invocable actions
  - id: refresh
    label: Refresh sources
    description: Poll every active source and record any new items as raw_items.
    tasklist: refresh                # runs tasklists/refresh/ (optional — else freeform)
knowledge:                           # refs into knowledge/ tree (<domain>/<field>)
  - journalism/source-evaluation
functions:                           # refs to functions/*.ts this agent may call
  - parseFeedEntries
  - dedupeByUrl
components: []                        # refs to components/{view,form}
canDelegateTo: []                    # delegation policy (see table)
capabilities:                        # project-app grants (see table)
  - db:read:  { tables: [sources, raw_items] }
  - db:write: { tables: [raw_items, sources] }
---

## Action: refresh
Poll every active source … (system prompt body)
```

### Allowed frontmatter keys

`title`, `knowledge`, `functions`, `components`, `actions`, `defaultAction`, `canDelegateTo`,
`dependencies`, `capabilities`. **An unrecognized key (e.g. a typo'd `capabilties`) throws** — the
whole space load aborts (fail-loud).

Each `actions[]` entry has `id`, `label`, `description`, and an optional `tasklist` (the slug under
[../tasklists/](../tasklists/)); with no `tasklist` the action runs freeform. `defaultAction` names
the robust freeform fallback.

### `canDelegateTo` — delegation policy

| Value | Meaning |
|---|---|
| omitted | unrestricted delegation (back-compat default) |
| `[]` | **no delegation** — `delegate` global not injected, stripped from the typecheck DTS |
| `["*"]` | explicitly unrestricted |
| explicit list | hard allowlist — `"space/agent"` (any action) or `"space/agent#action"` (that action only); a violating `delegate()` throws |
| `"registered:*"` entry | additionally allow any space registered at runtime via `registerSpace()` |

The same table applies to a task's frontmatter `canDelegateTo` — except the *omitted* default there
is "no delegation".

### `capabilities` — project-app grants

Host-injected **only** when granted; a missing grant is also stripped from the typecheck DTS, so a
stray call fails typecheck, not just at runtime. Each list entry is either a **bare id** (full
scope) or a **single-key map** carrying that capability's config (narrowed scope).

| Capability | Unlocks | Config |
|---|---|---|
| `db:read` | `db.query`, `db.tables` | optional `{ tables: [...] }` (bare = all tables) |
| `db:write` | `db.insert`, `db.update`, `db.remove` | optional `{ tables: [...] }` |
| `db:schema` | `writeTableSchema`, `db.createTable`/`addColumn` | optional `{ tables: [...] }` |
| `pages:write` | `writePage` | bare only |
| `api:write` | `writeApi` | bare only |
| `hooks:write` | `writeHook` | bare only |
| `api:call` | `apiCall(name, input)` | **required** `{ allow: [...] }` |
| `project:manage` | `createProject`, `selectProject` | bare only |

Validation is fail-loud: an unknown id, config on a bare-only capability, a bare `api:call` (its
`allow` list is required), or a `db:*` `tables` entry naming a table absent from the project's
[database/](../../project/database/) all abort the space load.

> **Least-privilege in practice:** the `app-architect` orchestrator holds the full authoring set;
> specialists hold only their slice (`data-modeler` = `db:schema`+`db:read`; `page-builder` =
> `pages:write`+`db:read`; `api-author` = `api:write`+`db:read`; `automator` = `hooks:write`).

Real examples: `store/projects/blog/spaces/newsroom/agents/fetcher/{charter,instruct}.md`,
`.lmthing/system/spaces/user-thing/agents/thing/instruct.md`.
