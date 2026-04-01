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

### Phase 4 — System Prompt Builder Refactor
**Goal:** Replace the 575-line monolithic `buildSystemPrompt()` function (12 positional parameters, all global documentation inline, section-collapse logic interspersed) with a composable, section-based `SystemPromptBuilder` that supports targeted section updates — enabling Phase 8's dynamic agent-tree reload without rebuilding the entire prompt.

**Current problems in `org/libs/core/src/cli/buildSystemPrompt.ts`:**
- Single function, 575 lines, 12 positional `string | undefined` parameters — order errors are silent
- ~400 lines of global documentation (`### stop()`, `### display()`, etc.) hardcoded as template literals inside the function body — impossible to update in isolation
- `isExpanded()` / `collapseSection()` focus logic interleaved with content throughout
- `AgentLoop` must rebuild the entire prompt whenever any single piece changes (scope, agents, knowledge)
- Lives in `org/libs/core`, not in `@lmthing/repl` — unavailable to consumers that don't use `AgentLoop`

**Target architecture in `@lmthing/repl/src/context/prompt/`:**

```
context/prompt/
├── builder.ts          → SystemPromptBuilder class
├── focus.ts            → FocusController
├── config.ts           → SystemPromptConfig interface
└── sections/
    ├── role.ts         → buildRoleSection()
    ├── globals.ts      → buildGlobalsSection(config)  ← docs moved here
    ├── scope.ts        → buildScopeSection(scope, pinned, memo)
    ├── components.ts   → buildComponentsSection(form, view, focus)
    ├── functions.ts    → buildFunctionsSection(fns, classes, focus)
    ├── agents.ts       → buildAgentsSection(agentTree, knowledgeNs, focus)
    ├── knowledge.ts    → buildKnowledgeSection(tree, focus)
    ├── rules.ts        → buildRulesSection(extras?)
    └── instruct.ts     → buildInstructSection(text)
```

**Files:**
- `org/libs/repl/src/context/prompt/` (new directory, ~9 files)
- `org/libs/repl/src/index.ts`
- `org/libs/core/src/cli/buildSystemPrompt.ts` (becomes thin adapter)
- `org/libs/core/src/cli/agent-loop.ts` (switch to `SystemPromptBuilder`)

**Work:**

1. Define `SystemPromptConfig` in `config.ts` — named object replacing the 12 positional params:

```ts
interface SystemPromptConfig {
  functionSignatures?: string
  formSignatures?: string
  viewSignatures?: string
  classSignatures?: string
  scope: string
  instruct?: string
  knowledgeTree?: string
  agentTree?: string
  knowledgeNamespacePrompt?: string
  pinnedBlock?: string
  memoBlock?: string
  focusSections?: Set<string> | null
}
```

2. Extract each section into its own file under `sections/`. Each exports a single `build*(config)` function returning a string. The global documentation (`### stop()`, `### display()`, etc.) moves to `globals.ts` as named constants, making it editable independently of assembly logic.

3. Create `FocusController` in `focus.ts`:
   - `isExpanded(section: string): boolean`
   - `collapse(section: string, content: string, label: string): string`
   - `update(sections: Set<string> | null): void`

4. Create `SystemPromptBuilder` in `builder.ts`:

```ts
class SystemPromptBuilder {
  constructor(config: SystemPromptConfig)

  // Full assembly
  build(): string

  // Targeted section updates — return new full prompt string
  updateScope(scope: string, pinned?: string, memo?: string): string
  updateAgents(agentTree: string): string
  updateKnowledge(knowledgeTree: string): string
  setFocus(sections: Set<string> | null): string

  // Generic: rebuild one named section and return updated prompt
  rebuildSection(name: SectionName): string
}
```

Each `update*` method rebuilds only the affected section(s) and splices the new content into the cached prompt — O(section) rather than O(full prompt).

5. `buildSystemPrompt.ts` in `core` becomes a one-liner adapter:

```ts
export function buildSystemPrompt(...args): string {
  return new SystemPromptBuilder(argsToConfig(...args)).build()
}
```

6. `AgentLoop` switches to holding a `SystemPromptBuilder` instance:
   - Calls `builder.updateScope(...)` at every turn (fast path — already done per-turn)
   - Calls `builder.updateAgents(newTree)` when `addSpace()` runs (Phase 8)
   - Calls `builder.updateKnowledge(newTree)` when knowledge is saved/reloaded

7. Export `SystemPromptBuilder`, `SystemPromptConfig`, and all section builders from `@lmthing/repl/src/index.ts`.

**Outcome:** Each section is testable in isolation. `AgentLoop.addSpace()` calls `builder.updateAgents()` — one section rebuilt, not 575 lines re-evaluated. The global documentation becomes a maintainable set of named string constants. New sections (e.g. a `space` namespace block) can be added without modifying the core assembly function.

