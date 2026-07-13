# Adding a space

A **space** is a directory bundle of agents plus the tooling they reference — `functions/`,
`knowledge/`, `tasklists/`, `components/`, `events/` — read into a `Space` record by
`loadSpace(dir)` (`sdk/org/libs/core/src/spaces/load.ts#loadSpace`). This page is the procedure for
**authoring one and getting the runtime to see it**. The on-disk *format* of every file kind lives
in [../format/space/README.md](../format/space/README.md) — this page does not restate it; it tells
you what to create, what the loader will reject, and how to register/install what you built.

Related: [../runtime/spaces-loading.md](../runtime/spaces-loading.md) (the loader/merge internals)
· [../format/space/agents/README.md](../format/space/agents/README.md) (charter/instruct)
· [../runtime-globals/store-and-consent.md](../runtime-globals/store-and-consent.md) (`installSpace`).

---

## 0. Which kind of space are you adding?

The files are identical; **where the directory lives** decides how it is discovered.

| Kind | Lives at | Discovered by | Section |
|---|---|---|---|
| **Project space** (the common case) | `<root>/<projectId>/spaces/<id>/` | scanned per session — `listProjectSpaceDirs` → `preloadSpaceDirs` (`sdk/org/libs/cli/src/server/projects.ts:148-153`, `sdk/org/libs/cli/src/server/session-manager.ts:1112-1118`) | [§5a](#5a-a-project-space) |
| **System space** (shipped with the runtime) | `sdk/org/libs/core/system-spaces/<name>/` | must be listed in `SYSTEM_SPACE_NAMES` (`sdk/org/libs/core/src/spaces/system.ts#SYSTEM_SPACE_NAMES`) | [§5b](#5b-a-system-space) |
| **Store space** (installable integration) | `store/spaces/<id>/` | store catalog manifest + the pod's install route (`store/scripts/gen-apps-manifest.mjs:41-42`, `sdk/org/libs/cli/src/server/routes/store-spaces.ts#installStoreSpace`) | [§5c](#5c-a-store-space-integration) |
| **Runtime-registered** (ephemeral, agent-authored) | anywhere on the pod FS | the `registerSpace(dir)` global (`sdk/org/libs/core/src/globals/register-space.ts#createRegisterSpaceGlobal`) | [§5d](#5d-a-runtime-registered-space) |

Write the space once; pick the registration path at the end.

---

## 1. Scaffold the directory

Only `agents/` is mandatory (and only when the caller requires agents — see §4). Every other
loader returns empty when its directory is absent, so omit what you don't need
(`sdk/org/libs/core/src/spaces/load.ts:173`, `:213-215`, `:259-261`, `:359`).

```
my-space/
├── agents/<slug>/charter.md      # fork-safe identity/guardrails (body only)
├── agents/<slug>/instruct.md     # YAML frontmatter (config) + operating instructions
├── functions/<fnName>.ts         # deterministic TS helpers (no LLM)
├── knowledge/<domain>/<field>/   # index.md (overview) + <aspect>.md options
├── tasklists/<slug>/             # index.md + NN-<id>.md steps (NN-<id>.ts = code node)
├── components/{view,form}/*.tsx  # agent-rendered UI
├── events/<name>.ts              # emitter defs — makes the space an EVENT SOURCE
└── package.json                  # store spaces only: the `lmthing` manifest block
```

Real minimal shapes to copy: `sdk/org/libs/core/system-spaces/system-research/` ships only
`agents/` + `tasklists/`, and `store/spaces/integration-slack/` ships `agents/ functions/ events/
knowledge/` with no `tasklists/` or `components/` (`store/spaces/integration-slack/package.json:1-3`).

Per-file-kind formats: [../format/space/agents/](../format/space/agents/README.md) ·
[functions/](../format/space/functions/README.md) ·
[knowledge/](../format/space/knowledge/README.md) ·
[tasklists/](../format/space/tasklists/README.md) ·
[components/](../format/space/components/README.md) ·
[events/](../format/space/events/README.md) ·
[package.json](../format/space/package.json.md).

---

## 2. Write the agent — `agents/<slug>/{charter,instruct}.md`

Two files, both read by `loadAgent` (`sdk/org/libs/core/src/spaces/load.ts#loadAgent`):

- **`charter.md`** — body only, **no frontmatter required**; it is `parseFrontmatter`d and the body
  trimmed into `AgentDef.charterBody` (`load.ts:548-553`). It is injected into the top-level prompt
  **and every fork**, so keep it to identity + guardrails (`load.ts:27-29`).
- **`instruct.md`** — YAML frontmatter is *all* the config; the body becomes the agent's operating
  instructions (`load.ts:456-458`). It is top-level only. The loader does **not** require it: the
  read sits behind a `fileExists` guard (`load.ts:456`), so an agent dir without one still loads,
  with an empty body and its slug as its title. Don't rely on that — an agent with no `instruct.md`
  (and no actions) counts as an **empty placeholder** and is deliberately prevented from shadowing a
  same-slug system agent on merge (`sdk/org/libs/core/src/spaces/system.ts:139-148`). Always write one.

Real example — the Slack integration agent (`store/spaces/integration-slack/agents/slack/instruct.md:1-24`):

```yaml
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
    description: Post messages, list channels, and search messages in the user's connected Slack workspace.
  - id: post
    label: Post message
    description: Send a message to a Slack channel.
defaultAction: assist
canDelegateTo: []
---
```

### The frontmatter allow-list (fail-loud)

`AGENT_FRONTMATTER_ALLOWED_KEYS` is the closed set of top-level keys; **any other key throws at load**
(`sdk/org/libs/core/src/spaces/load.ts#AGENT_FRONTMATTER_ALLOWED_KEYS`, `:461-466`). That gate exists precisely so a typo'd
`capabilites:` can't silently grant nothing.

| Key | Meaning | Grounding |
|---|---|---|
| `title` | display name; defaults to the slug | `load.ts:470` |
| `knowledge` | `<domain>/<field>[/<option>]` refs — validated against `knowledge/` | `load.ts:473`, `:699-718` |
| `functions` | names that must exist in `functions/` — scopes VM injection + DTS | `load.ts:474`, `:684-691` |
| `components` | names that must exist in `components/view` or `components/form` | `load.ts:475`, `:692-698` |
| `actions` | `{id,label,description,tasklist}` list; each `tasklist` must resolve | `load.ts:493-505`, `:662-670` |
| `defaultAction` | freeform session runs this action's tasklist deterministically | `load.ts:471`, `:52-54` |
| `canDelegateTo` | delegation allowlist. **Tri-state**: omitted = unrestricted, `[]` = none, `["*"]` = explicit all, list = hard allowlist | `load.ts:36-44`, `:477-481` |
| `dependencies` | deprecated alias for `canDelegateTo` (one-release compat) | `load.ts:479-481` |
| `capabilities` | project-app grants, parsed by `parseCapabilities` | `load.ts:468` |
| `model` | model alias/spec this agent's turns run on (overrides the caller's) | `load.ts:46-50`, `:472` |
| `triggers` | LEGACY inbound-webhook bindings (`webhook: {path, provider?}`) | `load.ts:506-544` |

Two non-obvious behaviours worth knowing before you author:

- **`canDelegateTo: []` is the correct "no delegation" declaration** and does not warn — unless the
  instruct body actually calls `delegate(`, which is the only genuinely confusing combo the loader
  warns about (`load.ts:482-492`).
- **`triggers:` is validated hard**: non-array, a missing `webhook` object, a missing/empty `path`, a
  `path` outside `/^[A-Za-z0-9_-]+$/`, or a non-string `provider` each throw (`load.ts:429`, `:506-544`).
  Prefer the current event pipeline (`events/` + `hooks/`) over `triggers:` —
  see [../format/space/events/README.md](../format/space/events/README.md).

### Capabilities

`capabilities:` is a YAML list of bare ids or single-key config maps, parsed by `parseCapabilities`
(`sdk/org/libs/core/src/spaces/capabilities.ts#parseConnectionsConfig` — the 12 ids are at `:26-56`). Parsing is
fail-loud: an unknown id, an unknown config key, or a bare `api:call`/`connections:use`
(their `allow`/`providers` list is *required* — "there is no 'use anything'") all throw at space load
(`capabilities.ts:129-144`, `:187-205`). When the loader is given `knownTables` — the project's `database/` tables —
a `db:*` capability naming a nonexistent table also throws; a project-agnostic (system) load omits
`knownTables` and defers that check to run time (`load.ts:570-581`, `:468`).

The grant→global table is [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md)
and [../runtime-globals/README.md](../runtime-globals/README.md).

---

## 3. Add the tooling the agent names

Everything an agent declares must exist — the loader verifies **every edge**:

| You declared | The loader resolves it against | Throws when |
|---|---|---|
| `functions: [myFn]` | `functions/myFn.ts` (or `.tsx`), read by `loadFunctionsFromDir` (`load.ts:168-206`) | not found (`load.ts:684-691`) |
| `components: [MyView]` | `components/view/MyView.tsx` or `components/form/MyView.tsx` (`load.ts:208-253`) | not found in either (`load.ts:692-698`) |
| `knowledge: [d/f/opt]` | `knowledge/<d>/<f>/` with `index.md` + `<opt>.md` (`load.ts:255-328`) | domain, field, or option missing (`load.ts:699-718`) |
| `actions[].tasklist` | `tasklists/<slug>/` (`load.ts:355-404`) | tasklist dir absent (`load.ts:662-670`) |

Two extra fail-loud validators fire on the files themselves, whether or not an agent names them:

- **Knowledge option frontmatter** — a `knowledge/<d>/<f>/<opt>.md` with frontmatter must have a
  non-empty `description`, and may carry only `description`/`icon`/`color`/`label`; anything else
  throws. Plain markdown with no frontmatter is always valid
  (`load.ts:331-353`, `validateKnowledgeOptionFrontmatter`).
- **Malformed YAML anywhere** — `parseFrontmatter` throws with the file path rather than silently
  yielding an empty config (`sdk/org/libs/core/src/spaces/frontmatter.ts#parseFrontmatter`).

If the space has a `package.json` **with declared dependencies**, `loadSpace` runs `npm install` in
the space dir on first load (and throws if it fails), then esbuild-bundles each function so it can
`import` those deps (`load.ts:606-650`, `:185-201`). A `package.json` with no deps never triggers an
install — deliberately, so offline pods don't fail (`load.ts:617-623`).

---

## 4. Make sure it loads

`loadSpace(dir, opts)` is the gate. It throws on:

1. **No `agents/` directory** — `Space at "<dir>" must have an agents/ directory` (`load.ts:589-591`).
2. **Zero agent subdirectories** — `Space at "<dir>" must have at least one agent` (`load.ts:601-603`).
3. A **disallowed frontmatter key**, a **bad capability**, a **malformed `triggers:` entry**, or
   **invalid YAML** (§2).
4. An **unresolved** `functions`/`components`/`knowledge`/`actions[].tasklist` reference (§3).
5. A failed **`npm install`** for a space that declares dependencies (`load.ts:625-630`).

`opts.requireAgents: false` relaxes (1) and (2) — that is how **function-only** system spaces like
`system-global` load (`load.ts:583-603`; `loadSystemSpaces` passes it, `sdk/org/libs/core/src/spaces/system.ts#loadSystemSpaces`).
`opts.onWarn` re-routes non-fatal diagnostics (default: `console.warn` with a `[spaces]` prefix,
`load.ts:585`).

> A pod-side space listing is deliberately **tolerant**: `listProjectSpaces` catches a failing
> `loadSpace` and skips that dir rather than breaking the whole listing (`sdk/org/libs/cli/src/server/session-manager.ts:2097-2128`).
> So "my space vanished from Studio" almost always means it threw — run the loader directly (§6).

---

## 5. Register / install it

### 5a. A project space

Drop the directory at `<root>/<projectId>/spaces/<id>/`. Nothing to register: the session manager
scans that dir on every session build and hands the dirs to the core `Session` as
`preloadSpaceDirs`, which loads each into `dynamicSpaces` so its agents are **immediately
delegatable** (`sdk/org/libs/cli/src/server/session-manager.ts:1112-1118` ·
`sdk/org/libs/core/src/session/session.ts:236-243`). Studio writes spaces here over HTTP —
`POST /api/spaces {name, files}` wipes and rewrites the space dir so editor deletions are reflected
(`sdk/org/libs/cli/src/server/routes/spaces.ts:16-27`; see [../cli-api/rest/spaces.md](../cli-api/rest/spaces.md)).

`delegate()` addresses it by the ref grammar `space/agent#action`, matched with directory-suffix
tolerance (`sdk/org/libs/core/src/exec/target-match.ts:24-50`).

### 5b. A system space

Two edits, both required:

1. **Create** `sdk/org/libs/core/system-spaces/<name>/`.
2. **Add `<name>` to `SYSTEM_SPACE_NAMES`** (`sdk/org/libs/core/src/spaces/system.ts#SYSTEM_SPACE_NAMES`) — the
   list `defaultSystemSpaceDirs()` maps over (`system.ts:50-57`). A directory that isn't in the list
   is never loaded. Ten ship today: `system-global`, `system-engineer`, `system-architect`,
   `system-research`, `system-appbuilder`, `system-vision`, `system-files`, `system-store`,
   `user-memory`, `user-thing`.

Then know what the runtime does with it:

- **Functions are NOT universal.** Only `system-global`'s functions are injected into every agent
  (`GLOBAL_SPACE_NAME`, `system.ts:27`, `systemFunctionNames`/`systemFunctionSources` filter on
  `isGlobalSpace`, `:73-95`). A system space that ships an agent keeps its functions scoped to that
  agent. Its **agents**, however, are merged into every user space and are universally delegatable
  (`mergeSystemInto`, `system.ts:112-166`).
- **The user space wins collisions** — except an *empty placeholder* agent (an `agents/<slug>/` dir
  with no `instruct.md`) or an empty tasklist dir, which must not shadow the real system one
  (`system.ts:144-155`).
- **Materialization.** `materializeRuntime(root)` copies every `defaultSystemSpaceDirs()` entry into
  `<root>/system/spaces/<name>/` and records a content hash per space in `<root>/system/.shipped.json`
  (`sdk/org/libs/cli/src/cli/runtime-init.ts#materializeRuntime`). On every boot `syncSystemSpaces` reconciles:
  new → copy; recorded hash === shipped → skip; **pristine but outdated → auto-adopt**; **locally
  modified → hold back** unless `--adopt-system-spaces` / `LM_ADOPT_SYSTEM_SPACES=1` (which backs the
  old copy up to `<name>.bak-<ts>` first) (`runtime-init.ts:159-214`). So a source edit reaches an
  untouched pod automatically, and a user's customization is never silently overwritten.
- **Shipping.** `defaultSystemSpaceDirs()` resolves `system-spaces/` relative to the *bundle*
  (`system.ts:50-57`), so the CLI's build copies `libs/core/system-spaces/` → `libs/cli/dist/system-spaces/`
  (`sdk/org/libs/cli/scripts/copy-system-spaces.mjs:23-31`, appended to the cli `build` script,
  `sdk/org/libs/cli/package.json:17`). **Forget this and every session fails to find the `thing`
  agent** — `materializeRuntime` warns loudly when it copies zero spaces (`runtime-init.ts:105-110`).
- **Override for a local experiment** without touching the list: `LM_SYSTEM_SPACES=<csv of dirs>`, or
  `--system-spaces` / `--no-system-spaces` (`sdk/org/libs/cli/src/cli/bin.ts#resolveAgentAndSpaces`).

### 5c. A store space (integration)

1. **Create** `store/spaces/<id>/` with a `package.json` carrying an `lmthing` block — `kind`,
   `title`, `icon`, `description`, `tags`, and a JSON-Schema `settings` for its secrets. A
   `package.json` with **no `lmthing` block is skipped** by the manifest generator and never becomes a
   catalog entry (`store/scripts/gen-apps-manifest.mjs:445-451`). `kind: "integration"` is what the
   pod's Integrations panel filters on. Full field table:
   [../format/space/package.json.md](../format/space/package.json.md).
2. **Regenerate the catalog** — `store/projects/manifest.json` is **generated, never hand-edited**:
   `buildManifest` walks `store/spaces/*` into the `spaces[]` array
   (`gen-apps-manifest.mjs:41-42`, `:482-505`), lifting each space's `events`/`functions`/`agents`/
   `inbound` surface plus the full `files` download list (`:453-478`). Run `pnpm --dir store gen:apps-manifest`
   (`store/package.json:9`); the `lmthing-apps-manifest` Vite plugin also runs it on every build
   (`store/vite.config.ts#appsManifestPlugin`).
3. **Install path.** The pod downloads the space's `files` from `<store>/spaces/<id>/<rel>` into
   `<root>/<projectId>/spaces/<id>/` — one pure engine, `installStoreSpace`, shared by the HTTP route
   `POST /api/store/spaces/install` and the agent-facing `installSpace` yield resolver
   (`sdk/org/libs/cli/src/server/routes/store-spaces.ts#installStoreSpace`, `:293-297`). It applies the same
   pristine-vs-diverged hash guard as app install: a locally-edited copy answers
   `{ok:false, diverged:true}` unless `force:true` (`store-spaces.ts:248-267`). Route docs:
   [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md).
4. **Agent-driven install is consent-gated.** `installSpace` is the only consent-marked yield kind
   (`CONSENT_MARKED_YIELD_KINDS`, `sdk/org/libs/core/src/globals/consent.ts#CONSENT_MARKED_YIELD_KINDS`), and it **fails
   closed** with no prompter — a fork/delegate/hook can never install silently. Discovery is
   delegated to `system-store`'s `finder` agent, which holds only `store:read`
   (`sdk/org/libs/core/system-spaces/system-store/agents/finder/instruct.md:1-6`). See
   [../runtime-globals/store-and-consent.md](../runtime-globals/store-and-consent.md).

### 5d. A runtime-registered space

`registerSpace(dir)` is a yielding global that loads a space at an arbitrary path into the live
session's `dynamicSpaces` map, returning `{ok, spaceKey, agentSlug}` to pass straight to `delegate()`
(`sdk/org/libs/core/src/globals/register-space.ts:3-33`). It is injected only when
`caps.registerSpace` is set — withheld from read-only forks because it mutates shared session state
(`sdk/org/libs/core/src/exec/bootstrap.ts:149`, `:210`). This is how `system-architect` runs the
specialists it just wrote; it is not the path for a space you author by hand.

---

## 6. Test it

- **Load it directly.** The cheapest check is a `loadSpace` call — every authoring error in §4
  surfaces as a thrown message naming the file. `sdk/org/libs/core/src/spaces/load.test.ts` is the
  reference (`:25-76` reference validation, `:77-127` the frontmatter allow-list + capabilities,
  `:128-179` `triggers:`).
- **Structural guard for system spaces.** `sdk/org/libs/core/src/spaces/system-spaces-dag.test.ts`
  loads *every* shipped system space and asserts each tasklist validates as a DAG with exactly one
  resolvable goal, that every agent ships a `charter.md`, and that `prelude:` sources typecheck
  against a fork-shaped ambient DTS (`:15-24`). A new system space is covered by it automatically —
  and will fail it if a `forEach` ref, goal, or charter is missing.
- **Run it.** `node sdk/org/libs/cli/dist/cli/bin.js --space ./my-space "<message>"`
  (`--space` is required outside serve/bare mode, `sdk/org/libs/cli/src/cli/args.ts:94-97`, `:236`).
  Add `--mock <file>` for a keyless scripted run.
- `cd sdk/org && pnpm test libs/core/src/spaces` · `pnpm typecheck`. (**Not**
  `pnpm --filter @lmthing/core test` — that package declares no `test` script, so the filtered run
  exits 0 having run nothing; see [`testing.md`](./testing.md).)

---

## Checklist

| # | What | Where |
|---|---|---|
| 1 | `agents/<slug>/charter.md` (fork-safe identity) + `instruct.md` (frontmatter + instructions) | `load.ts:431-568` |
| 2 | Frontmatter keys inside the allow-list; `capabilities:` bare-or-config; `canDelegateTo` tri-state | `load.ts:413-425` · `capabilities.ts:26-56` |
| 3 | Every declared function/component/knowledge/tasklist ref actually exists | `load.ts:662-719` |
| 4 | Space loads (`loadSpace`), no throws | `load.ts:583-722` |
| 5a | **Project space**: drop at `<root>/<projectId>/spaces/<id>/` — auto-discovered | `session-manager.ts:1112-1118` |
| 5b | **System space**: add the dir **and** its name to `SYSTEM_SPACE_NAMES` | `system.ts:30-41` · `runtime-init.ts:89-214` |
| 5c | **Store space**: `lmthing` block in `package.json` + regenerate `store/projects/manifest.json` | `gen-apps-manifest.mjs:445-505` |
| 6 | Loader test; system spaces are additionally covered by the DAG/charter guard | `load.test.ts` · `system-spaces-dag.test.ts` |

---

## When you change the code

- Changed a **file kind** an author writes (`agents/*`, `tasklists/*`, `knowledge/*`, `functions/*`,
  `components/*`, `events/*`, a space `package.json` field) → update the matching doc under
  [../format/space/](../format/space/README.md).
- Changed the **loader / merge / discovery** (`loadSpace`, `mergeSystemInto`, `SYSTEM_SPACE_NAMES`,
  `materializeRuntime`/`syncSystemSpaces`) → update [../runtime/spaces-loading.md](../runtime/spaces-loading.md)
  (and this page's §5b if the ten-space list moves).
- Changed a **capability id** or its gate → [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md)
  **and** [../runtime-globals/README.md](../runtime-globals/README.md) (see
  [add-a-global.md](./add-a-global.md)).
- Changed the **store catalog shape** or an install route → [../format/space/package.json.md](../format/space/package.json.md)
  and [../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md).
