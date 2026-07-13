# Shared libraries (`@lmthing/*`)

The reusable packages under `sdk/org/libs/`. They live **inside the `sdk/org`
submodule** so the compute-pod Docker image (build context = `sdk/org`) can
build the apps self-contained — see the workspace glob `sdk/org/pnpm-workspace.yaml`.
There are exactly **nine** packages — `auth cli config core css openclaw-compat
state ui utils` (`sdk/org/libs/`), tabled below. "Spaces" is not one of them: it is
a runtime concept implemented inside `@lmthing/core`'s `spaces/` module
(`sdk/org/libs/core/src/spaces/load.ts`), not a package.

> Naming note: every package is `"type": "module"` (ESM). Three ship compiled
> `dist/` (`core`, `cli`, `openclaw-compat`, `state`); the rest are consumed
> straight from `src/` (`main`/`exports` point at `.ts`) — e.g. `@lmthing/ui`
> `"main": "./src/index.ts"` (`sdk/org/libs/ui/package.json`), `@lmthing/auth`
> `"main": "./src/index.ts"` (`sdk/org/libs/auth/package.json`). Bundling is the
> consuming app's job (Vite / tsup).

## Index

| Package | Purpose | Entry / main exports | Consumed by |
|---|---|---|---|
| **`@lmthing/core`** | The agent **runtime** — QuickJS WASM sandbox, turn loop, value-yielding globals, spaces/tasklist/fork/delegate engines, typecheck, project-app db/capability layer. No renderer, no AI provider. | `sdk/org/libs/core/src/index.ts` (216 lines of re-exports): `createVM`/`VM` (`sandbox/quickjs.js`), `Session` (`session/session.js`), `runTurnLoop` (`eval/turn-loop.js`), `loadSpace`/`Space` (`spaces/load.js`), `runTasklist` (`tasklist/orchestrator.js`), `ForkEngine` (`fork/fork.js`), `DelegateRegistry`/`runDelegate` (`delegate/`), `runTsc` (`typecheck/tsc.js`), the `create*Global` factories (`globals/*`), `validateTableSchema`/`DbApi` (`db/`), `parseCapabilities` (`spaces/capabilities.js`). Sub-path `./ui` → the UI catalog + form normalization. | `@lmthing/cli`, `@lmthing/ui` (`sdk/org/libs/cli/package.json`, `sdk/org/libs/ui/package.json`) |
| **`@lmthing/cli`** | The `lmthing` **CLI + pod server** — Ink terminal renderer, AI-provider wiring (ai-sdk), the WebSocket REPL/RPC server, `lmthing serve` (serves the unified SPA), and the project-app SQLite storage engine. Ships the `lmthing` bin. | `sdk/org/libs/cli/src/index.ts`: `Session`/`RenderHost` (re-exported from core), `InkRenderHost` (`render/ink-renderer.js`), `ReplWebSocketServer`/`WebRenderHost` (`rpc/server.js`), `resolveModel` (`providers/resolve.js`), `resolveAlias` (`providers/aliases.js`), `createStream` (`stream/stream.js`). Bin: `./dist/cli/bin.js` (`sdk/org/libs/cli/package.json` `bin.lmthing`). | Top-level app / pod only (no other lib depends on it) — `sdk/org/libs/cli/package.json` |
| **`@lmthing/state`** | In-memory **virtual file system** — layered, scoped VFS with a fine-grained event bus, pod transport, React contexts + hooks. Powers Studio/Chat/Computer project & space browsing. | `sdk/org/libs/state/src/index.ts`: `export *` from `./types`, `./lib/fs`, `./lib/pod`, `./lib/contexts`, `./hooks`; named `AppProvider`/`ProjectProvider`/`useProject`/`SpaceProvider`. Sub-paths `./types`, `./fs`, `./contexts`, `./hooks` (`sdk/org/libs/state/package.json` `exports`). | `apps/web` + every product SPA (`com`, `social`, `team`, `store`, `space`, `blog`, `casa`) — `grep "@lmthing/state"` |
| **`@lmthing/ui`** | Shared **React UI** — elements, components, and the three product-surface bundles (chat/studio/computer) plus theme. | `sdk/org/libs/ui/src/index.ts` re-exports `./components/auth`. Sub-paths carry the real surface: `./chat`, `./studio`, `./computer`, `./components/*`, `./elements/*`, `./lib/*`, `./theme`, `./chat/css` (`sdk/org/libs/ui/package.json` `exports`). Depends on `@lmthing/auth`, `@lmthing/core`, `@lmthing/css`. | `apps/web`, `@lmthing/cli`, and every product SPA (`com`/`social`/`team`/`store`/`space`/`blog`/`casa`) + store project-apps (`store/projects/{health,homes,trips,blog,kitchen}`) |
| **`@lmthing/css`** | The **design system** — design tokens, generated `theme.css`, element/component CSS, and the token linter. | `sdk/org/libs/css/package.json` `exports`: `./theme` (`src/theme.css`), `./tokens.json`, `./tokens.manifest.json`, `./elements/*`, `./components/*`. Bin `lmthing-lint-tokens` (`./scripts/lint-design-tokens.mjs`). `generate` rebuilds `theme.css` + component catalog. Full spec → [../design-system/README.md](../design-system/README.md). | `apps/web`, `@lmthing/ui`, `@lmthing/cli`, all product SPAs + store project-apps |
| **`@lmthing/auth`** | Shared **auth client** for cross-domain SSO across `lmthing.*` apps — React provider + token/session helpers + repo-sync hook. | `sdk/org/libs/auth/src/index.ts`: `AuthProvider`/`useAuth` (`./AuthProvider`), the `./client` helpers (`redirectToLogin`, `handleAuthCallback`, `refreshSession`, `ensureValidToken`, `authFetch`, `getSession`, `clearSession`, `onSessionChange`, PIN helpers, `getPodInjectedToken`/`isPodEmbedded`/`isLocalRun`), `useRepoSync` (`./useRepoSync`); types `AuthSession`/`AuthConfig`/`AuthContextValue`. | `apps/web`, `@lmthing/ui`, and the `space` SPA (`grep "@lmthing/auth"`) |
| **`@lmthing/openclaw-compat`** | Pod-side **host foundation for running OpenClaw plugins** — a structural shim over `OpenClawPluginApi` that fails loud (`UnsupportedCompatError`) on anything not yet implemented. | `sdk/org/libs/openclaw-compat/src/index.ts`: `PluginRegistry` (`./registry.js`), `createCompatApi` (`./api.js`), `loadPlugin` (`./loader.js`), the plugin-SDK shim (`definePluginEntry`, `defineBundledChannelEntry`, `applyBundledChannelDescriptor`), `CompatHost`/`Compat*` types, `UnsupportedCompatError`. | `@lmthing/cli` only (`sdk/org/libs/cli/package.json`) — see [./openclaw-compat.md](./openclaw-compat.md) |
| **`@lmthing/utils`** | Private **build utility** — the shared Vite config factory used by every SPA. | `sdk/org/libs/utils/src/index.ts`: `createViteConfig` (`./vite`), sub-path `./vite` → `src/vite.mjs`. `findOrgRoot()` locates the `sdk/org` root across both checkout layouts; wires react + tailwind + tanstack-router plugins and serves shared favicons (`sdk/org/libs/utils/src/vite.mjs`). `"private": true`. | `apps/web` + all product SPAs (`com`/`social`/`team`/`store`/`space`/`blog`/`casa`) |
| **`@lmthing/config`** | Private **shared tooling config** — base tsconfigs + ESLint flat configs. Not runtime code. | `sdk/org/libs/config/package.json` `exports`: `./tsconfig/base`, `./tsconfig/react-lib`, `./tsconfig/node-lib`, `./eslint`, `./eslint/react`. `"private": true`. | Every workspace package + `sdk/org` root + `apps/web` (dev-dependency; `grep "@lmthing/config"`) |