---

### Phase 5 — Git Commits on File Writes
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

### Phase 6 — Space Creation via File Blocks
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

### Phase 7 — Space Namespace Global
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

1. `space.create(spec)` — calls `scaffoldSpace(userSpacesDir, spec)`, then calls `onSpaceLoaded(path)` to trigger hot reload (Phase 8).

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

### Phase 8 — Dynamic Space Loading
**Goal:** When a space is created, loaded, or installed, the running agent immediately gains access to its agents without restarting.

**Files:**
- `org/libs/core/src/cli/agent-loop.ts`
- `org/libs/core/src/cli/run-agent.ts`

**Work:**
1. Add `AgentLoop.addSpace(spacePath: string): void`:
   - `buildSpaceAgentTrees([spacePath], [knowledgeTree])` for the new space
   - Merge new agent tree into existing trees
   - `createNamespaceGlobals` for just the new space, merge into existing namespaces
   - `session.injectGlobal(spaceName, namespace)`
   - Call `promptBuilder.updateAgents(newAgentTree)` (Phase 4) — rebuilds only the agents section, not the full 575-line prompt

2. `AgentLoop` holds a `SystemPromptBuilder` instance (Phase 4). Replace the current full-rebuild pattern with targeted `update*` calls:
   - Scope changes → `promptBuilder.updateScope(...)`
   - Agent tree changes → `promptBuilder.updateAgents(...)`
   - Knowledge changes → `promptBuilder.updateKnowledge(...)`

3. `onSpaceLoaded` in `run-agent.ts` calls `agentLoopRef!.addSpace(path)`.

**Outcome:** After any of `space.create()`, `space.load()`, or `space.install()`, the new namespace is live in the current turn.

---

### Phase 9 — THING Agent Entry Point
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

### Phase 10 — Web Search Catalog Module
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

### Phase 11 — Space Creator Automation
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

### Phase 12 — Built-in Space: `space-spaces`
**Goal:** A comprehensive space lifecycle management space that supersedes the limited `space-creator`. Provides agents for creating, editing, and performing file operations on all five space pillars (agents, flows, functions, components, knowledge) — the operational backbone the THING agent uses when building spaces autonomously.

**Location:** `org/libs/thing/spaces/space-spaces/`

**Agents (4):**

| Agent | Role |
|-------|------|
| `SpaceArchitect` | Designs full space structure from a brief — directory layout, agent roles, flow steps, knowledge domains |
| `SpaceEditor` | Updates existing spaces — modifies agent configs, rewrites instruct files, restructures flows |
| `FileOperator` | Low-level space file operations — create, rename, delete, move files/directories within a space |
| `KnowledgeWeaver` | Adds/updates knowledge: new domains, fields, option files, cross-space knowledge links |

**Flows (6):**

```
flows/
├── flow_create_space/         # 7 steps: brief → research → design → scaffold → write files → load → verify
├── flow_edit_agent/           # 4 steps: locate → read current → patch instruct/config → reload
├── flow_add_knowledge/        # 5 steps: topic → design domain/fields → write options → inject into agents → verify
├── flow_add_flow/             # 4 steps: define steps → write step files → update index.md → wire to agent action
├── flow_add_component/        # 3 steps: design → write tsx → register in agent config
└── flow_add_function/         # 3 steps: design signature → write tsx → register in agent config
```

**Knowledge (6 domains):**

```
knowledge/
├── space-structure/           # Full directory layout spec; agents/flows/functions/components/knowledge schemas
│   └── pillar/                # One option per pillar: agents, flows, functions, components, knowledge
├── file-block-syntax/         # Four-backtick write and diff syntax; path rules; diff ledger requirements
│   └── operation/             # write, diff-patch, read-before-patch
├── agent-design/              # Agent patterns: specialist, coordinator, reviewer; instruct frontmatter spec
│   └── pattern/               # specialist.md, coordinator.md, reviewer.md
├── flow-design/               # Step structure: numbered md files, index.md frontmatter, output schemas
│   └── step-pattern/          # linear, branching, verification-loop
├── knowledge-design/          # Domain/field/option hierarchy; field types; variableName conventions
│   └── field-type/            # select, multiSelect, text, number
└── naming-conventions/        # All naming rules: kebab-case slugs, PascalCase agents, snake_case flow IDs
    └── element-type/          # agent-names, flow-ids, folders-and-slugs, variables
```

**Functions (3):**

```
functions/
├── validateSpace.tsx          # validateSpace(path): ValidationResult — checks required files, naming rules
├── listSpaceFiles.tsx         # listSpaceFiles(path): SpaceFileTree — annotated tree with pillar labels
└── diffSpaceChanges.tsx       # diffSpaceChanges(path, baseline): FileDiff[] — shows what changed vs a snapshot
```

