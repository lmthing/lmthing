# The pod CLI & its REST server

`lmthing` is the whole backend of a user's compute pod: **one Node process, one port**. It serves the pre-built unified SPA (the `/studio`, `/computer`, `/chat` client-side routes) as a catch-all *and* the `/api/*` REST + WebSocket surface every one of those surfaces calls — plus, for a project with an app layer, the app's own pages and Node API. The binary is declared as `lmthing → ./dist/cli/bin.js` (`sdk/org/libs/cli/package.json:L5-L7`).

| Page | Covers |
|---|---|
| **[commands.md](./commands.md)** | Subcommands (`serve`, `init`), the bare invocation, every flag, the env surface, mock/REPL/web/headless modes. |
| **[rest/](./rest/README.md)** | The HTTP + WS API: sessions, projects, spaces, env, uploads, fs, hooks, webhooks, apps/store, budget. |
| [../README.md](../README.md) | The documentation hub (format, runtime globals, the surfaces). |

---

## One process, one origin

Both `lmthing serve` and a bare `lmthing` end in `startSessionServer({ port, manager, appTsxPath, lmthingRoot })` and never return (`sdk/org/libs/cli/src/cli/bin.ts:L334-L392`, `:L396-L426`). The default port is **8080** in both paths (`args.servePort ?? 8080` — `bin.ts:L337`, `:L405`).

`startSessionServer` builds one route registry (`sdk/org/libs/cli/src/server/serve.ts:L134`) and one `node:http` server whose request handler does exactly three things in order (`serve.ts:L343-L370`):

1. **Dispatch the router.** The `Router` is a tiny first-match-wins pattern matcher — `:param` captures one non-slash segment, a trailing `/*` captures the rest as `params.rest`, and the verb `'*'` matches any method (`sdk/org/libs/cli/src/server/router.ts#compilePattern`, `:L60-L80`). Registration order therefore *is* precedence.
2. **404 unknown `/api/*`** as JSON: `{ error: "unknown API route <METHOD> <path>" }` (`serve.ts:L361-L366`).
3. **Fall through to the SPA** for everything else — the Vite dev middleware when `LM_DEV_WEB` is set, otherwise the built dist (`serve.ts:L367-L369`).

WebSockets are matched *outside* the router, in the `upgrade` handler: `/api/terminals/<id>` goes to the terminal socket, everything else to the agent socket (`serve.ts:L376-L387`).

```
GET /studio/user/blog        → SPA index.html          (catch-all)
GET /assets/index-a1b2.js    → SPA asset, immutable
GET /api/projects            → pod REST                (router)
WS  /api/ws?sessionId=…      → agent stream            (upgrade handler)
GET /app/blog/               → the project-app's built React bundle
GET /app/blog/api/posts      → the project-app's Node API runtime
GET /api/nope                → 404 {"error":"unknown API route GET /api/nope"}
```

### Serving the SPA

`createStaticApps(resolveAppDist())` is the catch-all (`serve.ts:L123`). The dist is `LM_APP_DIST`, else `<appsBase>/web/dist`, where `appsBase` is found by walking **up** from the module until a directory containing `apps/` appears — because the relative depth differs between the src tree, the tsup-flattened dist, and the Docker image (`sdk/org/libs/cli/src/server/static-apps.ts:L48-L71`). Then:

- `/assets/*` → served with `Cache-Control: public, max-age=31536000, immutable`, path-traversal-guarded (`static-apps.ts:L97-L122`).
- any other real file on disk (`favicon.ico`, `robots.txt`, …) → `Cache-Control: no-cache` (`static-apps.ts:L126-L149`).
- everything else, including `/`, `/studio`, `/computer`, `/chat` and deep client routes → `index.html`, served **verbatim** with `no-cache, no-store`; the app self-authenticates from `localStorage` and computes its own WS URL, so nothing is injected (`static-apps.ts:L32-L34`, `:L151-L164`).
- no dist on disk → `503 [lmthing] app not built yet` (`static-apps.ts:L155-L159`).

### Project-apps: two mounts

The app's API is registered **before** its pages, so `…/api/*` never reaches the page server (`serve.ts:L218` vs `:L306`):

| Pattern | Handler |
|---|---|
| `* /app/:projectId/api/*` | `createAppApiHandler` — the worker-isolated Node api runtime (`serve.ts:L217-L218`) |
| `* /app/:projectId/*` | `createPageServeHandler` — the built React bundle + asset-manifest SPA fallback (`serve.ts:L292-L306`) |
| `* /:projectId/api/*`, `* /:projectId/*` | the **same** handlers with no `/app` prefix — registered **only** when `LMTHING_GATEWAY_URL` is set (`serve.ts:L322-L326`) |

