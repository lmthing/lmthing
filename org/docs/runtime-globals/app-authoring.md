# App-authoring globals — `createProject` · `selectProject` · `writeProject*` · `apiCall`

The project-app authoring globals let a capability-holding agent **create a live project and write its files** — table schemas, API handlers, React pages, shared components, hooks, emitter defs, project functions — and (via `apiCall`) **call the project's own API endpoints**. They are the sandbox side of the [project format](../format/project/README.md).

There is **one** writer family — the **live-project** writers `writeProject*` — and two lifecycle globals, `createProject` / `selectProject`, that pick the project those writers (and a subsequent `automator` delegate) target. The old STORE-CATALOG authoring engine (the `createAppAuthoringGlobals` writers that wrote `store/projects/<id>/` templates, and the `app-architect` cast that drove them) has been **removed**; nothing writes a catalog template anymore. Installing a pre-made app from `store/projects/` is a different, unchanged flow (`installSpace` / `/api/apps`) — see [store-and-consent](./store-and-consent.md) and [../cli-api/rest/apps.md](../cli-api/rest/apps.md).

Two properties set these globals apart from the other runtime globals:

- **Every writer is a SYNCHRONOUS host call, not a yield.** They are bound straight onto the VM with `injectGlobal` and their DTS declares a plain object return, not a `Promise` `sdk/org/libs/core/src/exec/app-globals.ts:20-27` · `sdk/org/libs/core/src/typecheck/library-dts.ts#PROJECT_MANAGE_DTS`. Only `apiCall` yields — it ends the turn because the host has to run a Node handler `sdk/org/libs/core/src/globals/api-call.ts:1-27`.
- **They are gated on the agent's `capabilities:` frontmatter alone** — *not* on `projectRoot` — because `createProject` legitimately runs before the target project exists `sdk/org/libs/core/src/exec/app-globals.ts:162-179`. The one exception is `db`, which additionally requires a live project (see [data-db.md](./data-db.md)) `sdk/org/libs/core/src/exec/app-globals.ts:189-195`.

Capability parsing and the full grant vocabulary → [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md).

---

## The gate table

A capability that is not granted is **not injected AND not declared** — a stray call fails typecheck ("Cannot find name 'writeProjectPage'"), a clean retryable error, rather than throwing at runtime. Injection lives in `injectAppGlobals` `sdk/org/libs/core/src/exec/app-globals.ts:198-232` (called once from the single bootstrap site `sdk/org/libs/core/src/exec/bootstrap.ts:143`); the matching DTS fragments are emitted by `buildAppCapabilityDts` `sdk/org/libs/core/src/exec/bootstrap.ts:282-309` from `CAPABILITY_DTS_FRAGMENTS` `sdk/org/libs/core/src/typecheck/library-dts.ts#CAPABILITY_DTS_FRAGMENTS`.

| Capability | Live-project global | File written | Format doc |
|---|---|---|---|
| `project:manage` | `createProject(name)`, `selectProject(id)` | creates / selects the target **live** project | [project format](../format/project/README.md) |
| `db:schema` | `writeProjectTable(name, schema, rows?)` | `database/<name>.json` | [database/](../format/project/database/README.md) |
| `api:write` | `writeProjectApi(route, src)` | `api/<path>/<METHOD>.ts` | [api/](../format/project/api/README.md) |
| `pages:write` | `writeProjectPage(route, src, opts?)` | `pages/<route>.tsx` | [pages/](../format/project/pages/README.md) |
| `pages:write` | `writeProjectComponent(name, src)` | `components/<Name>.tsx` | [pages/](../format/project/pages/README.md) |
| `hooks:write` | `writeProjectHook(slug, src)` | `hooks/<slug>.ts` | [hooks/](../format/project/hooks/README.md) |
| `hooks:write` | `writeProjectEvent(name, src)` | `events/<name>.ts` | [events/](../format/project/events/README.md) |
| `hooks:write` | `writeProjectFunction(name, src)` | `functions/<name>.ts` | [project format](../format/project/README.md) |
| `api:call` | `apiCall(name, input?)` — **yields** | — (calls, does not write) | [api/](../format/project/api/README.md) |

`db:schema` also earns the runtime `db.createTable` / `db.addColumn` members on the `db` object — a *migration*, distinct from the *schema-file* write `sdk/org/libs/core/src/exec/app-globals.ts:148-158` · `sdk/org/libs/core/src/typecheck/library-dts.ts:213-218`.