**Components (2):**

```
components/
├── view/SpaceFileTree.tsx     # Renders space directory as annotated tree with pillar color-coding
└── form/AgentConfigForm.tsx   # Form to fill agent config.json fields (title, model, actions, knowledge refs)
```

**Files to create:**

```
org/libs/thing/spaces/space-spaces/
├── package.json
├── agents/
│   ├── agent-space-architect/  config.json + instruct.md
│   ├── agent-space-editor/     config.json + instruct.md
│   ├── agent-file-operator/    config.json + instruct.md
│   └── agent-knowledge-weaver/ config.json + instruct.md
├── flows/
│   ├── flow_create_space/      index.md + 7 step files
│   ├── flow_edit_agent/        index.md + 4 step files
│   ├── flow_add_knowledge/     index.md + 5 step files
│   ├── flow_add_flow/          index.md + 4 step files
│   ├── flow_add_component/     index.md + 3 step files
│   └── flow_add_function/      index.md + 3 step files
├── functions/
│   ├── validateSpace.tsx
│   ├── listSpaceFiles.tsx
│   └── diffSpaceChanges.tsx
├── components/
│   ├── view/SpaceFileTree.tsx
│   └── form/AgentConfigForm.tsx
└── knowledge/
    ├── space-structure/         config.json + pillar/ (5 options)
    ├── file-block-syntax/       config.json + operation/ (3 options)
    ├── agent-design/            config.json + pattern/ (3 options)
    ├── flow-design/             config.json + step-pattern/ (3 options)
    ├── knowledge-design/        config.json + field-type/ (4 options)
    └── naming-conventions/      config.json + element-type/ (4 options)
```

**Relationship to `space-creator`:** `space-spaces` is the autonomous runtime space (used by THING internally). `space-creator` remains the user-facing guided flow (SpaceArchitect walks the user through creation interactively). Both are built-in; `space-spaces` is wired as a dependency of THING's self-growing loop (Phase 11).

---

### Phase 13 — Built-in Space: `space-web-research`
**Goal:** Web research and deep web research space. Provides everything the THING agent needs to gather, evaluate, and structure information from the web before creating a space or answering a knowledge-heavy request.

**Location:** `org/libs/thing/spaces/space-web-research/`

**Agents (3):**

| Agent | Role |
|-------|------|
| `WebResearcher` | Quick research: single query → top results → clean summary. Entry point for most requests. |
| `DeepResearcher` | Multi-round research: iterative queries, follows citations, scrapes 5–10 sources, synthesizes across them |
| `ContextBuilder` | Structures raw research output into lmthing knowledge format: domains, fields, option files ready to paste into a space |

**Flows (4):**

```
flows/
├── flow_quick_research/         # 3 steps: query → scrape top 3 → summarize
├── flow_deep_research/          # 6 steps: initial query → identify sub-topics → parallel scrape → cross-validate → synthesize → structured output
├── flow_prepare_space_context/  # 5 steps: topic → deep research → extract knowledge domains → format options → review
└── flow_fact_check/             # 4 steps: claim → find 3 independent sources → compare → verdict + citations
```

**Knowledge (4 domains):**

```
knowledge/
├── search-strategy/             # Query construction: narrow vs broad, boolean operators, site: filters
│   └── technique/               # keyword-expansion, boolean-search, domain-filter, date-filter
├── source-evaluation/           # How to judge sources: authority, recency, cross-validation, bias signals
│   └── signal/                  # domain-authority, publication-date, cross-reference, primary-vs-secondary
├── synthesis-patterns/          # How to combine multiple sources: agreement-first, conflict-surfacing, gap-detection
│   └── method/                  # consensus-summary, conflict-map, gap-analysis, hierarchical-outline
└── context-format/              # How to format research output for space creation: domain mapping, option writing
    └── output-type/             # knowledge-option, agent-instruct-context, flow-step-brief, raw-notes
```

**Functions (4):**

```
functions/
├── webSearch.tsx          # webSearch(query, opts?): SearchResult[] — wraps catalog search module (Phase 10)
├── scrapeUrl.tsx          # scrapeUrl(url, opts?): string — wraps catalog scrape, returns clean markdown
├── deepSearch.tsx         # deepSearch(seed, opts?): DeepResearchResult — multi-round: search → scrape → extract sub-topics → recurse
└── formatAsKnowledgeOption.tsx  # formatAsKnowledgeOption(content, title, order): string — produces valid option .md frontmatter + body
```

**Components (2):**

```
components/
├── view/ResearchSummary.tsx     # Renders research results: source list, key findings, confidence level
└── view/SourceCard.tsx          # Single source: title, url, excerpt, quality signals
```

**Files to create:**

