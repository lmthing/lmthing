# The typecheck / DTS gate

Every statement the model streams is typechecked against a **per-agent ambient DTS** before it is transpiled and evaluated. This is the load-bearing security-and-correctness gate of the runtime: a global that the agent was not granted is **not declared in its DTS**, so a stray call to it fails typecheck with a clean `Cannot find name '…'` — a *retryable* error surfaced to the model — instead of passing typecheck and throwing (or silently binding `undefined`) at runtime. The DTS is composed additively from per-global fragments keyed to the agent's capabilities and functions; injection and declaration are kept in lockstep so "not listed ⇒ not injected AND absent from the DTS."

Implementation: `sdk/org/libs/core/src/typecheck/{tsc,library-dts,overlay,transpile}.ts` (the checker, the built-in-global fragments, the function/component overlay generator, the TS/JSX→JS transpiler) plus the DTS assembler `buildAmbientDts` in `sdk/org/libs/core/src/exec/bootstrap.ts`. The per-statement pipeline that drives them lives in `sdk/org/libs/core/src/eval/turn-loop.ts` — see [turn-loop.md](./turn-loop.md).

## The per-statement pipeline

`processStatement` in `turn-loop.ts` runs each parsed statement through a fixed sequence `sdk/org/libs/core/src/eval/turn-loop.ts:382-422`:

1. **prose-drop** — `looksLikeProse(stmt)` drops narrated prose (`turn-loop.ts:383`, def at `:172`) so it never burns a retry on a guaranteed typecheck error.
2. **typecheck** — `runTsc({ ambientDts: fullAmbient(), sessionContext: accumulatedContext, statement })` `sdk/org/libs/core/src/eval/turn-loop.ts:385`. A failure returns `{ kind: 'typecheck_error', message }` with all diagnostics joined by `; ` `turn-loop.ts:386-391`.
3. **transpile + globalThis-propagation** — `transpileStatement(stmt)` then append `globalThis['<name>'] = <name>` for each bound name `turn-loop.ts:395-402`.
4. **eval** — `vm.evalStatement(jsCode)` `turn-loop.ts:403`.
5. **pending-yield check → accumulatedContext append** `turn-loop.ts:410-421`.

Only the typecheck and DTS composition are covered here; the eval/yield half is [turn-loop.md](./turn-loop.md).

## The checker (`tsc.ts`)

`runTsc({ ambientDts, sessionContext, statement })` builds an **in-memory two-file TypeScript program** and returns `{ ok, diagnostics }` `sdk/org/libs/core/src/typecheck/tsc.ts:27-97`:

- **`__ambient__.d.ts`** ← the per-agent `ambientDts` (all declarations).
- **`__session__.tsx`** ← `export {};\n` (MODULE_HEADER — makes the file a module so **top-level `await`** is allowed) + the accumulated prior successful statements + the new statement `tsc.ts:30-45`. The `.tsx` extension enables JSX syntax `tsc.ts:25`.

Compiler options: `strict: true`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, classic JSX (`jsx: React`, `jsxFactory: React.createElement`), `skipLibCheck`, `noEmit`, `lib: ['lib.es2022.d.ts']` `tsc.ts:47-59`.

> Correction — the old `@.claude/arch/typecheck.md` claimed `module: NodeNext`. The code uses `module: ESNext` + `moduleResolution: Bundler` `tsc.ts:49-50`.

Diagnostics from both `getSyntacticDiagnostics()` and `getSemanticDiagnostics()` are collected, filtered to **only the `__session__.tsx` file** and **only lines ≥ `statementStartLine`** (so a diagnostic is attributed to the *current* statement, not accumulated context) `tsc.ts:70-94`. `statementStartLine = headerLines + contextLineCount` accounts for both the module header and the accumulated context `tsc.ts:32-40`. Line numbers in the returned diagnostics are rebased to be relative to the statement (`line - statementStartLine`) `tsc.ts:87-93`.