**Read-only fork roles (`explore`/`plan`) lose every authoring grant.** `intersectAppCaps(app, allowWrite=false)` keeps only `db:read`, `api:call`, `connections:use`, `store:read`; `db:write`, `db:schema`, `pages:write`, `api:write`, `hooks:write`, `store:install`, `events:emit` are dropped before the profile is built `sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps` · `sdk/org/libs/core/src/exec/capability.ts:94-97`.

---

## `createProject` / `selectProject` — picking the live build target

`createProject` and `selectProject` are the two `project:manage` globals. They operate on **live** projects — real project trees under the pod's `<lmthingRoot>/<slug>/` — not on store-catalog templates. **THING holds `project:manage`** (§[system-spaces](../system-spaces/README.md)): when a user asks to build an app while the current project is the default `user` project, THING names a project, `createProject`s it, and the automator builds into it. THING never builds an app into the `user` project.

The impls are supplied by the host as `AppGlobalImpls.createProject` / `AppGlobalImpls.selectProject` `sdk/org/libs/core/src/exec/app-globals.ts#AppGlobalImpls`, injected only under the `project:manage` grant `sdk/org/libs/core/src/exec/app-globals.ts:225-229`.

### `createProject(name) → { ok, appId?, root?, error? }` — `project:manage`

Creates a **new live project** and makes it the build target. The name is slugified and a project skeleton is scaffolded under `<lmthingRoot>/<slug>/` (`database/ api/ pages/ components/ hooks/`, a `project.json`), then returned as `{ ok, appId, root }`. The synchronous scaffold core is `createProjectSync` `sdk/org/libs/cli/src/server/projects.ts#createProjectSync`, shared with `SessionManager.createProject` `sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.createProject` and the `POST /api/projects` REST path, so the agent global, the REST create, and studio all derive project ids the same way (see [../cli-api/rest/projects.md](../cli-api/rest/projects.md)). Because the scaffold is a plain sync host call, the DTS return stays a non-`Promise` object `sdk/org/libs/core/src/typecheck/library-dts.ts#PROJECT_MANAGE_DTS`.

### `selectProject(id) → { ok, appId?, root?, error? }` — `project:manage`

Binds an **existing** live project as the build target; fails when no such project exists. Used when THING is already in (or wants to retarget to) a real, non-`user` project rather than making a new one.

### Retargeting the automator delegate to the new project

`createProject` / `selectProject` only record the intended target; the actual retargeting happens when THING next delegates the build. A subsequent `delegate('system-appbuilder', 'automator', …)` is re-rooted at the selected project via the session's `resolveBuildTarget` hook, which yields a `DelegateProjectContext` (the project root the child's `writeProject*` writers bind to) `sdk/org/libs/core/src/session/types.ts#DelegateProjectContext` · `sdk/org/libs/core/src/session/types.ts:106`. `null` there means "no target selected — build into the current project in place", which is what happens when THING is already in a real project and never called `createProject`.

---

## Live-project writers — `writeProjectTable` · `writeProjectApi` · `writeProjectPage` · `writeProjectComponent` · `writeProjectHook` · `writeProjectEvent` · `writeProjectFunction`

The writers are built by `createProjectAuthoringGlobals`, bound to one fixed project root at construction `sdk/org/libs/cli/src/app/authoring/globals.ts#createProjectAuthoringGlobals`. They write **into the project the session is running in** (or the one `createProject`/`selectProject` retargeted to) and then **apply** the change — republish / db reload / cache invalidation — unlike the removed catalog writers, which only ever wrote a template that a later install+boot applied. They are present only in a project-rooted session, where the host supplies the impls `sdk/org/libs/cli/src/server/session-manager.ts:559-630`.

