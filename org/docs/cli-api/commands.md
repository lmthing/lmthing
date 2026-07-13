# The `lmthing` CLI — commands & flags

The `lmthing` binary is `@lmthing/cli`: `"bin": { "lmthing": "./dist/cli/bin.js" }` `sdk/org/libs/cli/package.json:4-6`. Everything below is parsed by one hand-rolled parser (`parseArgs`, `sdk/org/libs/cli/src/cli/args.ts#parseArgs`) and dispatched by one `main()` (`sdk/org/libs/cli/src/cli/bin.ts#main`).

Uninstalled, the same binary is `node libs/cli/dist/cli/bin.js …` — the invocation form used throughout the repo (e.g. `Makefile:135`).

Related: the HTTP surface the server modes expose → [./rest/README.md](./rest/README.md) · what a space *is* (the thing `--space` points at) → [../format/space/README.md](../format/space/README.md).

---

## Modes at a glance

`main()` dispatches in this order — the first match wins `sdk/org/libs/cli/src/cli/bin.ts#main`:

| # | Condition | Mode | Ends in |
|---|---|---|---|
| 1 | `--dump-system-prompt <file>` | keyless system-prompt dump `bin.ts:283-286` | exit |
| 2 | `lmthing init` | materialize `<cwd>/.lmthing` `bin.ts:289-298` | exit |
| 3 | `lmthing serve` | multi-session HTTP+WS server `bin.ts:334-392` | listens forever |
| 4 | bare `lmthing` (no space/message/repl/web/request) | same server + up-front system-space sync `bin.ts:396-426` | listens forever |
| 5 | `--web [port]` | single-session DevTools web UI `bin.ts:437-461` | listens forever |
| 6 | `--repl` | interactive Ink REPL `bin.ts:462-507` | exit on `exit`/`quit` |
| 7 | `--request "<msg>"` | headless single-shot (THING + project app) `bin.ts:508-599` | exit |
| 8 | otherwise | terminal single-shot (positional message) `bin.ts:600-620` | exit |

Modes 3 and 4 are the production path (the compute pod runs bare `lmthing`); the rest are development/authoring tools.

---

## Subcommands

Two leading subcommands are shifted off `argv` before flag parsing `sdk/org/libs/cli/src/cli/args.ts:59-65`.

### `lmthing serve`

Starts the multi-session server: builds `streamFn`, constructs a `SessionManager({ streamFn, defaultSpaceDir, lmthingRoot, defaultModelAlias, maxSessions?, snapshotsDir? })`, starts the session reaper, installs a `SIGINT` handler, and awaits `startSessionServer({ port, manager, appTsxPath, defaultSpaceDir, lmthingRoot })` `sdk/org/libs/cli/src/cli/bin.ts:334-374`. It never returns — the listening server keeps the process alive `bin.ts:391`.

- **Default port 8080** (`args.servePort ?? 8080`) `sdk/org/libs/cli/src/cli/bin.ts:337`.
- `--space` is **optional** here — it becomes the manager's `defaultSpaceDir`; sessions are otherwise created via `POST /api/sessions` `sdk/org/libs/cli/src/cli/args.ts:210-214`, `bin.ts:359`.
- Runtime init is **split around `listen`**: only the correctness-critical `materializeRuntime` runs pre-listen, and only when `runtimeNeedsInit(root)` `bin.ts:352-356`. The `syncSystemSpaces` hash walk is deferred until *after* the server is listening, so a scaled-to-zero cold wake never delays time-to-serve / the K8s startup probe `bin.ts:369-390`. (`startSessionServer` resolves once the HTTP server is listening — `sdk/org/libs/cli/src/server/serve.ts:395`.)

```bash
lmthing serve --port 8080
node --env-file=devops/local/.env.local --watch sdk/org/libs/cli/dist/cli/bin.js \
  serve --port 18080 --space sdk/org/libs/core/system-spaces/architect   # Makefile:135
```

### `lmthing init`

Keyless. Materializes the runtime into `<cwd>/.lmthing` and exits `sdk/org/libs/cli/src/cli/bin.ts:289-298`:

```
lmthing runtime initialized at <cwd>/.lmthing
  system spaces → <cwd>/.lmthing/system
  default project → <cwd>/.lmthing/user
```

No model, no API key, no `--space`, no message — `init` returns from `parseArgs` before any validation `sdk/org/libs/cli/src/cli/args.ts:205-208`.

### Bare `lmthing`

