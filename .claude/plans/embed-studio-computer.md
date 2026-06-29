# Embed Studio & Computer into the sdk/org CLI

## Context

Today `studio`, `computer`, and `chat` are three independent Vite SPAs, each shipped as
its own nginx Docker image. The `@lmthing/cli` package (`sdk/org/packages/cli`) is the
per-user **compute pod** server (`lmthing serve`); it already serves *one* React surface —
the `@lmthing/agent-ui` chat/DevTools app (`packages/ui/src/app/main.tsx`) — by
esbuild-bundling it at runtime and returning a single HTML page.

We want the pod/CLI to become the server for **all three** full UIs, with their source
relocated **under `sdk/org/packages/ui`**, selected by HTTP **Host** header
(`lmthing.studio`→studio, `lmthing.computer`→computer, `lmthing.chat`→chat). The
agent-ui "chat" app is turned into a proper Vite app (rather than migrating studio/computer
off Vite), and the CLI serves the **prebuilt** Vite output. All existing CLI features
(`/api/*`, sessions, WS agent + terminal control sockets, project/space files, fs, env)
are preserved unchanged.

**Auth model (per-host bootstraps):** thin per-host bootstrap SPAs keep doing login +
`compute/ensure`, then redirect the authenticated user to the pod with `/?access_token=…`;
the pod serves the full UI. So the full studio/computer apps, *when served by the pod*,
must trust the injected token and skip their login/ensure gates — exactly how the chat
shell already works (`window.__LM_ACCESS_TOKEN__`).

**This plan is Phase 1: code relocation + CLI serving + auth integration, verified
locally.** Deployment rewiring (compute Dockerfile, Envoy routes, CI matrix, ArgoCD
manifests, slimming root studio/computer to bootstraps) is **Phase 2**, sketched at the
end but not executed here.

---

## Phase 1 — Workstreams

The three workstreams are independent and can be implemented in parallel, then verified
together. Each was designed in detail; key file anchors below.

### A. Relocate apps under `packages/ui` + fix the shared Vite config

Target layout (sub-folders of the ui package, grouped under `apps/`):

```
sdk/org/packages/ui/
  src/                     # unchanged @lmthing/agent-ui shared lib + app shell
  apps/
    studio/                # moved from /studio   (pkg @lmthing/app)
    computer/              # moved from /computer  (pkg @lmthing/computer)
    chat/                  # NEW Vite app (pkg @lmthing/chat-app) wrapping mountApp()
```

1. **`sdk/libs/utils/src/vite.mjs` — make `createViteConfig` depth-independent (prerequisite).**
   The helper currently computes `libsDir`/`faviconDir`/aliases as `resolve(dirname,'../sdk/...')`,
   assuming each app sits one level below repo root. Add a `findRepoRoot(startDir)` that walks
   up to the directory containing `pnpm-workspace.yaml`, then derive:
   - `libsDir = resolve(repoRoot,'sdk/libs')`, `faviconDir = resolve(repoRoot,'sdk/common/favicon.ico')`
   - aliases `@lmthing/{ui,agent-ui,css,state,auth}` → `resolve(repoRoot,'sdk/...')`
   - keep `'@'` → `resolve(dirname,'./src')` (per-app).
   This keeps all 11 existing root-level apps working unchanged and unblocks any depth.
   The `resolve-workspace-deps` plugin's `libsDir` guard keeps working (now absolute).

2. **Move `/studio` → `sdk/org/packages/ui/apps/studio/`** and **`/computer` → `…/apps/computer/`**
   (strip their `node_modules/` first). Their `vite.config.ts` (`createViteConfig(__dirname)`)
   needs no change after step A.1.

3. **Create `sdk/org/packages/ui/apps/chat/`** — a thin Vite SPA:
   - `package.json` name `@lmthing/chat-app` (avoid clash with root `@lmthing/chat`), deps
     `@lmthing/agent-ui`, react/react-dom 18; devdeps vite-plus/@lmthing/utils/tailwind.
   - `vite.config.ts`: `export default createViteConfig(__dirname)`.
   - `index.html`: copy from `studio/index.html`, retitle.
   - `src/main.tsx`: `import { mountApp } from '@lmthing/agent-ui/app-entry'; mountApp()`.
   - `src/index.css`: `@import "tailwindcss"; @source "../../../src";` (scan the agent-ui lib
     for Tailwind classes).
   - `src/routes/__root.tsx`: one-line `createRootRoute({})` stub so the `tanstackRouter()`
     plugin (always registered in `createViteConfig`) generates a trivial valid `routeTree.gen.ts`.

4. **tsconfig:** add a shared base `sdk/org/packages/ui/apps/tsconfig.vite-app.json` with the
   correct deep-relative `paths` (`../../../../../sdk/libs/...`, `@lmthing/agent-ui`→`../src`);
   each app's `tsconfig.app.json` extends it. (Per-app `tsconfig.node.json` unchanged.)

