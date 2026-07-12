# The `capabilities:` frontmatter grant model

`capabilities:` is one of the allow-listed keys of an agent's `instruct.md` frontmatter (`sdk/org/libs/core/src/spaces/load.ts:422`), parsed by `parseCapabilities(data['capabilities'], { agentId, knownTables })` during `loadAgent` (`sdk/org/libs/core/src/spaces/load.ts:468`). It declares which **project-app globals** the agent may call; every other frontmatter key is covered in [frontmatter.md](./frontmatter.md). This is a least-privilege model: an agent receives exactly the globals its grants earn, and a grant that is absent is absent from BOTH the injected globals AND the typecheck DTS, so a stray call fails typecheck instead of reaching the engine (`.lmthing/system/spaces/system-appbuilder/knowledge/app_building/model/capability-model.md:3-6`).

## The grants and what they unlock

There are 13 recognized capability ids, enumerated in `CapabilityId` / `CAPABILITY_IDS` (`sdk/org/libs/core/src/spaces/capabilities.ts:26-56`).

| Capability | Unlocks (global) | Config |
|---|---|---|
| `db:read` | `db.query`, `db.tables` | optional `{ tables: [...] }` |
| `db:write` | `db.insert`, `db.update`, `db.remove` | optional `{ tables: [...] }` |
| `db:schema` | `db.createTable`, `db.addColumn`, `writeTableSchema`, `writeProjectTable` | optional `{ tables: [...] }` |
| `pages:write` | `writePage`, `writeProjectPage` | bare |
| `api:write` | `writeApi`, `writeProjectApi` | bare |
| `hooks:write` | `writeHook`, `writeProjectHook`/`Event`/`Function` | bare |
| `project:manage` | `createProject`, `selectProject` | bare |
| `api:call` | `apiCall(name, input)` | required `{ allow: [...] }` |
| `connections:use` | `callConnection(provider, req)` | required `{ providers: [...] }` |
| `tools:use` | `tool(name, input)` | required `{ allow: [...] }` |
| `store:read` | `storeSearch`, `storeInspect` | bare |
| `store:install` | `installSpace` (consent-marked) | bare |
| `events:emit` | `emitEvent` | bare |

The `db:*` grants map to the scoped `db` verbs shown above (`sdk/org/libs/core/src/exec/app-globals.ts:126-158`); `db:schema` additionally earns the standalone catalog writer `writeTableSchema` plus its live-project twin `writeProjectTable` (`sdk/org/libs/core/src/exec/app-globals.ts:214-218`). `pages:write`/`api:write` earn the catalog writer AND the live-project twin (`writeProjectPage`/`writeProjectApi`) (`sdk/org/libs/core/src/exec/app-globals.ts:198-205`); `hooks:write` earns `writeHook` plus the live-project `writeProjectHook`/`writeProjectEvent`/`writeProjectFunction` (`sdk/org/libs/core/src/exec/app-globals.ts:206-213`). `project:manage` earns `createProject`/`selectProject` (`sdk/org/libs/core/src/exec/app-globals.ts:219-222`). `api:call`, `connections:use`, `tools:use`, `store:read`, `store:install`, and `events:emit` are value-yielding globals wired through the yield router in `createChildVM` rather than by `injectAppGlobals` — `apiCall` is injected only when `api:call` is granted (`sdk/org/libs/core/src/exec/bootstrap.ts:173`).

> UNVERIFIED: I confirmed `apiCall` is grant-gated at `bootstrap.ts:173` but did not open the exact injection lines for `callConnection`/`tool`/`store`/`emitEvent`; the grounding-map notes and their DTS composers (below) attest they are wired the same way through the yield router.

## Host-injected only when granted; stripped from the DTS when absent

The capability model has two cooperating sides kept in lockstep by `AppCapabilities` (`sdk/org/libs/core/src/spaces/capabilities.ts:91-105`).

**Inject side (host-enforced security boundary).** `injectAppGlobals(vm, { app, projectRoot, appGlobals })` injects a global onto the VM only when its grant is present in `app` (`sdk/org/libs/core/src/exec/app-globals.ts:180-223`). The host hands in UNSCOPED engine impls; core wraps each in a capability-scope check, so the boundary is host-side and enforced on EVERY call, not just at injection time (`sdk/org/libs/core/src/exec/app-globals.ts:13-27`). The `db` global is additionally gated on `projectRoot` — a session/fork/delegate running outside a project receives no `db` (`sdk/org/libs/core/src/exec/app-globals.ts:189-195`). The authoring globals are gated on the capability grant ALONE (not `projectRoot`), because the appbuilder legitimately has no project until `createProject` establishes one (`sdk/org/libs/core/src/exec/app-globals.ts:197-222`).

