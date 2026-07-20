# Runtime globals

The agent runtime is a **QuickJS WASM sandbox** into which the host injects a set of
free-standing functions and objects — the **globals**. A model-authored statement is
evaluated inside that VM; anything it can reach (`ask`, `db`, `display`, …) is a
global the host decided to bind on `globalThis` before the turn started. (Generic
`execShell`/`readFile`/`writeFile` are **not** among them for a normal agent — they were
removed from the model surface; see [§2](#2-capabilities-gate-injection-and-the-dts) and the
[fs:scratch](#the-14-app-capabilities) note.)

There is exactly **one injection site**: `createChildVM` (`sdk/org/libs/core/src/exec/bootstrap.ts#createChildVM`),
with exactly three non-test callers — the top-level session
(`sdk/org/libs/core/src/session/session.ts:638`), a fork leaf
(`sdk/org/libs/core/src/fork/fork.ts:283`), and a delegate
(`sdk/org/libs/core/src/delegate/delegate.ts:193`). Before this file existed the wiring was
copy-pasted across those three sites and drifted apart (the "A1 delegate-nesting bug" — see
the `CapabilityProfile` doc comment, `sdk/org/libs/core/src/exec/capability.ts:30-46`), which
is why the doc below can talk about *one* rule set rather than three.

Sub-docs, by global family:

| Doc | Covers |
|---|---|
| [conversation.md](./conversation.md) | `ask`, `display`, `inspect` |
| [delegation.md](./delegation.md) | `fork`, `tasklist`, `delegate`, `registerSpace` |
| [knowledge-and-docs.md](./knowledge-and-docs.md) | `loadKnowledge`, `readDocument` |
| [events-and-integrations.md](./events-and-integrations.md) | `emitEvent`, `callConnection`, `integrationStatus` |
| [store-and-consent.md](./store-and-consent.md) | `storeSearch`, `storeInspect`, `installSpace`, the `@consent` model |
| [session-and-utils.md](./session-and-utils.md) | `setSessionMeta`, `sleep`, `fetch`, and the host-tools substrate |
| [app-authoring.md](./app-authoring.md) | `createProject`/`selectProject` (live build target), the live-project `writeProject*` writers, `apiCall` |
| [data-db.md](./data-db.md) | `db.*`, `apiCall` |

Capability frontmatter (the `capabilities:` list that grants the project-app globals) is
specified in [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md).

---

## 1. Yielding vs non-yielding

Two mechanically different kinds of global:

**Yielding globals** push a `YieldRequest` onto `vm.pendingYields` and return a Promise
(`sdk/org/libs/core/src/exec/bootstrap.ts:151-153`, `pushYield`). Pushing a yield **ends the
turn**: the host stops the model stream, resolves the request (`routeCommonYield`,
`sdk/org/libs/core/src/eval/yield-router.ts#routeCommonYield`), binds the resolved value host-side, and
the next turn resumes with it in scope. There are **19** yield kinds today — the
`YieldRequest['kind']` union (`sdk/org/libs/core/src/eval/yield.ts#YieldRequest.kind`), one per `kind: '…'`
literal under `sdk/org/libs/core/src/globals/`: `ask`, `sleep`, `fetch`, `readDocument`,
`loadKnowledge`, `inspect`, `fork`, `tasklist`, `delegate`, `registerSpace`, `setSessionMeta`,
`apiCall`, `callConnection`, `integrationStatus`, `storeSearch`, `storeInspect`,
`installSpace`, `emitEvent`, and the internal `consent`
(`sdk/org/libs/core/src/globals/consent.ts#createConsentRequestGlobal`).

**Non-yielding globals** are plain synchronous host calls marshalled across the QuickJS
bridge — they do not end the turn. This is the whole host-tools substrate
(`injectHostTools`, `sdk/org/libs/core/src/globals/host-tools.ts#injectHostTools`), the project-app `db`
object and the authoring writers (`injectAppGlobals`,
`sdk/org/libs/core/src/exec/app-globals.ts#injectAppGlobals`), and `display`, which is the one
fire-and-forget member of the "yielding" family's neighbourhood — it calls the render host
and returns `void`, pushing nothing (`sdk/org/libs/core/src/globals/display.ts`,
`createDisplayGlobal`; note it has no `pushYield` parameter, unlike every other
`globals/*.ts` factory).

> Two gotchas worth internalising: `inspect` and `loadKnowledge` **do** yield
> (`sdk/org/libs/core/src/globals/inspect.ts#createInspectGlobal`, `sdk/org/libs/core/src/globals/load-knowledge.ts#createLoadKnowledgeGlobal`)
> even though they read like utilities; and `execShell` (a host primitive, model-callable
> only in the engineer's `fs:scratch` sandbox) is **synchronous**, so it blocks the
> single Node thread — the per-stream idle watchdog cannot fire while it runs
> (`DEFAULT_EXEC_TIMEOUT_MS = 120_000`, `sdk/org/libs/core/src/globals/host-tools.ts#DEFAULT_EXEC_TIMEOUT_MS`,
> applied at `:190`).
> `fetch` is *not* in that category: it is a real, non-blocking yield
> (`sdk/org/libs/core/src/globals/fetch.ts#createFetchGlobal` → `sdk/org/libs/core/src/eval/fetch-yield.ts`).

---

## 2. Capabilities gate injection **and** the DTS

One value — `CapabilityProfile` (`sdk/org/libs/core/src/exec/capability.ts#CapabilityProfile`) — feeds
**both** sides of the wiring:

* the **inject** side, `createChildVM` (`sdk/org/libs/core/src/exec/bootstrap.ts#createChildVM`), which
  binds a global only behind an explicit `if (caps.…)`;
* the **DTS** side, `buildAmbientDts` (`sdk/org/libs/core/src/exec/bootstrap.ts#buildAmbientDts`) +
  `buildAppCapabilityDts` (`:311-343`), which composes the agent's ambient typecheck
  declarations additively from the fragments in
  `sdk/org/libs/core/src/typecheck/library-dts.ts`.

The invariant this buys, verbatim from the profile's own doc comment
(`sdk/org/libs/core/src/exec/capability.ts:37-40`) — "not listed ⇒ not injected AND absent
from the DTS":

> - which value-yielding globals `createChildVM` injects (exec/bootstrap.ts)
> - which ambient declarations `buildAmbientDts` emits, so a call to a global that is not
>   injected fails typecheck (a clean retryable error) instead of passing typecheck and
>   throwing at runtime.

That matters because a typecheck failure is a *clean, retryable, model-visible* error
("Cannot find name 'x'"), whereas an un-declared-but-injected global would bind `undefined`
or throw mid-run.

The profile has seven boolean flags plus the parsed app grants
(`sdk/org/libs/core/src/exec/capability.ts#CapabilityProfile`):

| Flag | Session | Delegate | Fork leaf |
|---|---|---|---|
| `ask` | ✅ | ❌ | ❌ |
| `orchestrate` (`fork`, `tasklist`) | ✅ | ✅ | ❌ |
| `delegate` | policy | policy | only via task `canDelegateTo` |
| `registerSpace` | ✅ | ❌ | only when `allowWrite` |
| `setSessionMeta` | ✅ | ❌ | ❌ |
| `setActivity` (ungated — NOT a profile flag; injected in every VM like `display`) | ✅ | ✅ | ✅ |
| `allowWrite` (mutating `execShell`, the internal `writeFileRaw` — neither on the model DTS) | ✅ | ✅ | `role !== explore\|plan` |
| `scratchFs` (`createScratch` + a scratch-jailed `execShell` on the model DTS) | `fs:scratch` grant | `fs:scratch` grant | grant, dropped for read-only roles |
| `app: AppCapabilities` | as granted | as granted | `intersectAppCaps(app, allowWrite)` |

(`sessionCapabilities` `:91-93`, `delegateCapabilities` `:114-116`, `forkCapabilities` `:101-105`.)

`intersectAppCaps` (`sdk/org/libs/core/src/exec/capability.ts#intersectAppCaps`) is the read-only-fork
gate: a `explore`/`plan` role keeps only `db:read`, `api:call`, `connections:use`,
`store:read`; every mutating/authoring grant (`db:write`, `db:schema`,
`pages:write`, `api:write`, `hooks:write`, `store:install`, `events:emit`, and `fs:scratch`)
is **dropped before the profile is built**, so it can neither be injected nor declared —
which is why a read-only fork's `scratchFs` is false.

### The 13 app capabilities

`CapabilityId` (`sdk/org/libs/core/src/spaces/capabilities.ts#CapabilityId`) —
`db:read`, `db:write`, `db:schema`, `pages:write`, `api:write`, `hooks:write`, `api:call`,
`connections:use`, `project:manage`, `store:read`, `store:install`,
`events:emit`, `fs:scratch`. Parsing is fail-loud (`parseCapabilities`, `:245-336`): an
unknown id, an unknown config key, a config on a bare-only cap, or a bare `api:call`/
`connections:use` (their allowlists are **required** — "there is no *call
anything*", `:190`) all throw at space load.

| Capability | Config | Globals it earns | Doc |
|---|---|---|---|
| `db:read` | `{ tables?: [] }` | `db.query`, `db.tables` | [data-db.md](./data-db.md) |
| `db:write` | `{ tables?: [] }` | `db.insert`, `db.update`, `db.remove` | [data-db.md](./data-db.md) |
| `db:schema` | `{ tables?: [] }` | `db.createTable`, `db.addColumn`, `writeProjectTable` | [data-db.md](./data-db.md) · [app-authoring.md](./app-authoring.md) |
| `api:call` | `{ allow: [] }` **required** | `apiCall` | [data-db.md](./data-db.md) |
| `connections:use` | `{ providers: [] }` **required** | `callConnection` | [events-and-integrations.md](./events-and-integrations.md) |
| `pages:write` | bare | `writeProjectPage`, `writeProjectComponent` | [app-authoring.md](./app-authoring.md) |
| `api:write` | bare | `writeProjectApi` | [app-authoring.md](./app-authoring.md) |
| `hooks:write` | bare | `writeProjectHook`, `writeProjectEvent`, `writeProjectFunction` | [app-authoring.md](./app-authoring.md) |
| `project:manage` | bare | `createProject`, `selectProject` (live build target) | [app-authoring.md](./app-authoring.md) |
| `store:read` | bare | `storeSearch`, `storeInspect` | [store-and-consent.md](./store-and-consent.md) |
| `store:install` | bare | `installSpace` (**consent-marked**) | [store-and-consent.md](./store-and-consent.md) |
| `events:emit` | bare | `emitEvent` | [events-and-integrations.md](./events-and-integrations.md) |
| `fs:scratch` | bare | `createScratch` + a scratch-jailed generic fs/shell (the engineer's code sandbox; the ONLY generic filesystem on the model surface) | [session-and-utils.md](./session-and-utils.md) · [../system-spaces/README.md](../system-spaces/README.md) |

Injection: `sdk/org/libs/core/src/exec/bootstrap.ts:175-235` (yielding app globals) and
`sdk/org/libs/core/src/exec/app-globals.ts#injectAppGlobals` (synchronous `db` + writers); the
`fs:scratch` scratch block is bootstrap step 4c (`sdk/org/libs/core/src/exec/bootstrap.ts:154-167`).
DTS: `CAPABILITY_DTS_FRAGMENTS` (`sdk/org/libs/core/src/typecheck/library-dts.ts#CAPABILITY_DTS_FRAGMENTS`) —
note `pages:write` maps to `PAGES_WRITE_DTS` + `PROJECT_PAGE_DTS` + `PROJECT_COMPONENT_DTS`
(`:300`), etc.; `fs:scratch`'s `EXEC_SHELL_DTS`/`SCRATCH_DTS` are emitted directly in
`buildAmbientDts`, not via that flat map (`sdk/org/libs/core/src/exec/bootstrap.ts#buildAmbientDts`).

### Gating goes beyond presence/absence

* **Typed narrowing.** `composeConnectionsDts`
  (`sdk/org/libs/core/src/typecheck/library-dts.ts#composeConnectionsDts`) declares `provider` as
  the **union of the granted values**, so calling an ungranted provider fails
  *typecheck*, not just at runtime.
* **Per-call host re-check.** The `db` object is scoped at injection (`buildScopedDb`,
  `sdk/org/libs/core/src/exec/app-globals.ts#buildScopedDb`) *and* every call re-runs
  `assertTableAllowed` against the grant's `tables` list
  (`sdk/org/libs/core/src/exec/app-globals.ts#assertTableAllowed`). The DTS is a convenience; the host is
  the boundary.
* **Typed `apiCall`.** When the project supplies generated overloads (`AmbientDtsOpts.appDts`)
  they **replace** the generic `apiCall` fragment
  (`sdk/org/libs/core/src/exec/bootstrap.ts:329`).

### The third gate: the host resolver

A gated global can be injected and still have **no host resolver** (a session outside a
project, a pod with no connections gateway, a bare unit test). The yield then **rejects
with a specific, retryable error** instead of binding `undefined`. That error list is a
contract (`sdk/org/libs/core/src/eval/yield-router.ts`):

```
apiCall is not available here: this session has no project api runtime          (:195)
callConnection is not available here: no connection resolver configured          (:208)
readDocument is not available here: no document resolver configured              (:231)
integrationStatus is not available here: no project scope configured             (:244)
storeSearch is not available here: no store resolver configured                  (:264)
storeInspect is not available here: no store resolver configured                 (:273)
installSpace is not available here: no store resolver configured                 (:286)
emitEvent is not available here: no event resolver configured (project-rooted sessions only)  (:339)
```

---

## 3. Consent (generic, host-enforced, fail-closed)

Two entry points, one primitive (`sdk/org/libs/core/src/globals/consent.ts`):

1. **A consent-marked GLOBAL** — a yield kind in `CONSENT_MARKED_YIELD_KINDS`
   (`:54`, today exactly `installSpace`). The yield router intercepts it **before the
   switch**, so no resolver can run unapproved
   (`sdk/org/libs/core/src/eval/yield-router.ts:140-145`).
2. **A consent-marked SPACE FUNCTION** — an `@consent` pragma in the function's *leading*
   comment (`functionRequiresConsent`, `sdk/org/libs/core/src/globals/consent.ts#functionRequiresConsent`;
   detected on the original TS because bundling strips comments). At injection the function
   is wrapped so the real implementation lives in an unreachable closure and only runs after
   `__requestConsent` resolves (`wrapWithConsentGate`,
   `sdk/org/libs/core/src/sandbox/inject-functions.ts#wrapWithConsentGate`, applied at `:70-71`).

`enforceConsent` **fails closed**: with no prompter it throws `consentUnavailableError`
(`sdk/org/libs/core/src/globals/consent.ts#enforceConsent`). The prompter is wired only for interactive
sessions, so forks, delegates, hooks and headless runs cannot silently execute a
consent-marked call — nor hang on one.

`__requestConsent` itself is the inverse of the usual lockstep: injected into **every** VM
(`sdk/org/libs/core/src/exec/bootstrap.ts:209`) yet deliberately **absent from the DTS** —
model code must never call it directly.

---

## 4. Known lockstep exceptions

`COMMON_DTS` (`sdk/org/libs/core/src/typecheck/library-dts.ts#COMMON_DTS`) is the always-declared
set. Three names in it are declared unconditionally but **not always injected** — a stray
call there passes typecheck and fails at runtime:

| Global | Declared | Injected only when |
|---|---|---|
| `registerSpace` | `library-dts.ts:40` (the comment at `:29-34` says so explicitly) | `caps.registerSpace` — not for delegates, not for read-only fork roles (`bootstrap.ts:234`) |
| `progress()` | `library-dts.ts:106` | `ChildVMOpts.progress` is supplied (`host-tools.ts:219-220`) — the delegate site passes none |
| `integrationStatus` | `library-dts.ts:101` | `opts.projectRoot` is set (`bootstrap.ts:212`) — it has no capability seam yet, justified because it leaks only the *names* of missing env vars |

---

## 5. Full global table

Y = value-yielding (ends the turn). S = synchronous host call. F = fire-and-forget.

| Global | Y/S | Purpose | Gate | Doc |
|---|---|---|---|---|
| `ask(descriptor)` | Y | Prompt the user with a JSX form/descriptor; resolves to their answer | `caps.ask` — **top-level session only** | [conversation.md](./conversation.md) |
| `display(descriptor)` | F | Render a block into the transcript; does **not** end the turn | none (every VM) | [conversation.md](./conversation.md) |
| `setActivity(text)` | F | Set the live "currently doing" status — the session's main header line, or a fork/delegate work node's narration; `''` clears | none (every VM) | [session-and-utils.md](./session-and-utils.md) |
| `inspect(...args)` | Y | Query a large value host-side (path/slice/depth/filter/sample/keys/count/search); emits a VARIABLES block | none | [conversation.md](./conversation.md) |
| `fork(opts)` | Y | Spawn a headless sub-agent; `output` schema is **required** | `caps.orchestrate` — never a fork leaf | [delegation.md](./delegation.md) |
| `tasklist(name, seed?)` | Y | Run a named DAG; resolves to a `TaskEnvelope` | `caps.orchestrate` | [delegation.md](./delegation.md) |
| `delegate(pkg, agent, action?, opts?)` | Y | Hand work to another space's agent; `action` optional | `caps.delegate` (the `canDelegateTo` policy) | [delegation.md](./delegation.md) |
| `registerSpace(dir)` | Y | Load a space into the shared `dynamicSpaces` map so `delegate()` reaches it now | `caps.registerSpace` | [delegation.md](./delegation.md) |
| `loadKnowledge(...path)` | Y | Read `<spaceDir>/knowledge/<...path>` on demand | none | [knowledge-and-docs.md](./knowledge-and-docs.md) |
| `readDocument(id, opts?)` | Y | Extract text from an uploaded attachment; bytes never enter the sandbox | none (deliberately universal) | [knowledge-and-docs.md](./knowledge-and-docs.md) |
| `setSessionMeta({title?,slug?})` | F | Name the current conversation; does **not** end the turn | `caps.setSessionMeta` — session only | [session-and-utils.md](./session-and-utils.md) |
| `sleep(duration)` | Y | Pause (`'500ms'`/`'2min'`/`'3h'`) | none | [session-and-utils.md](./session-and-utils.md) |
| `fetch(url, opts?)` | injected only (no model declaration) | Real non-blocking HTTP; `{ok,status,text(),json()}`; model-authored calls fail typecheck — function bodies only | none | [session-and-utils.md](./session-and-utils.md) |
| `apiCall(name, input?)` | Y | Call one of the project's own `api/` endpoints by name | `api:call` (allowlist required) | [data-db.md](./data-db.md) |
| `callConnection(provider, req)` | Y | Authenticated request to a user-connected service via the gateway egress proxy; the token never enters the sandbox | `connections:use` (providers required) | [events-and-integrations.md](./events-and-integrations.md) |
| `integrationStatus(spaceId)` | Y | Presence-only config check — `{ready, missingRequired[]}` (names only, never values) | `projectRoot` set (not a capability) | [events-and-integrations.md](./events-and-integrations.md) |
| `emitEvent(name, payload)` | Y | Publish one of this scope's declared events; the source scope is derived **host-side** at injection and cannot be spoofed | `events:emit` | [events-and-integrations.md](./events-and-integrations.md) |
| `storeSearch(query?)` | Y | Search the store's space catalog | `store:read` | [store-and-consent.md](./store-and-consent.md) |
| `storeInspect(spaceId)` | Y | Inspect one catalog entry | `store:read` | [store-and-consent.md](./store-and-consent.md) |
| `installSpace(spaceId)` | Y | Install a store space into the project and live-register it — **consent-marked** | `store:install` | [store-and-consent.md](./store-and-consent.md) |
| `__requestConsent(fn, args)` | Y | Internal seam behind the `@consent` pragma; injected everywhere, **absent from the DTS** | none | [store-and-consent.md](./store-and-consent.md) |
| `db.query` / `db.tables` | S | Read the project's SQLite rows / list tables | `db:read` | [data-db.md](./data-db.md) |
| `db.insert` / `db.update` / `db.remove` | S | Write rows | `db:write` | [data-db.md](./data-db.md) |
| `db.createTable` / `db.addColumn` | S | Evolve the live schema | `db:schema` | [data-db.md](./data-db.md) |
| `createProject` / `selectProject` | S | Create a NEW **live** project (under `<lmthingRoot>/<slug>/`) or bind an existing one as the app-build target | `project:manage` | [app-authoring.md](./app-authoring.md) |
| `writeProjectPage` / `writeProjectApi` / `writeProjectComponent` / `writeProjectTable` / `writeProjectHook` / `writeProjectEvent` / `writeProjectFunction` | S | Author into the **live project** and republish/rebuild | same grants as above **and** a host impl (project-rooted session); `writeProjectComponent` on `pages:write` | [app-authoring.md](./app-authoring.md) |
| `listProjectDir(dir)` / `readProjectFile(path)` | S | List/read project files, rooted at `projectRoot` — the **only** way an agent reads project files now | `projectRoot` set (**not** a capability) | [app-authoring.md](./app-authoring.md) · [../format/project/README.md](../format/project/README.md) |
| `console.log/warn/error` | S | Log via the render host | none | [session-and-utils.md](./session-and-utils.md) |
| `execShell(cmd, opts?)` | S | Run a shell command; **blocks the Node event loop** | injected on every VM but **on the model DTS only under `fs:scratch`** (engineer scratch sandbox, scratch-rooted); mutating commands refused (`exitCode: 126`) under a read-only role | [session-and-utils.md](./session-and-utils.md) |
| `createScratch()` | S | Create (once) the throwaway `.lmthing/scratch/<random>` sandbox and return its path | `scratchFs` (the `fs:scratch` grant) — the engineer only | [session-and-utils.md](./session-and-utils.md) |
| `readFileRaw(path, opts?)` | S | Read a file (binary-safe, 256 KB cap) | **internal-only** — injected but not on any model DTS | [session-and-utils.md](./session-and-utils.md) |
| `writeFileRaw(path, content)` | S | Write a file (mkdir -p) | **internal-only** — not on any model DTS; `allowWrite` still gates the write (else a no-op `{ok:false}`) | [session-and-utils.md](./session-and-utils.md) |
| `process.exit(code?)` | S | Throws `process.exit(<code>)`; `turn-loop.ts` treats it as intentional termination (no retry) | none — **declared on the model DTS unconditionally** (`PROCESS_EXIT_DTS`, same tier as `COMMON_DTS`) | [session-and-utils.md](./session-and-utils.md) |
| `process.env` | S | Frozen env copy + the `LMTHING_*` vars | none (injected everywhere; **internal-only** — not on any model DTS, only the internal `LIBRARY_DTS` bundles for system-function bodies) | [session-and-utils.md](./session-and-utils.md) |
| `progress()` | S | `{episodes, toolCalls, elapsedMs}` snapshot of the run budget | `ChildVMOpts.progress` supplied | [session-and-utils.md](./session-and-utils.md) |
| `spacePath(...parts)` / `resolveSpaceDir(space)` | S | `path.join` / space-dir resolution inside QuickJS | none | [session-and-utils.md](./session-and-utils.md) |
| `typecheckSource(src)` | S | Typecheck a TS string against the full library DTS | none (pure/read-only) | [session-and-utils.md](./session-and-utils.md) |
| `currentTask.resolve(value)` | S | The fork/delegate result-capture channel | `ChildVMOpts.currentTaskResolve` (fork + delegate only) | [delegation.md](./delegation.md) |
| `React` + component stubs | S | Classic-transform JSX shim returning a `JSXDescriptor`, plus one stub per catalog/space component | none (every VM) | [conversation.md](./conversation.md) |

**Not globals.** `webSearch`, `webFetch`, `todoWrite`, `todoRead`, `remember`/`recall`/
`recallAll`/`forget` are **space functions** in
`sdk/org/libs/core/system-spaces/system-global/functions/`, injected via
`injectSpaceFunctions` (`sdk/org/libs/core/src/exec/bootstrap.ts:123`) and built *on top of*
the `fetch`/`readFileRaw`/`writeFileRaw` primitives. Of these 8, 6 are UNIVERSAL (`todoWrite`,
`todoRead`, `remember`, `recall`, `recallAll`, `forget` — always injected regardless of
frontmatter) and 2 — `webSearch`/`webFetch` — are **GRANTED-ONLY**: withheld from the top-level
injected view unless the running agent's own `functions:` frontmatter names them; see
[§7](#7-function-allowlists-a-second-orthogonal-gate) for why and how. The generic fs wrappers
`readFile`/`writeFile`/`editFile`/`listDir`/`glob`/`grep` live in **`system-engineer`**
(`sdk/org/libs/core/system-spaces/system-engineer/functions/`), scoped to the engineer
(its `functions:` frontmatter) and jailed to the `fs:scratch` sandbox — not in `system-global`. All of these declare
via the function overlay, not `library-dts.ts`.

---

## 6. Bootstrap order

`createChildVM` runs a fixed sequence (`sdk/org/libs/core/src/exec/bootstrap.ts#createChildVM`):

1. **Seed vars** — fork seed + upstream outputs, delegate query/context, session resume scope
   (`:107-109`).
2. **`currentTask`** — only when `opts.currentTaskResolve` is supplied (`:115-120`).
3. **`injectSpaceFunctions`** — space/project functions as globals; an `@consent` pragma
   wraps the function (`:123`).
4. **`injectHostTools`** — the synchronous substrate (incl. the internal `execShell`/
   `readFileRaw`/`writeFileRaw` primitives), with `profile.allowWrite` taken from the
   capability profile (`:131-139`).
   4b. **`injectAppGlobals`** — `db` + the authoring writers + (on `projectRoot`) the
   `listProjectDir`/`readProjectFile` reads (`:144`).
   4c. **The `fs:scratch` scratch sandbox** — only when `caps.scratchFs`: injects
   `createScratch` + the internal scratch primitives and OVERRIDES `execShell` with the
   scratch-rooted variant (`:154-167`).
5. **The yielding globals**, each behind an explicit `if (caps.…)` (`:169-235`).
6. **The JSX runtime** — the `React` shim plus one stub global per `CATALOG_NAMES` and per
   caller-supplied component name; space components override on collision (`:241-264`).

---

## 7. Function allowlists (a *second*, orthogonal gate)

Capabilities gate **globals**. A separate mechanism gates **space functions** — the things
`injectSpaceFunctions` binds in step 3.

**Agent `functions:` frontmatter** is an explicit selection, not a filter over "everything":
`getAgentFunctions` walks `agent.config.functions` and picks only those names out of the
space (`sdk/org/libs/core/src/spaces/agent.ts#getAgentFunctions`), and the parsed default is the empty list
(`sdk/org/libs/core/src/spaces/load.ts:444`). What an agent's **top-level VM** actually gets is
the merge of three scopes — system functions ∪ project functions ∪ the agent's selected space
functions, with space/system winning on a name collision — but that merge is not the whole
story any more: it is filtered a second time.

**The two-set split (`webSearch`/`webFetch` are GRANTED-ONLY, not universal).** Every OTHER
`system-global` function (`todoWrite`, `remember`, …) is injected into the top-level VM
regardless of frontmatter, exactly as before. `webSearch`/`webFetch` are the two exceptions —
named in `GRANTED_ONLY_SYSTEM_FUNCTIONS`
(`sdk/org/libs/core/src/spaces/system.ts#GRANTED_ONLY_SYSTEM_FUNCTIONS`) — withheld from the
top-level injected functions/DTS/system-block **unless the running agent's own `functions:`
frontmatter names them**, via `filterUniversalFunctions`
(`sdk/org/libs/core/src/spaces/system.ts#filterUniversalFunctions`). A top-level
`webSearch(...)`/`webFetch(...)` call from an agent that hasn't granted itself the name fails
typecheck ("Cannot find name") — the same clean, retryable failure any other undeclared
identifier gets, not a runtime throw. This closes a bypass: `webSearch`/`webFetch` run raw HTTP
with no persistence step of their own, so an agent that can call them directly at top level can
research a fact and never store it — skipping straight past a `research_and_store`-shaped
tasklist that would have saved the finding for next time
(`.issues/research-store-noop-diagnosis.md`). **No shipped system agent grants
`webSearch`/`webFetch` today** (neither THING nor the researcher calls either at top level —
both route research through delegation/tasklists), so in practice every real
`webSearch`/`webFetch` call today happens inside a tasklist/fork task node that EXPLICITLY
names them, per the pool mechanism below — never at an agent's own top level, and (since the
task-node-default fix below) never by omission either.

**The fork-engine POOL stays unfiltered — this is what makes explicit task-level grants still
work.** `buildInjectedFunctions`
(`sdk/org/libs/core/src/session/session.ts#Session.buildInjectedFunctions`) computes the merged
three-scope set FIRST, unfiltered, and returns it *twice*: once filtered (via
`filterUniversalFunctions`) as the top-level `functions`/`functionsBundled` the VM/DTS/prompt
actually see, and once UNFILTERED as `poolFunctions`/`poolFunctionsBundled` — the superset a
task node's own `functions:` allow-list (below) narrows FROM. The pool, not the filtered view, is
what `ForkEngine`/`getForkEngine()` receives (`ForkEngineOpts.agentFunctions`,
`sdk/org/libs/core/src/fork/fork.ts#ForkEngineOpts`) — so a task node can still select
`webSearch`/`webFetch` explicitly even though the agent running it never sees them at its own top
level. `delegate.ts` mirrors the same split (`injectedFunctions` vs `poolFunctions`,
`sdk/org/libs/core/src/delegate/delegate.ts:211-214`).

**Task `functions:` frontmatter** (tasklist nodes) is a *narrowing allowlist over the parent's
POOL*, with three-way semantics (`sdk/org/libs/core/src/fork/fork.ts:321-339`):

```ts
const fnAllow = task.functions;
const pickAllowed = <T,>(rec: Record<string, T>): Record<string, T> => {
  if (!fnAllow) return filterUniversalFunctions(rec, undefined); // omitted ⇒ pool MINUS granted-only
  const out: Record<string, T> = {};
  for (const name of fnAllow) if (name in rec) out[name] = rec[name]!;
  return out;                                       // [...] ⇒ exactly those; [] ⇒ NO functions at all
};
```

So: **omit** = inherit the pool the parent agent had, MINUS the granted-only functions
(`webSearch`/`webFetch`) — a task node must opt into web access explicitly, exactly the same
"not granted ⇒ not injected" rule the top-level VM applies just above. This closed a second,
task-level instance of the SAME bypass §"two-set split" describes: a scaffolded task that
omitted `functions:` (e.g. a coverage-check `answer` task meant to read static knowledge only)
used to silently inherit the full pool INCLUDING `webSearch`/`webFetch`, so it could research
inline and report false coverage instead of honestly returning `covered:false` for the caller to
escalate to a `research_and_store`-shaped tasklist
(`.issues/research-store-noop-diagnosis.md`). **`[...]`** = exactly those names, if present in
the pool — this is how a task node EXPLICITLY opts in, unaffected by the omitted-case fix. This
is exactly how `research_and_store`'s research node reaches `webSearch`/`webFetch`
(`functions: [webSearch, webFetch]`,
`sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/05-write_tasks.md`)
even when the specialist agent running the tasklist was never granted them itself. **`[]`** =
none at all. Never forbid a tool in prose; disable it in frontmatter.

The DTS follows the same rule: the function overlay is built from the *injected* set —
`buildOverlay(agentFunctions, …)`, i.e. the already-narrowed map, fed to `buildAmbientDts`
(`sdk/org/libs/core/src/fork/fork.ts:420-421`, `:435-442`) — so a task that dropped (or never
had) `webSearch` cannot even name it without failing typecheck.

---

## 8. Runtime invariants

1. **Sync eval loop.** Statements are evaluated one at a time; a yield's result is injected
   as a global variable for subsequent turns.
2. **Host-side yield binding.** `const x = await ask()` does **not** resume via a QuickJS
   Promise continuation — the turn loop resolves the yield and binds `x` host-side. The
   yielding statement's LHS is parsed by `extractBindingPattern`
   (`sdk/org/libs/core/src/context/variables.ts#extractBindingPattern`) into a
   `simple`/`array`/`object`/`none` pattern (`sdk/org/libs/core/src/eval/turn-loop.ts:600`);
   `bindYieldResults` (`sdk/org/libs/core/src/eval/turn-loop.ts#bindYieldResults`) maps the resolved
   values onto those names — `yieldCount > 1` ⟹ the statement awaited a combinator
   (`Promise.all`) and the array of values in source order is the awaited result, `1` ⟹ the
   single value (`:281`) — and the turn loop then writes each name back with `vm.setVar`
   (`sdk/org/libs/core/src/eval/turn-loop.ts:679-682`), "inject into VM scope + host scope for
   the next turn".
   The **`vm.getVar` preference** (`sdk/org/libs/core/src/eval/turn-loop.ts#bindYieldResults`) is the
   nested-yield fix: for every bound name, the VM's own computed value wins over the raw
   resolved value whenever the VM reports it as defined. The two agree when the yielding call
   *is* the directly-awaited expression (every yield kind today); they diverge when the yield
   is nested inside another async function the model awaited instead — `webSearch()` awaiting
   `fetch()` internally — where the raw resolved value is the *inner* yield's value, while the
   VM's bytecode (continued via `drivePendingJobs()`) already computed the outer call's real
   return value. Regression test: "binds a NESTED yield (space function internally awaiting
   fetch) via bindYieldResults' getVar preference"
   (`sdk/org/libs/core/src/exec/prelude.test.ts:132`). The same helper is reused by the
   host-executed prelude (`sdk/org/libs/core/src/exec/prelude.ts:181`, `:230`).
3. **App globals root at `projectRoot`, never `LMTHING_SPACE_DIR`.** The internal
   `execShell`/`readFileRaw`/`writeFileRaw` primitives resolve relative paths against the space
   dir (`sdk/org/libs/core/src/globals/host-tools.ts:170-171`, `LMTHING_SPACE_DIR`), while `db`,
   the `writeProject*` writers, and the `listProjectDir`/`readProjectFile` reads resolve against
   the project root (`sdk/org/libs/core/src/exec/bootstrap.ts:144`; `LMTHING_PROJECT_DIR` at
   `sdk/org/libs/core/src/globals/host-tools.ts:199-201`). This split — space-rooted internal fs
   vs project-rooted typed reads/writes — is why an agent reads project files through
   `readProjectFile`/`listProjectDir`, not the (now internal) `readFileRaw`. A session with no
   `projectRoot` gets no `db` at all (`sdk/org/libs/core/src/exec/app-globals.ts:205`).
4. **Two execution regimes for the same data model.** In the agent sandbox `db.*` is a
   **synchronous** host call (`sdk/org/libs/core/src/exec/app-globals.ts#buildScopedDb`); the same
   methods are `Promise`-returning (`AsyncDbApi`) on the Node `api/`/`hooks/` side. One
   schema, two typed surfaces — see [data-db.md](./data-db.md).
