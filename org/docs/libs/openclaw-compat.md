# @lmthing/openclaw-compat — run OpenClaw plugins as-is on the pod

`@lmthing/openclaw-compat` (`../../sdk/org/libs/openclaw-compat/`) is a **pod-side compatibility host** that executes an OpenClaw plugin's own `register(api)` code as full-privilege Node **inside the user's single-tenant compute pod** — NOT the QuickJS sandbox (that runs model-authored TypeScript only). Its package description states the goal exactly: "a structural shim over OpenClawPluginApi that fails loud on anything not yet implemented" (`../../sdk/org/libs/openclaw-compat/package.json:4`).

Two seams connect a loaded plugin to the rest of lmthing:
- a plugin's `registerHttpRoute(...)` becomes reachable at `POST /api/inbound/:path` with zero gateway change, via the Triggers inbound ingress's plugin-route fallback (`../../sdk/org/libs/cli/src/server/routes/webhooks.ts:134-156`);
- a plugin's registered `tool()`s are dispatchable by lmthing agents through the value-yielding `tool()` global (`../../sdk/org/libs/core/src/globals/tool.ts:19-28`).

Related: the unified event pipeline these routes ride on is documented in [../runtime-globals/events-and-integrations.md](../runtime-globals/events-and-integrations.md); the inbound ingress plumbing in [../cli-api/rest/webhooks.md](../cli-api/rest/webhooks.md).

---

## The library surface (`src/`)

Public exports (`../../sdk/org/libs/openclaw-compat/src/index.ts:8-38`):

| Export | Kind | Role |
|---|---|---|
| `createCompatApi(host, registry, opts?)` | fn | Builds the `api` object a plugin's `register(api)` runs against (`src/api.ts:236`). |
| `loadPlugin(dir, api, opts?)` | fn | Reads a plugin dir, transpiles + evals its entry, calls `register(api)` (`src/loader.ts:73`). |
| `PluginRegistry` | class | One-way sink for everything a plugin registers (`src/registry.ts:11`). |
| `definePluginEntry` / `defineBundledChannelEntry` / `applyBundledChannelDescriptor` | fn | `openclaw/plugin-sdk/*` shims (`src/plugin-sdk-shim.ts`). |
| `UnsupportedCompatError` | class | Thrown by any unimplemented api surface (`src/types.ts:135`). |
| `CompatHost`, `CompatHttpRequest/Response`, `CompatRouteHandler`, `RegisteredTool/HttpRoute/Channel/Provider`, … | types | The host seam + registry record shapes (`src/types.ts`). |

The package builds with tsup (`package.json:21`), ships as ESM (`package.json:5,8-14`), and has **one runtime dependency: `esbuild`** (`package.json:28-30`) — it transpiles plugin `.ts` at runtime.

---

## What OpenClaw is — and what our shim mirrors

The bullets below describe the **upstream `openclaw` npm package**, which lives outside this repo; they carry no lmthing citation. Each one is paired with the place in *our* code that encodes or reacts to it — that citation is the checkable part.