## Dependency shape

`@lmthing/core` is the runtime root and imports **no** other `@lmthing/*` package
(`sdk/org/libs/core/package.json` has only third-party deps: `quickjs-emscripten`,
`esbuild`, `typescript`, `yaml`). Everything layers up from there:

```
core ─┬─────────────► cli  (adds providers, Ink/WS renderers, serve, sqlite)
      └─► ui ──► css        (ui also → auth, core)
auth ─┘
state          (standalone VFS; peer: react)
utils, config  (build-time only, private)
openclaw-compat ► cli
```

- `@lmthing/core` **never** imports `cli` or `ui` — it emits events and accepts a
  `RenderHost` interface (`sdk/org/CLAUDE.md`, "Packages"; confirmed by
  `sdk/org/libs/core/package.json` having no `@lmthing/*` dependency).
- `@lmthing/ui` `dependencies` = `@lmthing/auth`, `@lmthing/core`, `@lmthing/css`
  (`sdk/org/libs/ui/package.json`).
- `@lmthing/cli` `dependencies` include `@lmthing/core`, `@lmthing/openclaw-compat`,
  `@lmthing/ui`, `@lmthing/css` (`sdk/org/libs/cli/package.json`).

## Detail docs

- [./state.md](./state.md) — `@lmthing/state` VFS: layers, event bus, pod transport, contexts, hooks.
- [./ui-and-css.md](./ui-and-css.md) — `@lmthing/ui` surfaces/components + `@lmthing/css` internals.
- [./auth.md](./auth.md) — `@lmthing/auth` session model, cross-domain SSO, `useRepoSync`.
- [./openclaw-compat.md](./openclaw-compat.md) — the OpenClaw plugin host shim.
- [../design-system/README.md](../design-system/README.md) — the token-driven design system (canonical spec, backed by `@lmthing/css`).

> `@lmthing/core` and `@lmthing/cli` are the runtime; their internals are
> documented under [../runtime/README.md](../runtime/README.md) and
> [../cli-api/README.md](../cli-api/README.md), not in a per-lib detail file here.
