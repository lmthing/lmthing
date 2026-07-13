# Spaces Loading & Validation

How a space directory on disk becomes an in-memory `Space` object, the fail-loud validators that reject malformed authoring, and how project spaces + runtime-registered spaces are discovered so `delegate()` can reach them.

The on-disk *format* this loader parses (what a `spaces/<id>/` tree contains) is documented in [../format/space/README.md](../format/space/README.md). This page is about the **loader** — `sdk/org/libs/core/src/spaces/load.ts`.

## The `Space` object

`loadSpace(dir)` returns a `Space` (`sdk/org/libs/core/src/spaces/load.ts:7-21`):

| Field | What it holds |
|---|---|
| `dir` | absolute space directory (doubles as the delegate registry key — `registry.ts:126`) |
| `packageName` | `name` from the space's own `package.json` (optional) |
| `agents` | `slug -> AgentDef` |
| `tasklists` | `slug -> TasklistDir` (sorted node files) |
| `functions` | `name -> original TS source` (always) |
| `functionsBundled` | `name -> esbuild-bundled ESM` (only when `node_modules/` present) |
| `nodeModulesDir` | set only when the space has a `package.json` with installed deps |
| `dependentSpaces` | `packageName -> Space` for npm deps that are themselves spaces |
| `components` | `{ view, form }` — each `name -> source` |
| `knowledge` | `{ domains }` tree |

`AgentDef` (`load.ts:23-68`) carries `slug`, `title`, `instructBody` (body of `instruct.md`), `charterBody` (body of `charter.md` — fork-safe, injected into every fork), `actions`, `canDelegateTo` (tri-state, see below), optional `model`, `config` (declared knowledge/functions/components refs), `defaultAction`, `capabilities`, and `triggers`.

## `loadSpace(dir, opts)` — the pipeline

`loadSpace` (`load.ts:583-722`) runs these steps in order:

1. **Require an `agents/` directory** unless `opts.requireAgents === false` (`load.ts:584-591`). A missing `agents/` throws `Space at "<dir>" must have an agents/ directory`; function-only system spaces (e.g. `system-global`) pass `requireAgents:false`.
2. **Require ≥1 agent** — after filtering `agents/*` to real sub-directories, an empty list throws `Space at "<dir>" must have at least one agent` (`load.ts:601-603`) — again skipped when `requireAgents:false`.
3. **`package.json` / dependency install** (`load.ts:606-650`) — reads `name` into `packageName`; runs `npm install` **only when the space actually declares deps** and `node_modules/` is absent (`load.ts:619-630`; a dep-less `package.json` must not trigger install on egress-less pods). A failed install throws. When `node_modules/` exists, `nodeModulesDir` is set and any dependency that is itself a space (has an `agents/` dir) is recursively `loadSpace`'d into `dependentSpaces` (invalid deps are skipped silently, `load.ts:642-647`).
4. **Load agents** — one `loadAgent` per agent dir (`load.ts:653-656`), threading `opts.knownTables` for capability validation.
5. **Load tasklists** (`loadTasklists`, `load.ts:355-404`).
6. **Validate action → tasklist** (`load.ts:662-670`).
7. **Load functions** via the shared `loadFunctionsFromDir` (`load.ts:673`).
8. **Load components** (`loadComponents`, `load.ts:208-253`) and **knowledge** (`loadKnowledge`, `load.ts:255-328`).
9. **Validate agent config refs** — functions, components, knowledge (`load.ts:684-719`).

### `LoadSpaceOpts` (`load.ts:570-581`)

- `requireAgents` (default `true`) — allow function-only system spaces.
- `onWarn` — non-fatal diagnostics channel (defaults to `console.warn` with a `[spaces]` prefix).
- `knownTables` — table names in the resolving project's `database/`, used to fail-loud on a `db:*` capability that names a non-existent table. **Omit for a project-agnostic (system) space load** — the table-existence check is then deferred to run time.

## Fail-loud validators

The loader rejects authoring mistakes *at load time* rather than silently mis-configuring an agent. Every throw below aborts the load.

### Frontmatter YAML — `parseFrontmatter`
`sdk/org/libs/core/src/spaces/frontmatter.ts:11-40` throws `Invalid YAML frontmatter in <source>: …` on malformed YAML instead of returning empty `data` — "a loud error instead of a mysteriously default-configured agent". A file with no `---` delimiters is treated as plain body (no throw).

### Agent frontmatter key allow-list
`loadAgent` rejects any `instruct.md` frontmatter key outside `AGENT_FRONTMATTER_ALLOWED_KEYS` (`load.ts:413-425`, `461-466`): `title, knowledge, functions, components, actions, defaultAction, canDelegateTo, dependencies, capabilities, model, triggers`. This exists so a typo'd `capabilities`/`canDelegateTo` (which would otherwise be silently ignored, granting nothing) fails loudly. The set is kept in lockstep with every key `loadAgent` actually reads.