5. **`pnpm-workspace.yaml`:** add glob `sdk/org/packages/ui/apps/*`. Then `pnpm install` at
   repo root to relink. (Root `studio`/`computer` entries: see Phase 2 — leave for now.)

Notes/risks: React **dedupe** for `@lmthing/agent-ui` (own react@18) is already in `vite.mjs`
— keep it. Tailwind v4 scans whatever Vite processes, so no `@source` changes for the moved
apps; only the new chat app needs the explicit `@source`.

### B. CLI serves the three prebuilt apps by Host header

New module **`sdk/org/packages/cli/src/server/static-apps.ts`**:

1. **`resolveAppDists()`** (once at startup) → `{studio,computer,chat}` absolute dist paths.
   Base = `resolve(dirname(fileURLToPath(import.meta.url)), '../../ui/apps')` — resolves to
   `sdk/org/packages/ui/apps/<name>/dist` in dev, tsup output, and the Docker image
   (`/app/packages/ui/apps/<name>/dist`) alike. Per-app env overrides
   `LM_APP_DIST_{STUDIO,COMPUTER,CHAT}` (lets you point at the old `/studio/dist` before the move).
2. **`resolveAppName(req)`**: read `x-forwarded-host` (Envoy) else `host`, strip port, lowercase;
   `*studio*`→studio, `*computer*`→computer, else→chat (default).
