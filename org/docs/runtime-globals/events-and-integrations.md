# Runtime globals — events, connections & the outside world

The globals an agent uses to reach **out** of the sandbox: publish an event (`emitEvent`), call a
user-connected third-party service (`callConnection`), check whether an integration is configured
(`integrationStatus`), dispatch to a host-registered OpenClaw plugin tool (`tool`), and make raw HTTP
(`fetch` — plus the `webFetch`/`webSearch` **space functions** built on top of it).

See [./README.md](./README.md) for the injection model, [../format/space/events/README.md](../format/space/events/README.md)
for the emitter-def (`events/<name>.ts`) format `emitEvent` feeds, and
[../format/space/functions/README.md](../format/space/functions/README.md) for the space-function layer
(`webSearch`/`webFetch` live there, **not** in the runtime).

---

## At a glance

| Global | Kind | Gate | Host resolver (absent ⇒ the yield rejects) |
|---|---|---|---|
| `emitEvent(name, payload)` | value **yield** `emitEvent` `sdk/org/libs/core/src/globals/emit-event.ts:56-70` | capability `events:emit` (bare) `sdk/org/libs/core/src/exec/bootstrap.ts:202-204` | `emitEventResolver` `sdk/org/libs/core/src/eval/yield-router.ts:333-344` |
| `callConnection(provider, req)` | value **yield** `callConnection` `sdk/org/libs/core/src/globals/call-connection.ts:20-33` | capability `connections:use: { providers: [...] }` — config REQUIRED `sdk/org/libs/core/src/exec/bootstrap.ts:177` | `connectionResolver` `sdk/org/libs/core/src/eval/yield-router.ts:201-213` |
| `integrationStatus(spaceId)` | value **yield** `integrationStatus` `sdk/org/libs/core/src/globals/integration-status.ts:27-40` | NOT a capability — injected whenever the VM has a `projectRoot` `sdk/org/libs/core/src/exec/bootstrap.ts:188` | `integrationStatusResolver` `sdk/org/libs/core/src/eval/yield-router.ts:237-249` |
| `tool(name, input?)` | value **yield** `tool` `sdk/org/libs/core/src/globals/tool.ts:16-29` | capability `tools:use: { allow: [...] }` — config REQUIRED `sdk/org/libs/core/src/exec/bootstrap.ts:182` | `toolResolver` `sdk/org/libs/core/src/eval/yield-router.ts:214-224` |
| `fetch(url, opts?)` | value **yield** `fetch` `sdk/org/libs/core/src/globals/fetch.ts:23-36` | none — injected in **every** VM `sdk/org/libs/core/src/exec/bootstrap.ts:159` | built in (`resolveFetchYield`) `sdk/org/libs/core/src/eval/yield-router.ts:184-189` |
| `webSearch` / `webFetch` | **space functions**, not globals `sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts` · `.../webFetch.ts` | the universal `system-global` toolkit + the `functions:` allowlists (below) | n/a — they call the `fetch` global |

All five globals **end the turn**: the model writes `const r = await callConnection(...)`, the statement is
aborted, the host resolves the yield and binds the value back host-side for the next turn
(`pushYield`, `sdk/org/libs/core/src/exec/bootstrap.ts:151-153`).

---

## `emitEvent(name, payload)` — the producer half of the event pipeline

```ts
declare function emitEvent(name: string, payload: Record<string, unknown>): Promise<{ ok: boolean; event: string }>;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:269-270` (`EVENTS_EMIT_DTS`)

`emitEvent` publishes an event **the calling scope already declared** in one of its `events/<name>.ts`
emitter defs (`emits`) — the same contract webhook/cron/db emitters are held to. It resolves to
`{ ok, event }`, where `event` is the source-qualified address subscribers match on, `<scope>/<name>`
`sdk/org/libs/core/src/globals/emit-event.ts:21-26`.