- **Subpath exports.** `openclaw` is a single npm package whose `openclaw/plugin-sdk/*` subpaths export the entry builders (`plugin-entry`, `channel-entry-contract`, …). Our host cannot resolve them from npm (no registry egress from the pod), so `BUILTIN_SHIMS` maps exactly the two we need to local implementations (`../../sdk/org/libs/openclaw-compat/src/loader.ts:32-43`).
- **Channel extensions are separate packages.** `@openclaw/*` channel packages peer-depend on `openclaw` and pull their own runtime deps (`@slack/bolt`, `ws`, …).
- **`@openclaw/slack` is Socket Mode** — a persistent outbound WebSocket, which a scale-to-zero pod cannot hold open. Accordingly our shim records a bundled channel's lazy `plugin`/`runtime` module refs but **deliberately never loads them** — only the webhook-mode `registerFull` hook runs (`src/plugin-sdk-shim.ts:23-29,38-45,49-79`).
- **Two entry shapes.** A plugin's runtime entry is either `definePluginEntry({ id, name, description, register(api){…} })` — upstream an identity function, which our shim reproduces exactly (`src/plugin-sdk-shim.ts:10-21`) — or a bundled-channel descriptor, identifiable by its `plugin.specifier` field (`src/plugin-sdk-shim.ts:31-47`; detected by `isBundledChannelDescriptor` at `src/loader.ts:118-123`).
- **`register(api)` receives `OpenClawPluginApi`** — 40+ `register*` methods plus nested `api.session`/`api.agent`/`api.lifecycle`/`api.runtime` namespaces (~2900 lines of interface). We implement **13 top-level names** and let the Proxy fail loud on every other one (`src/api.ts:8-10,27-45,346-351`); only the record shapes we actually need are mirrored in `src/types.ts`.
- **Package metadata.** A plugin directory carries `package.json#openclaw.extensions[0]` (the entry file) plus an `openclaw.plugin.json` manifest keyed by `id` (upstream also `contracts`, `configSchema`, `activation`). Those two files — and specifically `extensions[0]` + `id` — are exactly what `loadPlugin` reads and requires (`src/loader.ts:76-89`); a real example is the vendored Tavily extension (`../../sdk/org/libs/openclaw-compat/test/tavily/package.json:5-7`, `test/tavily/openclaw.plugin.json:1-17`).

---

## The compat `api` — a fail-loud Proxy (`src/api.ts`)

`createCompatApi(host, registry, opts?)` returns a `Proxy` over an `implemented` object (`src/api.ts:236-352`). The Proxy's `get` trap returns the real member only for names in `IMPLEMENTED_TOP_LEVEL`; **everything else returns a `makeUnsupportedProxy`** (`src/api.ts:346-351`).

`IMPLEMENTED_TOP_LEVEL` (`src/api.ts:27-45`):
```
registerTool · registerHttpRoute · registerChannel ·
registerWebSearchProvider · registerProvider · registerEmbeddingProvider ·
registerWebFetchProvider · runtime · log · logVerbose ·
logger · pluginConfig · config
```

`makeUnsupportedProxy(path)` is a function that **throws `UnsupportedCompatError` on call**, and on property access returns a further nested throwing proxy — so both `api.session()` and `api.session.getUser()` fail loud with a path naming exactly what was touched (`src/api.ts:81-96`). It special-cases `then` (returns `undefined`) so `await`-probing doesn't treat it as a thenable (`src/api.ts:91-92`). This is the core design contract from `types.ts:1-13`: "never a silent no-op, never an opaque `TypeError`."

### `registerTool` — object AND factory form

`registerTool` accepts both `registerTool({ name, execute })` and OpenClaw's factory form `registerTool((ctx) => toolObject, { name })` — the factory is invoked with a minimal `ctx` (`{}`) and the resulting tool must have an `execute()` function or it throws (`src/api.ts:242-264`). Tavily's real (vendored, unmodified) entry uses the factory form — `api.registerTool((ctx) => createTavilySearchTool(api, ctx), { name: "tavily_search" })` (`../../sdk/org/libs/openclaw-compat/test/tavily/index.ts:19-23`). The name comes from `opts.name` (factory form) else `tool.name`; a missing/empty name throws (`src/api.ts:251-254`). Recorded into `registry.tools` (`src/api.ts:256-261`).

### `registerHttpRoute` — method-less shape tolerated

`registerHttpRoute({ path, handler })` requires `path` + `handler` (throws otherwise); `method` is **optional and defaults to `POST`** — because OpenClaw's route shape omits it (it uses `match`/`auth` and defaults to accepting POST webhooks) (`src/api.ts:266-278`, type at `:68-73`). It records into the registry AND calls `host.mountRoute(method, path, handler)` (`src/api.ts:274-275`).

### `runtime.subagent.run` — the only implemented `runtime` member

`api.runtime` is a Proxy exposing only `subagent.run`; every other member under `runtime` (and `runtime.subagent`) fails loud (`src/api.ts:99-137`). `subagent.run({ sessionKey, message, provider?, model? })` validates `sessionKey`+`message` are strings then calls `host.runAgent({ sessionKey, message, agentRef: provider ?? model })` (`src/api.ts:100-114`).