### `triggers:` shape validation
When present, `triggers` must be an array (`load.ts:506-509`); each entry must be `{ webhook: { path, provider? } }` (`load.ts:510-543`). `path` must be a non-empty string matching `WEBHOOK_PATH_RE` = `/^[A-Za-z0-9_-]+$/` (`load.ts:429`, `524-533`) — kept in sync with the CLI's `libs/cli/src/app/hooks/loader.ts`. `provider`, if present, must be a string.

### `canDelegateTo` — tri-state, preserved not normalized
`load.ts:36-44`, `447`, `477-481`. The loader keeps the distinction:
- **`undefined`** (key omitted) → unrestricted delegation (back-compat).
- **`[]`** → NO delegation.
- **`["*"]`** → explicitly unrestricted.
- explicit list → hard allowlist enforced at yield time.

The deprecated `dependencies:` key is read as a fallback when `canDelegateTo` is absent (`load.ts:479-481`). One non-fatal `onWarn` fires for the genuinely confusing combo — `canDelegateTo: []` while the instruct body calls `delegate(` (`load.ts:482-492`); a plain `[]` on a non-delegating specialist is the correct "hard none" declaration and must not warn.

### Knowledge option frontmatter allow-list — `validateKnowledgeOptionFrontmatter`
`load.ts:339-353`. A `knowledge/<domain>/<field>/<slug>.md` option file with frontmatter must have a non-empty `description` (required); only `description, icon, color, label` are allowed (`KNOWLEDGE_OPTION_ALLOWED_KEYS`, `load.ts:331`). Any other key throws. Plain markdown with no frontmatter is always valid. Invoked per option file during `loadKnowledge` (`load.ts:297`).

### Action → tasklist resolution
Every `action.tasklist` that is set must name a loaded tasklist, else `Agent "<slug>" action "<id>" references tasklist "<name>" which does not exist` (`load.ts:662-670`).

### Agent config-reference resolution
For every agent (`load.ts:684-719`): each declared `functions:` entry must exist in the loaded `functions/`; each `components:` entry must exist in `components.view` or `components.form`; each `knowledge:` ref (`domain/field/option`, split on `/`) must resolve its domain, then field, then option. Any miss throws a specific message. (Previously only functions were validated — bad component/knowledge refs used to fail silently.)

### Capabilities validation
`parseCapabilities` (`sdk/org/libs/core/src/spaces/capabilities.ts`, called at `load.ts:468`) parses the `capabilities:` frontmatter into `AppCapabilities`. It receives `{ agentId, knownTables }` so a `db:*` grant naming a table absent from the project `database/` fails loud — but only when `knownTables` was supplied (project-rooted load); a system-space load defers this to run time.

## `loadFunctionsFromDir` — the shared function loader

`load.ts:168-206`. Reads `<dir>/functions/*.{ts,tsx}` keyed by basename into `functions` (original source, always). When `nodeModulesDir` is passed, each function is additionally esbuild-bundled (`bundle:true, format:'esm', platform:'browser'`, `absWorkingDir` = the space dir) into `functionsBundled` so it can `import` an installed dependency at runtime. This same primitive is reused by the **project** function scope (`spaces/project-functions-load.ts`, `<projectRoot>/functions/`) — a third function scope loaded only for project-rooted sessions — so the esbuild wiring isn't duplicated.

## Space roots — system spaces

System spaces are always-loaded baseline capability spaces merged into every user space (`sdk/org/libs/core/src/spaces/system.ts:7-22`).

`SYSTEM_SPACE_NAMES` (`system.ts:30-41`) — the **ten** bundled spaces shipped with `@lmthing/core`:
`system-global, system-engineer, system-architect, system-research, system-appbuilder, system-vision, system-files, system-store, user-memory, user-thing`.

`defaultSystemSpaceDirs()` (`system.ts:50-57`) resolves the bundled directory by probing both `dist/` and `src/` layouts (`existsSync`) so the path resolves whether running compiled or under vitest, then joins each name. Overridable via `LM_SYSTEM_SPACES` (CSV of dirs), handled by the caller.

`loadSystemSpaces(dirs)` (`system.ts:60-70`) loads each with `requireAgents:false` and **swallows any error** — a missing/invalid system-space dir must not break the session.

