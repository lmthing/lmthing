# The `capabilities:` frontmatter grant model

`capabilities:` is one of the allow-listed keys of an agent's `instruct.md` frontmatter (`sdk/org/libs/core/src/spaces/load.ts#AGENT_FRONTMATTER_ALLOWED_KEYS`), parsed by `parseCapabilities(data['capabilities'], { agentId, knownTables })` during `loadAgent` (`sdk/org/libs/core/src/spaces/load.ts:468`). It declares which **project-app globals** the agent may call; every other frontmatter key is covered in [frontmatter.md](./frontmatter.md). This is a least-privilege model: an agent receives exactly the globals its grants earn, and a grant that is absent is absent from BOTH the injected globals AND the typecheck DTS, so a stray call fails typecheck instead of reaching the engine (`sdk/org/libs/core/system-spaces/system-appbuilder/knowledge/app_building/model/capability-model.md:3-6`).

## The grants and what they unlock

There are 13 recognized capability ids, enumerated in `CapabilityId` / `CAPABILITY_IDS` (`sdk/org/libs/core/src/spaces/capabilities.ts:25-57`).

| Capability | Unlocks (global) | Config |
|---|---|---|
| `db:read` | `db.query`, `db.tables` | optional `{ tables: [...] }` |
| `db:write` | `db.insert`, `db.update`, `db.remove` | optional `{ tables: [...] }` |
| `db:schema` | `db.createTable`, `db.addColumn`, `writeTableSchema`, `writeProjectTable` | optional `{ tables: [...] }` |
| `pages:write` | `writePage`, `writeProjectPage` | bare |
| `api:write` | `writeApi`, `writeProjectApi` | bare |
| `hooks:write` | `writeHook`, `writeProjectHook`/`Event`/`Function` | bare |
| `knowledge:write` | `writeKnowledge` (own space only) | optional `{ spaces: [...] }` |
| `project:manage` | `createProject`, `selectProject` | bare |
| `api:call` | `apiCall(name, input)` | required `{ allow: [...] }` |
| `connections:use` | `callConnection(provider, req)` | required `{ providers: [...] }` |
| `store:read` | `storeSearch`, `storeInspect` | bare |
| `store:install` | `installSpace` (consent-marked) | bare |
| `events:emit` | `emitEvent` | bare |

`knowledge:write` earns the SYNCHRONOUS `writeKnowledge(domain, field, option, markdown, opts?)` global (`sdk/org/libs/core/src/globals/write-knowledge.ts#createWriteKnowledgeGlobal`), injected in `createChildVM` on the grant and scoped — like `loadKnowledge` — to the running agent's own `knowledge/` dir, so it can only author its OWN space (there is no `space` parameter to spoof) (`sdk/org/libs/core/src/exec/bootstrap.ts:191-197`). The optional `{ spaces: [...] }` allow-list is parsed for a future cross-space grant but not yet enforced (`sdk/org/libs/core/src/spaces/capabilities.ts#parseKnowledgeWriteConfig`). `opts.source` (`'user'|'researched'|'agent'`) prepends a provenance blockquote used by conflict resolution.

Any `db:*` grant ALSO earns the project-rooted introspection reads `listProjectDir`/`readProjectFile`, but only in a project-rooted session — they are gated on `projectRoot` + any db grant, exactly like `db` itself (`sdk/org/libs/core/src/exec/app-globals.ts:238-241`, DTS at `sdk/org/libs/core/src/exec/bootstrap.ts#AmbientDtsOpts`).

The `db:*` grants map to the scoped `db` verbs shown above (`sdk/org/libs/core/src/exec/app-globals.ts:130-170`); `db:schema` additionally earns the standalone catalog writer `writeTableSchema` plus its live-project twin `writeProjectTable` (`sdk/org/libs/core/src/exec/app-globals.ts:224-228`). `pages:write`/`api:write` earn the catalog writer AND the live-project twin (`writeProjectPage`/`writeProjectApi`) (`sdk/org/libs/core/src/exec/app-globals.ts:208-215`); `hooks:write` earns `writeHook` plus the live-project `writeProjectHook`/`writeProjectEvent`/`writeProjectFunction` (`sdk/org/libs/core/src/exec/app-globals.ts:216-223`). `project:manage` earns `createProject`/`selectProject` (`sdk/org/libs/core/src/exec/app-globals.ts:229-232`).

`api:call`, `connections:use`, `store:read`, `store:install`, and `events:emit` are value-yielding globals wired through the yield router in `createChildVM` rather than by `injectAppGlobals`, and each is injected on its own grant in one contiguous block: `apiCall` on `api:call` (`sdk/org/libs/core/src/exec/bootstrap.ts:173`), `callConnection` on `connections:use` (`:177`), `storeSearch`+`storeInspect` on `store:read` (`:191-194`), `installSpace` on `store:install` (`:198`), and `emitEvent` on `events:emit` (`:202-204`) — the last with its emitting scope derived HOST-side at injection (`deriveEventScope(spaceDir, projectRoot)`), so sandbox code cannot spoof another scope's events (`sdk/org/libs/core/src/exec/bootstrap.ts:199-204`).