### Provider registrations — record-only, plus win #2 tool exposure

`registerWebSearchProvider` / `registerProvider` (model) / `registerEmbeddingProvider` / `registerWebFetchProvider` all funnel through `recordProvider(...)` (`src/api.ts:314-325`, kinds `webSearch|model|embedding|webFetch` from `types.ts:125`). `recordProvider` stores the provider verbatim into `registry.providers` and never throws for a valid object (`src/api.ts:193-211`).

**Win #2** — a recorded `webSearch`/`webFetch` provider carrying a `createTool(ctx)` factory (Brave/Exa/Firecrawl shape) is **also** surfaced as a `tool()`-callable tool via `exposeProviderAsTool` (`src/api.ts:152-190`, called from `recordProvider` at `:209`). It builds the tool with `createTool({ searchConfig: {} })`, requires an `execute` function, derives a name (`t.name` else `<providerId>_search`/`_fetch`), skips duplicates, and adapts the provider tool's single-`args` signature to the host resolver's `(toolCallId, params)` shape by forwarding `params` (`src/api.ts:159-185`). Best-effort: a bad shape / throwing factory / dup name is logged and skipped, never fails the provider registration (`src/api.ts:172-189`).

### `registerChannel` — record-only

`registerChannel(registration)` extracts an `inbound` handler (from `onMessage`/`handleInbound`/`inbound`) and a `send`, keeps the raw object verbatim, and records it — but "channel routing is not implemented in this foundation" (`src/api.ts:280-307`, type at `types.ts:101-114`).

### `logger` / `pluginConfig` / `config` — win #1 loadability

`api.logger.{info,warn,error,debug,trace,log}` all route to the host's single `log` sink (`buildLogger`, `src/api.ts:216-220,341`). `api.pluginConfig` / `api.config` are read-only, defaulting to `{}` (overridable via `CreateCompatApiOptions`) so a config-reading plugin (e.g. OpenClaw's own `webhooks` extension, which early-returns when it finds no routes) loads cleanly instead of hitting a throwing proxy (`src/api.ts:222-229,337-343`).

---

## The `PluginRegistry` (`src/registry.ts`)

The one-way sink a loaded plugin writes into via the compat `api` — plugins register into a host-owned registry and never read it back through `api` (`src/registry.ts:1-7`). It holds four collections (`src/registry.ts:12-15`):
- `tools` — `Map<string, RegisteredTool>`; `addTool` **throws on a duplicate name** (fail loud) (`src/registry.ts:18-23`); `getTool(name)` for lookup (`src/registry.ts:66-68`).
- `httpRoutes` / `channels` / `providers` — arrays in registration order (`src/registry.ts:26-38`); `getProviders(kind)` filters by kind (`src/registry.ts:61-63`).

---

## The loader (`src/loader.ts`)

`loadPlugin(dir, api, opts?)` (`src/loader.ts:73`):
1. Reads `package.json` + `openclaw.plugin.json` from `dir`; requires `package.json#openclaw.extensions[0]` (the entry file path) and `openclaw.plugin.json#id` — both throw with a clear message if missing (`src/loader.ts:76-89`).
2. Transpiles the `.ts` entry with **esbuild** (`transform`, `loader:'ts'`, `format:'cjs'`, `target:'node18'`) then `new Function`-evals it with a `shimRequire` (`src/loader.ts:140-168`). Same esbuild-transform-then-eval approach as the cli hook loader (`src/loader.ts:14-16`).
3. Resolves the default export and, if it has a `register` function, calls `entry.register(api)` (`src/loader.ts:91-99`).

### `moduleOverrides` + builtin shims — no npm egress needed

