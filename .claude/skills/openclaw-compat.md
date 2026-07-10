---
name: openclaw-compat
description: Load when running OpenClaw plugin code as-is on a compute pod — the `@lmthing/openclaw-compat` package (loader, Proxy-backed api, CompatHost), `.openclaw-plugins/` boot, the `tool()` global, plugin HTTP routes on the Triggers ingress, or the packaging/npm/socket-mode constraints.
---

# Skill: OpenClaw Compat (run OpenClaw plugins verbatim on the pod)

`@lmthing/openclaw-compat` (`sdk/org/libs/openclaw-compat/`) is a **pod-side compatibility host** that
executes an OpenClaw plugin's own `register(api)` code as full-privilege Node **inside the user's
single-tenant compute pod** (NOT the QuickJS sandbox — that runs model-authored TS only). It rides on
the inbound-webhook ingress: a plugin's `registerHttpRoute(...)` becomes reachable at
`POST /api/inbound/:path` with **zero gateway change**. Context: this closes the one OpenClaw
extension bucket lmthing lacked a native seam for — inbound messaging channels. See
`@.claude/skills/triggers.md` (authoring) and `@.claude/skills/webhooks.md` (ingress/transport).
Canonical gap analysis: `sdk/org/libs/openclaw-compat/COMPAT.md`.

## What OpenClaw actually is (confirmed facts)

- `openclaw` is **ONE MIT npm pkg** (v2026.6.11) whose subpath exports provide `openclaw/plugin-sdk/*`
  (dozens of subpaths). Channel extensions are **separate `@openclaw/*` pkgs** (peer-dep `openclaw` +
  own runtime deps like `@slack/bolt`, `ws`).
- `OpenClawPluginApi` is a ~2953-line type with 40+ `register*` methods + nested
  `api.session`/`api.agent`/`api.lifecycle`/`api.runtime`.
- Two plugin shapes: **`definePluginEntry({ id, register })`** (supported) and
  **`defineBundledChannelEntry(...)`** (identifiable by a `plugin.specifier` field — **rejected** with
  `UnsupportedCompatError`; a later increment). `@openclaw/slack` is **Socket Mode** (persistent WS) ⇒
  **warm-pod-only**, incompatible with scale-to-zero.

## Structural shim, fail-loud

The api is a **Proxy** (`src/api.ts`): only `IMPLEMENTED_TOP_LEVEL` = `{registerTool,
registerHttpRoute, registerChannel}` + `api.runtime.subagent.run` are real. **Everything else returns
a `makeUnsupportedProxy` that throws `UnsupportedCompatError` on call/deep-access** — never a silent
no-op, never an opaque `TypeError`. `registerChannel` and the four `register*Provider` methods are
**record-only** (stored in `PluginRegistry`, not yet wired to any lmthing pipeline).

- `registerTool` accepts both **object form** `registerTool({name, execute})` and **factory form**
  `registerTool((ctx) => toolObject, { name })` (Tavily uses the factory form) → recorded in
  `registry.tools` (a `Map`).
- `registerHttpRoute({method, path, handler})` → `host.mountRoute` → the shared route table.
- `runtime.subagent.run({ sessionKey, message })` → `host.runAgent` → a **real lmthing agent**.

## The CompatHost seam (`src/types.ts`) + the pod host (`libs/cli/src/server/openclaw-host.ts`)

`CompatHost = { runAgent, mountRoute, log }`. The pod implements it via `createComputeCompatHost`:
- **`runAgent({sessionKey, message})`** → `SessionManager.runHeadlessThreaded` with `sessionId =
  deterministicUuidFromKey(sessionKey)` (sha1→RFC-4122-shaped, so the SAME `sessionKey` always resumes
  the SAME persisted session — one continuous conversation, not a fresh one-shot each call). Target
  agent = `LM_OPENCLAW_AGENT` (`space/agent`, `parseOpenClawAgentEnv`) else top-level `thing`.