## Host-injected only when granted; stripped from the DTS when absent

The capability model has two cooperating sides kept in lockstep by `AppCapabilities` (`sdk/org/libs/core/src/spaces/capabilities.ts:91-105`).

**Inject side (host-enforced security boundary).** `injectAppGlobals(vm, { app, projectRoot, appGlobals })` injects a global onto the VM only when its grant is present in `app` (`sdk/org/libs/core/src/exec/app-globals.ts:190-242`). The host hands in UNSCOPED engine impls; core wraps each in a capability-scope check, so the boundary is host-side and enforced on EVERY call, not just at injection time (`sdk/org/libs/core/src/exec/app-globals.ts:13-28`). The `db` global is additionally gated on `projectRoot` — a session/fork/delegate running outside a project receives no `db` (`sdk/org/libs/core/src/exec/app-globals.ts:199-205`). The authoring globals are gated on the capability grant ALONE (not `projectRoot`), because the appbuilder legitimately has no project until `createProject` establishes one (`sdk/org/libs/core/src/exec/app-globals.ts:207-232`). A second, independent gate is the host itself: each `writeProject*` impl is supplied only by a project-rooted session, so a catalog-only appbuilder session leaves it absent even with the grant (`sdk/org/libs/core/src/exec/app-globals.ts:210-213`).

**DTS side (typecheck).** `buildAppCapabilityDts(app, appDts)` emits exactly the declarations the grants earned; a grant that is absent is absent from the DTS, so a stray call fails typecheck — the same "not listed ⇒ not injected AND absent from the DTS" invariant enforced for `ask`/`fork`/`delegate` (`sdk/org/libs/core/src/exec/bootstrap.ts:274-313`). The three `db:*` verbs share one `db` object composed by `composeDbDts({ read, write, schema })`, which pushes only the granted verb-member blocks and returns `''` when no db cap is present (`sdk/org/libs/core/src/typecheck/library-dts.ts:149-156`). The standalone globals are pulled from `CAPABILITY_DTS_FRAGMENTS` keyed by id (`sdk/org/libs/core/src/typecheck/library-dts.ts:279-288`).

## `{ tables: [...] }` narrowing per verb

Each `db:*` grant carries an optional `{ tables?: string[] }` narrowing (`sdk/org/libs/core/src/spaces/capabilities.ts:92-94`); an omitted `tables` means all tables (`sdk/org/libs/core/src/spaces/capabilities.ts:288-292`). At runtime, `buildScopedDb` wraps each granted verb, and `assertTableAllowed` throws when a verb targets a table outside its grant's `tables` list (`sdk/org/libs/core/src/exec/app-globals.ts:109-170`). The narrowing is per-VERB — `db:read: { tables: [items] }` scopes reads independently of `db:write`'s tables (`sdk/org/libs/core/src/exec/app-globals.ts#buildScopedDb`). Two verbs are not per-table narrowed: `db.tables()` lists the schema, not row data (`sdk/org/libs/core/src/exec/app-globals.ts:141-142`), and `db.createTable` names a NEW table so the grant's list only pre-authorizes creation (`sdk/org/libs/core/src/exec/app-globals.ts:159-163`).

`api:call`'s `allow` list IS enforced host-side at the call: the yield router refuses an endpoint outside the granted list with a retryable error naming what is allowed, and the resolver never runs (`sdk/org/libs/core/src/eval/yield-router.ts#routeCommonYield`, threaded in as `YieldRouterContext.apiCallAllow` from the agent's own grant by both the session and the delegate — `sdk/org/libs/core/src/session/session.ts#buildYieldContext`, `sdk/org/libs/core/src/delegate/delegate.ts`). `connections:use`'s `providers` is NOT re-checked there — it remains enforced only through the narrowed DTS (typecheck) — and the db `tables` check remains the only runtime scope assertion inside `app-globals.ts` (`sdk/org/libs/core/src/exec/app-globals.ts:109-170`).

## `api:call` (and `connections:use`) require config

`api:call` requires a non-empty `{ allow: [...] }` allowlist of endpoint names — a bare `api:call` throws, and an empty/missing `allow` throws (`sdk/org/libs/core/src/spaces/capabilities.ts#parseApiCallConfig`). Likewise `connections:use` requires a non-empty `{ providers: [...] }` (`sdk/org/libs/core/src/spaces/capabilities.ts:296-302`, `sdk/org/libs/core/src/spaces/capabilities.ts#parseConnectionsConfig`). These allow/provider lists are enforced by narrowing the DTS parameter to a union of the granted values: `composeConnectionsDts` narrows `provider`, so a call to an undeclared provider fails typecheck (`sdk/org/libs/core/src/typecheck/library-dts.ts:170-188`) — and for `api:call`, additionally at the call site (above).