The gateway injects `LMTHING_GATEWAY_URL` into every per-user pod and nothing else sets it, so the clean root mount exists exactly when the pod sits behind the Envoy shell/pod split. It is **unset** under local `lmthing serve` / `pnpm thing`, where a bare `/:projectId/*` would shadow every SPA route — hence apps live at `localhost:8080/app/<project>` locally (`serve.ts:L308-L326`). Detail: [../app/README.md](../app/README.md).

---

## The pod root

`materializeRuntime(root)` copies every dir returned by core's `defaultSystemSpaceDirs()` into `<root>/system/spaces/<name>/`, records each shipped dir's content hash into `<root>/system/.shipped.json`, and creates the default `user` project skeleton (`sdk/org/libs/cli/src/cli/runtime-init.ts#materializeRuntime`). The root is `LMTHING_ROOT` if set, else `<cwd>/.lmthing` (`bin.ts:L209-L213`; production pods point it at their data volume).

```
<root>/                              # $LMTHING_ROOT, else <cwd>/.lmthing
  system/
    .shipped.json                    # { "<space-name>": "<sha256 of the shipped source dir>" }
    spaces/
      system-global/  system-engineer/  system-architect/  system-research/
      system-appbuilder/  system-vision/  system-files/  system-store/
      user-memory/  user-thing/      # exactly the 10 SYSTEM_SPACE_NAMES
  user/                              # the default project
    spaces/                          # (empty at init)
    documents/                       # (empty at init)
    instructions.md                  # created empty if absent
    project.json                     # {id:'user', name:'user', createdAt:<ISO>}
```

The ten names are fixed in `SYSTEM_SPACE_NAMES` (`sdk/org/libs/core/src/spaces/system.ts:L29-L41`); `defaultSystemSpaceDirs()` probes for the `system-spaces/` dir in both the dist and src layouts (`system.ts:L49-L57`).

`<root>/system/` is also surfaced by the server as a **synthetic `system` project** — `listProjects` prepends `{ id:'system', name:'System', createdAt:0 }` whenever `<root>/system/spaces/` is non-empty, so Studio edits system spaces through the ordinary `/api/projects/system/spaces/...` routes (`sdk/org/libs/cli/src/server/projects.ts#listProjects`). `system` is reserved, along with `api`, `assets` and `install` — ids that would collide with reserved `lmthing.app` URL paths under the root mount (`projects.ts:L34-L44`). The default project id is `user` (`projects.ts:L22`).

### System-space reconciliation

`syncSystemSpaces(root, { adopt })` compares, per space, the materialized copy against the shipped source using `.shipped.json` (`runtime-init.ts:L159-L214`):

| State | Action |
|---|---|
| missing | copy |
| recorded hash === shipped hash | skip |
| current === shipped | just record the hash |
| **pristine** (current === recorded) but outdated | **auto-adopt** the shipped update — nothing to lose |
| locally modified, or legacy (no recorded hash) | **hold back**, print a stderr warning naming the spaces |
| … with `--adopt-system-spaces` / `LM_ADOPT_SYSTEM_SPACES=1` | rename the old copy to `<name>.bak-<epoch>`, then overwrite |

Hashes are content-only (sorted relpath + bytes, sha256), so a copy's mtimes never matter (`runtime-init.ts:L26-L49`).

### Init vs. repair

`runtimeNeedsInit(root)` is true iff `<root>/system/spaces/user-thing` is missing — the *sentinel* space, not merely the `system/` dir, because a PVC can carry an empty `system/` from an earlier broken materialization that must be repaired rather than skipped (`runtime-init.ts:L51-L67`).

`materializeRuntime` returning **0** is a hard misconfiguration: it warns on stderr, and every session then fails with `Agent "thing" not found` (`runtime-init.ts:L105-L110`). The usual cause is a build that skipped the post-build copy of `libs/core/system-spaces/` into `libs/cli/dist/system-spaces/` — tsup bundles `@lmthing/core` into `dist/cli/bin.js`, so `defaultSystemSpaceDirs()` resolves against the **CLI bundle's** `__dirname` (`sdk/org/libs/cli/scripts/copy-system-spaces.mjs:L1-L26`).

---

## Boot order (and why)

