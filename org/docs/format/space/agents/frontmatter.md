# Agent `instruct.md` frontmatter — key reference

An agent's `agents/<slug>/instruct.md` may open with a YAML frontmatter block (delimited by `---` lines) parsed by `parseFrontmatter` `sdk/org/libs/core/src/spaces/frontmatter.ts#parseFrontmatter`. Malformed YAML throws (fail-loud) rather than silently producing empty data `sdk/org/libs/core/src/spaces/frontmatter.ts#parseFrontmatter`. When no frontmatter block is present the whole file is treated as the instruction body `sdk/org/libs/core/src/spaces/frontmatter.ts#parseFrontmatter`.

## Allowed keys (fail-loud allow-list)

Every top-level key must appear in `AGENT_FRONTMATTER_ALLOWED_KEYS` `sdk/org/libs/core/src/spaces/load.ts#AGENT_FRONTMATTER_ALLOWED_KEYS`. Any key outside that set aborts the entire space load with a `disallowed frontmatter key(s)` error `sdk/org/libs/core/src/spaces/load.ts:461-466`. This exists so a typo'd `capabilities`/`canDelegateTo` fails loudly instead of silently granting nothing `sdk/org/libs/core/src/spaces/load.ts:407-411`.

The allow-list is: `title`, `knowledge`, `functions`, `components`, `actions`, `defaultAction`, `canDelegateTo`, `dependencies`, `capabilities`, plus `model` and `triggers` `sdk/org/libs/core/src/spaces/load.ts#AGENT_FRONTMATTER_ALLOWED_KEYS`.

| Key | Type | Meaning |
|---|---|---|
| `title` | string | Human display name for the agent; defaults to the slug when absent `sdk/org/libs/core/src/spaces/load.ts:442,470`. |
| `knowledge` | string[] | Refs into `knowledge/` (see below) `sdk/org/libs/core/src/spaces/load.ts:473`. |
| `functions` | string[] | Refs into `functions/` (see below) `sdk/org/libs/core/src/spaces/load.ts:474`. |
| `components` | string[] | Refs into `components/{view,form}` (see below) `sdk/org/libs/core/src/spaces/load.ts:475`. |
| `actions` | object[] | Named tasklist entry points `{id,label,description,tasklist}` `sdk/org/libs/core/src/spaces/load.ts:493-505`. |
| `defaultAction` | string | An action `id` run host-driven for a freeform session (see below) `sdk/org/libs/core/src/spaces/load.ts:471`. |
| `canDelegateTo` | string[] | Delegation allowlist (tri-state; see below) `sdk/org/libs/core/src/spaces/load.ts:477-481`. |
| `dependencies` | string[] | **Deprecated** one-release alias for `canDelegateTo` `sdk/org/libs/core/src/spaces/load.ts:476,479-481`. |
| `capabilities` | string/object list | Project-app capability grants (see [capabilities.md](./capabilities.md)) `sdk/org/libs/core/src/spaces/load.ts:468`. |
| `model` | string | Model alias/spec this agent's turns run on; undefined = inherit caller `sdk/org/libs/core/src/spaces/load.ts:472` · `sdk/org/libs/core/src/spaces/load.ts:45-50`. |
| `triggers` | object[] | Inbound-webhook bindings `{webhook:{path,provider?}}` `sdk/org/libs/core/src/spaces/load.ts:506-544`. |

## `title`

`title` sets the agent's display name; when it is not a string the slug is used `sdk/org/libs/core/src/spaces/load.ts:442,470`.

## `knowledge` — resolves to `knowledge/<domain>/<field>`

Each `knowledge` entry is a `/`-separated ref `domain/field[/option]` `sdk/org/libs/core/src/spaces/load.ts:700`. At load time every ref is validated: the domain must exist under `knowledge/`, and (when given) the field and option must exist too — otherwise the space load throws `sdk/org/libs/core/src/spaces/load.ts:699-718`. The tree is built by `loadKnowledge`, which reads each `knowledge/<domain>/<field>/index.md` for the field's `type`/`variable`/`default` frontmatter and treats every other `.md` in the field dir as an option (aspect) file `sdk/org/libs/core/src/spaces/load.ts#loadKnowledge`. At runtime a ref is dereferenced by `resolveKnowledge`, which returns the domain/field overview or an individual option's body/frontmatter `sdk/org/libs/core/src/spaces/knowledge.ts#resolveKnowledge`. See [../knowledge/README.md](../knowledge/README.md).

## `functions` — resolves to `functions/*`