**The `["*"]` wildcard.** `allow: ["*"]` grants any endpoint THIS project declares (`sdk/org/libs/core/src/spaces/capabilities.ts#parseApiCallConfig`, checked in `sdk/org/libs/core/src/eval/yield-router.ts#routeCommonYield`). It exists for the agent that cannot know the endpoint names up front because they are authored per project at runtime — THING, the user's own orchestrator inside the user's own project, which holds `api:call: { allow: ['*'] }` so it can answer "what does it say now?" from the app's own route rather than re-deriving the figure from raw rows (`sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md`). It stays an explicit, opt-in declaration: the list is still required, and a NAMED list still means only those endpoints.

## Fail-loud validation cases

`parseCapabilities` is fail-loud — any malformed entry throws during space load (`sdk/org/libs/core/src/spaces/capabilities.ts:236-244`). The throwing cases:

- **Unknown id** → "declares unknown capability" (`sdk/org/libs/core/src/spaces/capabilities.ts:267-271`).
- **Config on a bare-only cap** (`pages:write`/`api:write`/`hooks:write`/`project:manage`/`store:read`/`store:install`/`events:emit`, the set `BARE_ONLY_CAPABILITY_IDS`) → "takes no config (bare only)" (`sdk/org/libs/core/src/spaces/capabilities.ts:66-74`, `sdk/org/libs/core/src/spaces/capabilities.ts:278-283`).
- **Unknown config key** on a `db:*`/`api:call`/`connections:use` map → "has disallowed config key(s)" (`sdk/org/libs/core/src/spaces/capabilities.ts#parseDbConfig`).
- **`db:*` `tables` naming a table absent** from the project's `database/`, but only when `knownTables` is supplied — a bare cap on a system/project-agnostic space (`knownTables === undefined`) DEFERS this check to the project the space resolves into (`sdk/org/libs/core/src/spaces/capabilities.ts:150-160`).
- **`tables` not a string list** → "must be a list of table names" (`sdk/org/libs/core/src/spaces/capabilities.ts:143-147`).
- **Bare `api:call`/`connections:use`** (their allow/providers is required) (`sdk/org/libs/core/src/spaces/capabilities.ts:296-323`).
- **Duplicate capability**, a **multi-key map entry**, or a **non-string/non-map entry** all throw (`sdk/org/libs/core/src/spaces/capabilities.ts#parseCapabilities`).

## Read-only fork roles intersect grants

Read-only fork roles (`explore`/`plan`) can never receive a mutating/authoring grant: `intersectAppCaps(app, allowWrite)` drops every write grant (including `knowledge:write`), keeping only `db:read`, `api:call`, `connections:use`, and `store:read` (`sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps`). This carries into `forkCapabilities`, where the intersected caps become `CapabilityProfile.app` (`sdk/org/libs/core/src/exec/capability.ts#forkCapabilities`) — so a knowledge-writing tasklist node must run `role: general`.

A tasklist node may further NARROW its inherited grants to a per-node subset via the node's `capabilities:` frontmatter — `narrowAppCaps(app, allow)` selects only the intersection of the requested ids with what the agent declared, never widening (`sdk/org/libs/core/src/exec/capability.ts#narrowAppCaps`). See [../tasklists/step-file.md](../tasklists/step-file.md).

## Least-privilege split across specialist agents

In the `system-appbuilder` space each specialist holds only the slice its job needs (`sdk/org/libs/core/system-spaces/system-appbuilder/knowledge/app_building/model/capability-model.md:41-48`). The real on-disk frontmatter:

| Agent | `capabilities:` |
|---|---|
| `app-architect` | `project:manage`, `db:schema`, `db:read`, `pages:write`, `api:write`, `hooks:write` (`.../app-architect/instruct.md:7-13`) |
| `data-modeler` | `db:schema`, `db:read` (`.../data-modeler/instruct.md:7-9`) |
| `page-builder` | `pages:write`, `db:read` (`.../page-builder/instruct.md:7-9`) |
| `api-author` | `api:write`, `db:read` (`.../api-author/instruct.md:7-9`) |
| `automator` | `hooks:write`, `db:schema`, `db:read`, `db:write`, `pages:write`, `api:write` (`.../automator/instruct.md:7-13`) |
| `engineer` (`system-engineer`) | `hooks:write` only (`sdk/org/libs/core/system-spaces/system-engineer/agents/engineer/instruct.md:6-7`) |

(all paths relative to `sdk/org/libs/core/system-spaces/system-appbuilder/agents/` unless stated). A page-builder cannot write a table; a data-modeler cannot write a page. The `automator` is the broad one — it authors the LIVE project (data model + automation + UI), so it holds every authoring grant except `project:manage`.

## Worked example

An integration space's outbound agent declares a single narrowed capability — the Slack agent grants only `connections:use` scoped to the `slack` provider (`store/spaces/integration-slack/agents/slack/instruct.md:1-24`, abridged):

````yaml
---
title: Slack
knowledge:
  - slack/api
functions:
  - slackPostMessage
  - slackListChannels
  - slackSearchMessages
components: []
capabilities:
  - connections:use: { providers: [slack] }
actions:
  - id: assist
    label: Slack assistant
    # … post / search actions omitted
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