- **`mountRoute(method, path, handler)`** → writes into a shared `OpenClawRouteTable` (`Map`, path
  normalized to strip leading `/` so `/echo` keys `echo`). That same table is passed to
  `createInboundHandler` as `pluginRoutes` → **the Triggers `POST /api/inbound/:path` dispatcher falls
  back to a plugin route when no webhook-hook/space-trigger binding matches** (bindings always win).

## Boot wiring (`libs/cli/src/server/serve.ts`)

```
openclawRoutes = new Map()                                    // shared route table
router.add('POST', '/api/inbound/:path', createInboundHandler(manager, root, openclawRoutes))
...
host = createComputeCompatHost(manager, { projectId, spaceRef, agentSlug }, openclawRoutes)
{ registry } = await loadOpenClawPlugins(join(root, '.openclaw-plugins'), host, console.log)
manager.setToolRegistry(registry)                            // exposes plugin tools to the tool() global
```

`loadOpenClawPlugins` scans `<root>/.openclaw-plugins/*` (one subdir per plugin, each needs
`package.json` + `openclaw.plugin.json`). **No dir ⇒ no-op** — existing pods are completely unaffected.
Each plugin is **best-effort**: a bad manifest / throwing `register()` / `UnsupportedCompatError` is
logged and skipped so one broken plugin never blocks the others or pod boot.

## The loader (`src/loader.ts`)

`loadPlugin(dir, api, opts?)`: reads `package.json#openclaw.extensions[0]` (entry file) +
`openclaw.plugin.json#id` → transpiles the `.ts` entry with **esbuild** (`format:'cjs'`) →
`new Function`-evals it with a `shimRequire` → calls `entry.register(api)`. (Same
esbuild-transform-then-eval approach as the cli hook loader — plugin entries are plain `.ts` outside
any build pipeline; **esbuild is a runtime dependency of this package**, hence its `node_modules` must
ship — see packaging gotcha.)