### Merge semantics — `mergeSystemInto`
`system.ts:112-166`. System spaces are applied first (lower priority), then the user space overlays (higher priority), so **a user space wins every name collision** and can override a system tool. Returns a NEW `Space`; inputs are not mutated. Two placeholder-shadowing guards:
- An **empty placeholder agent** (a dir with no `instruct.md` → no `instructBody`, no actions) must NOT shadow a real system agent of the same slug (`system.ts:144-148`). This is what once silently stripped the system `architect`.
- An **empty user tasklist** (no node files) must not shadow a system tasklist of the same slug (`system.ts:152-155`).

### Universal vs scoped functions
Agents from every system space are universally delegatable, but **functions are universal only when they live in `system-global`** (`GLOBAL_SPACE_NAME`, `system.ts:27`). `systemFunctionNames` / `systemFunctionSources` / `systemFunctionsBundled` (`system.ts:78-105`) filter to `isGlobalSpace` (`basename(dir) === 'system-global'`). Every other system space's functions reach only its own agents via the per-agent path — they stay out of other spaces' prompts and VMs.

## Project-space discovery

A **project space** lives at `<root>/<projectId>/spaces/<spaceId>/`. Discovery is the CLI's job — core stays path-agnostic and only receives dirs.

- `listProjectSpaceDirs(root, projectId)` (`sdk/org/libs/cli/src/server/projects.ts:152-154`) returns the absolute path of every immediate sub-directory of `<root>/<projectId>/spaces/`, or `[]` if absent. `projectSpaceDir(root, projectId, spaceId)` (`projects.ts:157-159`) resolves a single one.
- The `SessionManager` scans them once per session and passes the results as two `SessionOpts`:
  - `preloadSpaceDirs` — the scanned dirs (`session-manager.ts:1114-1130`), which `Session.start`/rehydrate loads into `dynamicSpaces` up front so they are **delegatable immediately** (`session.ts:236-245`, `427-433`; one bad dir logs a warn and is isolated, it does not abort startup).
  - `projectSpacesDir` = `join(root, projectId, 'spaces')` (`session-manager.ts:1112`) — threaded through every fork/delegate (`session.ts:645, 708, 755, 976`) so nested scopes rebuild a registry that can still reach project spaces.

`preloadSpaceDirs` are loaded with a plain `loadSpace(dir)` (default `requireAgents:true`) — a project space must have agents.

## Runtime registration — `registerSpace`

`registerSpace(dir)` is a value-yielding global (`sdk/org/libs/core/src/globals/register-space.ts:21-34`) that loads a space at `dir` into the live registry so `delegate()` can reach it *this session*. It returns `{ ok, spaceKey, agentSlug, error? }` where `spaceKey === dir` (the key to pass to `delegate()`) and `agentSlug` is the first agent found.

Resolution has two sites, both writing the **same shared `dynamicSpaces` Map**:
- **Top-level session** (`session.ts:816-826`): `loadSpace(dir)` → `this.dynamicSpaces.set(dir, space)`; on failure returns `{ ok:false, error }` rather than throwing.
- **Fork leaves** (`eval/yield-router.ts:355-370`): gated on `ctx.resolveRegisterSpace`; loads and inserts into the shared map (`session.ts:113` — a single mutable reference handed to `delegate()`, forks, and the router), so a space registered inside a fork is reachable by the parent's later `delegate()`.

`Session.dynamicSpaces` is a shared mutable `Map` (`session.ts:109-113`). When building a delegate's `spaceMap` (`session.ts:925-939`), the session seeds it with its own space + `dependentSpaces`, adds every system space (always delegatable), then merges in every `dynamicSpaces` entry.

## Delegate registry resolution

`DelegateRegistry` (`sdk/org/libs/core/src/delegate/registry.ts`) is constructed over the `spaceMap` and resolves a delegate target string to `{ space, agent }`:
- A **bare slug** (`spaceRef === undefined`) searches every registered space for that agent slug (`registry.ts:14-20`).
- A `space/agent` ref matches a space by `packageName`, exact `dir`, or `dir` ending in `/<name>` (`matchesSpace`, `registry.ts:121-127`) — this is how a preloaded project space at `.../spaces/<id>` matches a `<id>/<agent>` ref.
- `resolveLazy(target)` (`registry.ts:71-103`) falls back to treating the target as an on-disk path (`<spaceDir>/<agentSlug>`) and `loadSpace`-ing it, caching the result — surfacing the actionable registry error (not a filesystem error) if that also fails.
- Errors list the real available space keys + agent slugs so a hallucinated key self-corrects on retry (`availabilityHint`, `registry.ts:44-55`).

## Related

- On-disk space format → [../format/space/README.md](../format/space/README.md)
- Turn loop & yield protocol → [turn-loop.md](./turn-loop.md)
- Typecheck / DTS overlay → [typecheck.md](./typecheck.md)
