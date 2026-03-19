# Phase 1b: Agent Namespaces

## Context

The REPL needs to expose space agents as callable namespace globals. Agents from the **current space** and from **dependency spaces** (declared in `package.json` `spaces` field) become chainable objects in the sandbox. An agent's `config.json` gets a new `"agents"` field to control which dependency-space agents it can access.

**Namespace shape**: dependency agents are nested under the parent space:

```ts
// Own space agents — direct children of the space namespace
var steak = cooking.general_advisor({ technique: "saute" }).mealplan("How to cook a steak?");

// Dependency space agents — nested under parent space
var plan = plants.scheduler.planner({}).plan("water schedule");
var diag = plants.diagnostics.analyzer({}).diagnose("yellow leaves");

// Chaining context options
var research = cooking
  .general_advisor({})
  .mealplan("suggest improvements")
  .options({ context: "branch" });
```

**Dependency on Phase 1a**: Phase 1a provides the actual child session creation. Phase 1b defines the `onSpawn` callback as the bridge. Until Phase 1a is implemented, `onSpawn` is a stub that throws.

---

## Space Dependency Format

From `spaces/cooking/package.json`:

```json
{
  "name": "cooking-demo",
  "version": "1.0.0",
  "private": true,
  "spaces": {
    "npm:@lmthing/space/french-cooking": "latest",
    "github:lmthing/space/italian-cooking": "latest",
    "../../packages/space/space": "latest"
  }
}
```

Three URI formats:

- `npm:@scope/package` — npm package (resolution deferred to Phase 1a)
- `github:org/repo/path` — GitHub repo (resolution deferred to Phase 1a)
- `relative/or/absolute/path` — local directory (supported in Phase 1b)

## Agent Config Format (NEW `agents` field)

```json
{
  "knowledge": { "cuisine": { "type": "italian" }, "technique": true },
  "agents": {
    "npm:@lmthing/space/french-cooking": ["chef", "sommelier"],
    "github:lmthing/space/italian-cooking": true,
    "../../packages/space/space": ["assistant"]
  },
  "functions": ["catalog/fs"],
  "components": ["MealPlanCard"]
}
```

- Key = space URI from parent's `package.json` `spaces` field
- Value = `true` (all agents) or `string[]` (specific agent slugs)

---

## Implementation Steps

### Step 1: Add spawn types — `src/session/types.ts`

```ts
export interface SpawnOptions {
  context: "empty" | "branch";
}

export interface SpawnConfig {
  spaceDir: string; // resolved directory of the space containing the agent
  spaceName: string; // namespace display name (e.g., "cooking")
  agentSlug: string; // agent directory name (e.g., "general-advisor")
  actionId: string;
  request: string;
  params: Record<string, any>;
  options: SpawnOptions;
}

export interface SpawnResult {
  scope: Record<string, any>;
  result: any;
  keyFiles?: string[];
  issues?: string[];
}
```

Add spawn events to the `SessionEvent` union:

```ts
| { type: 'spawn_start'; spaceName: string; agentSlug: string; actionId: string }
| { type: 'spawn_complete'; spaceName: string; agentSlug: string; actionId: string; result: SpawnResult }
| { type: 'spawn_failed'; spaceName: string; agentSlug: string; actionId: string; error: string }
```

### Step 2: Add `onSpawn` to `GlobalsConfig` — `src/sandbox/globals.ts`

One line in the `GlobalsConfig` interface:

```ts
onSpawn?: (config: SpawnConfig) => Promise<SpawnResult>
```

### Step 3: Extend agent-loader — `src/cli/agent-loader.ts`

Add `enabledAgents` field to `LoadedAgent`:

```ts
export interface LoadedAgent {
  // ... existing fields
  enabledAgents: Record<string, string[] | true>; // NEW: space URI → agent slugs or true
}
```

In `loadAgent()`, parse the new field:

```ts
enabledAgents: config.agents ?? {},
```

### Step 4: Create `src/sandbox/agent-namespaces.ts` (NEW)

Core module — ~350 lines. Five exports:

#### 4a. Types

```ts
export interface SpaceAgentTree {
  spaceName: string; // namespace id (e.g., "cooking")
  spaceDir: string;
  agents: AgentEntry[];
  dependencies: DependencyTree[]; // nested spaces
}

export interface DependencyTree {
  namespaceName: string; // e.g., "french_cooking"
  uri: string; // original URI from package.json
  spaceDir: string | null; // resolved path (null if unresolvable npm/github)
  agents: AgentEntry[];
}

export interface AgentEntry {
  slug: string; // namespace id (e.g., "general_advisor")
  rawSlug: string; // directory name (e.g., "general-advisor")
  title: string;
  actions: AgentAction[];
  paramSchema: ParamSchema;
}

export interface ParamSchema {
  domains: Record<string, DomainParam>;
}

export interface DomainParam {
  fields: Record<string, { optional: boolean; enum?: string[] }>;
}
```

