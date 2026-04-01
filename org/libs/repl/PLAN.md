# Implementation Plan: Self-Growing THING Agent with Space Creation

## Vision

The user's THING personal agent starts from a set of built-in spaces (`org/libs/thing/spaces/`), uses agents from those spaces to handle requests, and autonomously creates new spaces by researching topics — writing agents, flows, and knowledge directly to the file system. The system grows with the user. Spaces can also be installed from public catalogs (npm, GitHub) and hot-reloaded into the live session.

---

## Current State Audit

### What Works
- Full `Session` runtime (sandbox, 30+ globals: `stop`, `display`, `ask`, `async`, `tasklist`, `fork`, `reflect`, `compress`, `plan`, `critique`, `learn`, `checkpoint`, `pin`, `memo`, `broadcast`, `listen`, etc.)
- Knowledge system: tree builder, loader, writer (`saveKnowledgeFile`, `deleteKnowledgeFile`, `ensureMemoryDomain`)
- Catalog: `fs`, `fetch`, `shell`, `db`, `csv`, `json`, `path`, `env`, `date`, `crypto`, MCP
- **Four-backtick file blocks** — stream-level file write (`````<path>`) and diff patch (`````diff <path>`) already parsed by `line-accumulator.ts` and applied by `file-block-applier.ts`. Path traversal blocked. Diff enforces read-before-patch via ledger.
- Agent namespaces: `buildSpaceAgentTrees`, `createNamespaceGlobals`, `ChainableSpawnPromise`
- Knowledge namespace: `knowledge.writer({ field }).save/remove/addOptions`
- `fork()` → `AgentLoop.handleFork()` — fully wired
- `reflect()`, `compress()`, `plan()`, `critique()` → AgentLoop handlers — wired
- `parallel()`, `checkpoint()`, `rollback()`, `pin()`, `memo()`, `watch()`, `pipeline()` — implemented
- 7 built-in THING spaces in `org/libs/thing/spaces/`
- `spawn.ts`: `executeSpawn()` exists and is complete

### What's Broken / Stubbed

| Feature | Location | Status |
|---------|----------|--------|
| Agent namespace spawning | `run-agent.ts:256` | Throws `'not yet implemented'` |
| `speculate()` | `globals.ts:1293` | `onSpeculate` never provided by AgentLoop |
| `vectorSearch()` | `globals.ts` | Not defined at all |
| Git commits on file writes | `file-block-applier.ts` | Writes files, no git commits |
| Dynamic space loading | `run-agent.ts` | Spaces loaded once at startup only |
| `space` namespace global | — | No `space.create()` / `space.load()` / `space.install()` |
| Space catalog install | — | `npm:` / `github:` URIs parsed but not fetched |
| THING agent entry point | — | No `runThingAgent()` |
| Web search catalog | — | No `search` module |

---

## Phases

---

### Phase 1 — Fix Agent Spawning
**Goal:** `cooking.general_advisor({}).mealplan("...")` actually executes instead of throwing.

**Files:**
- `org/libs/core/src/cli/run-agent.ts`
- `org/libs/core/src/cli/agent-loop.ts`

**Work:**
1. In `run-agent.ts`, replace `onSpawnStub` with a real `onSpawn` that calls `executeSpawn()` from `spawn.ts`, passing the current `AgentLoop`'s spawn context (model, messages, catalogGlobals, knowledgeLoader, etc.).
2. `AgentLoop` needs a `getSpawnContext(): SpawnContext` method that collects its current state.
3. The `onSpawn` callback should use `agentLoopRef` to access the live context at call time (not at setup time), since the context evolves across turns.
4. Wire `onSpawn` into `createNamespaceGlobals(agentTrees, onSpawnFn)` replacing the stub.

**Outcome:** Agents can call other space agents as sub-processes. All 7 built-in THING spaces become callable.

---

### Phase 2 — `speculate()` Implementation
**Goal:** The agent can test multiple approaches in parallel isolated sandboxes and pick the best.

**Files:**
- `org/libs/core/src/cli/agent-loop.ts`
- `org/libs/repl/src/sandbox/globals.ts` (interface already defined)