Because injection requires the *impl* as well as the capability, a session where the host supplies no live impls has no `writeProject*` names bound — but the DTS fragments ride the same grant, so a stray call there still typechecks (see [Gotchas](#gotchas)) `sdk/org/libs/core/src/exec/app-globals.ts:200-218`.

Every writer returns `{ ok: boolean; error?: string }` — validation failures are **returned, never thrown into the sandbox**, so the model sees them and retries `sdk/org/libs/core/src/exec/app-globals.ts:8-11`. Each writer wraps its own body in `try/catch` and converts a throw into `{ ok:false, error }` `sdk/org/libs/cli/src/app/authoring/globals.ts:193-249`.

### `writeProjectTable(name, schema, rows?) → { ok, error? }` — `db:schema`

Writes `database/<name>.json` into the target project. `name` must be **snake_case** (`/^[a-z][a-z0-9_]*$/`) — table names are interpolated unquoted into `CREATE TABLE`, so hyphens are rejected while `feed_items` is fine `sdk/org/libs/cli/src/app/authoring/globals.ts:61-66` · `sdk/org/libs/cli/src/app/authoring/globals.ts:86-90`. The schema then goes through core's fail-loud `validateTableSchema` — description required, ≥1 column, exactly one primary key, per-column type/`generated` checks `sdk/org/libs/core/src/db/validate.ts#validateTableSchema`. The optional third `rows` arg **seeds data at creation**. Format → [../format/project/database/README.md](../format/project/database/README.md).

Real usage, from the `data-modeler` charter (schema shape reference) `sdk/org/libs/core/system-spaces/system-appbuilder/agents/data-modeler/charter.md:1-6`:

````markdown
```typescript
const w = writeProjectTable('items', {
  title: 'Items',
  description: 'A single item the user tracks.',
  columns: {
    id: { type: 'string', description: 'unique id', primaryKey: true, generated: 'uuid' },
    title: { type: 'string', description: 'the item title', required: true },
    createdAt: { type: 'date', description: 'when it was added', generated: 'now' },
  },
});
display(w.ok ? 'wrote items schema' : ('schema error: ' + w.error));
```
````

### `writeProjectApi(route, src) → { ok, error? }` — `api:write`

`route` carries the **HTTP method as its last segment**: `items-list/GET` → `api/items-list/GET.ts`; `items/[id]/PATCH` → `api/items/[id]/PATCH.ts`. The method must be one of `GET POST PUT PATCH DELETE`, and at least one path segment must precede it `sdk/org/libs/cli/src/app/authoring/globals.ts:77` · `sdk/org/libs/cli/src/app/authoring/globals.ts:219-237`. The handler contract (`export const name`, `Input`, `Output`, default async handler, `ctx.db`) → [../format/project/api/README.md](../format/project/api/README.md).

### `writeProjectPage(route, src, opts?) → { ok, error? }` — `pages:write`

Writes `pages/<route>.tsx`; the `.tsx` suffix is appended when absent `sdk/org/libs/cli/src/app/authoring/globals.ts:206-217`. `index` is the app root, `items/[id]` a dynamic route. Routing + the `@app/runtime` import surface → [../format/project/pages/README.md](../format/project/pages/README.md). The optional third arg guards a destructive overwrite (below).

### `writeProjectComponent(name, src) → { ok, error? }` — `pages:write`

Writes a shared React component to `components/<Name>.tsx`; `<Name>` must be **PascalCase** (`COMPONENT_NAME_RE`) and `.tsx` is enforced `sdk/org/libs/cli/src/app/authoring/globals.ts:496-514` · `sdk/org/libs/cli/src/app/authoring/globals.ts:73-75`. Its DTS `PROJECT_COMPONENT_DTS` rides the `pages:write` grant `sdk/org/libs/core/src/typecheck/library-dts.ts#PROJECT_COMPONENT_DTS` · `sdk/org/libs/core/src/typecheck/library-dts.ts#CAPABILITY_DTS_FRAGMENTS`, injected only when the host supplies the live impl `sdk/org/libs/core/src/exec/app-globals.ts:219`.

### `writeProjectHook(slug, src) → { ok, error? }` — `hooks:write`

Writes `hooks/<slug>.ts`; `slug` must be a kebab-slug `sdk/org/libs/cli/src/app/authoring/globals.ts:239-249`. Hook def shapes (`cron` / `event` / `webhook`) → [../format/project/hooks/README.md](../format/project/hooks/README.md).

### `writeProjectEvent` / `writeProjectFunction`

`writeProjectEvent(name, src)` writes an emitter def to `events/<name>.ts` (`hooks:write`); `writeProjectFunction(name, src)` writes `functions/<name>.ts` and requires a **camelCase identifier**, not a slug — the file basename becomes the callable function name `sdk/org/libs/cli/src/app/authoring/globals.ts:70-71` · `sdk/org/libs/cli/src/app/authoring/globals.ts:352-365`.

### Applying the change (what "apply" means)

- Every successful write fires `republish()` — best-effort, fire-and-forget (the writers are synchronous, so they cannot await it; a republish failure never fails the write, because the file is already on disk). It re-derives the webhook manifest, crontab and emitter-scan cache and re-reads the project's hooks into the live db-write dispatch set, **without a pod restart** `sdk/org/libs/cli/src/app/authoring/globals.ts:314-330` · `sdk/org/libs/cli/src/server/session-manager.ts:641-653`.
  - That refresh **wires the dispatch runtime when the project has none yet**, it does not merely reload an existing one `sdk/org/libs/cli/src/server/session-manager.ts:724-732`. The runtime is otherwise created once, at the project db's first boot, and only if the project ALREADY has an event hook or a `db` emitter def `sdk/org/libs/cli/src/server/session-manager.ts:537-564`. A project's db comes into existence when its **first table** is authored — necessarily *before* its first hook exists — so wiring only at boot would leave a hook authored later dead until the pod restarted.
- `writeProjectTable` additionally fires `onSchemaWrite`, which drops the cached project db so the next access re-boots it — necessary because a project with no `database/*.json` boots **no db at all** and that `null` is cached `sdk/org/libs/cli/src/app/authoring/globals.ts:377-393` · `sdk/org/libs/cli/src/server/session-manager.ts:583-590`.
- `writeProjectPage` / `writeProjectApi` / `writeProjectComponent` fire `onAppWrite` — whose `kind` is `'page' | 'api' | 'component'` `sdk/org/libs/cli/src/app/authoring/globals.ts:329-332` — which drops the project's typed endpoint contracts and disposes its API runtime. **Page compilation is deliberately NOT done on write** — the caller must `POST /api/projects/:projectId/app/build` afterwards `sdk/org/libs/cli/src/server/session-manager.ts:591-609` (see [../cli-api/rest/projects.md](../cli-api/rest/projects.md)).

**The writers parse-check their source before it lands.** `assertSourceParses` runs an esbuild `transformSync` (loader `ts` or `tsx`) and returns `{ ok:false, error: 'source failed to parse (write rejected — fix and retry): …' }`. It exists because models emitted literal `\n` escape sequences instead of newlines, producing one-line hook files that silently broke the automation pipeline `sdk/org/libs/cli/src/app/authoring/globals.ts#assertSourceParses`. The check is **syntax-only** — undefined identifiers are a typecheck concern, not a parse one.

**Write-time lint: a generated artifact is checked against its real loader/compiler CONTRACT and rejected AT THE WRITE.** Beyond parsing, each writer validates the file the way the app loader will later read it, so a malformed artifact is a direct, retryable failure at authoring time instead of a confusing downstream compile/serve error. The validators live in `sdk/org/libs/cli/src/app/authoring/lint.ts` and **reuse the loaders' own contract functions** so the lint cannot drift `sdk/org/libs/cli/src/app/authoring/lint.ts#lintApiHandler`:

| artifact | contract enforced at write | reused loader function |
|---|---|---|
| **api** (`writeProjectApi`) | a `export const name`, a default (or `handler`) export, and a **project-unique** name | `sdk/org/libs/cli/src/app/api/loader.ts#apiEndpointContractError` · `sdk/org/libs/cli/src/app/authoring/lint.ts#existingApiNames` |
| **page** (`writeProjectPage`) | a **default export** (else the page bundle renders nothing) | `sdk/org/libs/cli/src/app/authoring/lint.ts#lintPageSource` |
| **component** (`writeProjectComponent`) | a **default export** | `sdk/org/libs/cli/src/app/authoring/lint.ts#lintComponentSource` |
| **hook** (`writeProjectHook`) | `export default` is a hook **object** with a known `type` (`cron`/`event`/`webhook`) — the finer shape stays with the **fail-soft** hook loader | `sdk/org/libs/cli/src/app/authoring/lint.ts#lintHookSource` (via `sdk/org/libs/cli/src/app/hooks/loader.ts#evalHookDefaultFromSource`) |

Unlike the parse/column checks (which return `{ ok:false }`), a lint violation **throws a `LintError`** `sdk/org/libs/cli/src/app/authoring/lint.ts#LintError` — each writer's `catch` re-throws it past the catch-to-`{ok:false}` so it surfaces to the model as a **retryable error like a typecheck failure**, and the file is never written `sdk/org/libs/cli/src/app/authoring/globals.ts#throwLint`. (Motivating failure, scenario 06: an automator-written dashboard endpoint omitted `export const name`, passed the old parse-only writer, and only failed at the API loader's "every endpoint must be named" contract.) Knowledge writes get the minimal non-empty check inline in core's `writeKnowledge` `sdk/org/libs/core/src/globals/write-knowledge.ts#createWriteKnowledgeGlobal`.

**`writeProjectPage` guards a destructive overwrite.** It takes an optional third argument, `opts?: { replace?: boolean }` `sdk/org/libs/cli/src/app/authoring/globals.ts#writeProjectPage`. Without `replace`, a write onto an **existing** page whose source fetches ≥1 API route — every `useApi` / `useApiMutation` / `apiCall` with a literal route, per `fetchedRoutes` — is **rejected** when the incoming source fetches *none* of those routes `sdk/org/libs/cli/src/app/authoring/globals.ts#wouldDropData`. A `@app/runtime` page reaches the database only through those hooks, so a replacement that drops them all renders nothing: the app still builds and every route still answers 200, while the user opens it to an empty page. (Live in scenario 07: a later "add an invoices section" turn re-authored `pages/index.tsx`, and a household's renewals/policies/accounts dashboard came back as `Home · [Invoices]` — with `/vault-dashboard` still serving the whole household to a page that no longer fetched it.) A first write, a page that fetched nothing anyway, and a rewrite that keeps ≥1 of its routes all pass; `{ replace: true }` is the explicit "the user asked me to remove those sections".

---

## Path safety (all writers)

Three layers, in order:

1. **Name/route regexes** — kebab-slug for project ids and hook/event slugs, snake_case for table names, JS identifier for function names, and per-segment `/^\[?[a-zA-Z0-9_-]+\]?$/` for page/api paths. No dots, no slashes; `.` and `..` are rejected explicitly `sdk/org/libs/cli/src/app/authoring/globals.ts:56-108`.
2. **`safeResolve(root, rel)`** — the resolved target must stay under the resolved root, else `path traversal rejected: "<rel>"` `sdk/org/libs/cli/src/app/authoring/globals.ts:110-119`.
3. One file per call, parent dirs created — **never a bulk delete, never a build step** `sdk/org/libs/cli/src/app/authoring/globals.ts:8-11` · `sdk/org/libs/cli/src/app/authoring/globals.ts:121-125`.

---

## `apiCall(name, input?) → Promise<any>` — `api:call`

The one **value-yielding** app global: it ends the turn, the host runs the endpoint (a worker-isolated Node handler), and the result is bound back into the VM `sdk/org/libs/core/src/globals/api-call.ts:1-27`. It is dual-addressed with the browser path — the page's `useApi` and the agent's `apiCall` enter the *same* main-process API runtime, the agent by endpoint **`name`** `sdk/org/libs/cli/src/app/api/runtime.ts:100-110`.

**The allow-list config is required.** A bare `api:call` is a hard space-load error — "there is no 'call anything'" `sdk/org/libs/core/src/spaces/capabilities.ts#parseApiCallConfig` — and the list must be a non-empty array of strings `sdk/org/libs/core/src/spaces/capabilities.ts:166-185`:

```yaml
capabilities:
  - api:call: { allow: [markRead, itemsList] }
```

**Typed overloads replace the generic signature.** When the host supplies project-generated contracts, `buildAppCapabilityDts` uses them *instead of* the generic `API_CALL_DTS` `sdk/org/libs/core/src/exec/bootstrap.ts#AmbientDtsOpts` · `sdk/org/libs/core/src/typecheck/library-dts.ts:160`. They are built with `fallback: false`, so a wrong endpoint name **and** a wrong input type are both hard typecheck errors inside the sandbox `sdk/org/libs/cli/src/app/build/apicall-dts.ts:28-47` · `sdk/org/libs/cli/src/app/build/contracts.ts#generateProjectContracts`. One overload per endpoint:

```ts
declare function apiCall(name: 'markRead', input: { id: string }): Promise<{ ok: boolean }>;
```

**Error contract.** The pod resolver unwraps the API response: a status ≥ 400 becomes a thrown `Error` carrying `.status` (message taken from the handler's `{ error: { message } }` body), otherwise the body is returned — so the agent sees the same error shape the browser does `sdk/org/libs/cli/src/server/session-manager.ts:217-229`.

**Resolver seam.** The global is injected on the grant, but the host resolver may still be absent (a session outside a project, a project with no `api/`). The yield then rejects with a specific, retryable error rather than binding `undefined` `sdk/org/libs/core/src/eval/yield-router.ts:190-199`:

```
apiCall is not available here: this session has no project api runtime
```

In the pod the resolver is attached only when `getApiRuntime` returns a runtime, and that returns `null` for a project with no db `sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.getProjectAppGlobals` · `sdk/org/libs/cli/src/server/session-manager.ts:669-674`.

---

## Who holds these capabilities

The **live-project** writers live in the **`system-appbuilder`** space's `automator` agent; **THING** holds `project:manage` (create/select the target) and delegates the build in. There is no longer an `app-architect` or its slice specialists — the automator authors the whole app itself. The frontmatter is the whole gate:

| Agent | `capabilities:` | Writes |
|---|---|---|
| `user-thing/thing` | `project:manage`, `db:read`, `db:write`, `store:read`, `store:install`, `api:call` | `createProject`/`selectProject` (picks the build target) + reads/writes the live db `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:1-19` |
| `system-appbuilder/automator` | `hooks:write`, `db:schema`, `db:read`, `db:write`, `pages:write`, `api:write` | the **live-project** writers `writeProject*` `sdk/org/libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md:1-16` |

---

## Gotchas

- **The writers parse-check AND lint `src`.** Every `writeProject*` write runs `assertSourceParses` + the write-time lint before the file lands `sdk/org/libs/cli/src/app/authoring/globals.ts#createProjectAuthoringGlobals`, so a malformed endpoint/page fails at authoring time instead of at the next app build.
- **DTS and injection are not in lockstep.** `PROJECT_PAGE_DTS`/`PROJECT_API_DTS`/`PROJECT_AUTHORING_DTS`/`PROJECT_TABLE_DTS` are appended to their capability's fragment unconditionally `sdk/org/libs/core/src/typecheck/library-dts.ts#CAPABILITY_DTS_FRAGMENTS` · `sdk/org/libs/core/src/exec/bootstrap.ts#AmbientDtsOpts`, while injection additionally requires the host impl `sdk/org/libs/core/src/exec/app-globals.ts:204-218`. In a session where the host supplies no live impls (e.g. a non-project appbuilder run), `writeProjectPage(...)` passes typecheck and fails at runtime.
- **`api:call`'s `allow` list is not enforced at call time.** It is required at parse time and stored on the grant `sdk/org/libs/core/src/spaces/capabilities.ts:96-98` · `sdk/org/libs/core/src/spaces/capabilities.ts#parseApiCallConfig`, but the typed DTS is generated from **every** endpoint in the project (`generateProjectContracts` → `buildApiCallDts(endpoints)`, no filter) `sdk/org/libs/cli/src/app/build/contracts.ts#generateProjectContracts`, and the pod resolver dispatches by name with no allow-list check `sdk/org/libs/cli/src/server/session-manager.ts:217-229`. The filter `buildApiToolSignatures(endpoints, allow)` exists `sdk/org/libs/cli/src/app/build/apicall-dts.ts:61-80` but has no non-test caller (`rg buildApiToolSignatures libs/cli/src` matches only its own module and its test).
- **`writeProjectTable` (schema *file*) ≠ `db.createTable` (live *migration*).** Both come from `db:schema`; the first writes `database/<name>.json`, the second runs a migration against the open project db `sdk/org/libs/core/src/exec/app-globals.ts:148-158` · `sdk/org/libs/core/src/typecheck/library-dts.ts:213-218`.
- **A "no db" project caches its `null`.** Only `writeProjectTable`'s `onSchemaWrite` drops that cache — a project with no table yet has no live db `sdk/org/libs/cli/src/server/session-manager.ts#SessionManager.liveProjectDb`.

---

## See also

- [../format/project/README.md](../format/project/README.md) — the project directory format
- [./data-db.md](./data-db.md) — the `db` global (`db:read` / `db:write` / `db:schema`)
- [./events-and-integrations.md](./events-and-integrations.md) — `emitEvent` and the hook/emitter pipeline the live writers republish into
- [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md) — the `capabilities:` frontmatter
- [../cli-api/rest/projects.md](../cli-api/rest/projects.md) — the app admin API (`/api/projects/:id/app/*`, incl. the build endpoint a live page write requires; and the project create path `createProject` shares)
- [../app/README.md](../app/README.md) — the served project-app surface
</content>
</invoke>