**The scope cannot be spoofed.** It is derived HOST-side at injection from the VM's `spaceDir` +
`projectRoot` and baked into the global's closure: a space dir under `<projectRoot>/spaces/<id>` emits as
`<id>`, everything else (project agents, system/user spaces, sessions outside a project) emits as
`'project'` `sdk/org/libs/core/src/globals/emit-event.ts:43-50`. The bootstrap passes
`deriveEventScope(opts.spaceDir, opts.projectRoot)` into the factory
`sdk/org/libs/core/src/exec/bootstrap.ts:202-204`, and the yield router reads `sourceScope` out of the
yield args — which the closure, not the sandbox, supplied `sdk/org/libs/core/src/eval/yield-router.ts:333-344`.

**Host resolver — 4 steps** (`createEmitEventResolver`, `sdk/org/libs/cli/src/server/emit-event.ts:57-112`):

1. **Declared-event check** against the *caller's* scope — `scanEmitterDefs(root, projectId).scopes[sourceScope].declaredEvents`; an undeclared name throws with the scope's actual contract listed `sdk/org/libs/cli/src/server/emit-event.ts:63-73`.
2. **Payload-schema check** via the shared `validateEmitted` — a mismatch **throws** ("payload … does not match its declared schema") `sdk/org/libs/cli/src/server/emit-event.ts:75-82`.
3. **Depth cap** on the manual cascade, in lockstep with the hook loop guard (`HOOK_DEPTH_CAP`): an emit whose subscribers' agent runs emit again is refused once the chain is CAP deep. The counter is **pod-wide** (one per `SessionManager`) because a nested emit arrives through a *different* session's resolver `sdk/org/libs/cli/src/server/emit-event.ts:31-34,84-91` · `sdk/org/libs/cli/src/server/session-manager.ts:392-396`.
4. **Dispatch** to subscribing event hooks via `dispatchEmittedEvents`, **awaited** — so the agent's `{ ok: true }` truthfully means "subscribers ran" `sdk/org/libs/cli/src/server/emit-event.ts:96-110`.

The resolver is wired only for **project-rooted** sessions (`withStore` needs `lmthingRoot` + `projectId`)
`sdk/org/libs/cli/src/server/session-manager.ts:404-425`; elsewhere the yield rejects with
`emitEvent is not available here: no event resolver configured (project-rooted sessions only)`
`sdk/org/libs/core/src/eval/yield-router.ts:338-340`.

Real grant + wrapper (`store/spaces/integration-lmthing/agents/publisher/instruct.md:1-17`):

````md
---
title: lmthing Events
functions:
  - publishEvent
capabilities:
  - events:emit
---
Call `publishEvent(name, payload)` — a thin wrapper over the `emitEvent` global (your `events:emit`
capability). Subscribers address it as `integration-lmthing/<name>`…
````

```ts
export async function publishEvent(name: string, payload: Record<string, unknown>): Promise<void> {
  await emitEvent(name, payload);
}
```
`store/spaces/integration-lmthing/functions/publishEvent.ts:15-17`

> That function's docstring says a payload mismatch is "dropped with a warning". The pod resolver
> **throws** on a mismatch (`sdk/org/libs/cli/src/server/emit-event.ts:77-82`) — the drop-with-warn
> behaviour belongs to the *emitter-def* dispatch path, not to a manual `emitEvent`.

`events:emit` is **bare-only** — a config payload is a load error `sdk/org/libs/core/src/spaces/capabilities.ts:66-74,278-286`.
It is also **dropped for read-only fork roles** (`explore`/`plan`), since emitting triggers hooks
`sdk/org/libs/core/src/exec/capability.ts:16-28`.

---

## `callConnection(provider, req)` — user-connected external services

```ts
// composeConnectionsDts(['discord']) →
declare function callConnection(provider: 'discord', req: { method: string; path: string; query?: Record<string, string>; body?: unknown; headers?: Record<string, string> }): Promise<{ ok: boolean; status: number; data: any }>;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:170-173`