**Work:**
1. Add `handleSpeculate(branches: SpeculateBranch[], timeout: number): Promise<SpeculateResult>` to `AgentLoop`.
2. Snapshot the current sandbox scope, spawn N lightweight `Sandbox` instances with cloned scope, execute each branch function with a timeout, collect results.
3. Wire `onSpeculate: (branches, timeout) => agentLoop.handleSpeculate(branches, timeout)` in `run-agent.ts` Session options.

**Outcome:**
```ts
const best = await speculate([
  { label: 'regex', fn: () => parseWithRegex(text) },
  { label: 'split', fn: () => parseWithSplit(text) },
], 2000)
```

---

### Phase 3 — `vectorSearch()` Global
**Goal:** Agent can semantically search its own past reasoning (comment blocks + code).

**Files:**
- `org/libs/repl/src/sandbox/vector-index.ts` (new)
- `org/libs/repl/src/sandbox/globals.ts`
- `org/libs/repl/src/session/session.ts`
- `org/libs/repl/src/index.ts`

**Work:**
1. Create `VectorIndex` in `vector-index.ts`: TF-IDF cosine similarity, no external deps.
   - `index(text: string, code: string, turn: number): void`
   - `search(query: string, topK: number): Match[]`
2. In `Session`, extract comment blocks from each `codeLines` batch at every `stop()`, feed into `VectorIndex`.
3. Add `onVectorSearch` to `GlobalsConfig`, add `vectorSearch(query, topK = 5)` global wired to it.
4. Export `VectorIndex` from `index.ts`.

**Note:** Phase 3 is in-session only. Cross-session persistence via SQLite can be added later using the `db` catalog.

**Outcome:**
```ts
const past = await vectorSearch("aggregate sales by region")
stop(past)
```

---

### Phase 4 — Git Commits on File Writes
**Goal:** Every file write or diff patch creates a git commit, making the space file system fully version-tracked.

**Files:**
- `org/libs/repl/src/stream/file-block-applier.ts`
- `org/libs/repl/src/sandbox/globals.ts` (checkpoint/rollback enhancement)

**Work:**
1. In `file-block-applier.ts`, after a successful `applyFileWrite` or `applyFileDiff`, detect if `workingDir` is inside a git repo (check for `.git/` walking up). If so, run `git add <path> && git commit -m "agent: write <path>"` via `child_process.execSync`.
2. Enhance `checkpoint()`: if in a git repo, `git stash push -m "checkpoint-<id>"` alongside the scope snapshot. Store the stash ref in `CheckpointData`.
3. Enhance `rollback(snapshot)`: if a stash ref exists, `git stash pop <ref>` to restore file state alongside scope.
4. Optional: add a `branch(name)` global — `git checkout -b agent/<name>` — for named exploration branches.

**Outcome:** Full episodic memory trail in git history. Checkpoint/rollback covers both scope and files. `git log` shows the complete evolution of a space.

---

### Phase 5 — Space Creation via File Blocks
**Goal:** The agent creates new spaces by writing files directly with four-backtick blocks — no intermediate spec API required. A `scaffoldSpace()` helper provides structural validation and programmatic creation for non-LLM callers.

**Primary mechanism — agent writes space files directly:**

The agent already has everything it needs. With `fileWorkingDir` pointing at the user's spaces directory and the `fs` catalog for reading, the agent creates a space file-by-file:

```
// Research the topic
const results = await webSearch("Greek cooking techniques")
const content = await scrapeUrl(results[0].url, { format: 'markdown' })
stop(content)

// Write the package.json
````spaces/greek-cooking/package.json
{
  "name": "greek-cooking",
  "version": "1.0.0"
}
````

// Write the agent config
````spaces/greek-cooking/agents/agent-recipe-advisor/config.json
{ "title": "RecipeAdvisor", "model": null, "actions": [{ "id": "create_menu", "flow": "flow_create_menu", "label": "Create Menu" }] }
````

// Write the instruct
````spaces/greek-cooking/agents/agent-recipe-advisor/instruct.md
---
title: RecipeAdvisor
---
You are a Greek cuisine specialist...
````

// Write knowledge option
````spaces/greek-cooking/knowledge/cuisine-context/region/central.md
---
title: Central Greece
order: 1
---
Central Greek cuisine features lamb, feta, and olive oil as core ingredients...
````
```