`shimRequire(id)` consults, in order: `opts.moduleOverrides` → `BUILTIN_SHIMS` → the real `createRequire(entryFile)` (`src/loader.ts:156-164`). `BUILTIN_SHIMS` maps `openclaw/plugin-sdk/plugin-entry` → `{ definePluginEntry }` and `openclaw/plugin-sdk/channel-entry-contract` → `{ defineBundledChannelEntry }` (`src/loader.ts:40-43`), so a real, unmodified plugin entry's `import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"` resolves without the `openclaw` npm package installed — this host has no npm-registry egress (`src/loader.ts:32-39`). `moduleOverrides` (caller-supplied) still win, letting a vendored entry's `import "./src/..."` resolve to stubs (`src/loader.ts:51-63`).

### Bundled-channel loading (win #3)

`defineBundledChannelEntry(descriptor)` returns a `{ id, name, description, register(api) }` whose `register` runs `applyBundledChannelDescriptor` (`src/plugin-sdk-shim.ts:91-103`). `applyBundledChannelDescriptor` (`src/plugin-sdk-shim.ts:60-79`):
1. calls `api.registerChannel({ id, name, plugin, raw })` — recording the channel metadata + the lazy `plugin`/`runtime` refs;
2. runs `descriptor.registerFull(api)` when present — the **webhook-mode** hook that mounts the channel's own HTTP routes (e.g. Slack's `registerSlackPluginHttpRoutes`) onto the Triggers ingress.

The socket/native runtime behind `descriptor.plugin.specifier` is **deliberately NOT loaded** — that stays warm-pod/Socket-Mode, a deferred increment (`src/plugin-sdk-shim.ts:52-56`, `:38`). `loadPlugin` also has a **raw-descriptor fallback**: an entry with `plugin.specifier` but no `register` (built against the real SDK without our shim) is detected by `isBundledChannelDescriptor` and taken through the same `applyBundledChannelDescriptor` path (`src/loader.ts:101-123`).

> Note: the loader's own file-header docstring (`src/loader.ts:6-11`) still describes `defineBundledChannelEntry` as **rejected** with `UnsupportedCompatError`. The **code no longer rejects it** — `loadPlugin` handles both the shim-generated `register` and the raw descriptor (`src/loader.ts:94-110`), and `plugin-sdk-shim.ts` implements the loading path. The header docstring is stale; the shipped behaviour is "loaded in webhook-mode."

---

## The `CompatHost` seam (`src/types.ts`) and the pod host (`libs/cli/src/server/openclaw-host.ts`)

`CompatHost` is the minimal lmthing-supplied seam (`src/types.ts:37-44`):
```
runAgent(opts) → Promise<CompatRunAgentResult>   // { ok, result?, error? }
mountRoute(method, path, handler) → void
log(msg) → void
```

The pod implements it via `createComputeCompatHost(manager, opts, routeTable)` (`../../sdk/org/libs/cli/src/server/openclaw-host.ts:105-133`):

- **`runAgent({ sessionKey, message })`** → `manager.runHeadlessThreaded` with `sessionId = deterministicUuidFromKey(sessionKey)` (`openclaw-host.ts:112-121`). `deterministicUuidFromKey` sha1-hashes the key and stamps RFC-4122 version/variant nibbles + 8-4-4-4-12 dashes, so the **same `sessionKey` always resumes the same persisted session** (one continuous conversation, not a fresh one-shot) (`openclaw-host.ts:87-93`; rationale `:72-86`). It is NOT a byte-exact v5 UUID (`openclaw-host.ts:82-86`). The target agent = `opts.spaceRef`/`opts.agentSlug`.
- **`mountRoute(method, path, handler)`** → writes into the shared `OpenClawRouteTable` (`Map<string, {method, handler}>`), normalizing the path to strip a leading `/` so `/echo` keys `echo` — matching the inbound dispatcher's `:path` param (`openclaw-host.ts:126-128`, `normalizePath` `:68-70`).
- **`log(msg)`** → `console.log('[openclaw] …')` (`openclaw-host.ts:129-131`).

`ComputeCompatHost` also re-exposes `routeTable` so the loader can return it to the caller (`openclaw-host.ts:59-64,110-111`).

### `loadOpenClawPlugins(pluginsDir, host, log)`