The `provider` parameter is typed to the **union of the granted providers**, so a call to a provider the
agent did not declare fails *typecheck*, not at runtime `sdk/org/libs/core/src/typecheck/library-dts.ts:170-173`
· `sdk/org/libs/core/src/exec/bootstrap.ts:300-302`. The grant's `providers` list is **required** — a bare
`connections:use` is a fail-loud space-load error ("there is no 'connect to anything'")
`sdk/org/libs/core/src/spaces/capabilities.ts:210-229,296-304`.

### The token never enters the sandbox

The sandbox supplies only `provider` + `{ method, path, query?, body?, headers? }`; the pod attaches the
credential and pins the host `sdk/org/libs/core/src/globals/call-connection.ts:16-19`.

The pod resolver (`createConnectionResolver`, `sdk/org/libs/cli/src/server/connections.ts:341-381`) is
**bring-your-own-token**: it looks the token up in `process.env` by the provider's `tokenEnv` (set from
Settings → Integrations), applies the provider's auth style, and calls the REST API **directly**
`sdk/org/libs/cli/src/server/connections.ts:9-31`.

> Core's own docstring still describes a "gateway egress proxy"
> (`sdk/org/libs/core/src/globals/call-connection.ts:16-18`). That is stale: the pod resolver makes the
> call itself, with no gateway round-trip `sdk/org/libs/cli/src/server/connections.ts:14-16`.

Providers resolve in two tiers `sdk/org/libs/cli/src/server/connections.ts:41-75`:

- **Built-ins** — `slack` (`https://slack.com/api`, `SLACK_BOT_TOKEN`), `github` (`https://api.github.com`, `GITHUB_TOKEN`), `google` (`https://www.googleapis.com`, `GOOGLE_ACCESS_TOKEN`); all Bearer `sdk/org/libs/cli/src/server/connections.ts:41-45`.
- **Installed integration spaces** — any space whose `package.json` declares an `lmthing.connection` descriptor, discovered by scanning `<projectRoot>/spaces/` `sdk/org/libs/cli/src/server/connections.ts:60-75`. Adding a platform is a new space folder, not a code edit.

Real descriptor (`store/spaces/integration-discord/package.json:20-25`):

````json
"connection": {
  "provider": "discord",
  "apiBase": "https://discord.com/api/v10",
  "tokenEnv": "INTEGRATION_DISCORD_BOT_TOKEN",
  "auth": { "kind": "bot" }
}
````

Auth styles: `bearer`, `bot`, `basic` (`userEnv` + token), `query-token` (`param`), `nextcloud-bot`
(HMAC over `random + signedContent`), `none` `sdk/org/libs/cli/src/server/connections.ts:239-283`.
`apiBase` may be `{ env, suffix }` (self-hosted servers) or a string with `{token}` / `{env:VAR}`
placeholders `sdk/org/libs/cli/src/server/connections.ts:224-236`.

A space function is the idiomatic wrapper (`store/spaces/integration-discord/functions/discordCreateMessage.ts:11-18`):

````ts
export async function discordCreateMessage(channelId: string, content: string): Promise<any> {
  const r = await callConnection('discord', {
    method: 'POST',
    path: `/channels/${channelId}/messages`,
    body: { content },
  });
  return r.data;
}
````

…and the agent that exposes it declares exactly one provider
(`store/spaces/integration-discord/agents/discord/instruct.md:15`):

````yaml
capabilities:
  - connections:use: { providers: [discord] }
````

### Host pinning + SSRF guards

All in `sdk/org/libs/cli/src/server/connections.ts`:

| Guard | Behaviour |
|---|---|
| **Relative path only** | an absolute / scheme / protocol-relative `path` is rejected — `callConnection: path must be relative to the provider apiBase` (lines 285-292), so the agent can't redirect the credential at an attacker host |
| **Base-URL allowlist** | `assertSafeBaseUrl` — http(s) only; rejects `localhost`, `*.local` / `.internal` / `.svc` / `.cluster.local`, bare single-label hostnames (cluster services), and private/loopback/link-local IPs incl. `169.254.169.254` (lines 91-144) |
| **DNS-rebinding pre-check** | `assertResolvedHostSafe` resolves the hostname and rejects if *any* address is internal (lines 146-166) |
| **Connect-time IP pinning** | an undici `Agent` whose `lookup` fails a private IP at connect time, closing the resolve-vs-connect TOCTOU; falls back to plain `fetch` when undici isn't resolvable (lines 174-208, 324-331) |
| **Header stripping** | caller-supplied `authorization` / `host` headers are dropped (lines 297-303) |
| **Secret redaction** | the token's literal value is stripped from any error message (token-in-path providers, e.g. Telegram `…/bot<token>/…`) (lines 210-216, 366) |
| **Timeout** | `AbortSignal.timeout(25_000)` (lines 33, 329) |
| **Escape hatch** | `LMTHING_ALLOW_INTERNAL_CONNECTIONS=1` disables the internal-host checks for that pod only (lines 140, 152, 200) |

Errors are thrown, never silently bound: an unknown provider lists the supported set; an unset token gives
`callConnection("<p>"): not configured — set <TOKEN_ENV> in Settings → Integrations`
`sdk/org/libs/cli/src/server/connections.ts:342-354`.

### Beyond the agent sandbox

The same resolver backs **tasklist code nodes**, where `ctx.callConnection` is further locked to the
tasklist's declared `connections:` **∩** the owning space's own provider(s) — an out-of-scope provider
throws `callConnection("x"): not allowed for tasklist "<name>"`
`sdk/org/libs/cli/src/server/tasklist-runner.ts:86-127`. Hook handlers get the same shape, gated by the
hook def's `connections:` `sdk/org/libs/cli/src/app/hooks/loader.ts:90,116,146,500-505`.

---

## `integrationStatus(spaceId)` — presence-only config check

```ts
declare function integrationStatus(spaceId: string): Promise<{ ready: boolean; missingRequired: string[] }>;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:98-101`

`missingRequired` lists the **NAMES** of required settings env vars that are unset — never any values, so a
secret can never reach the LLM context `sdk/org/libs/core/src/globals/integration-status.ts:3-10`. This is
what lets an agent say *"Discord needs `INTEGRATION_DISCORD_BOT_TOKEN` — set it in Settings → Integrations"*
without ever seeing a token.

It is **not** capability-gated: it is injected whenever the VM has a `projectRoot`
`sdk/org/libs/core/src/exec/bootstrap.ts:183-188`, and its DTS lives in `COMMON_DTS` (declared
unconditionally) `sdk/org/libs/core/src/typecheck/library-dts.ts:98-101` — one of the documented
inject ≠ DTS exceptions in [./README.md](./README.md). Outside a project the yield rejects with
`integrationStatus is not available here: no project scope configured`
`sdk/org/libs/core/src/eval/yield-router.ts:243-245`.

Resolver: `integrationStatusFor(projectDir, spaceId)` reads `<projectDir>/spaces/<spaceId>/package.json`,
requires `lmthing.kind === 'integration'`, and diffs the settings schema's `required` keys against
`process.env` `sdk/org/libs/cli/src/server/routes/store-spaces.ts:501-518`. It is wired only for
project-rooted sessions `sdk/org/libs/cli/src/server/session-manager.ts:453-458`. The keys it checks are
exactly the settings-schema properties an integration space declares
(`store/spaces/integration-discord/package.json:11-19`), which are also the pod env-var names the
Chat/Studio Integrations tab writes — see [../chat/features.md](../chat/features.md) and
[../cli-api/rest/store-spaces.md](../cli-api/rest/store-spaces.md).

---

## `tool(name, input?)` — OpenClaw plugin tools

```ts
// composeToolDts(['searchIssues']) →
declare function tool(name: 'searchIssues', input?: any): Promise<any>;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:185-188`

Like `callConnection`, `name` is narrowed to the granted **allow-list union**, so calling an undeclared
tool fails typecheck `sdk/org/libs/core/src/typecheck/library-dts.ts:175-188` ·
`sdk/org/libs/core/src/exec/bootstrap.ts:303-305`. The `allow` list is required — a bare `tools:use` is a
fail-loud error ("there is no 'use anything'") `sdk/org/libs/core/src/spaces/capabilities.ts:188-207,306-315`:

```yaml
capabilities:
  - tools:use: { allow: [webSearch] }   # host-tool allowlist (required)
```
`sdk/org/libs/core/src/spaces/capabilities.ts:8-16`

The host side is the **OpenClaw compat** registry: at boot the pod loads `<root>/.openclaw-plugins/` via
`loadOpenClawPlugins` and hands the resulting `PluginRegistry` to `manager.setToolRegistry(registry)`
`sdk/org/libs/cli/src/server/serve.ts:505-509` · `sdk/org/libs/cli/src/server/session-manager.ts:347-349`.
`resolveTool` then dispatches by name — `tool.execute(randomUUID(), input ?? {})`, returning the plugin's
result verbatim; an unknown name throws
`tool("<n>") not found: no OpenClaw plugin registered a tool with that name`
`sdk/org/libs/cli/src/server/session-manager.ts:364-374`. A pod with no `.openclaw-plugins/` dir never sets
the registry, so `withTools` leaves the field absent and the yield rejects with
`tool() is not available here: no tool registry configured`
`sdk/org/libs/cli/src/server/session-manager.ts:376-383` · `sdk/org/libs/core/src/eval/yield-router.ts:218-220`.

**What the pod dispatches *to*.** A plugin directory needs a `package.json` whose `openclaw.extensions[0]`
names the entry file, plus an `openclaw.plugin.json` carrying an `id` — either one missing is a fail-loud
load error `sdk/org/libs/openclaw-compat/src/loader.ts:76-89`. `loadPlugin` transpiles the entry, takes its
default export, and calls `register(api)` on it (the `definePluginEntry({ id, register })` shape)
`sdk/org/libs/openclaw-compat/src/loader.ts:91-99`. Inside `register`, a tool is declared with
`api.registerTool({ name, execute })` — OpenClaw's factory form `registerTool((ctx) => tool, { name })` is
also accepted; a tool with no `execute()` function, or with no resolvable name, throws
`sdk/org/libs/openclaw-compat/src/api.ts:242-264`. The call records `{ name, description, parameters,
execute }` into the `PluginRegistry`, which **rejects a duplicate tool name**
`sdk/org/libs/openclaw-compat/src/registry.ts:17-23` — and that registry's `getTool(name)` is exactly what
the pod's `resolveTool` looks up `sdk/org/libs/cli/src/server/session-manager.ts:368-374`.

Full library reference (the fail-loud `api` Proxy, `registerHttpRoute`, channels, providers, the
`CompatHost` seam) → [../libs/openclaw-compat.md](../libs/openclaw-compat.md).

---

## `fetch(url, opts?)` — raw HTTP, universal

```ts
declare function fetch(url: string, opts?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ ok: boolean; status: number; text(): string; json(): unknown }>;
```
`sdk/org/libs/core/src/typecheck/library-dts.ts:96`

`fetch` is **not** capability-gated — it is injected into every VM (session, fork, delegate)
`sdk/org/libs/core/src/exec/bootstrap.ts:159` and declared in `COMMON_DTS`. It is a real **value yield**:
the host resolves it with non-blocking Node `fetch()`, bounded by `AbortSignal.timeout(25_000)`, buffering
the body once so `text()`/`json()` stay *synchronous* accessors
`sdk/org/libs/core/src/eval/fetch-yield.ts:9-30` · `sdk/org/libs/core/src/eval/yield-router.ts:184-189`.

Two behaviours worth knowing:

- **It never throws.** A network failure or timeout returns `{ ok: false, status: 0, text: () => '', json: () => ({}) }` `sdk/org/libs/core/src/eval/fetch-yield.ts:27-29`.
- **It replaced `execSync(curl)`.** The old primitive blocked the single Node thread for the whole request, which also defeated the per-stream idle watchdog `sdk/org/libs/core/src/globals/fetch.ts:16-22`. (`execShell` *is* still synchronous and still blocks the loop — see [./session-and-utils.md](./session-and-utils.md).)