Every block is a git commit. The full space is built turn-by-turn with `stop()` inspections between each step.

**Complementary: `scaffoldSpace()` programmatic API**

For validation and non-LLM callers, add `scaffoldSpace(spacesDir, spec)` to `org/libs/repl/src/knowledge/space-writer.ts`:

```ts
interface SpaceSpec {
  slug: string
  name: string
  description: string
  agents: AgentSpec[]
  flows?: FlowSpec[]
  knowledge?: KnowledgeSpec[]
}
```

Writes the same files the agent would write via blocks. Exported from `index.ts`. Used by `space.create(spec)` in Phase 6 as a shortcut when the full spec is already known.

---

### Phase 6 — Space Namespace Global
**Goal:** The THING agent has a `space` global to list, create, load, and install spaces at runtime.

**Files:**
- `org/libs/core/src/agent-namespaces.ts`
- `org/libs/core/src/cli/run-agent.ts`
- `org/libs/core/src/cli/agent-loop.ts`

**Namespace API:**

```ts
space {
  // Create from spec (uses scaffoldSpace internally)
  create(spec: SpaceSpec): Promise<{ path: string }>

  // Load an already-written local space into the live session
  load(path: string): Promise<void>

  // List all currently loaded spaces and their agents
  list(): SpaceListEntry[]

  // Install from npm or GitHub into userSpacesDir, then load
  install(uri: string): Promise<{ path: string }>

  // Describe a loaded space (agents, flows, knowledge domains)
  describe(slug: string): SpaceDescription
}
```

**Work:**

1. `space.create(spec)` — calls `scaffoldSpace(userSpacesDir, spec)`, then calls `onSpaceLoaded(path)` to trigger hot reload (Phase 7).

2. `space.load(path)` — calls `onSpaceLoaded(path)` directly, for spaces already on disk.

3. `space.install(uri)`:
   - Parse `uri`: `npm:@scope/pkg`, `github:org/repo/path`, or a URL
   - `npm:` → run `npm pack <package>` into a temp dir, extract into `userSpacesDir/<slug>/`
   - `github:` → fetch `https://github.com/<org>/<repo>/archive/HEAD.tar.gz`, extract the subpath into `userSpacesDir/<slug>/`
   - Then call `space.load(extractedPath)`
   - The installed space lands in `userSpacesDir`, git-tracked alongside the user's own spaces

4. `space.list()` / `space.describe(slug)` — read from the live agent tree in `AgentLoop`.

5. Add `formatSpaceNamespaceForPrompt()` to document the API in the system prompt.

6. Wire into `run-agent.ts`.

**Outcome:** The agent can both write spaces file-by-file (full control) and install community spaces from the catalog:
```ts
// Install a published space
const { path } = await space.install('npm:@lmthing/space-nutrition')
// Immediately callable
const plan = await nutrition.diet_planner({}).create_plan("vegetarian, 2000 kcal")
```

---

### Phase 7 — Dynamic Space Loading
**Goal:** When a space is created, loaded, or installed, the running agent immediately gains access to its agents without restarting.

**Files:**
- `org/libs/core/src/cli/agent-loop.ts`
- `org/libs/core/src/cli/run-agent.ts`

**Work:**
1. Add `AgentLoop.addSpace(spacePath: string): void`:
   - `buildSpaceAgentTrees([spacePath], [knowledgeTree])` for the new space
   - Merge new agent tree into existing trees
   - `createNamespaceGlobals` for just the new space, merge into existing namespaces
   - Rebuild `knowledgeTreePrompt`
   - `session.injectGlobal(spaceName, namespace)`
   - `rebuildSystemPrompt()` — update system prompt with new agent tree + knowledge

2. Make `buildSystemPrompt()` dynamic — read from current state fields rather than construction-time snapshots.

3. `onSpaceLoaded` in `run-agent.ts` calls `agentLoopRef!.addSpace(path)`.

**Outcome:** After any of `space.create()`, `space.load()`, or `space.install()`, the new namespace is live in the current turn.

---

### Phase 8 — THING Agent Entry Point
**Goal:** `runThingAgent(opts)` boots the personal agent with all built-in spaces, the user's spaces directory, and the right `fileWorkingDir` so the agent can write space files directly.