#### 4b. `readSpaceDependencies(spaceDir)`

Reads `package.json` `spaces` field. For each entry:

- Local paths → resolve relative to spaceDir, verify it exists
- `npm:` / `github:` → store URI, set `spaceDir: null` (resolution deferred)

Returns `Map<uri, { namespaceName, spaceDir }>`.

Namespace name extraction:

- `npm:@scope/french-cooking` → `french_cooking` (last segment, kebab to snake)
- `github:org/repo/italian-cooking` → `italian_cooking` (last segment)
- `../../path/to/my-space` → read resolved dir's `package.json` name, or use directory basename

#### 4c. `buildSpaceAgentTrees(spacePaths, knowledgeTrees)`

For each loaded space:

1. List `agents/` subdirectories, call `loadAgent()` for each
2. Extract param schema from `knowledgeDefaults` × `KnowledgeTree`
3. Read space dependencies via `readSpaceDependencies()`
4. For each agent's `enabledAgents`, resolve which dependency-space agents to include
5. For resolvable dependencies (local paths), load those agents too
6. Build the full `SpaceAgentTree` with own agents + dependency trees

Slug conversion: `toNamespaceId(name, prefix?)` — strips prefix, replaces `-` with `_`

- `"general-advisor"` → `"general_advisor"` (agent dirs, no `agent-` prefix based on actual dirs)
- `"space-cooking"` → `"cooking"` (strip `space-` prefix)
- `"cooking-demo"` → `"cooking_demo"` (package.json names)

Note: The actual cooking space uses directory name `general-advisor` (no `agent-` prefix), unlike the THING spaces which use `agent-space-architect`. The code handles both by checking for `agent-` prefix and stripping if present.

#### 4d. `createNamespaceGlobals(trees, onSpawn)`

Returns `Record<string, unknown>` — one entry per loaded space.

Each space namespace object has:

- **Own agent methods** as direct properties: `cooking.general_advisor(params)`
- **Dependency sub-namespaces**: `cooking.french_cooking.chef(params)`

```ts
function buildSpaceNamespace(tree: SpaceAgentTree, onSpawn): object {
  const ns: Record<string, any> = {};

  // Own agents
  for (const agent of tree.agents) {
    ns[agent.slug] = buildAgentCallable(tree.spaceDir, tree.spaceName, agent, onSpawn);
  }

  // Dependency spaces (nested)
  for (const dep of tree.dependencies) {
    if (!dep.spaceDir) continue; // skip unresolvable
    const depNs: Record<string, any> = {};
    for (const agent of dep.agents) {
      depNs[agent.slug] = buildAgentCallable(dep.spaceDir, dep.namespaceName, agent, onSpawn);
    }
    ns[dep.namespaceName] = depNs;
  }

  return ns;
}

function buildAgentCallable(spaceDir, spaceName, agent, onSpawn) {
  return (params = {}) => {
    const actions: Record<string, Function> = {};
    for (const action of agent.actions) {
      actions[action.id] = (request: string) => {
        return new ChainableSpawnPromise(onSpawn, {
          spaceDir,
          spaceName,
          agentSlug: agent.rawSlug,
          actionId: action.id,
          request,
          params,
          options: { context: "empty" },
        });
      };
    }
    return actions;
  };
}
```

#### 4e. `ChainableSpawnPromise`

Implements `PromiseLike<SpawnResult>`:

- Constructor stores config, creates inner Promise, defers start via `Promise.resolve().then(() => this.start())`
- `.options(opts)` modifies config before start, returns `this`
- `.then()`, `.catch()`, `.finally()` delegate to inner promise
- `start()` calls `onSpawn(config)`, resolves/rejects inner promise

Using `Promise.resolve().then()` instead of `queueMicrotask` because `queueMicrotask` may not be in the vm.Context — `Promise` is already whitelisted.

#### 4f. `formatAgentTreeForPrompt(trees)`

```
cooking {
  general_advisor({ cuisine?: { type?: 'italian' | 'japanese' }, technique?: { method?: 'saute' | 'grill' } }): {
    mealplan(request: string): Promise<SpawnResult>;
  }
  french_cooking {
    chef({ ... }): {
      recipe(request: string): Promise<SpawnResult>;
    }
  }
}
```

Dependency spaces are indented as sub-blocks under the parent space.

### Step 5: Wire into Session — `src/session/session.ts`

Add to `SessionOptions`:

```ts
agentNamespaces?: Record<string, unknown>
onSpawn?: (config: SpawnConfig) => Promise<SpawnResult>
```

In constructor, after injecting the 13 existing globals (~line 184):

```ts
if (options.agentNamespaces) {
  for (const [name, ns] of Object.entries(options.agentNamespaces)) this.sandbox.inject(name, ns);
}
```

Wire `onSpawn` through GlobalsConfig with spawn event emission.