`createInMemoryHost` overlays the two virtual files onto a real `ts.createCompilerHost` so the default `lib.*.d.ts` files still resolve; `writeFile` is a no-op (`noEmit`) `tsc.ts:99-130`.

## The library DTS (`library-dts.ts`) — built-in global fragments

`library-dts.ts` splits the ambient declarations into **per-global fragments** so `buildAmbientDts` can compose each VM context additively. The key fragments:

**Orchestration globals** (each present in some contexts, absent in others):
- `ASK_DTS` — `ask()` `library-dts.ts:14`.
- `SET_SESSION_META_DTS` — `setSessionMeta()` `library-dts.ts:17-18`.
- `TASKLIST_DTS` — `tasklist()` `library-dts.ts:22-23`.
- `FORK_DTS` — `fork()` `library-dts.ts:24`.
- `DELEGATE_DTS` — the two `delegate()` overloads `library-dts.ts:25-26`.

**`COMMON_DTS`** — declarations present in **every** VM context (session, fork leaf, delegate): `display`, `inspect`, `loadKnowledge`, `sleep`, `registerSpace`, the `JSXDescriptor`/`ForkOpts`/`DelegateOpts` interfaces, the classic-JSX `React` and `JSX` namespaces, and host-injected primitives (`fetch`, `readDocument`, `integrationStatus`, `process`, `readFileRaw`, `typecheckSource`, `spacePath`, `resolveSpaceDir`, `progress`), plus `catalogDts()` (the design-system catalog as typed JSX globals) appended at the end `library-dts.ts:35-108`.

> Note — `registerSpace` stays declared in `COMMON_DTS` even where the global is *not* injected (read-only fork roles, delegates), deliberately matching the pre-unification DTS where only ask/tasklist/fork/delegate were stripped `library-dts.ts:28-40`. Its injection, not its declaration, is what is gated.

**Write primitives** — split OUT of `COMMON_DTS` and gated on `allowWrite`: `EXEC_SHELL_DTS` (`execShell`) `library-dts.ts:116` and `WRITE_FILE_RAW_DTS` (`writeFileRaw`) `library-dts.ts:117`. Declaring them unconditionally inside `COMMON_DTS` made a stray `writeFileRaw`/`execShell` **pass typecheck** in a read-only VM and throw at runtime; gating the fragment fixes that `library-dts.ts:110-117`.