**Files:**
- `org/libs/core/src/thing-agent.ts` (new)
- `org/libs/core/src/index.ts`

**Work:**

```ts
interface ThingAgentOptions {
  model: LanguageModel | string
  userSpacesDir?: string   // default: ~/.lmthing/spaces/
  port?: number
  debugFile?: string
}
```

1. Resolve built-in space paths from `org/libs/thing/spaces/`: `space-chat`, `space-studio`, `space-ecosystem`, `space-computer`, `space-deploy`, `space-store`, `space-creator`.
2. Scan `userSpacesDir` for existing user spaces (any directory with `package.json`).
3. Set `fileWorkingDir = userSpacesDir` so four-backtick file blocks write into the spaces directory.
4. System instruct defines the THING agent's meta-role:
   > "You are THING, a personal AI agent. You have access to specialized spaces and can create new ones. To handle a request outside your current spaces: use `webSearch` and `scrapeUrl` to research the topic, write space files directly with four-backtick blocks into the spaces directory, then call `space.load(path)` to activate the new space. For community spaces, use `space.install('npm:...')`. Always `stop()` to verify each file you write before moving on."
5. Enable catalog: `['fetch', 'fs', 'shell', 'db', 'json', 'search']`.
6. Calls `runAgent(thingFilePath, { model, spaces, catalog, port, fileWorkingDir: userSpacesDir })`.
7. Export from `org/libs/core/src/index.ts`.

**Outcome:**
```ts
const { agentLoop } = await runThingAgent({ model: 'openai:gpt-4o', port: 3030 })
```

---

### Phase 9 — Web Search Catalog Module
**Goal:** Agent can research topics before creating spaces.

**Files:**
- `org/libs/repl/src/catalog/search.ts` (new)
- `org/libs/repl/src/catalog/search.test.ts` (new)
- `org/libs/repl/src/catalog/index.ts`

**Work:**
1. Functions:
   - `webSearch(query, opts?: { engine?: 'brave'|'serpapi'|'duckduckgo'; n?: number }): Promise<SearchResult[]>`
   - `scrapeUrl(url, opts?: { format?: 'text'|'markdown' }): Promise<string>`
   - `summarizeResults(results): string`

2. Default engine: DuckDuckGo lite (no API key). Optional: Brave (`BRAVE_SEARCH_API_KEY`), SerpAPI (`SERPAPI_KEY`).

3. `scrapeUrl`: fetch + strip HTML tags, return clean text or markdown.

4. Register in `catalog/index.ts`.

**Outcome:**
```ts
const results = await webSearch("Greek cooking techniques")
const content = await scrapeUrl(results[0].url, { format: 'markdown' })
stop(content)
```

---

### Phase 10 — Space Creator Automation
**Goal:** The `SpaceArchitect` agent in `space-creator` drives the full research-and-create loop autonomously, using file blocks as its primary write mechanism.

**Files:**
- `org/libs/thing/spaces/space-creator/agents/agent-space-architect/instruct.md` (update)
- `org/libs/thing/spaces/space-creator/flows/flow_research_and_create/` (new flow, 6 steps)
- `org/libs/thing/spaces/space-creator/knowledge/space-structure/component-type/file-blocks.md` (new)

**Work:**
1. Update `SpaceArchitect` instruct to include:
   - Use `webSearch` + `scrapeUrl` to gather 5–10 sources on the topic
   - Design knowledge domains and fields from the research
   - Write all space files with four-backtick blocks (`stop()` after each to verify)
   - Call `space.load(path)` once all files are written
   - Test by calling the new space's primary agent

2. New `flow_research_and_create` flow:
   ```
   1. Research Topic.md     — webSearch + scrapeUrl, stop() on findings
   2. Extract Knowledge.md  — identify domains, fields, options from research
   3. Design Agents.md      — define agent roles, actions, knowledge references
   4. Write Space Files.md  — four-backtick blocks for each file, stop() to verify
   5. Load and Test.md      — space.load(path), call primary agent, verify output
   6. Refine.md             — patch any knowledge gaps found during testing
   ```

3. Add `file-blocks.md` to `space-structure` knowledge: documents the four-backtick write/diff syntax with concrete examples for space files (package.json, instruct.md, config.json, knowledge options).