With no `--space`, no positional message, and none of `--repl` / `--web` / `--request`, the CLI launches the **same server as `serve`** `sdk/org/libs/cli/src/cli/bin.ts:396-426` (validation is short-circuited the same way in the parser, `args.ts:224-233`). Two differences from `serve`:

1. It passes no `defaultSpaceDir` (there is no `--space` by definition) `bin.ts:414-420`.
2. It calls `ensureRuntime()` — materialize **or** sync — **synchronously before `listen`** `bin.ts:413`, `bin.ts:221-237`.

---

## Flags

Every flag is a case in the `while (args.shift())` switch `sdk/org/libs/cli/src/cli/args.ts#parseArgs`. A non-`-` token becomes the positional `message`; an unrecognized `-`-prefixed token throws `Unknown option: <arg>` `args.ts:193-201`. Numeric flags go through `parseNumericFlag` (finite, non-negative, else throw) `args.ts:45-51`.

### Target selection

| Flag | Meaning | Source |
|---|---|---|
| `<message>` (positional) | the single-shot message | `args.ts:193-201` |
| `--space <dir>`, `-s` | the space directory to run | `args.ts:94-100` |
| `--agent <slug>`, `-a` | agent slug; default `default` (or env `LM_AGENT`) | `args.ts:101-107`, `bin.ts:244` |
| `--model <spec\|alias>`, `-m` | model spec/alias; falls back to `LM_MODEL`, then alias `M` | `args.ts:108-114`, `bin.ts:309` |
| `--no-default-action` | bypass the agent's `defaultAction` routing | `args.ts:144-147` |

`--space` is **required** only in terminal / REPL / `--web` / `--dump-system-prompt` mode `args.ts:235-237`; a message is required unless `--web` / `--repl` / `--dump-system-prompt` is set `args.ts:239-241`. In `--request` mode `--space` defaults to `process.cwd()` and the agent defaults to `thing` `bin.ts:515`, `bin.ts:562`.

### Run modes

| Flag | Meaning | Source |
|---|---|---|
| `--repl`, `-r` | interactive Ink REPL; persistent `Session`, `maxHistoryTurns: 20`, Tab-completion over `@space`, `@space.agent`, `@space.agent.action` | `args.ts:121-125`, `bin.ts:462-507`, `bin.ts:49-91` |
| `--web [port]` | single-session DevTools web UI; port is **optional, default 3000** | `args.ts:182-192`, `bin.ts:437-461` |
| `--request "<msg>"` | headless single-shot (see below) | `args.ts:170-175`, `bin.ts:508-599` |
| `--claude` | `plain` output mode for `InkRenderHost` (programmatic/automated) | `args.ts:126-129`, `bin.ts:463`, `bin.ts:602` |
| `--trace <file>` | NDJSON trace file; also served at `/trace.jsonl` in `--web` mode | `args.ts:115-120`, `sdk/org/libs/cli/src/web/serve.ts:191-192` |
| `--dump-system-prompt <file>` | keyless: write the resolved system prompt + ambient DTS, exit | `args.ts:176-181`, `bin.ts:256-277` |
| `--mock <module.mjs>` | scripted provider — **no API key needed** | `args.ts:164-169`, `bin.ts:189-201`, `bin.ts:305-307` |

`--web` is a *different server* from `serve`: `startWebServer` esbuild-bundles the `@lmthing/ui` chat app, serves HTTP+WS for **one** session, exposes `/api/help`, and auto-opens the browser (`xdg-open`/`open`/`start`) `sdk/org/libs/cli/src/web/serve.ts#startWebServer`, `web/serve.ts:280-286`.

`--dump-system-prompt` builds the prompt with a stub `streamFn` and a no-op render host — it never calls the model. Output = `# System prompt — space/agent` header, the system block, an 80-`=` separator, then the ambient DTS `bin.ts:256-277`.

### Server mode (`serve` / bare)

| Flag | Meaning | Source |
|---|---|---|
| `--port <n>` | server port; **default 8080** | `args.ts:71-76`, `bin.ts:337`, `bin.ts:405` |
| `--max-sessions <n>` | `SessionManager` concurrency cap | `args.ts:77-80`, `bin.ts:362` |
| `--snapshots-dir <dir>` | session-snapshot output dir | `args.ts:81-86`, `bin.ts:363` |
| `--project <name>`, `-p` | **DEAD FLAG** — parsed into `CliArgs.project` and never read | `args.ts:87-93`, `args.ts:38-39` |