```
org/libs/thing/spaces/space-web-research/
├── package.json
├── agents/
│   ├── agent-web-researcher/     config.json + instruct.md
│   ├── agent-deep-researcher/    config.json + instruct.md
│   └── agent-context-builder/    config.json + instruct.md
├── flows/
│   ├── flow_quick_research/      index.md + 3 step files
│   ├── flow_deep_research/       index.md + 6 step files
│   ├── flow_prepare_space_context/ index.md + 5 step files
│   └── flow_fact_check/          index.md + 4 step files
├── functions/
│   ├── webSearch.tsx
│   ├── scrapeUrl.tsx
│   ├── deepSearch.tsx
│   └── formatAsKnowledgeOption.tsx
├── components/
│   └── view/
│       ├── ResearchSummary.tsx
│       └── SourceCard.tsx
└── knowledge/
    ├── search-strategy/          config.json + technique/ (4 options)
    ├── source-evaluation/        config.json + signal/ (4 options)
    ├── synthesis-patterns/       config.json + method/ (4 options)
    └── context-format/           config.json + output-type/ (4 options)
```

**Integration:** `space-web-research` is a dependency of `space-spaces`' `flow_create_space` (step 1: research the topic). It's also enabled as a direct catalog in the THING agent entry point (Phase 9). `ContextBuilder` outputs are designed to paste directly into `space-spaces` knowledge option files.

---

### Phase 14 — Built-in Space: `space-lmthing`
**Goal:** Platform knowledge space. Gives the THING agent and its spawned sub-agents a deep, up-to-date understanding of the lmthing ecosystem: all services, spaces, APIs, globals, model options, billing tiers, and runtime environments. The agent can answer "what can lmthing do?", navigate to the right service, and help users integrate the platform into their projects.

**Location:** `org/libs/thing/spaces/space-lmthing/`

**Agents (3):**

| Agent | Role |
|-------|------|
| `PlatformGuide` | Explains lmthing services, capabilities, and how they connect. Entry point for "how does X work?" questions. |
| `SpaceNavigator` | Recommends the right built-in or catalog space for a given task; explains what each space can do |
| `IntegrationHelper` | Helps users integrate lmthing into their projects: `runAgent()`, `runThingAgent()`, Vercel AI SDK patterns, CLI usage |

**Flows (3):**

```
flows/
├── flow_explore_lmthing/     # 4 steps: identify interest area → explain service → show capabilities → suggest next step
├── flow_find_right_space/    # 4 steps: understand task → scan space catalog → match + explain → demo call syntax
└── flow_integrate_core/      # 5 steps: use-case → choose entry point (runAgent/runThingAgent/CLI) → write config → wire globals → test
```

**Knowledge (6 domains):**

```
knowledge/
├── platform-overview/        # All 10 lmthing.* services with purpose, runtime, primary users
│   └── service/              # studio, chat, computer, space, social, team, store, blog, casa, cloud
├── space-catalog/            # All 10 built-in spaces (7 original + 3 new) with agents, flows, capabilities
│   └── space/                # space-creator, space-ecosystem, space-studio, space-chat, space-computer,
│                             #   space-deploy, space-store, space-spaces, space-web-research, space-lmthing
├── globals-reference/        # All 30+ REPL globals: stop, display, ask, async, fork, speculate, vectorSearch, space, etc.
│   └── global/               # grouped: control, display, knowledge, concurrency, space, memory
├── api-patterns/             # Key integration patterns: runAgent(), runThingAgent(), streaming, hooks, catalog
│   └── pattern/              # run-agent, run-thing, stream-consume, hook-intercept, catalog-use
├── model-guide/              # All provider/model combos, when to use each, cost tier implications
│   └── provider/             # openai, anthropic, google, azure, groq, mistral, lmthing-proxy
└── billing-tiers/            # Tier features, limits, budget reset cycles, upgrade triggers
    └── tier/                 # free, starter, basic, pro, max
```

**Files to create:**

```
org/libs/thing/spaces/space-lmthing/
├── package.json
├── agents/
│   ├── agent-platform-guide/    config.json + instruct.md
│   ├── agent-space-navigator/   config.json + instruct.md
│   └── agent-integration-helper/ config.json + instruct.md
├── flows/
│   ├── flow_explore_lmthing/   index.md + 4 step files
│   ├── flow_find_right_space/  index.md + 4 step files
│   └── flow_integrate_core/    index.md + 5 step files
└── knowledge/
    ├── platform-overview/      config.json + service/ (10 options)
    ├── space-catalog/          config.json + space/ (10 options)
    ├── globals-reference/      config.json + global/ (6 options)
    ├── api-patterns/           config.json + pattern/ (5 options)
    ├── model-guide/            config.json + provider/ (7 options)
    └── billing-tiers/          config.json + tier/ (5 options)
```