- **`moduleOverrides`** (`opts.moduleOverrides`): a `Record<specifier, value>` consulted before the
  real `require`. Lets a **vendored real entry's** `import "openclaw/plugin-sdk/..."` resolve **without
  installing the real npm packages** — critical, because this sandbox has **no npm-registry egress**
  (gh works). Proven against **Tavily's real `definePluginEntry` entry** (`test/tavily/`): its
  `register(api)` runs verbatim, ending with the web-search provider + `tavily_search`/`tavily_extract`
  tools registered (Tavily's `./src` tool factories are stubbed — real ones need `@tavily/core`).

## The `tool()` global — exposing plugin tools to agents (`libs/core/src/globals/tool.ts`)

A **value-yielding** global (like `apiCall`/`callConnection`/`fetch`): `tool(name, input)` ends the
turn and resumes when the host resolves the call against the loaded `PluginRegistry`.
- Injected **only** when the agent holds the **`tools:use { allow: [...] }`** capability
  (`spaces/capabilities.ts`); the per-grant DTS (`composeToolDts`) types `name` to the allow-list, so
  calling an undeclared tool **fails typecheck**.
- Yield kind `'tool'` (`eval/yield.ts`) → `toolResolver` (`eval/yield-router.ts`, threaded from
  `SessionManager` via `setToolRegistry`/`withTools`/`resolveTool`). No registry configured ⇒ the
  yield **rejects with a clear, retryable error**, never binds undefined.
- Mirrors `api:call` end-to-end. (Wiring shipped; a full prod verify with a tool-registering plugin +
  a `tools:use` agent is a documented future increment.)

## Hard constraints (state up front)

- **npm egress** — fully-as-installed plugins (`openclaw` + `@openclaw/*` + their runtime deps) need
  npm; this sandbox has none. Today: vendor the entry + `moduleOverrides`. Removing overrides needs the
  real packages installed in the pod image.
- **Socket/long-poll channels** (Slack Socket Mode, Telegram getUpdates, Discord gateway, Signal,
  Matrix) need an **always-on process** ⇒ **warm/pinned pod (paid tier)**, incompatible with
  scale-to-zero. Only **webhook-mode** channels fit the wake-and-forward model.
- **`defineBundledChannelEntry`** plugins are rejected (a later increment).
- **Trust boundary** — plugin code is full-privilege in-proc Node (not QuickJS). Single-tenant pod
  mitigates it; a worker/subprocess boundary is a possible hardening.
- **Packaging** — `@lmthing/openclaw-compat` is a cli dependency and **must be built + shipped in
  `devops/argocd/compute/Dockerfile`** (mirror `@lmthing/core`): copy its `package.json` pre-install,
  build its dist **before** the cli, and ship `dist` + `package.json` + **`node_modules`** (its dist
  imports esbuild at runtime). Omitting this crash-loops every pod on `Cannot find package` — a real
  prod outage we already hit. See `[[project-inbound-triggers]]`.

## File map

| File | Role |
|---|---|
| `sdk/org/libs/openclaw-compat/src/loader.ts` | `loadPlugin` (esbuild-transpile entry, `moduleOverrides`, reject bundled-channel) |
| `sdk/org/libs/openclaw-compat/src/api.ts` | Proxy-backed api: `IMPLEMENTED_TOP_LEVEL`, `registerTool` (object+factory), `registerHttpRoute`, `registerChannel`, `runtime.subagent.run`, `makeUnsupportedProxy` |
| `sdk/org/libs/openclaw-compat/src/types.ts` | `CompatHost`, `CompatHttpRequest/Response`, `RegisteredTool/HttpRoute/Channel/Provider`, `UnsupportedCompatError` |
| `sdk/org/libs/openclaw-compat/src/registry.ts` | `PluginRegistry` (tools map, httpRoutes, channels, providers) |
| `sdk/org/libs/openclaw-compat/src/plugin-sdk-shim.ts` | `definePluginEntry` identity shim |
| `sdk/org/libs/openclaw-compat/COMPAT.md` | Full gap analysis + roadmap |
| `sdk/org/libs/cli/src/server/openclaw-host.ts` | `createComputeCompatHost`, `loadOpenClawPlugins`, `deterministicUuidFromKey`, `parseOpenClawAgentEnv`, `OpenClawRouteTable` |
| `sdk/org/libs/cli/src/server/serve.ts` | Boot-load `.openclaw-plugins/` + `setToolRegistry` + inbound handler wiring |
| `sdk/org/libs/core/src/globals/tool.ts` | The `tool()` value-yielding global |
| `devops/argocd/compute/Dockerfile` | Builds + ships `libs/openclaw-compat` (dist + package.json + node_modules) |

## Testing

- Unit: `pnpm --filter @lmthing/openclaw-compat test` (loader, api Proxy, `tavily-load.test.ts` — the
  real Tavily entry through compat) · `pnpm --filter @lmthing/cli test -- openclaw`.
- Local drive: drop an echo plugin under `<root>/.openclaw-plugins/echoplugin/`
  (`package.json#openclaw.extensions[0]` + `openclaw.plugin.json#id`) that `registerHttpRoute`s
  `POST /echo` calling `api.runtime.subagent.run(...)`; boot a credentialed pod
  (`[[reference-local-ai-keys-env]]`); `POST /api/inbound/echo` → the agent runs and echoes.
- Prod (live-verified 2026-07-10, compute:4a74a84): set `LM_OPENCLAW_AGENT`, POST via
  `<gw>/api/inbound/<inboundJWT>/echo`, confirm pod log `[openclaw] loaded plugin "..."` +
  `mounted HTTP route POST /echo` and the agent's session snapshot. Prod idle scale-to-zero fights
  `kubectl exec` — drive via the gateway + read the persisted snapshot (`[[project-inbound-triggers]]`).