> `--project` is verifiably dead: `rg '\.project\b' sdk/org/libs/cli/src` matches only the assignment at `args.ts:91`. The active project is always `user` (`DEFAULT_PROJECT_ID`, `sdk/org/libs/cli/src/server/projects.ts#DEFAULT_PROJECT_ID`) unless a route or session says otherwise.

### System spaces

| Flag | Meaning | Source |
|---|---|---|
| `--system-spaces <csv>` | comma-separated dirs, overriding `defaultSystemSpaceDirs()` | `args.ts:130-135`, `bin.ts:245-248` |
| `--no-system-spaces` | run with **no** system spaces (`systemSpaceDirs = []`) | `args.ts:136-139`, `bin.ts:246-248` |
| `--adopt-system-spaces` | overwrite locally-modified system spaces with the shipped copies (a `.bak-<ts>` backup is kept) | `args.ts:140-143`, `sdk/org/libs/cli/src/cli/runtime-init.ts:199-203` |

### Budget caps

All four are optional; **undefined ⇒ unbounded** `sdk/org/libs/cli/src/cli/bin.ts#readBudget`.

| Flag | Env equivalent | Source |
|---|---|---|
| `--max-episodes <n>` | `LM_BUDGET_EPISODES` | `args.ts:148-151`, `bin.ts:172` |
| `--max-tool-calls <n>` | `LM_BUDGET_TOOL_CALLS` | `args.ts:152-155`, `bin.ts:173` |
| `--max-fork-depth <n>` | `LM_BUDGET_FORK_DEPTH` | `args.ts:156-159`, `bin.ts:174` |
| `--max-wallclock-ms <n>` | `LM_BUDGET_WALLCLOCK_MS` | `args.ts:160-163`, `bin.ts:175` |

---

## Development recipes

```bash
# Run an agent interactively
node libs/cli/dist/cli/bin.js --space ./fixtures/<space-slug> --agent <agent-slug> --repl

# Observability / DevTools web UI (trace, fork tree, variable inspector); auto-opens the browser
node libs/cli/dist/cli/bin.js --space ./fixtures/<space-slug> --web 3000

# No LLM keys: scripted mock provider (default export = MockHandler fn or string[])
node libs/cli/dist/cli/bin.js --space ./fixtures/<space-slug> --mock ./fixtures/mock.mjs "hello"
```

The mock module is an ESM file whose default export is either a `MockHandler` function or a `string[]` (wrapped in `mockScript`); anything else throws `sdk/org/libs/cli/src/cli/bin.ts#loadMockStreamFn`. Mock mode skips `resolveModel`/`createStream` entirely, so **no API key is required** `bin.ts:305-307`.

### `--request` (headless single-shot)

`--request "<msg>"` is the non-interactive capstone path `sdk/org/libs/cli/src/cli/bin.ts:508-599`. It: calls `ensureRuntime()`; defaults `spaceDir` to `process.cwd()`; uses a `plain` Ink host; sets `projectSpacesDir = <root>/user/spaces` **as an absolute path** (it propagates into fork/delegate VMs as `LMTHING_PROJECT_SPACES_DIR`); preloads every directory under it as a space so previously-built agents stay delegatable; boots the `user` project app db (`bootProjectApp`, hard-exits on failure); generates the typed `apiCall` DTS when `<root>/user/api` exists (non-fatal on failure); injects the catalog authoring globals (`writePage`/`writeApi`/`writeHook`/`writeTableSchema`/`createProject`/`selectProject`); runs **one** turn of the `thing` agent; then disposes.

---

## Environment

`bin.ts` calls `loadEnv()` at module top level: it reads `<cwd>/.env` and **unconditionally overwrites `process.env`** for every key in it `sdk/org/libs/cli/src/cli/bin.ts:16-30`. This is deliberate — that file is the one written by `PUT /api/env` and persisted on the pod volume, so it must supersede k8s-injected vars. `server/serve.ts` re-applies the same file after boot.