### Step 6: Add `agentTree` to system prompt — `src/cli/buildSystemPrompt.ts`

Add 8th parameter `agentTree?: string` to `buildSystemPrompt()`.

Insert `## Available Agents` section after Display Components (before Knowledge Tree):

```ts
if (agentTree) {
  prompt += `\n\n## Available Agents
Spawn child agents from loaded spaces. Each call returns a Promise.
Use \`var result = space.agent(params).action(request)\` to track, or omit \`var\` for fire-and-forget.
Chain \`.options({ context: "branch" })\` to give the child your conversation history (default: "empty").

\`\`\`
${agentTree}
\`\`\`\n`;
}
```

### Step 7: Thread through AgentLoop — `src/cli/agent-loop.ts`

- Add `agentTree?: string` to `AgentLoopOptions` (line 31)
- Store as `private agentTree: string` in constructor
- Pass as 8th arg to all 3 `buildSystemPrompt()` call sites (lines 161, 198, 659)

### Step 8: Orchestrate in run-agent — `src/cli/run-agent.ts`

After space knowledge loading (~line 235):

1. Retain the `KnowledgeTree[]` objects (currently formatted immediately — save before formatting)
2. Call `buildSpaceAgentTrees(spacePaths, knowledgeTrees)` to build agent trees
3. Call `createNamespaceGlobals(trees, onSpawn)` — with a stub `onSpawn` that throws
4. Call `formatAgentTreeForPrompt(trees)` for the prompt string
5. Pass `agentNamespaces` to Session constructor
6. Pass `agentTree` to AgentLoop constructor

Refactor: save `KnowledgeTree[]` before formatting so it can be passed to `buildSpaceAgentTrees`.

### Step 9: Tests — `src/sandbox/agent-namespaces.test.ts` (NEW)

1. `toNamespaceId` slug conversion
2. `readSpaceDependencies` — parses package.json spaces field, resolves local paths
3. `buildSpaceAgentTrees` — own agents + dependency agents in correct structure
4. `createNamespaceGlobals` — `space.agent(params).action(request)` returns thenable
5. `createNamespaceGlobals` — nested deps: `space.dep.agent(params).action(request)` returns thenable
6. `ChainableSpawnPromise` — resolves with SpawnResult, `.options()` modifies before start, rejects on error
7. Parameter schema extraction from knowledge defaults + knowledge tree
8. `formatAgentTreeForPrompt` — renders own + dependency agents correctly
9. Agent `enabledAgents` filtering — only enabled dependency agents appear

---

## Files Summary

| File                                   | Change                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/session/types.ts`                 | Add SpawnConfig, SpawnOptions, SpawnResult, spawn events                                                                 |
| `src/sandbox/globals.ts`               | Add `onSpawn?` to GlobalsConfig (1 line)                                                                                 |
| `src/cli/agent-loader.ts`              | Add `enabledAgents` to LoadedAgent, parse `config.agents`                                                                |
| `src/sandbox/agent-namespaces.ts`      | **NEW** — tree building, dependency resolution, namespace globals, ChainableSpawnPromise, prompt formatting (~350 lines) |
| `src/sandbox/agent-namespaces.test.ts` | **NEW** — tests (~250 lines)                                                                                             |
| `src/session/session.ts`               | Add agentNamespaces + onSpawn to SessionOptions, inject, emit events                                                     |
| `src/cli/buildSystemPrompt.ts`         | Add agentTree param + Available Agents section                                                                           |
| `src/cli/agent-loop.ts`                | Add agentTree to options, thread to buildSystemPrompt (3 call sites)                                                     |
| `src/cli/run-agent.ts`                 | Build agent trees, create namespaces, wire into Session + AgentLoop                                                      |

---

## Scope Boundaries

**In scope (Phase 1b)**:

- Read `package.json` `spaces` field
- Resolve **local path** dependencies
- Parse agent config.json `agents` field (new feature)
- Build namespace globals with own agents + nested dependency agents
- ChainableSpawnPromise with `.options()` chaining
- System prompt `## Available Agents` section
- `onSpawn` callback bridge (stub until Phase 1a)

**Deferred**:

- npm/github dependency resolution (requires package registry / git clone — Phase 1a or separate)
- Actual child session spawning (Phase 1a)
- Agent registry / `{{AGENTS}}` tracking (Phase 1d)
- `respond()` for child-to-parent questions (Phase 1e)

---

## Verification

1. `pnpm vitest run src/sandbox/agent-namespaces.test.ts` — all unit tests pass
2. `pnpm vitest run` — no regressions in existing tests
3. Manual: load cooking space (which has `spaces` field in package.json), verify `## Available Agents` shows in system prompt with own agents and dependency stubs
4. Manual: `var x = cooking.general_advisor({}).mealplan("test")` creates a ChainableSpawnPromise (throws "spawn not implemented" — expected before Phase 1a)