Each `functions` entry names a function whose source lives in the space's `functions/` directory `sdk/org/libs/core/src/spaces/load.ts:474`. Any ref not present in the loaded functions map throws at load `sdk/org/libs/core/src/spaces/load.ts:685-691`. Functions are loaded by `loadFunctionsFromDir` (keyed by file basename) `sdk/org/libs/core/src/spaces/load.ts#loadFunctionsFromDir`. See [../functions/README.md](../functions/README.md).

## `components` — resolves to `components/{view,form}`

Each `components` entry names a component that must exist in either `components/view/` or `components/form/`; a ref found in neither throws at load `sdk/org/libs/core/src/spaces/load.ts:692-698`. `loadComponents` reads each `<Name>.tsx`/`.ts` under those two dirs, keyed by basename `sdk/org/libs/core/src/spaces/load.ts#loadComponents`. See [../components/README.md](../components/README.md).

## `actions` and `defaultAction`

Each `actions` entry is parsed into an `ActionDef` `{id,label,description,tasklist}` `sdk/org/libs/core/src/spaces/load.ts:493-505` · `sdk/org/libs/core/src/spaces/load.ts#ActionDef`. Every `action.tasklist` must resolve to a real tasklist in the space or the load throws `sdk/org/libs/core/src/spaces/load.ts:662-670`. Actions are rendered into the system prompt as a `# Actions` list `sdk/org/libs/core/src/context/system-block.ts:237-242`. See [../tasklists/README.md](../tasklists/README.md).

`defaultAction` names an action `id` `sdk/org/libs/core/src/spaces/load.ts:471`. When set (and the session isn't started with `noDefaultAction`), a freeform session for this agent runs that action's tasklist deterministically host-driven via `runDelegate` instead of the model-driven turn loop `sdk/org/libs/core/src/session/session.ts:315-329` · `sdk/org/libs/core/src/spaces/load.ts:52-55`.

## `canDelegateTo` (and deprecated `dependencies`)

`canDelegateTo` is the delegation allowlist; `dependencies` is a deprecated fallback read only when `canDelegateTo` is absent `sdk/org/libs/core/src/spaces/load.ts:476-481`. It is tri-state: omitted (level default), `[]` (no delegation), `["*"]` (unrestricted), or an explicit allowlist enforced at yield time `sdk/org/libs/core/src/spaces/load.ts:38-44`. A warning fires only for the confusing combo where the frontmatter says `canDelegateTo: []` yet the instruct body calls `delegate()` `sdk/org/libs/core/src/spaces/load.ts:482-492`. See [delegation.md](./delegation.md).

## `capabilities`

`capabilities` is parsed by `parseCapabilities` into the agent's project-app grant set `sdk/org/libs/core/src/spaces/load.ts:468`. `loadAgent` always populates it (empty object when the key is absent) `sdk/org/libs/core/src/spaces/load.ts:450,564`. Full grant reference: [capabilities.md](./capabilities.md).

## Charter vs. instruction body

The frontmatter's markdown body becomes the agent's `instructBody` `sdk/org/libs/core/src/spaces/load.ts:459`, rendered as `# Agent Instructions` `sdk/org/libs/core/src/context/system-block.ts:232-234`. A separate optional `agents/<slug>/charter.md` (no frontmatter required) supplies fork-safe identity, rendered as `# Agent` before the instructions `sdk/org/libs/core/src/spaces/load.ts:547-553` · `sdk/org/libs/core/src/context/system-block.ts:229-231`. See [charter-file.md](./charter-file.md) and [instruct-file.md](./instruct-file.md).

## Worked example

Adapted from `sdk/org/libs/core/system-spaces/system-appbuilder/agents/app-architect/instruct.md` — every allowed key in one block:

```markdown
---
title: App Architect
knowledge:
  - app_building/model          # -> knowledge/app_building/model/
functions: []                    # -> functions/*
components: []                    # -> components/{view,form}/*
capabilities:
  - project:manage
  - db:schema
  - db:read
defaultAction: build_app         # runs the build_app action's tasklist host-driven
actions:
  - id: build_app
    label: Build App
    description: Turn a request into a working project.
    tasklist: build_app          # must resolve in tasklists/
canDelegateTo:
  - system-appbuilder/data-modeler
---

You are the App Architect. ...instruction body...
```

A key not on the allow-list (e.g. a typo'd `capabilties:`) aborts the whole space load `sdk/org/libs/core/src/spaces/load.ts:461-466`.