4. Wire `space-creator` as a dependency of the THING entry file's `spaces` field so it's always available.

---

## Dependency Order

```
Phase 1 (spawn)          ← unblocks all agent namespace calls
    │
    ├── Phase 2 (speculate)     ← independent
    ├── Phase 3 (vectorSearch)  ← independent
    └── Phase 4 (git commits)   ← independent, feeds Phase 5
            │
            ▼
        Phase 5 (space creation via file blocks + scaffoldSpace helper)
            │
            ▼
        Phase 6 (space namespace: create / load / install)
            │
            ▼
        Phase 7 (dynamic space loading / hot reload)
            │
            ├── Phase 9 (web search) ← can run in parallel with 5–7
            │
            ▼
        Phase 8 (THING agent entry point)
            │
            ▼
        Phase 10 (space creator automation — needs all above)
```

---

## End State: How It All Works Together

1. User starts: `runThingAgent({ model: 'openai:gpt-4o', port: 3030 })`
2. THING boots with 7 built-in spaces + any existing user spaces in `~/.lmthing/spaces/`; `fileWorkingDir` = `~/.lmthing/spaces/`
3. User asks: "Help me plan a Greek feast for 10 people"
4. THING checks its spaces — no Greek cooking space
5. THING creates the space by writing files directly:
   - `webSearch("Greek cooking techniques")` + `scrapeUrl(...)` → gathers knowledge
   - Four-backtick blocks write `package.json`, agent config, instruct, knowledge options
   - Each `stop()` verifies the written content
   - `space.load('~/.lmthing/spaces/greek-cooking')` → namespace live immediately
6. THING calls `greek_cooking.recipe_advisor({ 'cuisine-context': { 'region': 'central' } }).create_menu("feast for 10")`
7. `RecipeAdvisor` child agent runs, returns structured menu
8. THING presents result; space files are committed to git
9. Next session: `greek_cooking` already exists — no re-creation, agent refines via diff patches
10. User discovers a published space: `space.install('npm:@lmthing/space-wine-pairing')` → downloaded, loaded, callable

`learn()` calls and diff-patched knowledge files persist across all sessions in git. The space ecosystem grows and improves continuously.

---

## File Summary

| New File | Purpose |
|----------|---------|
| `org/libs/repl/src/sandbox/vector-index.ts` | TF-IDF in-memory vector search |
| `org/libs/repl/src/knowledge/space-writer.ts` | `scaffoldSpace()` — programmatic space directory writer |
| `org/libs/repl/src/catalog/search.ts` | `webSearch()`, `scrapeUrl()` catalog module |
| `org/libs/core/src/thing-agent.ts` | `runThingAgent()` entry point |
| `org/libs/thing/spaces/space-creator/flows/flow_research_and_create/` | 6-step research-and-create flow |
| `org/libs/thing/spaces/space-creator/knowledge/space-structure/component-type/file-blocks.md` | File-block syntax reference for SpaceArchitect |

| Modified File | Change |
|---------------|--------|
| `org/libs/core/src/cli/run-agent.ts` | Wire real `onSpawn`, `onSpeculate`, space namespace, `fileWorkingDir` |
| `org/libs/core/src/cli/agent-loop.ts` | Add `handleSpeculate`, `addSpace`, `getSpawnContext`, `rebuildSystemPrompt` |
| `org/libs/core/src/agent-namespaces.ts` | Add `createSpaceNamespace` with `create/load/install/list/describe`, `formatSpaceNamespaceForPrompt` |
| `org/libs/repl/src/sandbox/globals.ts` | Add `vectorSearch` global |
| `org/libs/repl/src/session/session.ts` | Wire `VectorIndex`, extract comments at each `stop()` |
| `org/libs/repl/src/stream/file-block-applier.ts` | Git commit after each successful write/diff |
| `org/libs/repl/src/catalog/index.ts` | Register `search` module |
| `org/libs/repl/src/index.ts` | Export `scaffoldSpace`, `VectorIndex` |
| `org/libs/core/src/index.ts` | Export `runThingAgent` |
| `org/libs/thing/spaces/space-creator/agents/agent-space-architect/instruct.md` | Add file-block patterns, `space.load()`, research workflow |