**Maintenance:** `space-lmthing` knowledge is kept in sync with the codebase — when a new global is added to `globals.ts`, `globals-reference` gets a new option. When a new service ships, `platform-overview` and `space-catalog` are updated. The `SpaceNavigator` agent uses `space.list()` at runtime to augment its static knowledge with the user's currently loaded spaces.

---

### Phase 15 — Cross-Space References in Knowledge
**Goal:** Knowledge markdown files can reference agents, flows, functions, components, or knowledge from other spaces using a structured syntax. The THING agent can discover these references and load the referenced spaces on-demand.

**Syntax for cross-space references:**

```markdown
---
title: Recipe Development
order: 1
references:
  - type: agent
    space: space-studio
    id: agent-prompt-coach
    context: "Use for optimizing agent instructions"
  - type: flow
    space: space-web-research
    id: flow_deep_research
    context: "For multi-source research on ingredients"
  - type: knowledge
    space: space-lmthing
    domain: model-guide
    field: provider
    option: anthropic
    context: "Claude models for recipe generation"
---

When developing recipes, consult the Prompt Coach agent from space-studio for instruction refinement...
```

**Files:**
- `org/libs/repl/src/knowledge/knowledge-types.ts` (extend `KnowledgeOption` interface)
- `org/libs/repl/src/knowledge/tree-builder.ts` (parse `references` frontmatter)
- `org/libs/repl/src/knowledge/references.ts` (new)
  - `interface SpaceReference { type: 'agent'|'flow'|'function'|'component'|'knowledge'; space: string; id?: string; domain?: string; field?: string; option?: string; context?: string }`
  - `parseReferences(option: KnowledgeOption): SpaceReference[]`
  - `formatReferenceForPrompt(ref: SpaceReference): string`
- `org/libs/repl/src/context/prompt/sections/knowledge.ts` (update to include references in the knowledge tree)

**Work:**

1. Extend YAML frontmatter parsing in `tree-builder.ts` to extract the `references` array from knowledge option files.

2. Create `parseReferences()` that validates reference syntax:
   - `type` must be one of: `agent`, `flow`, `function`, `component`, `knowledge`
   - For `agent`: needs `space` and `id` (e.g., `agent-prompt-coach`)
   - For `flow`: needs `space` and `id` (e.g., `flow_deep_research`)
   - For `function`: needs `space` and function name
   - For `component`: needs `space`, `view` or `form`, and component name
   - For `knowledge`: needs `space`, `domain`, optionally `field` and `option`

3. In the knowledge tree builder, attach references to each knowledge node. When building the system prompt's knowledge section, include a "Related Resources" subsection that lists the references with their context:

   ```
   ### Knowledge Domain: recipe-development / Recipe Development

   [Option content...]

   **Related Resources:**
   - Agent: space-studio.agent-prompt-coach — Use for optimizing agent instructions
   - Flow: space-web-research.flow_deep_research — For multi-source research on ingredients
   - Knowledge: space-lmthing.model-guide.provider.anthropic — Claude models for recipe generation
   ```

4. Validate that referenced spaces/agents exist when the knowledge is loaded. If a reference points to an unloaded space, flag it with `[NOT LOADED]` in the prompt.

**Outcome:** Knowledge files explicitly declare their dependencies on other spaces. The agent can see these dependencies and decide to load the referenced spaces.

---

### Phase 16 — Lazy Space Loading via References
**Goal:** When the agent encounters a reference to an unloaded space, it can load that space on-demand using new `space.get()` and `space.ensureLoaded()` APIs.

**Extended `space` namespace API:**

```ts
space {
  // ... existing create/load/install/list/describe

  // Get a specific resource from a space (loads the space first if needed)
  get(type: 'agent', space: string, id: string): Promise<AgentInfo>
  get(type: 'flow', space: string, id: string): Promise<FlowInfo>
  get(type: 'knowledge', space: string, domain: string, field?: string, option?: string): Promise<KnowledgeContent>
  get(type: 'function', space: string, name: string): Promise<FunctionSignature>
  get(type: 'component', space: string, kind: 'view'|'form', name: string): Promise<ComponentInfo>

  // Ensure a space is loaded; load from disk if not
  ensureLoaded(slug: string): Promise<void>

  // Resolve all references found in a knowledge option
  resolveReferences(option: KnowledgeOption): Promise<ResolvedReference[]>

  // Check if a space is currently loaded
  isLoaded(slug: string): boolean
}
```

**Files:**
- `org/libs/core/src/agent-namespaces.ts` (extend `createSpaceNamespace`)
- `org/libs/core/src/cli/agent-loop.ts` (add `ensureSpaceLoaded` method)
- `org/libs/core/src/cli/run-agent.ts` (wire `onEnsureLoaded` callback)
- `org/libs/repl/src/knowledge/references.ts` (add `resolveReferences()`)