Scans `<pluginsDir>/*` (one subdir per plugin) into ONE shared `PluginRegistry` (`openclaw-host.ts:152-188`):
- **No dir ⇒ no-op** — returns an empty registry and `host.routeTable` as-is, so existing pods with no `.openclaw-plugins/` are completely unaffected (`openclaw-host.ts:159-161,146-150`).
- Each subdir needs both `package.json` and `openclaw.plugin.json` or it's skipped (`openclaw-host.ts:175`).
- Each plugin is **best-effort**: a bad manifest / throwing `register()` / `UnsupportedCompatError` is logged and skipped so one broken plugin never blocks the others or pod boot (`openclaw-host.ts:177-184`). A fresh `createCompatApi(host, registry)` is built per plugin (`openclaw-host.ts:178`).

### `parseOpenClawAgentEnv(value)`

Parses `LM_OPENCLAW_AGENT` (`space/agent`, e.g. `billing/handler`) into `{ spaceRef, agentSlug }` (agentSlug = last path segment); unset falls back to `{ spaceRef:'', agentSlug:'thing' }` — the top-level THING agent, the same default `runHeadless` uses (`openclaw-host.ts:197-202`).

---

## Boot wiring (`libs/cli/src/server/serve.ts`)

At server construction a shared `openclawRoutes: OpenClawRouteTable = new Map()` is created and handed to the inbound handler (`../../sdk/org/libs/cli/src/server/serve.ts:235-236`):
```
const openclawRoutes: OpenClawRouteTable = new Map();
router.add('POST', '/api/inbound/:path', createInboundHandler(manager, effectiveLmthingRoot, openclawRoutes));
```

Later in the boot block, best-effort, the host is built and plugins loaded (`serve.ts:502-517`):
```
const { spaceRef, agentSlug } = parseOpenClawAgentEnv(process.env['LM_OPENCLAW_AGENT']);
const openclawHost = createComputeCompatHost(manager, { projectId: DEFAULT_PROJECT_ID, spaceRef, agentSlug }, openclawRoutes);
const { registry } = await loadOpenClawPlugins(join(root, '.openclaw-plugins'), openclawHost, console.log);
manager.setToolRegistry(registry);   // exposes plugin tools to the tool() global
```
`registerHttpRoute` calls mutate `openclawRoutes` in place — already captured by the `/api/inbound/:path` handler registered earlier, so no re-wiring is needed (`serve.ts:493-501`). A load failure is caught and warned, never crashes boot (`serve.ts:515-516`).

### The inbound-ingress fallback

`createInboundHandler(manager, lmthingRoot, pluginRoutes?)` resolves a webhook/emitter/space-trigger `binding` first; **only when no binding matches** does it consult `pluginRoutes.get(path)`, normalize the raw request into a `CompatHttpRequest` (method, path, headers, body, parsed query), invoke the plugin handler, and send its `{ status, body }` (`../../sdk/org/libs/cli/src/server/routes/webhooks.ts:111-158`). **Bindings always win** — a plugin can't shadow a real webhook-hook/space-trigger path (`webhooks.ts:108-109`). No plugin route and no binding ⇒ 404 (`webhooks.ts:157`).

---

## The `tool()` global — exposing plugin tools to agents

`tool(name, input?)` is a **value-yielding** global (like `apiCall`/`callConnection`/`fetch`): it ends the current turn and resumes once the host resolves the call (`../../sdk/org/libs/core/src/globals/tool.ts:16-28`, yield `kind:'tool'` in `eval/yield.ts:4`).

- **Injected only when the agent holds `tools:use { allow: [...] }`** (`spaces/capabilities.ts:35,100`). That capability **requires a non-empty `allow` list** — there is no "use anything" (`../../sdk/org/libs/core/src/spaces/capabilities.ts:187-203,306-313`).
- The per-grant DTS `composeToolDts(allow)` types `name` to a union of the allow-list literals, so calling an undeclared tool **fails typecheck** (`../../sdk/org/libs/core/src/typecheck/library-dts.ts:185-188`); `input`/return are `any`.
- The yield is resolved by `YieldRouterContext.toolResolver`; if absent (no pod tool registry configured), the `'tool'` case **throws a clear, retryable error** rather than binding undefined (`../../sdk/org/libs/core/src/eval/yield-router.ts:81-85,214-222`).
- The resolver is threaded into every session/fork/delegate from `appGlobals.tool` (`session.ts:879`, `fork/fork.ts:436`, `delegate/delegate.ts:347`).