| Variable | Read by | Effect |
|---|---|---|
| `LMTHING_ROOT` | `resolveLmthingRoot` `bin.ts:209-213` | runtime root; default `<cwd>/.lmthing` (pod: `/data/.lmthing`) |
| `LM_AGENT` | `bin.ts:244` | default agent slug |
| `LM_MODEL` | `bin.ts:309`, `bin.ts:317` | default model spec/alias (final fallback: alias `M`) |
| `LM_MODEL_ROLE_EXPLORE` / `_PLAN` / `_GENERAL` | `readRoleModels` `bin.ts:143-152` | per-fork-role model overrides |
| `LM_MOCK` | `bin.ts:301` | same as `--mock` |
| `LM_SYSTEM_SPACES` | `bin.ts:245` | csv of system-space dirs |
| `LM_ADOPT_SYSTEM_SPACES=1` | `runtime-init.ts:160` | same as `--adopt-system-spaces` |
| `LM_BUDGET_EPISODES` / `_TOOL_CALLS` / `_FORK_DEPTH` / `_WALLCLOCK_MS` | `readBudget` `bin.ts:165-180` | budget caps |
| `LM_APP_DIST` | `resolveAppDist` `sdk/org/libs/cli/src/server/static-apps.ts:63-70` | override the served SPA dist dir |
| `LM_DEV_WEB` | `sdk/org/libs/cli/src/server/serve.ts:389-392` | serve the web app in-process via Vite (HMR) instead of the built dist |

**Models resolve lazily, per stream call**, with a cache keyed by the resolved spec, and each call re-reads the env `sdk/org/libs/cli/src/cli/bin.ts:315-328`. So the server boots with no (or an invalid) model configured, and credentials supplied later via `PUT /api/env` take effect **without a process restart**.

---

## Runtime materialization (`runtime-init.ts`)

`materializeRuntime(root)` `sdk/org/libs/cli/src/cli/runtime-init.ts#materializeRuntime` copies every dir from core's `defaultSystemSpaceDirs()` into `<root>/system/spaces/<name>/`, records each shipped dir's content hash into `<root>/system/.shipped.json`, then creates the default `user` project skeleton:

```
<root>/                                  # LMTHING_ROOT, else <cwd>/.lmthing
  system/
    .shipped.json                        # { "<space-name>": "<sha256 of shipped src dir>" }
    spaces/
      system-global/   system-engineer/  system-architect/  system-research/
      system-appbuilder/  system-vision/  system-files/     system-store/
      user-memory/     user-thing/       # 10 dirs — core SYSTEM_SPACE_NAMES
  user/                                  # default project skeleton
    spaces/                              # (empty)
    documents/                           # (empty)
    instructions.md                      # created empty if absent
    project.json                         # {id:'user', name:'user', createdAt:<ISO>}
```

The ten names are `SYSTEM_SPACE_NAMES` `sdk/org/libs/core/src/spaces/system.ts#SYSTEM_SPACE_NAMES`; their source dirs are probed by `defaultSystemSpaceDirs()` (dist layout, then src layout) `system.ts:49-57`, and overridable by the caller via `--system-spaces` / `LM_SYSTEM_SPACES`.

`instructions.md` and `project.json` are only written **if absent** `runtime-init.ts:117-127`.