There is **no SSRF guard on `fetch`** — the allowlist/pinning machinery above is specific to
`callConnection`, because that is the path that carries a credential
(`sdk/org/libs/cli/src/server/connections.ts:84-144`).

### Host-tools substrate (context)

`fetch` sits alongside the synchronous host substrate injected by `injectHostTools` — `console`,
`process`, `progress`, `spacePath`, `resolveSpaceDir`, `typecheckSource`, plus the now
**internal-only** `execShell`/`readFileRaw`/`writeFileRaw` primitives (bound but absent from the
model DTS) `sdk/org/libs/core/src/globals/host-tools.ts:150-275`. Two facts matter for integrations:

- **`process.env` is a snapshot copy of the pod env** (undefined values filtered out) plus `LMTHING_SPACE_DIR`, and `LMTHING_PROJECT_SPACES_DIR` / `LMTHING_PROJECT_DIR` / `LMTHING_PROJECT_ID` when supplied `sdk/org/libs/core/src/globals/host-tools.ts:135-147`. **So `process.env` inside the sandbox DOES see integration tokens.** The "token never enters the sandbox" property is about `callConnection`/`integrationStatus` specifically, not about `process.env`. Space functions read keys from it directly — e.g. `webSearch` reads `TAVILY_API_KEY` `sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts:30`.
- **Read-only roles lose the write primitives.** Under `allowWrite: false` (`explore`/`plan` fork roles) mutating shell commands are refused with exit code 126 and `writeFileRaw` is a no-op, with both DTS fragments withheld `sdk/org/libs/core/src/globals/host-tools.ts:58-76,114-116,190-193` · `sdk/org/libs/core/src/typecheck/library-dts.ts:110-117`.

Full host-tools reference → [./session-and-utils.md](./session-and-utils.md).

---

## `webSearch` / `webFetch` are SPACE FUNCTIONS, not globals

They live in the `system-global` space
(`sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts`, `.../webFetch.ts`) and are built
**on top of** the `fetch` global — the runtime stays a thin substrate and capabilities live in spaces
`sdk/org/libs/core/src/spaces/system.ts:19-21`. Their DTS comes from the function overlay, not
`library-dts.ts`. Format → [../format/space/functions/README.md](../format/space/functions/README.md).

**`webSearch(query, opts?)`** → `{ ok, query, answer, results[], error? }`; `opts.provider` (default
`'auto'`) `sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts:12-55`:

| provider | key / service | notes |
|---|---|---|
| `tavily` | `TAVILY_API_KEY` | the only one with an AI `answer`; supports `topic: 'news'` + `timeRange` |
| `bing` | `RENDER_SERVICE_URL` (in-cluster headless Chromium, `RENDER_SERVICE_TOKEN`) | renders the results page with JS and scrapes it; no key, no `answer` |
| `duckduckgo` | none | scrapes the no-JS HTML endpoint; always-available last resort |
| `auto` (default) | — | Tavily (when keyed) → Bing (when the render service is set) → DuckDuckGo; first with results wins |

`sdk/org/libs/core/system-spaces/system-global/functions/webSearch.ts:35-55,112-120,202-209`

**`webFetch(url, opts?)`** → `{ ok, status, content, truncated, rendered?, error? }`. `format` is `'text'`
(default — tags stripped) / `'markdown'` (keeps headings, links, structure) / `'html'`; `render`
(`'auto'` default / `'force'` / `'off'`) controls the fallback to the same in-cluster render service, used
when a plain fetch returns an empty SPA shell or is bot-walled (403/429). The fallback is a no-op when
`RENDER_SERVICE_URL` is unset `sdk/org/libs/core/system-spaces/system-global/functions/webFetch.ts:1-42`.

### How functions are gated (the `functions:` allowlists)

Three distinct mechanisms — **none** of them is a `capabilities:` grant:

1. **`system-global` is universal.** Only that one space's functions are injected into every agent's VM (`systemFunctionSources` filters on `GLOBAL_SPACE_NAME`) `sdk/org/libs/core/src/spaces/system.ts:26-27,87-95` · `sdk/org/libs/core/src/session/session.ts:595-624`. Every *other* system space's functions reach an agent only through the per-agent path. That is why `webSearch`/`webFetch`/`todoWrite`/`remember` need no declaration. (The generic fs wrappers `readFile`/`grep` are **no longer** in `system-global` — they moved to `system-engineer`, scoped to the engineer's `fs:scratch` sandbox.)
2. **An agent's own space functions are opt-in** via `functions:` in `agents/<slug>/instruct.md` frontmatter: only the listed names are injected and shown in the prompt `sdk/org/libs/core/src/spaces/load.ts:474` · `sdk/org/libs/core/src/spaces/agent.ts:17-25`, and a name with no matching `functions/<name>.ts` is a fail-loud load error (`Agent "x" requires function "y" but it was not found in functions/`) `sdk/org/libs/core/src/spaces/load.ts:685-689`.
3. **A tasklist task narrows the set for its fork.** `functions: [...]` in a task's frontmatter is an allowlist intersected against the parent agent's *injected* set `sdk/org/libs/core/src/spaces/tasklist-load.ts:30-32,136-137` · `sdk/org/libs/core/src/fork/fork.ts:247-260`. Because the parent's set is the **merged** map (system toolkit + project functions + space functions) `sdk/org/libs/core/src/session/session.ts:620-623,746-747`, **`functions: []` means no functions at all — `webSearch`/`webFetch` included.** Never forbid a tool in prose; disable it in frontmatter.

---

## Failure contract (the resolver seam)

A gated global can be **injected and typed** yet still have no host resolver (a session outside a project,
a bare unit test, a pod with no plugin registry). It then **rejects with a specific, retryable error**
rather than binding `undefined`, so the model sees the message and can adapt
(`sdk/org/libs/core/src/eval/yield-router.ts`):

| Global | Error string | Line |
|---|---|---|
| `callConnection` | `callConnection is not available here: no connection resolver configured` | 208 |
| `tool` | `tool() is not available here: no tool registry configured` | 219 |
| `integrationStatus` | `integrationStatus is not available here: no project scope configured` | 244 |
| `emitEvent` | `emitEvent is not available here: no event resolver configured (project-rooted sessions only)` | 339 |

In practice `callConnection`'s resolver is folded into **every** session (`withConnections` — the built-in
providers work even project-less) `sdk/org/libs/cli/src/server/session-manager.ts:333-341`; `tool` exists
only when a plugin registry loaded `sdk/org/libs/cli/src/server/session-manager.ts:376-383`; `emitEvent`
and the store resolvers only for project-rooted sessions
`sdk/org/libs/cli/src/server/session-manager.ts:404-425`.

---

## Capability cheat-sheet

```yaml
capabilities:
  - connections:use: { providers: [google, slack] }   # → callConnection, provider union typed
  - tools:use: { allow: [webSearch] }                 # → tool, name union typed
  - events:emit                                       # → emitEvent (bare; a config is an error)
```
`sdk/org/libs/core/src/spaces/capabilities.ts:8-16,66-74`

- Not granted ⇒ **not injected AND absent from the DTS** — a stray call is a typecheck error ("Cannot find name"), not a runtime throw `sdk/org/libs/core/src/exec/bootstrap.ts:170-204,282-313`.
- Read-only fork roles (`explore`/`plan`) **keep** `connections:use` + `tools:use` (treated as outbound, like `api:call`) but **lose `events:emit`** `sdk/org/libs/core/src/exec/capability.ts:4-28`.
- `integrationStatus` and `fetch` have **no capability** at all.

Full capability list + frontmatter rules → [../format/space/agents/capabilities.md](../format/space/agents/capabilities.md).
Emitter-def authoring (what `emitEvent` may publish) → [../format/space/events/README.md](../format/space/events/README.md).