3. **`serveStaticApp(req,res,distDir)`**:
   - `/assets/*` → read file, `Cache-Control: public, max-age=31536000, immutable`, Content-Type
     from a small inline ext table (no `mime` dep). Path-traversal guard (`startsWith(distDir+sep)`),
     ENOENT→404.
   - other real files (favicon/manifest) → `Cache-Control: no-cache`.
   - **SPA fallback** (everything else incl. `/` and deep routes) → that app's `index.html`,
     `Cache-Control: no-cache, no-store`, **with the bootstrap script injected** (B.4).
   - Missing `index.html` → 503 with a clear message (don't fail startup).
4. **Bootstrap injection** = the existing IIFE from `buildHtml()` in `serve.ts` (reads
   `?access_token=`→`window.__LM_ACCESS_TOKEN__` then strips it from the URL; `?sessionId=`→`__WS_URL__`;
   `__LM_PROJECT_MODE__ = true`). Splice it as an inline `<script>` immediately before the first
   `<script type="module"` in the prebuilt index.html (single `indexOf`+concat; cache the spliced
   string per dist in a `Map`). App-agnostic — studio/computer/chat all read the same globals.

Wire into **`sdk/org/packages/cli/src/server/serve.ts`**:
- In `startSessionServer` startup (the `let html=''` block, ~L283–295): replace the esbuild
  bundling with `const staticApps = createStaticApps(resolveAppDists())`.
- In `handleHttp` catch-all (~L771–778, after the unknown-`/api/*` 404 branch): replace the
  single-`html` response with `await staticApps.handle(req, res)`.
- Remove now-dead `resolveUiAssets`/`readThemeCss`/`buildBundle`/`readCss`/`buildHtml` and the
  unused `esbuild`/`loadSpace`/`Space`/`createRequire`/`existsSync` imports. Mark
  `SessionServerOpts.appTsxPath` optional (leave `bin.ts` untouched).
- **Leave `src/web/serve.ts` (`--web` dev path) untouched** — it keeps esbuild-bundling the
  agent-ui app + per-space form components + trace replay for single-space dev. Per-space
  **theming** is dropped for the prebuilt apps (they own their Tailwind theme; project mode never
  had a single space anyway).

Everything else in `serve.ts` (all `/api/*`, the `/api/ws` agent + control/terminal sockets,
`/api/terminals/:id`, env/prices/restart, project/space-file/fs routes) is unchanged and shared
across hosts.

### C. Pod-served auth: trust the injected token, skip login/ensure

Mirror the existing `packages/ui/src/app/auth.ts` pattern in `@lmthing/auth` so studio/computer,
when served by the pod, treat the injected JWT as the session.

1. **`sdk/libs/auth/src/client.ts`** — add `getPodInjectedToken()` (reads
   `window.__LM_ACCESS_TOKEN__`) and `isPodEmbedded()`; export both from `src/index.ts`.
2. **`sdk/libs/auth/src/AuthProvider.tsx`** — at the top of the cold-reload/OAuth-callback
   `useEffect` (after the `isDemo` guard, before the `?code=` branch): if `getPodInjectedToken()`
   is set, build a synthetic `AuthSession {accessToken: token, userId:'pod-user', email:'',
   githubRepo:null, githubUsername:null}` (no refreshToken/expiresAt → `isSessionExpired` false →
   `ensureValidToken` returns it statically, never refreshes), `storeSession()`+`setSession()`,
   `setIsLoading(false)`, return. Result: `isAuthenticated=true`, `getAccessTokenSync()` returns
   the token. The proactive-refresh effect already no-ops without a refreshToken.
3. **`studio/src/routes/__root.tsx`** (→ new path) — import `isPodEmbedded`; in `PodEnsureGate`
   add early `if (isPodEmbedded()) return <>{children}</>` (pod already up). `COMPUTER_BASE_URL`
   default is already `window.location.origin` = the pod. `PinGate` passes through (no PIN on a
   fresh pod). `AppProvider` already receives `getAccessTokenSync`.
4. **`computer/src/routes/__root.tsx`** (→ new path) — same, but extract the provider subtree
   (`ComputerProvider`/`AppProvider`/`ProjectProvider`/`SpaceProvider`) into a `PodReadyTree`
   used by both the `status==='ready'` branch and the `isPodEmbedded()` early return.

Dev mode (no injected token) is unaffected: `isPodEmbedded()` false → all existing OAuth /
localStorage / `VITE_COMPUTER_BASE_URL=https://computer.test` paths run unchanged. Token refresh
in pod-embedded mode is intentionally a no-op (page reload returns to the bootstrap for a fresh
token) — same as `AgentChatPanel`'s static-token handling.

---

## Critical files

- `sdk/libs/utils/src/vite.mjs` — `findRepoRoot` + repoRoot-relative paths (A.1)
- `pnpm-workspace.yaml` — add `sdk/org/packages/ui/apps/*`
- `sdk/org/packages/ui/apps/{studio,computer,chat}/…` — relocated + new chat app
- `sdk/org/packages/ui/apps/tsconfig.vite-app.json` — shared base tsconfig
- `sdk/org/packages/cli/src/server/static-apps.ts` — **new**, host-based static serving
- `sdk/org/packages/cli/src/server/serve.ts` — swap esbuild bundling → `staticApps.handle`
- `sdk/libs/auth/src/{client.ts,index.ts,AuthProvider.tsx}` — injected-token session
- `studio/src/routes/__root.tsx`, `computer/src/routes/__root.tsx` — pod-embedded gate skip

## Reuse (don't reinvent)

- Bootstrap IIFE: lift verbatim from `buildHtml()` in `serve.ts`.
- Injected-token reader: `packages/ui/src/app/auth.ts` `getAccessToken()` is the template.
- Static-token-without-refresh behavior: `AgentChatPanel` already does this.
- `import.meta.url`/`fileURLToPath(dirname(...))`: already used by the prices route in `serve.ts`.

---

## Verification (local, end-to-end)

1. **Build the apps:** `pnpm install` then
   `pnpm --filter @lmthing/app build && pnpm --filter @lmthing/computer build && pnpm --filter @lmthing/chat-app build`.
   Confirm `dist/` under each `apps/<name>/`.
2. **Build + run the CLI:** `pnpm --filter @lmthing/cli build`, then
   `node sdk/org/packages/cli/dist/cli/bin.js serve --port 8080` (uses an `.lmthing` root; add
   `LM_APP_DIST_*` overrides if apps aren't moved yet).
3. **Host-based serving (curl):**
   - `curl -s -H "Host: lmthing.studio" localhost:8080/ | grep -E '__LM_PROJECT_MODE__|<title>'`
   - repeat with `Host: lmthing.computer` and `Host: lmthing.chat` → each returns its own app's HTML.
   - `curl -sI -H "Host: lmthing.studio" localhost:8080/assets/<hashed>.js` → `Cache-Control: …immutable`, JS content-type.
   - `curl -s -H "Host: lmthing.chat" "localhost:8080/?access_token=tok123" | grep __LM_ACCESS_TOKEN__` → bootstrap present.
   - `curl -s localhost:8080/api/sessions` → `{"sessions":[…]}` (API shared, unaffected); `curl -sI localhost:8080/api/nope` → 404.
   - deep route `…/projects/123/spaces/x` with `Host: lmthing.studio` → studio index.html (SPA fallback).
4. **Auth integration (browser, chrome-devtools MCP):** open `http://localhost:8080/?access_token=<gateway-JWT>`
   with `Host: lmthing.studio` (or against a real pod per `reference-prod-test-user-and-deploy`):
   studio renders **without** the LoginScreen or "Starting compute pod…" gate, and its `/api/*`
   calls + the THING dock WS carry the token. Repeat for computer.
5. **No-regression dev check:** `pnpm --filter @lmthing/app dev` (no injected token) still shows
   login + `PodEnsureGate` and talks to `https://computer.test`.

---

## Phase 2 (follow-up, not in this change)

- **compute Dockerfile** (`devops/argocd/compute/Dockerfile`): build the three Vite apps and
  `COPY` their `dist` to `/app/packages/ui/apps/<name>/dist`; pod still runs `lmthing serve`.
- **Per-host bootstraps:** reduce root `/studio` and `/computer` to thin login+ensure+redirect
  shells (mirror the existing `/chat`); keep three small images.
- **Envoy** (`devops/argocd/envoy/{studio,computer}-routes.yaml`): add `…-pod-root` rules so
  `/` and `/?access_token=` route to the user pod (like `chat-pod-root`); `/*` no-token → bootstrap.
- **CI** (`.github/workflows/build-images.yml`): point `compute` build at the new app sources;
  shrink studio/computer image builds to the bootstrap.