**`materializeRuntime` returning 0 is a hard misconfiguration** — it warns on stderr that "sessions will fail to find the `thing` agent" `runtime-init.ts:105-110`. The usual cause: the post-build `scripts/copy-system-spaces.mjs` step did not run, so the CLI bundle has no sibling `dist/system-spaces/` (tsup bundles `@lmthing/core` into `dist/cli/bin.js`, and `defaultSystemSpaceDirs()` then resolves against the *bundle's* `__dirname`) `sdk/org/libs/cli/scripts/copy-system-spaces.mjs`, `sdk/org/libs/cli/package.json:16`.

`runtimeNeedsInit(root)` is true iff `<root>/system/spaces/user-thing` is missing — the **sentinel** space, not the `system/` dir, because a PVC can carry an empty `system/` from an earlier broken materialization and checking the dir alone would skip the repair `sdk/org/libs/cli/src/cli/runtime-init.ts:57-67`.

### System-space sync (`syncSystemSpaces`)

Per space, using `.shipped.json` and mtime-independent content hashes (`hashDir`, sha256 over sorted relpath + bytes) `sdk/org/libs/cli/src/cli/runtime-init.ts#hashDir`, `runtime-init.ts:159-214`:

| State | Action |
|---|---|
| dest missing | copy `runtime-init.ts:180-185` |
| recorded hash === shipped hash | skip (up to date) `runtime-init.ts:186` |
| current === shipped | just record the hash `runtime-init.ts:189-193` |
| pristine (current === recorded) but outdated | **auto-adopt** — rm + copy `runtime-init.ts:194-198` |
| locally modified, or legacy (no recorded hash) | **hold back**, record a baseline, warn `runtime-init.ts:204-209` |
| …with `adopt` | rename to `<name>.bak-<Date.now()>`, then overwrite `runtime-init.ts:199-203` |

Held-back spaces are reported on stderr with the fix (`re-run with --adopt-system-spaces`) `sdk/org/libs/cli/src/cli/bin.ts#ensureRuntime`, `bin.ts:381-386`.

---

## Ports

| Port | What | Source |
|---|---|---|
| **8080** | `lmthing serve` / bare `lmthing` (`--port`) | `bin.ts:337`, `bin.ts:405` |
| **3000** | `--web` DevTools UI | `args.ts:189` |
| **18080** | the repo's local-dev serve target | `Makefile:135` |
| `THING_PORT` (default 8080) | `pnpm thing` — one port for `/api` + agent WS + Vite HMR | `sdk/org/scripts/thing-dev.mjs#SERVE_PORT`, `thing-dev.mjs:73-76` |

`pnpm thing` runs `tsup --watch` on `@lmthing/cli` plus `lmthing serve --port $THING_PORT` with `LM_DEV_WEB` pointing at `apps/web`, so the CLI serves the API, the agent WebSocket and the HMR web app on a single origin `sdk/org/scripts/thing-dev.mjs:67-77`.

---

## The SPA catch-all (non-`/api` requests)

In `serve` / bare mode the request handler runs the API router first; then `sdk/org/libs/cli/src/server/serve.ts:358-369`:

1. **Matched route** → handled (see [./rest/README.md](./rest/README.md)).
2. **Unmatched and path starts with `/api/`** → `404 {"error":"unknown API route <METHOD> <path>"}` `serve.ts:361-365`.
3. **Anything else** → the web app: the in-process Vite dev middleware when `LM_DEV_WEB` is set, otherwise the built SPA `serve.ts:367-369`, `serve.ts:389-392`.

The static SPA server (`createStaticApps(resolveAppDist())`, `sdk/org/libs/cli/src/server/static-apps.ts`) is the **one unified app** (`sdk/org/apps/web`) whose `/studio`, `/computer` and `/chat` are client-side routes:

- Dist = `LM_APP_DIST` || `<appsBase>/web/dist`, where `appsBase` is found by walking **up** from the module until a dir containing `apps/` appears — the relative depth differs between the src tree, the tsup-flattened dist, and the Docker image `static-apps.ts:40-70`.
- `/assets/*` → served with `Cache-Control: public, max-age=31536000, immutable` (path-traversal guarded) `static-apps.ts:95-121`.
- Any other real file on disk (`favicon.ico`, `robots.txt`, …) → served `no-cache` `static-apps.ts:124-149`.
- Everything else — including `/`, `/studio`, `/computer`, `/chat` and deep client routes — falls back to `index.html`, served verbatim with `no-cache, no-store` (the app self-authenticates from localStorage and computes its own WS URL, so no bootstrap injection happens) `static-apps.ts:33-36`, `static-apps.ts:151-165`.
- Missing dist → `503 [lmthing] app not built yet — dist not found at: <dir>` `static-apps.ts:155-159`.

---

## Gotchas

- **`--project` / `-p` is dead** — parsed, typed, never read (see above).
- **Two different default-project display names race.** `materializeRuntime` writes `project.json` with `name: 'user'` `runtime-init.ts:120-127`, while the server's `ensureDefaultProject` scaffolds it as **`'Personal'`** if `project.json` is absent `sdk/org/libs/cli/src/server/projects.ts:384-400`. Whichever runs first on a fresh root wins — and `materializeRuntime` runs first in every `bin.ts` path, so `user` is what you normally see.
- **The synthetic `system` project.** `<root>/system/spaces/<id>` matches the generic `<root>/<projectId>/spaces/<id>` shape, so `listProjects` prepends `{ id: 'system', name: 'System', createdAt: 0 }` when the system spaces dir is non-empty `sdk/org/libs/cli/src/server/projects.ts#listProjects` — that is how Studio edits system spaces through the ordinary project routes. `system` is reserved and cannot be created or deleted `projects.ts:31-41`, `projects.ts:330-336`.
- **`.env` in `<cwd>` beats the process env** — always, for every key present `bin.ts:16-30`.
- **A missing tsup dist entry ships a broken image.** `worker` and `worker-load-entry` must stay in the CLI's tsup `entry` list; they are resolved as siblings of the bundled module at runtime `sdk/org/libs/cli/tsup.config.ts:12-17`.