**Work:**

1. `space.ensureLoaded(slug)`:
   - Check if `slug` is in the loaded spaces list
   - If not, search `userSpacesDir` for a directory matching the slug (with `package.json`)
   - If found, call `agentLoop.addSpace(path)`
   - If not found, search built-in spaces paths
   - Throw if the space cannot be located

2. `space.get(type, ...args)`:
   - Calls `space.ensureLoaded(refSpace)` first
   - Reads the requested resource from the loaded space
   - Returns a structured object with the resource's content (e.g., for an agent: config.json + instruct.md summary)

3. `space.resolveReferences(option)`:
   - Parse the references from the knowledge option
   - For each reference, call `space.ensureLoaded(ref.space)`
   - Fetch the referenced content using `space.get()`
   - Return an array of resolved references with their actual content

4. In the knowledge tree builder, after attaching references to nodes, add a helper global: `resolveRefs()` that the agent can call to load and fetch referenced content:

   ```ts
   // In the agent's context
   const related = await resolveRefs(knowledgeOption)
   // related = [{ type: 'agent', space: 'space-studio', id: 'agent-prompt-coach', content: {...} }]
   ```

5. Update the system prompt's knowledge section to include a prompt for the agent to use `resolveRefs()` or `space.get()` when it wants to access referenced content.

**Outcome:**

```ts
// Agent encounters a knowledge option with references
stop(cooking_knowledge.recipe_development)
// Shows: "Related Resources: space-studio.agent-prompt-coach [NOT LOADED]"

// Agent loads the referenced space on-demand
await space.ensureLoaded('space-studio')

// Agent fetches the specific agent
const coach = await space.get('agent', 'space-studio', 'agent-prompt-coach')
// coach = { title: 'PromptCoach', instruct: '...', config: {...} }

// Or resolve all references at once
const related = await resolveRefs(cooking_knowledge.recipe_development)
// Loads all referenced spaces and returns their content
```

The THING agent grows its capabilities incrementally — it starts with core spaces, discovers cross-space references in knowledge, and loads referenced spaces as needed without manual intervention.

---

### Phase 17 — Automatic Reference Loading on Agent Spawn
**Goal:** When an agent spawns (via namespace call), automatically load any spaces referenced in that agent's accessible knowledge. This ensures agents have their dependencies available before execution.

**Files:**
- `org/libs/core/src/cli/agent-loop.ts` (update `handleSpawn` to check references)
- `org/libs/core/src/agent-namespaces.ts` (add `collectAgentReferences(agentInfo)`)
- `org/libs/repl/src/knowledge/references.ts` (add `collectReferencesFromAgentTree()`)

**Work:**

1. Before spawning a child agent, the parent agent loop should:
   - Read the agent's `config.json` to get its knowledge references
   - For each referenced knowledge domain, parse its option files for `references` frontmatter
   - Build a set of unique space slugs that need to be loaded
   - Call `space.ensureLoaded(slug)` for each

2. Add `collectAgentReferences(agentInfo: AgentInfo): Set<string>` that returns all space slugs referenced in an agent's accessible knowledge.

3. In `AgentLoop.handleSpawn()`:
   ```ts
   // Before creating the child sandbox
   const referencedSpaces = await collectAgentReferences(agentToSpawn)
   for (const slug of referencedSpaces) {
     await this.ensureSpaceLoaded(slug) // or this.agentLoopRef?.ensureSpaceLoaded(slug)
   }
   // Then proceed with spawn
   ```

4. This is recursive: if the child agent's references have their own references, those get loaded too (with a depth limit to prevent circular reference explosions).

5. Add a global flag to disable auto-loading if the user wants explicit control: `space.autoLoadReferences = false` (default: `true`).

**Outcome:** When THING calls `greek_cooking.recipe_advisor(...)` and `RecipeAdvisor` has knowledge that references `space-studio` and `space-web-research`, those spaces are loaded automatically before `RecipeAdvisor` begins execution. The agent doesn't need to manually call `ensureLoaded` — dependencies are resolved implicitly.

---

## Dependency Order

