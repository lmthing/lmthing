# `system-spaces/` — the shipped system spaces

The **ten** spaces that ship inside `@lmthing/core` and are loaded into **every** session, fork and delegate. They are what makes an empty project already able to think: THING orchestrates, the architect builds new agents, the appbuilder builds apps, the researcher searches, the engineer codes, and a universal function toolkit (`webSearch`/`remember`/`todoWrite`/…) is in scope everywhere.

They live at `sdk/org/libs/core/system-spaces/<name>/` — **not** under `src/`; they are read from disk at runtime, so editing an `.md` or a builder `.ts` needs no rebuild of `@lmthing/core` (`sdk/org/libs/core/src/spaces/system.ts:L50-L58` resolves the dir relative to the built/`src` layout).

- The **on-disk format** of any space (agents, tasklists, knowledge, functions, components, events) → [`../format/space/README.md`](../format/space/README.md). This page does not restate it.
- The **loader** that turns a directory into a `Space` → [`../runtime/spaces-loading.md`](../runtime/spaces-loading.md).
- The **globals** these agents call → [`../runtime-globals/README.md`](../runtime-globals/README.md).
- **Adding/changing** a space → [`../contributing/add-a-space.md`](../contributing/add-a-space.md).

---

## 1. What a system space IS

A system space is an ordinary space directory — same format, same loader — with four differences, all implemented in `sdk/org/libs/core/src/spaces/system.ts`:

| | System space | User / project space |
|---|---|---|
| **Where it comes from** | shipped in `@lmthing/core`, listed by name in `SYSTEM_SPACE_NAMES` (`sdk/org/libs/core/src/spaces/system.ts:L30-L41`), materialized onto the pod at `<root>/system/spaces/<name>/` (`sdk/org/libs/cli/src/cli/runtime-init.ts:L89-L104`) | authored by the user (or installed from the store) under `<root>/<projectId>/spaces/<id>/` (`sdk/org/libs/cli/src/server/projects.ts:L147-L151`) |
| **When it loads** | **always** — `loadSystemSpaces(dirs)` runs on every session start and the result is merged into the user space by `mergeSystemInto` (`sdk/org/libs/core/src/session/session.ts:L579-L581`) | only when it is the session's space, or pre-loaded/registered for `delegate()` |
| **Agent reachability** | every system agent is **universally delegatable** — the session seeds the delegate registry with every system space, keyed by dir and package name (`sdk/org/libs/core/src/session/session.ts:L930-L933`), and the same map is handed down the delegation chain (`sdk/org/libs/core/src/session/session.ts:L687-L707`) | reachable only from the current space, its npm-dependent spaces, or via `registerSpace()` (`registered:*`) |
| **Function reachability** | **only `system-global`'s functions are universal** (`GLOBAL_SPACE_NAME`, `sdk/org/libs/core/src/spaces/system.ts:L27`; `systemFunctionNames`/`systemFunctionSources` skip every non-global space, `:L78-L95`). Every other system space's functions are **scoped to its own agents** via that agent's `functions:` frontmatter (`getAgentFunctions`, `sdk/org/libs/core/src/delegate/delegate.ts:L180-L184`) | scoped to the space's own agents, always |

Two more rules that only matter here:

- **Function-only spaces are legal.** `loadSystemSpaces` calls `loadSpace(dir, { requireAgents: false })`, so a space with no `agents/` (i.e. `system-global`) loads instead of throwing (`sdk/org/libs/core/src/spaces/system.ts:L60-L70`).
- **The user space wins on a name collision — except empty placeholders.** `mergeSystemInto` overlays the user space on top of the system spaces, but an *empty* user agent (an `agents/<slug>/` dir with no `instruct.md` ⇒ no `instructBody`, no actions) or an *empty* user tasklist dir (no `.md` files) does **not** shadow the real system one (`sdk/org/libs/core/src/spaces/system.ts:L140-L155`). That silent shadowing once stripped the system `architect` of its instructions, actions and `defaultAction`.

**Capabilities are spaces, not ad-hoc core globals.** The runtime stays a thin substrate; the host primitives the system functions wrap (`readFileRaw`, `writeFileRaw`, `execShell`, `fetch`) are injected separately by `host-tools.ts` (`sdk/org/libs/core/src/spaces/system.ts:L7-L21`) — but as **internal** primitives, absent from every agent's model DTS; the only one that reaches model code is `execShell`, and only under the engineer's `fs:scratch` scratch sandbox (`sdk/org/libs/core/src/exec/bootstrap.ts:L146-L167`).

---

## 2. The ten spaces

`SYSTEM_SPACE_NAMES` (`sdk/org/libs/core/src/spaces/system.ts:L30-L41`), asserted to be exactly ten by `sdk/org/libs/core/src/spaces/system.test.ts:L60`:

| Space | Agent(s) | Actions | What it is for |
|---|---|---|---|
| **`system-global`** | *(none — function-only)* | — | The **universally injected toolkit**: 8 functions, in scope in every agent, fork and delegate (§3). |
| **`system-engineer`** | `engineer` | *(none — model-driven)* | Drafts/fixes/**verifies** code in a private **scratch sandbox** — `createScratch()` first, then a jailed `readFile`/`writeFile`/`editFile`/`listDir`/`glob`/`grep` + `execShell` (absolute/`..` paths rejected), with `fork({role:'explore'\|'plan'})` for heavy investigation (`sdk/org/libs/core/system-spaces/system-engineer/agents/engineer/instruct.md:L28-L45`). It does **not** read or write the live project; it **returns** the finished code to its caller via `currentTask.resolve({ ok, kind:'projectFunction'\|'code', code, suggestedName?, notes? })`, and the caller persists it with a typed writer (`:L73-L98`). Holds `fs:scratch` only — no `writeProjectFunction`. |
| **`system-architect`** | `architect` | `synthesize_and_run` *(default)*, `iterate_space` | The **meta-agent that builds other agents**. Its two jobs are two fixed 2-statement programs; the real work happens inside the tasklists (§6). Owns 13 scoped builder functions: `writeAgentFile`, `writeTaskFile`, `writeKnowledgeIndex`, `writeKnowledgeOption`, `writeFunctionFile`, `writeComponentFile`, `writeEventFile`, `writeHookFile`, `writeManifest`, `readSpaceFile`, `listSpaceDir`, `validateSpace`, `listScaffoldedSpaces` (`sdk/org/libs/core/system-spaces/system-architect/agents/architect/instruct.md:L5-L18`). Knowledge: `space_format/frontmatter`. |
| **`system-research`** | `researcher` | `research` *(default)*, `deep_research` | Web research. `research` = one search + one fetch + a concise sourced answer; `deep_research` = a 5-stage cited-report pipeline (`sdk/org/libs/core/system-spaces/system-research/agents/researcher/instruct.md:L6-L16`). Ships **no functions of its own** — its tasks reach the web through `system-global`'s `webSearch`/`webFetch`, allow-listed per task. |
| **`system-appbuilder`** | `app-architect` | `build_app` *(default)* | Builds a whole application — **the store-catalog template path**. Runs the `build_app` tasklist and reports; may delegate one slice to a specialist (`sdk/org/libs/core/system-spaces/system-appbuilder/agents/app-architect/instruct.md:L29-L54`). |
| | `automator` | *(none — model-driven)* | Builds/extends the app **in the LIVE project**: `writeProjectTable` (with a third `rows` arg that seeds data at creation), `writeProjectHook`, `writeProjectEvent`, `writeProjectApi`, `writeProjectPage` (`sdk/org/libs/core/system-spaces/system-appbuilder/agents/automator/instruct.md:L16-L33`). This is THING's default app path. |
| | `data-modeler` | *(none)* | One slice: JSON table schemas via `writeTableSchema(name, schema)`; every table/column/relation carries a real `description` (`sdk/org/libs/core/system-spaces/system-appbuilder/agents/data-modeler/charter.md:L1-L6`). |
| | `api-author` | *(none)* | One slice: typed handlers via `writeApi('<route>/<METHOD>', src)`, exporting `name`/`description`/`Input`/`Output` + a default `async (input, ctx)` using `ctx.db` (`sdk/org/libs/core/system-spaces/system-appbuilder/agents/api-author/instruct.md:L13-L30`). |
| | `page-builder` | *(none)* | One slice: React pages via `writePage(route, src)`, design tokens only, data through `@app/runtime` (`sdk/org/libs/core/system-spaces/system-appbuilder/agents/page-builder/charter.md:L1-L8`). |
| **`system-vision`** | `vision` | *(none)* | Looks at attached **images** and answers from what is visible; runs on a vision model (`model: vision` frontmatter, `sdk/org/libs/core/system-spaces/system-vision/agents/vision/instruct.md:L1-L6`). Resolves plain text for the caller to relay (`:L13-L17`). |
| **`system-files`** | `dispatch` | *(none)* | Routes attached **files** by mediaType: tabular → `sheet`, everything else → `reader`; delegates once per group with the full id list, in parallel (`sdk/org/libs/core/system-spaces/system-files/agents/dispatch/instruct.md:L19-L43`). Runs on `model: M`. |
| | `reader` | *(none)* | Answers about PDF/Word/PowerPoint/OpenDocument/text/Markdown/JSON/code attachments, read via `await readDocument(id)`. Knowledge: `documents/formats`. |
| | `sheet` | *(none)* | Answers about CSV/TSV/XLSX/XLS/ODS attachments (host-extracted to CSV text). Knowledge: `documents/tabular`. |
| **`system-store`** | `finder` | *(none)* | Searches the **store catalog** with `storeSearch`/`storeInspect` and judges FIT from catalog data alone, returning ONE recommendation `{ fit, spaceId, title, why, emits, actions, requiredSettings, verified }` or `{ fit:false, reason }` (`sdk/org/libs/core/system-spaces/system-store/agents/finder/instruct.md:L42-L76`). **It never installs** — THING does, behind a consent card (`:L11-L15`). |
| **`user-memory`** | `memory` | *(none)* | Durable facts about the user across sessions and projects, via `remember`/`recall`/`recallAll`/`forget`; always ends with `currentTask.resolve(...)` (`sdk/org/libs/core/system-spaces/user-memory/agents/memory/instruct.md:L14-L35`). Because a delegate runs with the **target** space's dir as `LMTHING_SPACE_DIR` (`sdk/org/libs/core/src/delegate/delegate.ts:L197`, `sdk/org/libs/core/src/globals/host-tools.ts:L137`), the store lands at `<user-memory space>/.lmthing/memory.json` (`sdk/org/libs/core/system-spaces/system-global/functions/remember.ts:L3`) — i.e. shared across every project. |
| **`user-thing`** | `thing` | *(none — model-driven)* | **THE user-facing orchestrator** (§4). Default agent of every project session (`sdk/org/libs/cli/src/server/session-manager.ts:L1110`). Ships the `build_specialist` tasklist. |

Every agent above ships both `charter.md` (fork-safe identity + a never-fabricate guardrail, injected into the top-level prompt **and every fork**) and `instruct.md` (frontmatter + top-level orchestration body) — the split is documented in [`../format/space/agents/charter-file.md`](../format/space/agents/charter-file.md) and [`../format/space/agents/instruct-file.md`](../format/space/agents/instruct-file.md).

> **Not system spaces:** `integration-google` / `integration-slack` / `integration-github` (and the other messaging integrations). They are **store-installable** spaces, explicitly asserted absent from `defaultSystemSpaceDirs()` (`sdk/org/libs/core/src/spaces/system.test.ts:L60-L62`). A project installs the ones it needs and reaches them via `registered:*`.

---

## 3. `system-global` — the universal toolkit

The one function-only space. Its 8 functions are injected into every session, delegate and fork VM, and into their typecheck overlays; the exact set is pinned by `sdk/org/libs/core/src/spaces/system.test.ts:L24-L30`:

| Function | What it does |
|---|---|
| `webSearch(query, opts?)` | Ranked web results (Tavily / Bing-render / DuckDuckGo; `provider: 'auto'` by default) (`webSearch.ts:L1-L3`) |
| `webFetch(url, opts?)` | Fetch a URL; HTML reduced to text, or `{format:'markdown'}` to keep structure (`webFetch.ts:L1-L3`) |
| `remember(key, value)` / `recall(key)` / `recallAll()` / `forget(key)` | Durable JSON facts at `<spaceDir>/.lmthing/memory.json` (`remember.ts:L1-L3`) |
| `todoWrite(items)` / `todoRead()` | The soft checklist, persisted to `.lmthing/todos.json` (`todoWrite.ts:L1`) |

Two consequences worth knowing:

- **`webSearch`/`webFetch` are plain `async function`s that `await fetch(...)` internally, and `fetch` is a value-YIELDING global** — it ends the turn and resumes when the host's real async `fetch()` settles (`sdk/org/libs/core/src/globals/fetch.ts:L16-L30`). It is **not** the old synchronous `execSync(curl …)` primitive; nothing blocks the Node thread for the duration of a request.
- A task can withhold the toolkit: tasklist frontmatter `functions: []` means **no functions at all**, including `webSearch`/`webFetch` (see [`../runtime/fork-and-tasklists.md`](../runtime/fork-and-tasklists.md)).

---

## 4. THING (`user-thing`) — triage and delegation

### 4.1 `canDelegateTo`

THING's `instruct.md` frontmatter declares a **hard allowlist** — an explicit list is enforced at yield time, and a violating `delegate()` throws an actionable error naming the allowed targets (`sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:L9-L19`):

```mermaid
flowchart LR
  THING["user-thing/thing<br/>capabilities: store:read, store:install"]
  THING --> R["system-research/researcher<br/>research · deep_research"]
  THING --> A["system-architect/architect<br/>synthesize_and_run · iterate_space"]
  THING --> E["system-engineer/engineer"]
  THING --> AA["system-appbuilder/app-architect<br/>build_app"]
  THING --> AU["system-appbuilder/automator"]
  THING --> F["system-store/finder"]
  THING --> V["system-vision/vision"]
  THING --> D["system-files/dispatch"]
  THING --> M["user-memory/memory"]
  THING --> REG["registered:* — anything registerSpace()d<br/>(built specialists, installed store spaces)"]
  D --> RD["system-files/reader"]
  D --> SH["system-files/sheet"]
  A --> R
  A --> REG
  AA --> AU
  AA --> DM["system-appbuilder/data-modeler"]
  AA --> PB["system-appbuilder/page-builder"]
  AA --> AP["system-appbuilder/api-author"]
  AA --> R
```

`registered:*` is what lets THING (and the architect) **run a freshly built or freshly installed agent** without being granted `*` (`sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:L19`; `sdk/org/libs/core/system-spaces/system-architect/agents/architect/instruct.md:L25-L27`). The `system-files/dispatch` fan-out is declared on the dispatcher itself (`sdk/org/libs/core/system-spaces/system-files/agents/dispatch/instruct.md:L5-L7`), and the app-architect's fan-out on itself (`sdk/org/libs/core/system-spaces/system-appbuilder/agents/app-architect/instruct.md:L20-L25`).

### 4.2 The seven triage paths

The shipped instruct defines **seven** numbered paths (`sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md:L114-L367`). A request may name more than one deliverable, and then THING must do each — collapsing an "X **AND** Y" request into one is a stated failure (`:L116-L123`).

| # | Path | Trigger | What THING emits |
|---|---|---|---|
| 1 | **Answer directly** | general knowledge, conversation, reasoning | `display(...)`, no delegation — the default for most messages (`:L125-L127`) |
| 2 | **Research the web** | current/external facts **as the final answer** | `delegate('system-research','researcher','research',{query})`; `deep_research` **only on explicit request** ("deep"/"thorough"/"comprehensive"/report) — it costs ~10× more (`:L129-L158`) |
| 3 | **Build a new specialist** | the user wants a **reusable agent/tool/workflow** | two turns: `await tasklist('build_specialist',{request})`, then `delegate(b.data.spaceKey, b.data.agentSlug, b.data.actionId, …)` guarded on `b.ok && b.data.ok` (`:L160-L180`). **When the material is already provided** (attached file / in-conversation), it must NOT run `build_specialist` — it delegates straight to `architect#synthesize_and_run` with the content seeded as `context.research` (a JSON string), which skips the research fork entirely (`:L182-L205`) |
| 4a | **App IN this project** (the DEFAULT app target) | "turn this into an app", "an app for my trip/notes/data", anything built on data already in this project | `delegate('system-appbuilder','automator',{query, attachmentIds})` — it authors tables (seeding rows), API handlers, pages and hooks **directly into the live project**, served at `/app/<project>/` (`:L228-L251`) |
| 4b | **A store-catalog app template** | *only* an explicitly fresh, shareable, installable app unrelated to this project's data | `delegate('system-appbuilder','app-architect','build_app',{query})` (`:L253-L263`) |
| 5 | **Write or fix code** | any deliverable that IS code | **always** `delegate('system-engineer','engineer',{query})` — never inline, even when THING could write it (`:L265-L273`) |
| 6 | **Remember something about the user** | a durable preference/fact/instruction | `delegate('user-memory','memory',{query:'Remember: …'})` (`:L275-L282`) |
| 7 | **Act on / automate a service** | "do X on Gmail/Slack/…", "when X happens, do Y" | if the integration is already installed → `delegate('<integration>', …)` via `registered:*`. Otherwise the **install-and-automate flow** below (`:L284-L366`) |

Path 7's flow, once per distinct need (the finder returns ONE space per call, so a two-need request runs it twice — each install raises its own consent card, `:L297-L301`):

**(a)** `delegate('system-store','finder',{query})` → `{ fit, spaceId, title, why, emits, actions, requiredSettings }`; `fit:false` ⇒ tell the user and stop, never build one (`:L303-L313`).
**(b)** `await installSpace(rec.spaceId)` — **consent-marked**: the host renders a consent card and installs only on approval; on success the space is live-registered for `delegate()` in the same session (`:L315-L325`). An id that did **not** come from a finder recommendation must be verified with `storeInspect` first — calling `installSpace` on a non-existent id would interrupt the user with an unfulfillable consent card (`:L327-L340`).
**(c)** `await integrationStatus(rec.spaceId)` → `{ ready, missingRequired }` (presence-only, never secret values); point the user at the chat **Integrations** tab. Their save restarts the pod and **auto-resumes THING** with a "`<id>` configured" system message — never poll (`:L342-L354`).
**(d)** `delegate('system-appbuilder','automator', …)` to author the event hook + emitter def (`:L356-L363`).
**(e)** If the automation needs a service call the installed space does not expose → the engineer **drafts** the **project function** code and returns it (path 5); the automator persists it via `writeProjectFunction` (the engineer no longer persists) (`:L365-L366`).

### 4.3 Standing behaviour (before triage)

- **Project context**, once per conversation: `readFile('instructions.md')` + `listDir('documents')`, both resolved against the project dir (`:L27-L40`).
- **Name the conversation** once, early: `await setSessionMeta({ title, slug })` (`:L42-L52`).
- **Attachments take priority over triage.** THING is a text model and cannot see an image or file: it sends **all** image ids in ONE `delegate('system-vision','vision',{query, attachmentIds})` and **all** file ids in ONE `delegate('system-files','dispatch',…)` (`:L54-L79`). Audio is already transcribed into the message — no delegation (`:L77-L79`).
- **Creating a project is a UI action, not a tool.** THING always runs inside an existing project and must not run `build_specialist`/`build_app` to "make a project" (`:L82-L88`).
- **Orchestrator discipline:** on a failed delegate, report the error — never do the specialist's job (THING cannot scaffold spaces or run builder functions) (`:L376-L380`).

---

## 5. Capabilities held by system agents

`capabilities:` is the least-privilege grant model — a grant that is absent is absent from **both** the injected globals and the typecheck DTS, so a stray call fails typecheck instead of reaching the engine (`sdk/org/libs/core/src/exec/app-globals.ts:L208-L226`, `sdk/org/libs/core/src/exec/bootstrap.ts:L189-L198`). The grant vocabulary itself is documented in [`../format/space/agents/capabilities.md`](../format/space/agents/capabilities.md); the ids are enumerated in `sdk/org/libs/core/src/spaces/capabilities.ts:L26-L56`.

**Exactly eight shipped system agents carry `capabilities:`. Every other system agent parses to `{}`** — asserted by the smoke test in `sdk/org/libs/core/src/spaces/capabilities.test.ts:L115-L142`, whose cap-bearing predicate is `system-appbuilder` ∪ `system-engineer` ∪ `system-store` ∪ `user-thing` (`:L126-L131`).

| Agent | Grants | Unlocks |
|---|---|---|
| `system-appbuilder/app-architect` | `project:manage`, `db:schema`, `db:read`, `pages:write`, `api:write`, `hooks:write` | the full catalog-app authoring set — asserted field-for-field in `sdk/org/libs/core/src/spaces/capabilities.test.ts:L144-L159` |
| `system-appbuilder/automator` | `hooks:write`, `db:schema`, `db:read`, `db:write`, `pages:write`, `api:write` | the LIVE-project writers `writeProjectTable`/`Hook`/`Event`/`Api`/`Page` + `db.*` (`system-appbuilder/agents/automator/instruct.md:L7-L13`) |
| `system-appbuilder/data-modeler` | `db:schema`, `db:read` | `writeTableSchema` (`system-appbuilder/agents/data-modeler/instruct.md:L7-L9`) |
| `system-appbuilder/page-builder` | `pages:write`, `db:read` | `writePage` (`system-appbuilder/agents/page-builder/instruct.md:L7-L9`) |
| `system-appbuilder/api-author` | `api:write`, `db:read` | `writeApi` (`system-appbuilder/agents/api-author/instruct.md:L7-L9`) |
| `system-engineer/engineer` | `fs:scratch` | `createScratch` + a sandboxed generic fs/shell (`readFile`/`writeFile`/`editFile`/`listDir`/`glob`/`grep` + `execShell`, jailed to a throwaway `.lmthing/scratch/<random>` dir) — the engineer's scratch workbench; the ONLY grant that earns any generic filesystem access, and it persists nothing (`sdk/org/libs/core/src/spaces/capabilities.ts:L93-L97`; `sdk/org/libs/core/src/exec/bootstrap.ts:L146-L167`; `system-engineer/agents/engineer/instruct.md:L12-L13`) |
| `system-store/finder` | `store:read` | `storeSearch`, `storeInspect` (`sdk/org/libs/core/src/exec/bootstrap.ts:L189-L193`; `system-store/agents/finder/instruct.md:L4-L5`) |
| `user-thing/thing` | `store:read`, `store:install` | `storeSearch`/`storeInspect` **plus** the consent-marked `installSpace` (`sdk/org/libs/core/src/exec/bootstrap.ts:L195-L198`; `user-thing/agents/thing/instruct.md:L6-L8`) |

`store:read` survives into read-only fork roles (pure catalog discovery); the mutating `store:install` and `events:emit` are dropped (`sdk/org/libs/core/src/exec/capability.ts:L8-L26`).

> The test's cap-bearing predicate also matches `dir.includes('integration-')` (`sdk/org/libs/core/src/spaces/capabilities.test.ts:L128`). That clause matches **none** of the ten shipped spaces — it is a leftover from when the `integration-*` spaces (which declare `connections:use`) were bundled; they are store spaces now (`sdk/org/libs/core/src/spaces/system.test.ts:L60-L62`).

---

## 6. The shipped tasklists (the host-driven DAGs)

Six tasklists ship across four spaces. The tasklist mechanics (`role`, `functions`, `forEach`, `prelude`, `dependsOn`, `goal`, the `{ok, degraded, data}` envelope) are documented in [`../format/space/tasklists/README.md`](../format/space/tasklists/README.md) and [`../runtime/fork-and-tasklists.md`](../runtime/fork-and-tasklists.md) — here is what each shipped DAG actually is.

### `user-thing/build_specialist` — `input: { request }`

```
research (explore, optional, prelude-delegates to system-research/researcher#deep_research)
  → build (goal, general, delegates to system-architect/architect#synthesize_and_run)
```

The `research` node is `optional: true` and its **prelude** performs the delegation, so the model's only job is to package the envelope; the `build` node **always runs** (a skipped dependency is satisfied) and returns the built agent's run coordinates `{ spaceKey, agentSlug, actionId, query, ok, errors }` (`sdk/org/libs/core/system-spaces/user-thing/tasklists/build_specialist/index.md:L1-L14`, `01-research.md:L1-L25`, `02-build.md`). The whole research node, verbatim:

````markdown
---
id: research
output:
  report: object
dependsOn: []
optional: true
goal: false
role: explore
functions: []
canDelegateTo:
  - system-research/researcher#deep_research
prelude: |
  const researchEnv = request ? await delegate('system-research', 'researcher', 'deep_research', { query: String(request) }) : { ok: false, degraded: true, data: {} };
---

Package the domain research for the build step. …

currentTask.resolve({ report: (researchEnv && researchEnv.data) ? researchEnv.data : {} });
````

### `system-architect/synthesize_and_run` — `input: { topic, goal, research }`

**The shipped DAG is eight nodes** (`sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/01-design.md` … `08-finalize.md`):

```
design (explore, functions: [])
  → build_field    (forEach: design.fields,    optional, general, [writeKnowledgeIndex, writeKnowledgeOption])
  → build_function (forEach: design.functions, optional, general, [writeFunctionFile])
  → write_agent  (general, [writeAgentFile])
  → write_tasks  (general, [writeTaskFile])
  → validate     (explore, [validateSpace])
  → register     (general)
  → finalize     (goal, explore)
```

There is **no research node** — the cited report is handed down in `research` (a JSON *string*) by the caller and seeded straight into `build_field`, so the architect never re-researches (`sdk/org/libs/core/system-spaces/system-architect/tasklists/synthesize_and_run/index.md:L1-L13`; `sdk/org/libs/core/system-spaces/system-architect/agents/architect/instruct.md:L36-L54`). Empty/degraded research is **not** a stop condition — the pipeline runs anyway and the built agent carries the knowledge gaps (`:L66-L69`). `finalize` packages `{ spaceKey, agentSlug, actionId, query, ok, errors }`, which the architect then delegates to on its second turn (`:L55-L64`).

### `system-architect/iterate_space` — `input: { spaceKey, feedback }`

```
load (explore) → diagnose (explore) → edit (general) → reregister (general) → redelegate (goal, general)
```
Locate the space, diagnose the feedback, re-write only the affected files with the per-file builders, re-validate, re-register, and hand back the re-run parameters (`sdk/org/libs/core/system-spaces/system-architect/tasklists/iterate_space/index.md:L1-L11`).

### `system-research/research` — `input: { query }`

One node, `answer` (goal, explore, `functions: [webSearch, webFetch]`), whose **prelude** does the whole gather (one `webSearch`, one `webFetch` of the top result) so the model only composes (`sdk/org/libs/core/system-spaces/system-research/tasklists/research/01-answer.md:L1-L16`).

### `system-research/deep_research` — `input: { query }`

```
scope (explore, [webSearch], prelude: 2 searches)
  → plan (explore, functions: [])
  → investigate (forEach: plan.questions, explore, [webSearch, webFetch], prelude: search + fetches)
  → synthesize (explore, functions: [], prelude: dedup sources + concat findings)
  → summarize (goal, explore, functions: [])
```
Every deterministic gather/aggregate step lives in a `prelude:`; the model's turns are reserved for synthesis and `resolve` (`sdk/org/libs/core/system-spaces/system-research/tasklists/deep_research/01-scope.md` … `05-summarize.md`). The goal output is the contract THING and the architect destructure: `{ topic, executive_summary, findings[], conclusion, sources[] }`.

### `system-appbuilder/build_app` — `input: { request }`

```
design (general, functions: [])
  → create_project (general)
  → build_table (forEach: design.tables,    optional, general)
  → build_api   (forEach: design.endpoints, general)
  → build_page  (forEach: design.pages,     general)
  → build_hook  (forEach: design.hooks,     optional, general)
  → finalize (goal, general)
```
Each fan-out node writes **exactly one file** with the injected authoring globals (`createProject`/`writeTableSchema`/`writeApi`/`writePage`/`writeHook`) (`sdk/org/libs/core/system-spaces/system-appbuilder/tasklists/build_app/index.md:L1-L12`, `01-design.md` … `07-finalize.md`).

---

## 7. Materialization onto the pod

### 7.1 `materializeRuntime(root)` — on **every** boot path

`materializeRuntime` copies **every** dir from `defaultSystemSpaceDirs()` into `<root>/system/spaces/<name>/`, records each one's shipped content hash in the manifest, and creates the default `user` project skeleton (`<root>/user/{spaces,documents}/`, an empty `instructions.md`, a `project.json`) (`sdk/org/libs/cli/src/cli/runtime-init.ts:L89-L129`). Copying zero spaces is a hard misconfiguration and warns loudly — every session would fail to find the `thing` agent (`:L105-L110`).

`<root>` is `LMTHING_ROOT` when set, else `<cwd>/.lmthing` (`sdk/org/libs/cli/src/cli/bin.ts:L209-L213`). On the compute pod it is the data volume (e.g. `LMTHING_ROOT=/data/.lmthing`).

It is gated by `runtimeNeedsInit(root)`, which checks for the **sentinel** `<root>/system/spaces/user-thing` — not merely the `system/` dir, because a persistent volume can carry an empty `system/` from an earlier broken materialization and that must be repaired (`sdk/org/libs/cli/src/cli/runtime-init.ts:L51-L67`).

Call sites — this is **not** an `lmthing init`-only step:

| Boot path | Code |
|---|---|
| bare `lmthing` / interactive / REPL → `ensureRuntime(root, args)` (materialize-if-needed, else sync) | `sdk/org/libs/cli/src/cli/bin.ts:L221-L237`, called at `:L413` and `:L514` |
| `lmthing serve` | materialize **pre-listen** (correctness-critical), sync **post-listen** so a cold wake never pays the hash walk before the startup probe (`sdk/org/libs/cli/src/cli/bin.ts:L352-L390`) |
| `lmthing init` | materializes into `<cwd>/.lmthing` directly (keyless, refresh-on-demand) (`sdk/org/libs/cli/src/cli/bin.ts:L289-L298`) |

### 7.2 `syncSystemSpaces(root, { adopt })` — pristine vs held-back

Safe to call on every boot (it hashes a handful of small dirs). For each shipped space it compares three hashes: the **shipped** hash, the **recorded** hash in `<root>/system/.shipped.json`, and the **current** materialized hash (`sdk/org/libs/cli/src/cli/runtime-init.ts:L159-L214`; `hashDir` is a sorted sha256 over relative path + bytes, ignoring mtimes, `:L29-L49`):

| State | Action |
|---|---|
| **new / missing** dir | copy it, record the hash (`:L180-L185`) |
| **up to date** (`recorded === shipped`) | skip (`:L186`) |
| current already equals shipped | just record the hash (`:L188-L193`) |
| **pristine but outdated** (`current === recorded`, i.e. the user never edited it) | **AUTO-ADOPT** the shipped version — provably nothing to lose. This is what makes a developer's source edit take effect and what un-stales a user volume after an image upgrade (`:L194-L198`) |
| **locally modified and outdated** | **HOLD BACK** and report it; the user's copy is never silently overwritten (`:L204-L209`) |
| **legacy, no recorded hash** | cannot prove pristine ⇒ treat as locally modified: hold back, but record a baseline so the next mismatch is classifiable (`:L204-L209`) |
| held back **+ `adopt`** | rename the old copy to `<name>.bak-<ts>`, then overwrite (`:L199-L203`) |

`adopt` comes from the CLI flag `--adopt-system-spaces` (`sdk/org/libs/cli/src/cli/args.ts:L140-L143`) or `LM_ADOPT_SYSTEM_SPACES=1` (`sdk/org/libs/cli/src/cli/runtime-init.ts:L160`). Held-back spaces are printed to stderr with the exact remedy (`sdk/org/libs/cli/src/cli/bin.ts:L231-L236`).

The manifest is `<root>/system/.shipped.json` — a plain `{ "<space-name>": "<sha256>" }` map (`sdk/org/libs/cli/src/cli/runtime-init.ts:L9-L24`).

### 7.3 What a pod session actually loads

**The pod loads the MATERIALIZED copies, not the shipped source.** The session manager passes `listSystemSpaceDirs(root)` — the immediate subdirs of `<root>/system/spaces/` (`sdk/org/libs/cli/src/server/projects.ts:L136-L143`) — as `systemSpaceDirs` (`sdk/org/libs/cli/src/server/session-manager.ts:L1116-L1130`), and `Session` uses that list, falling back to `defaultSystemSpaceDirs()` only when it is absent (`sdk/org/libs/core/src/session/session.ts:L579-L581`). So a source edit reaches a pod session only after the boot-time auto-adopt (§7.2) — or immediately in a workspace run where no `--space`-rooted `<root>` overrides the default.

Studio browses and edits them through the **synthetic `system` project**: `listProjects` prepends `{id:'system'}` whenever `<root>/system/spaces/` is non-empty, because `<root>/system/spaces/<id>` matches the generic `<root>/<projectId>/spaces/<id>` shape the normal project/space routes already serve (`sdk/org/libs/cli/src/server/projects.ts:L25-L31`, `:L299-L323`). `system` is reserved — it cannot be created or deleted as a project (`:L330`).

### 7.4 Overrides

| Override | Effect |
|---|---|
| `SessionOpts.systemSpaceDirs` | explicit dir list (tests pass `[]` for a keyless, system-space-free session) (`sdk/org/libs/core/src/session/session.ts:L579`) |
| `--system-spaces <csv>` | explicit dirs from the CLI (`sdk/org/libs/cli/src/cli/args.ts:L130-L135`) |
| `--no-system-spaces` | load none (`sdk/org/libs/cli/src/cli/args.ts:L136-L139`) |
| `LM_SYSTEM_SPACES` (csv) | same, from the environment (`sdk/org/libs/cli/src/cli/bin.ts:L245`) |

---

## 8. Authoring / modifying a system space

The **file formats** (agent frontmatter keys, tasklist node fields, knowledge layout, function rules) are not restated here — they are in [`../format/space/README.md`](../format/space/README.md) and its subpages ([agents](../format/space/agents/README.md), [tasklists](../format/space/tasklists/README.md), [knowledge](../format/space/knowledge/README.md), [functions](../format/space/functions/README.md)). The step-by-step how-to is [`../contributing/add-a-space.md`](../contributing/add-a-space.md).

What is **specific to a system space**:

1. **Create `sdk/org/libs/core/system-spaces/<name>/`**, then add `<name>` to `SYSTEM_SPACE_NAMES` (`sdk/org/libs/core/src/spaces/system.ts:L30-L41`). A dir that is not in that list is never materialized and never loaded. Update `sdk/org/libs/core/src/spaces/system.test.ts:L60`, which asserts the exact count.
2. **A function-only space is fine** (no `agents/`) — `loadSystemSpaces` passes `requireAgents: false` (`sdk/org/libs/core/src/spaces/system.ts:L60-L70`). But its functions are **only** universal if the space is literally named `system-global` (`:L27`, `:L73-L76`); any other space's functions must be declared in an agent's `functions:` frontmatter to reach anything.
3. **Adding a function to `system-global`** means adding a universal global: one file per function, named exactly like the file, with an explicit return type and a leading doc comment (both are surfaced to the model). It runs inside the QuickJS VM and may use the host primitives, but **may not** call value-yielding globals other than the ones already bridged. Update `sdk/org/libs/core/src/spaces/system.test.ts:L24-L30`, which pins the exact function list.
4. **Grants**: if the agent needs a project-app global, declare it in `capabilities:` — and extend the cap-bearing predicate in `sdk/org/libs/core/src/spaces/capabilities.test.ts:L126-L131`, which otherwise asserts your new agent's capabilities are `{}`.
5. **After editing**: a source `.md`/builder-`.ts` edit needs **no rebuild**, but an already-materialized pod root only picks it up via the pristine auto-adopt (§7.2). A locally-edited copy on that root holds back until `--adopt-system-spaces`.
6. **Never forbid a tool in prose.** Disable it structurally: `role: explore` for a read-only task, `functions: []` for a no-tools task, an explicit `functions:` allowlist otherwise. Prose restrictions are advisory; frontmatter is host-enforced (`sdk/org/libs/core/src/exec/app-globals.ts:L208-L226` for capabilities; [`../runtime/fork-and-tasklists.md`](../runtime/fork-and-tasklists.md) for task roles/allowlists).

---

## 9. Unverified

> **UNVERIFIED: the "weak production model" tuning rationale.** The predecessor `DEVELOPMENT.md` framed every structural feature (preludes, `forEach`, the charter/instruct split) as a response to `DeepSeek-V4-Flash` (alias `S`) being the production target, and cited live-run results (a 152 s `deep_research` run, 52 `fetch` yields). Those are historical run reports, not code. Searched `sdk/org/libs` for a model-alias default and `sdk/org/.env` for `LM_MODEL_*` — the alias map is environment configuration, not source, so neither the current production alias nor the run numbers can be grounded in code here. The *mechanisms* above (roles, allowlists, preludes, forEach) are all grounded; the *reason they exist* is not.

> **UNVERIFIED: whether any shipped system agent's `model:` alias resolves to a real deployment.** `system-vision/vision` declares `model: vision` and `system-files/dispatch` declares `model: M`, and the delegate runtime does honor an agent's own `model:` (`sdk/org/libs/core/src/delegate/delegate.ts:L103-L105`). Whether `vision` and `M` map to actual deployments depends on `LM_MODEL_<ALIAS>` env vars, which are not in the repo.