Host wiring: `SessionManager.setToolRegistry(registry)` stores the registry (`../../sdk/org/libs/cli/src/server/session-manager.ts:347-349`); `withTools(appGlobals)` folds in a `tool` resolver **only when a registry is set** (else the field stays absent so the router emits the clear error) (`session-manager.ts:380-383`); `resolveTool(name, input)` dispatches to `registry.getTool(name)` — an unknown name throws (fail loud), a hit's `execute(randomUUID(), input ?? {})` result is returned verbatim (`session-manager.ts:364-374`).

---

## Packaging — must ship in the compute image

`@lmthing/openclaw-compat` is a cli dependency and **must be built + shipped** in `../../devops/argocd/compute/Dockerfile`, mirroring `@lmthing/core`:
- its `package.json` is copied pre-install (`Dockerfile:51`);
- it is built **in dependency order core → openclaw-compat → cli** (`Dockerfile:82-91`) — omitting the build "crashes the openclaw boot step with `Cannot find package '@lmthing/openclaw-compat'`" (`Dockerfile:84-87`);
- the runtime stage ships its `dist` + `package.json` **and** its `node_modules` because "openclaw-compat's dist imports esbuild at runtime (the plugin-TS transpiler)" (`Dockerfile:132-139`).

---

## Current support vs. gaps