`lmthing serve` runs only the correctness-critical `materializeRuntime` **before** `listen`, and only when `runtimeNeedsInit` (`bin.ts:L352-L356`). The `syncSystemSpaces` hash walk is deliberately deferred until **after** the server is listening, so a scaled-to-zero cold wake never delays time-to-serve or the K8s startup probe (`bin.ts:L369-L390`). A bare `lmthing` instead calls `ensureRuntime()` (materialize **or** sync) synchronously before listen (`bin.ts:L413`; `ensureRuntime` at `bin.ts:L221-L237`).

Everything else — per-project db warm, cron boot catch-up, cron/webhook manifest publish, OpenClaw plugin load, the self-idle watchdog — runs in a background block *after* `listen`, so `GET /api/sessions` (the readiness probe) is answered in ~1-2s regardless of how many apps or overdue crons exist (`serve.ts:L406-L440`).

Two more startup behaviours worth knowing:

- **`<cwd>/.env` wins over the environment.** `loadEnv()` runs at `bin.ts` module top level and unconditionally overwrites `process.env` for every key in the file — intentional, because that file is the one written by `PUT /api/env`, and it must supersede the pod's k8s-injected vars (`bin.ts:L10-L30`). `startSessionServer` re-applies the same file after boot (`serve.ts:L96-L106`).
- **Models resolve lazily, per stream call**, cached by resolved spec and re-reading env each time — so the server boots with no valid model configured and picks up credentials supplied later via `PUT /api/env` **without a process restart** (`bin.ts:L309-L328`).

---

## Ports, in one place

| Port | What |
|---|---|
| **8080** | `lmthing serve` / bare `lmthing` default (`bin.ts:L337`, `:L405`); also `pnpm thing`'s `THING_PORT` default (`sdk/org/scripts/thing-dev.mjs#SERVE_PORT`) |
| **3000** | `--web [port]` — the *single-session* DevTools UI, a different server (`sdk/org/libs/cli/src/cli/args.ts:L182-L192`) |
| **18080** | the repo Makefile's local-dev serve port (`Makefile:L135`) |

`pnpm thing` runs `tsup --watch` on `@lmthing/cli` plus `lmthing serve` with `LM_DEV_WEB` pointed at `apps/web`, so one port carries `/api`, the agent WS **and** the Vite-HMR web app (`sdk/org/scripts/thing-dev.mjs:L8-L16`, `:L76`; the middleware is wired at `serve.ts:L389-L393`).

---

## Quick start

```bash
# materialize <cwd>/.lmthing (keyless — no model, no API key)
lmthing init

# serve everything on one origin (SPA + /api + WS), default :8080
lmthing serve

# a bare invocation is the same thing, plus an up-front system-space sync
lmthing

# a one-off headless turn through the THING agent
lmthing --request "summarize my open todos"
```

Full flag/env reference → **[commands.md](./commands.md)**. Endpoint reference → **[rest/](./rest/README.md)**.

---

## Gotchas

- **`--project` / `-p` is a dead flag.** It is parsed into `CliArgs.project` (`args.ts:L87-L93`, typed at `args.ts:L38-L39`) and read by nothing else in `libs/cli/src` — the active project is `user` (`DEFAULT_PROJECT_ID`) unless a route or session says otherwise.
- **Two default-project display names race.** `materializeRuntime` writes `name:'user'` (`runtime-init.ts:L120-L127`); `ensureDefaultProject` → `scaffoldProject` writes `'Personal'` (`projects.ts:L390-L400`). Whichever runs first on a fresh root wins — and `materializeRuntime` runs first in every `bin.ts` path, so `user` is what you normally see.
- **Registration order is precedence.** The literal `/api/*` and `/app/*` routes are registered before the `:projectId` root mounts, and within the app-admin group the specific sub-routes (`/app/build`, `/app/data/…`, `/app/files/*`) precede the bare `GET /api/projects/:projectId/app` manifest (`serve.ts:L240-L246`, `:L322-L326`).
- **Adding a worker-run seam means adding a tsup entry.** `worker` and `worker-load-entry` are pinned dist entries; a missing one ships an image where every emitter scan / space-hook dispatch fails at runtime (`sdk/org/libs/cli/tsup.config.ts:L3-L18`).
- **The pod server has no authentication of its own.** See [rest/README.md](./rest/README.md) — it is protected by its network position (one pod per user namespace, behind Envoy), and only `/api/budget`, `/api/report-bug` (which *relay* the caller's `Authorization` header) and `/api/inbound/:path` (per-provider HMAC) touch auth at all.