```
Phase 1 (spawn)          ← unblocks all agent namespace calls
    │
    ├── Phase 2 (speculate)       ← independent
    ├── Phase 3 (vectorSearch)    ← independent
    └── Phase 4 (prompt refactor) ← independent; prerequisite for Phase 8's targeted rebuild
            │
            ├── Phase 5 (git commits)  ← independent, feeds Phase 6
            │
            ▼
        Phase 6 (space creation via file blocks + scaffoldSpace helper)
            │
            ▼
        Phase 7 (space namespace: create / load / install)
            │
            ▼
        Phase 8 (dynamic space loading — calls builder.updateAgents())
            │
            ├── Phase 10 (web search catalog module) ← can run in parallel with 6–8
            │
            ▼
        Phase 9 (THING agent entry point)
            │
            ▼
        Phase 11 (space-creator automation — needs all above)
            │
            ├── Phase 13 (space-web-research) ← wraps Phase 10; can build in parallel with 12/14
            ├── Phase 14 (space-lmthing)      ← pure knowledge, no code deps; can build in parallel
            │
            ▼
        Phase 12 (space-spaces — depends on Phase 11 patterns + Phase 13 for research flow)
            │
            ▼
        Phase 15 (cross-space references in knowledge — extends Phase 12's knowledge design)
            │
            ▼
        Phase 16 (lazy space loading via space.get/ensureLoaded — extends Phase 7)
            │
            ▼
        Phase 17 (automatic reference loading on agent spawn — needs Phase 1 + Phase 15)
```

---

## End State: How It All Works Together

1. User starts: `runThingAgent({ model: 'openai:gpt-4o', port: 3030 })`
2. THING boots with **10 built-in spaces** + any existing user spaces in `~/.lmthing/spaces/`; `fileWorkingDir` = `~/.lmthing/spaces/`

   Built-in spaces available at startup:
   - `space-creator` — guided space creation (interactive, user-facing)
   - `space-ecosystem` — platform navigation, account and billing management
   - `space-studio` — agent building, workspace management, prompt optimization
   - `space-chat` — personal chat interface
   - `space-computer` — compute pod management and troubleshooting
   - `space-deploy` — space deployment lifecycle
   - `space-store` — agent marketplace publishing
   - **`space-spaces`** — autonomous space file operations (create, edit, CRUD all pillars)
   - **`space-web-research`** — web and deep research, context preparation
   - **`space-lmthing`** — full platform knowledge, space navigation, integration help

3. User asks: "Help me plan a Greek feast for 10 people"
4. THING checks its spaces — no Greek cooking space; consults `space_lmthing.space_navigator` → confirms no catalog match
5. THING delegates to `space_web_research.deep_researcher` → 8 sources on Greek cuisine, structured knowledge output
6. THING delegates to `space_spaces.space_architect` → designs `greek-cooking` space structure
7. THING writes space files directly via four-backtick blocks; `space_spaces.file_operator` verifies each write with `validateSpace()`

   The knowledge files include cross-space references:

   ```markdown
   ---
   title: Menu Planning
   order: 1
   references:
     - type: agent
       space: space-studio
       id: agent-prompt-coach
       context: "Use for refining menu planning instructions"
     - type: flow
       space: space-web-research
       id: flow_deep_research
       context: "For researching seasonal ingredient availability"
   ---
   ```

8. `space.load('~/.lmthing/spaces/greek-cooking')` → namespace live; each write was a git commit
9. THING calls `greek_cooking.recipe_advisor({ 'menu-planning': {} }).create_menu("feast for 10")`
10. Before `RecipeAdvisor` spawns, Phase 17 auto-loading kicks in:
    - `RecipeAdvisor`'s knowledge has references to `space-studio` and `space-web-research`
    - `space.ensureLoaded('space-studio')` and `space.ensureLoaded('space-web-research')` are called automatically
    - Both spaces are now available in the child agent's context
11. `RecipeAdvisor` child agent runs, returns structured menu; THING presents result
12. Next session: `greek_cooking` already exists — `space_spaces.space_editor` refines via diff patches as needed
13. User discovers a published space: `space.install('npm:@lmthing/space-wine-pairing')` → downloaded, loaded, callable
14. THING can explicitly query referenced content:

    ```ts
    // Load and fetch a specific referenced agent
    const coach = await space.get('agent', 'space-studio', 'agent-prompt-coach')

    // Resolve all references from a knowledge option
    const related = await resolveRefs(greek_cooking.menu_planning)
    // Returns: [{ type: 'agent', space: 'space-studio', id: 'agent-prompt-coach', content: {...} }, ...]
    ```

`learn()` calls and diff-patched knowledge files persist across all sessions in git. The space ecosystem grows and improves continuously. Cross-space references allow agents to discover and load their dependencies automatically, making the THING agent's capabilities expand organically as it encounters new domains.

---

## File Summary