**Functional end-to-end today:**
- `registerTool` plugins (object + factory form) → dispatchable via `tool()` (`src/api.ts:242-264`, `tool.ts`).
- `registerHttpRoute` plugins (incl. method-less) → reachable at `POST /api/inbound/<path>` (`src/api.ts:266-278`, `webhooks.ts:134-156`).
- `runtime.subagent.run` → a real, session-resuming lmthing agent (`openclaw-host.ts:112-121`).
- `registerWebSearchProvider`/`registerWebFetchProvider` carrying a `createTool` factory → also exposed as agent tools (win #2, `src/api.ts:152-190`).
- `defineBundledChannelEntry` / raw bundled-channel descriptors → loaded in **webhook-mode** (`registerFull` mounts HTTP routes) (win #3, `src/plugin-sdk-shim.ts:60-103`, `src/loader.ts:101-110`).

**Recorded-only (loads clean, not wired to a pipeline):**
- `registerProvider` (model) / `registerEmbeddingProvider` — stored in the registry, no lmthing model/embedding pipeline binding (`src/api.ts:317-325`, `types.ts:116-128`).
- `registerChannel` — recorded, no channel routing/Socket-Mode (`src/api.ts:280-307`).

**Gaps / hard constraints:**
- **Every other `register*` / namespace throws** `UnsupportedCompatError` (media/speech/image/video/embedding-catalog, `registerCli`/`registerCommand`/`registerService`/`registerMemoryCapability`/`registerAgentHarness`, `api.session`/`api.agent`/`api.lifecycle`, …) — by design (`src/api.ts:346-351`). That includes every model-provider extension built on OpenClaw's `defineSingleProviderPluginEntry` wrapper (openai/google/deepseek/…): the wrapper calls `registerModelCatalogProvider`, which is not in `IMPLEMENTED_TOP_LEVEL` and therefore resolves to a throwing proxy (`src/api.ts:27-45,346-351`).
- **npm egress** — fully as-installed plugins (`openclaw` + `@openclaw/*` + runtime deps) need npm, which this sandbox lacks; today you vendor the entry + use `moduleOverrides`/`BUILTIN_SHIMS` (`src/loader.ts:32-63`).
- **Socket/long-poll channels** (Slack Socket Mode, Telegram getUpdates, Discord gateway) need an always-on process ⇒ warm/pinned pod (paid tier); only webhook-mode channels fit wake-and-forward. The `plugin`/`runtime` specifier modules are deliberately not loaded (`src/plugin-sdk-shim.ts:52-56`).
- **Trust boundary** — plugin code is full-privilege in-proc Node, NOT QuickJS; the single-tenant pod is the mitigation (`src/index.ts:1-6`, `openclaw-host.ts` header).

---

## Testing

- Unit (co-located vitest): `pnpm --filter @lmthing/openclaw-compat test` runs `src/loader.test.ts`, `src/tavily-load.test.ts` (the real Tavily entry through compat), and `src/wins.test.ts` (the three coverage wins, with fixtures `test/bundled-channel/` + `test/raw-bundled/`).
- The synthetic `test/echo-plugin/index.ts` registers an `echo` tool + a `POST /echo` route whose handler calls `api.runtime.subagent.run(...)` (`../../sdk/org/libs/openclaw-compat/test/echo-plugin/index.ts:22-43`) — `loader.test.ts` drives that full host↔plugin loop against a fake `CompatHost`: load → tool in the registry → route mounted → invoking the handler lands in `host.runAgent` and its result comes back as the HTTP response (`src/loader.test.ts:14-35,37-68`).
- Local drive: drop a plugin under `<root>/.openclaw-plugins/<name>/` (needs `package.json#openclaw.extensions[0]` + `openclaw.plugin.json#id`), boot the pod, `POST /api/inbound/<path>`.

---

## File map

| File | Role |
|---|---|
| `../../sdk/org/libs/openclaw-compat/src/api.ts` | Proxy-backed `createCompatApi`: `IMPLEMENTED_TOP_LEVEL`, `registerTool` (object+factory), `registerHttpRoute`, `registerChannel`, provider recorders + win-#2 tool exposure, `runtime.subagent.run`, `makeUnsupportedProxy` |
| `../../sdk/org/libs/openclaw-compat/src/loader.ts` | `loadPlugin` (esbuild transpile+eval, `moduleOverrides`, `BUILTIN_SHIMS`, raw bundled-channel fallback) |
| `../../sdk/org/libs/openclaw-compat/src/types.ts` | `CompatHost`, `CompatHttpRequest/Response`, `Registered*` record shapes, `UnsupportedCompatError` |
| `../../sdk/org/libs/openclaw-compat/src/registry.ts` | `PluginRegistry` (tools map, httpRoutes/channels/providers) |
| `../../sdk/org/libs/openclaw-compat/src/plugin-sdk-shim.ts` | `definePluginEntry`, `defineBundledChannelEntry`, `applyBundledChannelDescriptor` |
| `../../sdk/org/libs/openclaw-compat/src/tavily-load.test.ts` | The real vendored Tavily entry (`test/tavily/`) loaded through `loadPlugin` + the compat api |
| `../../sdk/org/libs/openclaw-compat/src/loader.test.ts` | The echo fixture end-to-end + the `UnsupportedCompatError` fail-loud cases |
| `../../sdk/org/libs/cli/src/server/openclaw-host.ts` | `createComputeCompatHost`, `loadOpenClawPlugins`, `deterministicUuidFromKey`, `parseOpenClawAgentEnv`, `OpenClawRouteTable` |
| `../../sdk/org/libs/cli/src/server/serve.ts` | Boot-load `.openclaw-plugins/` + `setToolRegistry` + inbound-handler wiring |
| `../../sdk/org/libs/cli/src/server/routes/webhooks.ts` | Inbound `POST /api/inbound/:path` dispatcher with `pluginRoutes` fallback |
| `../../sdk/org/libs/cli/src/server/session-manager.ts` | `setToolRegistry` / `resolveTool` / `withTools` |
| `../../sdk/org/libs/core/src/globals/tool.ts` | The `tool()` value-yielding global |
| `../../sdk/org/libs/core/src/typecheck/library-dts.ts` | `composeToolDts` (allow-list DTS narrowing) |
| `../../devops/argocd/compute/Dockerfile` | Builds + ships `libs/openclaw-compat` (dist + package.json + node_modules) |