**DTS side (typecheck).** `buildAppCapabilityDts(app, appDts)` emits exactly the declarations the grants earned; a grant that is absent is absent from the DTS, so a stray call fails typecheck — the same "not listed ⇒ not injected AND absent from the DTS" invariant enforced for `ask`/`fork`/`delegate` (`sdk/org/libs/core/src/exec/bootstrap.ts:274-309`). The three `db:*` verbs share one `db` object composed by `composeDbDts({ read, write, schema })`, which pushes only the granted verb-member blocks and returns `''` when no db cap is present (`sdk/org/libs/core/src/typecheck/library-dts.ts:149-158`). The standalone globals are pulled from `CAPABILITY_DTS_FRAGMENTS` keyed by id (`sdk/org/libs/core/src/typecheck/library-dts.ts:266-275`).

## `{ tables: [...] }` narrowing per verb

Each `db:*` grant carries an optional `{ tables?: string[] }` narrowing (`sdk/org/libs/core/src/spaces/capabilities.ts:92-94`); an omitted `tables` means all tables (`sdk/org/libs/core/src/spaces/capabilities.ts:288-292`). At runtime, `buildScopedDb` wraps each granted verb, and `assertTableAllowed` throws when a verb targets a table outside its grant's `tables` list (`sdk/org/libs/core/src/exec/app-globals.ts:99-159`). The narrowing is per-VERB — `db:read: { tables: [items] }` scopes reads independently of `db:write`'s tables (`sdk/org/libs/core/src/exec/app-globals.ts:120-147`). Two verbs are not per-table narrowed: `db.tables()` lists the schema, not row data (`sdk/org/libs/core/src/exec/app-globals.ts:131-132`), and `db.createTable` names a NEW table so the grant's list only pre-authorizes creation (`sdk/org/libs/core/src/exec/app-globals.ts:149-153`).

Note that the `api:call` `allow` list is enforced only through the typed DTS overloads (typecheck), NOT by a separate host-side runtime assertion — the db `tables` check is the only runtime table/scope assertion in `app-globals.ts` (`sdk/org/libs/core/src/exec/app-globals.ts:99-159`).

## `api:call` (and `connections:use`/`tools:use`) require config

`api:call` requires a non-empty `{ allow: [...] }` allowlist of endpoint names — a bare `api:call` throws, and an empty/missing `allow` throws "there is no 'call anything'" (`sdk/org/libs/core/src/spaces/capabilities.ts:317-323`, `sdk/org/libs/core/src/spaces/capabilities.ts:178-183`). Likewise `connections:use` requires a non-empty `{ providers: [...] }` (`sdk/org/libs/core/src/spaces/capabilities.ts:296-302`, `sdk/org/libs/core/src/spaces/capabilities.ts:222-228`) and `tools:use` requires a non-empty `{ allow: [...] }` (`sdk/org/libs/core/src/spaces/capabilities.ts:307-313`, `sdk/org/libs/core/src/spaces/capabilities.ts:200-206`). These allow/provider lists are enforced by narrowing the DTS parameter to a union of the granted values: `composeConnectionsDts` narrows `provider` and `composeToolDts` narrows `name`, so a call to an undeclared provider/tool fails typecheck (`sdk/org/libs/core/src/typecheck/library-dts.ts:170-188`).

## Fail-loud validation cases

`parseCapabilities` is fail-loud — any malformed entry throws during space load (`sdk/org/libs/core/src/spaces/capabilities.ts:236-244`). The throwing cases:

- **Unknown id** → "declares unknown capability" (`sdk/org/libs/core/src/spaces/capabilities.ts:267-271`).
- **Config on a bare-only cap** (`pages:write`/`api:write`/`hooks:write`/`project:manage`/`store:read`/`store:install`/`events:emit`, the set `BARE_ONLY_CAPABILITY_IDS`) → "takes no config (bare only)" (`sdk/org/libs/core/src/spaces/capabilities.ts:66-74`, `sdk/org/libs/core/src/spaces/capabilities.ts:278-283`).
- **Unknown config key** on a `db:*`/`api:call`/`tools:use`/`connections:use` map → "has disallowed config key(s)" (`sdk/org/libs/core/src/spaces/capabilities.ts:134-139`).
- **`db:*` `tables` naming a table absent** from the project's `database/`, but only when `knownTables` is supplied — a bare cap on a system/project-agnostic space (`knownTables === undefined`) DEFERS this check to the project the space resolves into (`sdk/org/libs/core/src/spaces/capabilities.ts:150-160`).
- **`tables` not a string list** → "must be a list of table names" (`sdk/org/libs/core/src/spaces/capabilities.ts:143-147`).
- **Bare `api:call`/`connections:use`/`tools:use`** (their allow/providers is required) (`sdk/org/libs/core/src/spaces/capabilities.ts:296-323`).
- **Duplicate capability**, a **multi-key map entry**, or a **non-string/non-map entry** all throw (`sdk/org/libs/core/src/spaces/capabilities.ts:246-276`).

## Read-only fork roles intersect grants

Read-only fork roles (`explore`/`plan`) can never receive a mutating/authoring grant: `intersectAppCaps(app, allowWrite)` drops every write grant, keeping only `db:read`, `api:call`, `connections:use`, `tools:use`, and `store:read` (`sdk/org/libs/core/src/exec/capability.ts:16-28`). This carries into `forkCapabilities`, where the intersected caps become `CapabilityProfile.app` (`sdk/org/libs/core/src/exec/capability.ts:94-96`).

## Least-privilege split across specialist agents

In the `system-appbuilder` space each specialist holds only the slice its job needs (`.lmthing/system/spaces/system-appbuilder/knowledge/app_building/model/capability-model.md:41-48`). The real on-disk frontmatter: `data-modeler` = `db:schema` + `db:read`; `page-builder` = `pages:write` + `db:read`; `api-author` = `api:write` + `db:read`; `app-architect` holds the full authoring set (`project:manage`, `db:schema`, `db:read`, `pages:write`, `api:write`, `hooks:write`) (`sdk/org/libs/core/system-spaces/system-appbuilder/agents/app-architect/instruct.md`, `.../data-modeler/instruct.md`, `.../page-builder/instruct.md`, `.../api-author/instruct.md`). A page-builder cannot write a table; a data-modeler cannot write a page. The `system-engineer`'s `engineer` holds only `hooks:write` (`sdk/org/libs/core/system-spaces/system-engineer/agents/engineer/instruct.md`).

> UNVERIFIED: the canonical `capability-model.md` grant table is STALE — it omits `connections:use`, `tools:use`, `store:read`, `store:install`, and `events:emit` (its "automator = hooks:write" line is also narrower than the on-disk automator, which holds `hooks:write`+`db:schema`+`db:read`+`pages:write`+`api:write`). This doc's table above reflects the code (`sdk/org/libs/core/src/spaces/capabilities.ts:42-56`) and the live `automator/instruct.md`, not the stale knowledge doc.

## Worked example

An integration space's outbound agent declares a single narrowed capability — the Slack agent grants only `connections:use` scoped to the `slack` provider (from `store/spaces/integration-slack/agents/slack/instruct.md`):

````yaml
---
title: Slack
knowledge:
  - slack/api
functions:
  - slackPostMessage
capabilities:
  - connections:use: { providers: [slack] }
canDelegateTo: []
---
````

This earns exactly `callConnection` with `provider` typed to `'slack'`; any other provider — or any db/authoring global — fails the agent's typecheck because its declaration was never emitted (`sdk/org/libs/core/src/typecheck/library-dts.ts:170-173`).

## Related docs

- [frontmatter.md](./frontmatter.md) — the full frontmatter allow-list this key belongs to
- [delegation.md](./delegation.md) — the `canDelegateTo` policy (sibling frontmatter key)
- [../../project/database/README.md](../../project/database/README.md) — the `database/` tables the `db:*` grants scope over
- [../../project/api/README.md](../../project/api/README.md) — the `api/` endpoints `api:write`/`api:call` author and enter
- [../../project/pages/README.md](../../project/pages/README.md) — the `pages/` UI `pages:write` authors
- [../../project/hooks/README.md](../../project/hooks/README.md) — the `hooks/` `hooks:write` authors