The two full bundles (used by `host-tools.ts`'s `typecheckSource`, which needs the full global set — so both re-append the write primitives `library-dts.ts:290-294`):
- `LIBRARY_DTS` — everything incl. `ask` `library-dts.ts:296-297`.
- `LIBRARY_DTS_NO_ASK` — no `ask` (fork/delegate VMs are headless; a stray `await ask(...)` there fails typecheck with `Cannot find name 'ask'` instead of blocking forever on stdin) `library-dts.ts:299-306`.

### App-capability fragments

Project-as-application globals are declared **only when the owning agent holds the matching `capabilities:` grant** (see [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md)). These fragments are the DTS half of the capability→{inject, dts} registry:

- **`db.*`** — the three `db:*` verbs share ONE `db` object, so they cannot be three separate `declare const db` blocks. `composeDbDts({ read, write, schema })` unions the present member strings (`DB_READ_MEMBERS` / `DB_WRITE_MEMBERS` / `DB_SCHEMA_MEMBERS`) into a single `declare const db`, returning `''` when none are present (so a stray `db` call fails typecheck) `library-dts.ts:130-156`. In the agent sandbox `db.*` is a **synchronous** host call (non-Promise) `library-dts.ts:124-127`.
- **`api:call`** → `API_CALL_DTS` (`apiCall`, value-yielding Promise) `library-dts.ts:160`, replaced by project-generated typed overloads when `appDts` is supplied (see below).
- **`connections:use`** → `composeConnectionsDts(providers)` types `callConnection`'s `provider` param to the **union of granted providers**, so a call to an undeclared provider fails typecheck `library-dts.ts:170-173`.
- **`tools:use`** → `composeToolDts(allow)` types `tool`'s `name` param to the **union of the granted allow-list** `library-dts.ts:185-188`.
- **`pages:write`** → `PAGES_WRITE_DTS` (`writePage`) + `PROJECT_PAGE_DTS` (`writeProjectPage`) `library-dts.ts:189,199,281`.
- **`api:write`** → `API_WRITE_DTS` (`writeApi`) + `PROJECT_API_DTS` (`writeProjectApi`) `library-dts.ts:190,200,282`.
- **`hooks:write`** → `HOOKS_WRITE_DTS` (`writeHook`) + `PROJECT_AUTHORING_DTS` (`writeProjectHook`/`writeProjectEvent`/`writeProjectFunction`) `library-dts.ts:191,209-211,283`.
- **`db:schema`** → in addition to the `db.createTable`/`addColumn` members, the standalone `WRITE_TABLE_SCHEMA_DTS` (`writeTableSchema` — catalog template) and `PROJECT_TABLE_DTS` (`writeProjectTable` — live project, optional third arg seeds rows) `library-dts.ts:218,229`.
- **any `db:*` grant** → `PROJECT_READ_DTS` (`listProjectDir`/`readProjectFile`) — project-rooted introspection, the read-side twins of the `writeProject*` writers (unlike the space-rooted `readFileRaw`/`execShell`) `library-dts.ts:238-239`, gated at `exec/bootstrap.ts:295`.
- **`project:manage`** → `PROJECT_MANAGE_DTS` (`createProject`/`selectProject`) `library-dts.ts:245-246`.
- **`store:read`** → `STORE_READ_DTS` (`storeSearch`/`storeInspect`) `library-dts.ts:252-255`.
- **`store:install`** → `STORE_INSTALL_DTS` (`installSpace`, consent-marked) `library-dts.ts:262-263`.
- **`events:emit`** → `EVENTS_EMIT_DTS` (`emitEvent`) `library-dts.ts:269-270`.

The flat standalone map is `CAPABILITY_DTS_FRAGMENTS` `library-dts.ts:279-288`; the `db:*` trio is deliberately NOT in it (composed via `composeDbDts`), and neither are `WRITE_TABLE_SCHEMA_DTS`/`PROJECT_TABLE_DTS`/`PROJECT_READ_DTS`/`composeConnectionsDts`/`composeToolDts` (all handled explicitly in `buildAppCapabilityDts`).

## Composing the per-agent DTS (`buildAmbientDts`)

`buildAmbientDts(opts)` in `exec/bootstrap.ts` is the single DTS assembler for all three contexts (session, fork, delegate) — it replaced three earlier string-surgery sites (session `LIBRARY_DTS + overlay`, delegate `LIBRARY_DTS_NO_ASK + …`, fork's regex-strip of tasklist/fork/delegate) `sdk/org/libs/core/src/exec/bootstrap.ts:248-272`. It concatenates, in order and filtering out empties `bootstrap.ts:315-337`:

1. `caps.ask ? ASK_DTS : ''`
2. `caps.setSessionMeta ? SET_SESSION_META_DTS : ''`
3. `caps.orchestrate ? TASKLIST_DTS : ''` and `caps.orchestrate ? FORK_DTS : ''`
4. `caps.delegate ? DELEGATE_DTS : ''`
5. `COMMON_DTS` (unconditional)
6. `caps.allowWrite ? EXEC_SHELL_DTS : ''` and `caps.allowWrite ? WRITE_FILE_RAW_DTS : ''`
7. `buildAppCapabilityDts(caps.app, opts.appDts)` — the app-capability fragments
8. `opts.overlay ?? ''` — the function/component overlay
9. `opts.currentTask ? CURRENT_TASK_DTS : ''` — the fork/delegate `currentTask.resolve()` capture global `bootstrap.ts:246`
10. `...(opts.extraDecls ?? [])` — fork seed/upstream vars, delegate query/context

`buildAppCapabilityDts(app, appDts)` gates each app fragment per grant `bootstrap.ts:282-313`: `composeDbDts` from the three `db:*` flags; `writeTableSchema`+`writeProjectTable` on `db:schema` `bootstrap.ts:291`; `listProjectDir`/`readProjectFile` on **any** db grant `bootstrap.ts:295`; the project-generated typed `apiCall` overloads (`appDts`) in place of the generic fragment when `api:call` is held AND `appDts` is non-empty `bootstrap.ts:299`; `composeConnectionsDts`/`composeToolDts` on `connections:use`/`tools:use` `bootstrap.ts:302-305`; then each standalone `CAPABILITY_DTS_FRAGMENTS[id]` for the remaining grants present `bootstrap.ts:309-311`.

### Which context gets what

The `capabilities` passed to `buildAmbientDts` is a `CapabilityProfile` `sdk/org/libs/core/src/exec/capability.ts:47-79`, built by one of three factories:

| Factory | `ask` | `orchestrate` (tasklist/fork) | `delegate` | `setSessionMeta` | `allowWrite` | `app` |
|---|---|---|---|---|---|---|
| `sessionCapabilities` `capability.ts:84-86` | ✓ | ✓ | policy | ✓ | ✓ | full |
| `forkCapabilities` `capability.ts:94-97` | ✗ | ✗ | task opt-in | ✗ | role (explore/plan = read-only) | `intersectAppCaps(app, allowWrite)` |
| `delegateCapabilities` `capability.ts:106-108` | ✗ | ✓ | policy | ✗ | ✓ | full |

So a **fork leaf** has no `ask`, no `tasklist`/`fork` (a leaf spawning its own subtree would bypass the concurrency semaphore) — those declarations are simply absent, and a stray call fails typecheck as a clean retryable error rather than passing then throwing at runtime `fork/fork.ts:325-343`. `delegate` is added back to a fork only when the task opts in via `canDelegateTo`. A read-only fork role has `app` intersected against `allowWrite` (`intersectAppCaps`, `capability.ts:16-28` — only `db:read`/`api:call`/`connections:use`/`tools:use`/`store:read` survive) so its write grants vanish from the DTS too.

Call sites: session `session/session.ts:278` (and the two rebuild/resume paths `session.ts:411,472`), fork `fork/fork.ts:338-343` (with `currentTask: true` and seed/upstream `extraDecls`; the tasklist prelude VM re-builds one at `fork.ts:482`), delegate `delegate/delegate.ts:258-263` (`currentTask: true` + `query`/`context` `extraDecls`).

## The function/component overlay (`overlay.ts`)

`buildOverlay(functions, components, onWarn?)` generates ambient declarations for the agent's **own** space functions and components `sdk/org/libs/core/src/typecheck/overlay.ts:63-95`:

- **Functions** → `extractFunctionSignature(name, src)` parses the source, prepends any local `interface`/`type` declarations the params reference, and re-emits the exported function as a `declare` with its real parameter/return types `overlay.ts:189-232`. A function with **no explicit return type** is declared `: any` (not `unknown`) — the model often omits the annotation, and `unknown` would force every `result.field` access to fail typecheck and burn a retry `overlay.ts:220-222`.
- **Components** → the `Props` interface is extracted and renamed `<Name>Props`, with all **function-typed props made optional** (the render surface injects the callbacks — the model must not pass them) `overlay.ts:23-56,83-92`; fallback `declare function Name(props?: Record<string, unknown>): JSXDescriptor` when no `Props` is found `overlay.ts:89`.

`warnIfMissingAnnotations` logs (does not throw) when a function/component lacks a JSDoc description or has untyped params `overlay.ts:103-133`.

## Transpile (`transpile.ts`)

After a statement passes typecheck, `transpileStatement(code)` runs `ts.transpileModule` with the **classic JSX transform** (`jsx: React`, `jsxFactory: React.createElement`, `jsxFragmentFactory: React.Fragment`, `module: ESNext`, `target: ES2022`) `sdk/org/libs/core/src/typecheck/transpile.ts:7-19`. Output is plain JS with type annotations stripped and JSX converted to `React.createElement(...)` — that JS (plus the appended `globalThis` binds) is what `vm.evalStatement` runs. `React` is declared globally in `COMMON_DTS` `library-dts.ts:49-52` and a React shim (`createElement` → a plain `JSXDescriptor`, plus a `displayName` stub per catalog/space component) is injected into every VM — sessions, forks, delegates — by `createChildVM` `sdk/org/libs/core/src/exec/bootstrap.ts:213-240`, so `<Foo/>` typechecks without an import and doesn't throw "React is not defined" at eval.

## The retry-on-type-error path

A `typecheck_error` outcome is surfaced to the model as a **retryable** error, never silently swallowed. In the streaming loop, the first typecheck error aborts the stream, records a `typecheck_error` trace event, and breaks out `sdk/org/libs/core/src/eval/turn-loop.ts:473-478`. After the stream ends, `turnError`/`failingStatement` drive the retry `turn-loop.ts:578-596`:

- `process.exit(...)` in the error message is treated as **intentional termination** (control flow), returning `'done'` without retrying `turn-loop.ts:582-585`.
- Otherwise an **error block** is appended to history as a `user` message via `buildErrorBlock(failingStatement, turnError, attempt, maxRetries, accumulatedContext)` `turn-loop.ts:593`, then `continue` re-runs the turn — unless `attempt >= maxRetries` (default 3), in which case the loop returns `'error'` `turn-loop.ts:594`.

`accumulatedContext` is **not rolled back** on error: statements that succeeded earlier in the turn already bound their variables in the VM (`globalThis`) and persist into the retry, so keeping them in the typecheck context matches VM reality — rolling back would make tsc reject valid references with "Cannot find name" `turn-loop.ts:586-591`. The failing statement itself was never appended (it errors before accumulation).

`buildErrorBlock` `sdk/org/libs/core/src/eval/error-rewind.ts:45-76` emits: the attempt counter, the commented-out failing statement, the diagnostic message, an optional actionable `sandboxApiHint` (mapping e.g. a `Cannot find name 'fetch'`/`child_process`/`fs` reach for a sandbox-unavailable API to the right host global `error-rewind.ts:9-34`), the still-in-scope names (do NOT redeclare), and the already-executed context.

### Forward-reference repair for errored yields

A separate mechanism handles names bound by a *yielding* statement whose yield **errored** on a retryable attempt: that statement is never committed to `accumulatedContext` (it is re-tried), so without help a retry that references the name would fail typecheck with "Cannot find name". `fullAmbient()` appends `declare const <name>: any;` for each such name (tracked in `yieldErrorNames`) to the ambient DTS — a forward reference resolves against it, and a re-emitted `const <name> = …` simply shadows it with no redeclare conflict `turn-loop.ts:321-331`.

## Why the gate matters (the invariant)

The whole design rests on one rule, restated across the code: a capability that is **not granted** is **not injected as a global AND not declared in the DTS** — so a stray call is caught by the typechecker as `Cannot find name '…'` (a clean, retryable, model-visible error) rather than passing typecheck and either throwing at runtime (wasting a salvage) or binding `undefined` (a silent wrong result) `library-dts.ts:3-13`, `bootstrap.ts:274-281`, `capability.ts:47-79`. The gate is per-agent, per-context, and per-capability, and it is the same gate the boolean orchestration flags (`ask`/`fork`/`delegate`) and the app grants (`db:*`/`connections:use`/…) both flow through.