| New File | Purpose |
|----------|---------|
| `org/libs/repl/src/context/prompt/builder.ts` | `SystemPromptBuilder` — composable, section-cached prompt assembly |
| `org/libs/repl/src/context/prompt/config.ts` | `SystemPromptConfig` interface |
| `org/libs/repl/src/context/prompt/focus.ts` | `FocusController` — section collapse/expand logic |
| `org/libs/repl/src/context/prompt/sections/role.ts` | Role section builder |
| `org/libs/repl/src/context/prompt/sections/globals.ts` | Globals docs + section builder (content moved from core) |
| `org/libs/repl/src/context/prompt/sections/scope.ts` | Scope / pinned / memo section builder |
| `org/libs/repl/src/context/prompt/sections/components.ts` | Form + display components section builder |
| `org/libs/repl/src/context/prompt/sections/functions.ts` | Functions + classes section builder |
| `org/libs/repl/src/context/prompt/sections/agents.ts` | Agents + knowledge namespace section builder |
| `org/libs/repl/src/context/prompt/sections/knowledge.ts` | Knowledge tree section builder |
| `org/libs/repl/src/context/prompt/sections/rules.ts` | Rules section builder |
| `org/libs/repl/src/context/prompt/sections/instruct.ts` | Instruct section builder |
| `org/libs/repl/src/sandbox/vector-index.ts` | TF-IDF in-memory vector search |
| `org/libs/repl/src/knowledge/space-writer.ts` | `scaffoldSpace()` — programmatic space directory writer |
| `org/libs/repl/src/catalog/search.ts` | `webSearch()`, `scrapeUrl()` catalog module |
| `org/libs/core/src/thing-agent.ts` | `runThingAgent()` entry point |
| `org/libs/thing/spaces/space-creator/flows/flow_research_and_create/` | 6-step research-and-create flow |
| `org/libs/thing/spaces/space-creator/knowledge/space-structure/component-type/file-blocks.md` | File-block syntax reference for SpaceArchitect |

| Modified File | Change |
|---------------|--------|
| `org/libs/core/src/cli/buildSystemPrompt.ts` | Becomes thin adapter: constructs `SystemPromptConfig`, delegates to `SystemPromptBuilder` |
| `org/libs/core/src/cli/run-agent.ts` | Wire real `onSpawn`, `onSpeculate`, space namespace, `fileWorkingDir` |
| `org/libs/core/src/cli/agent-loop.ts` | Hold `SystemPromptBuilder`; replace full rebuilds with `updateAgents/updateKnowledge/updateScope`; add `handleSpeculate`, `addSpace`, `getSpawnContext` |
| `org/libs/core/src/agent-namespaces.ts` | Add `createSpaceNamespace` with `create/load/install/list/describe`, `formatSpaceNamespaceForPrompt` |
| `org/libs/repl/src/sandbox/globals.ts` | Add `vectorSearch` global |
| `org/libs/repl/src/session/session.ts` | Wire `VectorIndex`, extract comments at each `stop()` |
| `org/libs/repl/src/stream/file-block-applier.ts` | Git commit after each successful write/diff |
| `org/libs/repl/src/catalog/index.ts` | Register `search` module |
| `org/libs/repl/src/index.ts` | Export `SystemPromptBuilder`, `SystemPromptConfig`, `scaffoldSpace`, `VectorIndex` |
| `org/libs/core/src/index.ts` | Export `runThingAgent` |
| `org/libs/thing/spaces/space-creator/agents/agent-space-architect/instruct.md` | Add file-block patterns, `space.load()`, research workflow |

**Cross-Space References (Phases 15–17):**

| New File | Purpose |
|----------|---------|
| `org/libs/repl/src/knowledge/references.ts` | `SpaceReference` type, `parseReferences()`, `formatReferenceForPrompt()`, `resolveReferences()`, `collectAgentReferences()`, `collectReferencesFromAgentTree()` |
| `org/libs/repl/src/knowledge/knowledge-types.ts` | Extend `KnowledgeOption` interface to include `references?: SpaceReference[]` |
| `org/libs/repl/src/knowledge/tree-builder.ts` | Parse `references` frontmatter from knowledge option files |
| `org/libs/repl/src/context/prompt/sections/knowledge.ts` | Include "Related Resources" subsection in knowledge tree output |
| `org/libs/core/src/cli/agent-loop.ts` | Add `ensureSpaceLoaded(slug)`, update `handleSpawn()` to auto-load referenced spaces |
| `org/libs/core/src/agent-namespaces.ts` | Extend `space` namespace with `get()`, `ensureLoaded()`, `resolveReferences()`, `isLoaded()`, `autoLoadReferences` flag |

**New Built-in Spaces (Phases 12–14):**

| New Space | Purpose |
|-----------|---------|
| `org/libs/thing/spaces/space-spaces/` | Autonomous space file operations — 4 agents, 6 flows, 3 functions, 2 components, 6 knowledge domains |
| `org/libs/thing/spaces/space-web-research/` | Web and deep research, context structuring — 3 agents, 4 flows, 4 functions, 2 view components, 4 knowledge domains |
| `org/libs/thing/spaces/space-lmthing/` | Full platform knowledge, space navigation, integration help — 3 agents, 3 flows, 6 knowledge domains |
