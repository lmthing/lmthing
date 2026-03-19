# CLAUDE.md — Streaming TypeScript REPL Agent

## Project Overview

A streaming TypeScript REPL agent system that executes LLM-generated code line-by-line with control primitives (`stop`, `display`, `ask`, `async`, `tasklist`, `completeTask`, `completeTaskAsync`, `taskProgress`, `failTask`, `retryTask`, `sleep`, `loadKnowledge`) and a React render surface. The agent writes only TypeScript — no prose — and the host runtime parses, executes, and renders in real time.

## Architecture

```
┌─────────────┐     token stream     ┌──────────────────┐     execute     ┌──────────────┐
│  LLM Agent  │ ──────────────────▶  │  Stream Parser &  │ ─────────────▶ │  TypeScript   │
│  (provider) │ ◀──────────────────  │  Line Accumulator │ ◀──────────── │  REPL Sandbox │
│             │   context injection  │                   │    results     │              │
└─────────────┘                      └──────────────────┘                └──────────────┘
                                            │                                   │
                                            ▼                                   │
                                     ┌──────────────┐                          │
                                     │  React       │ ◀────────────────────────┘
                                     │  Render      │    display() / ask() calls
                                     │  Surface     │
                                     └──────────────┘
```

Four subsystems:
1. **Stream Controller** — LLM connection, token accumulation (`src/stream/line-accumulator.ts`), bracket depth tracking (`src/stream/bracket-tracker.ts`), pause/resume, context injection
2. **Line Parser** — buffers tokens into complete statements, detects global calls (`src/parser/ast-utils.ts`, `src/parser/statement-detector.ts`)
3. **REPL Sandbox** — executes TypeScript line-by-line via `vm.Context` (`src/sandbox/sandbox.ts`), persistent scope, TS transpilation (`src/sandbox/transpiler.ts`), error capture (`src/sandbox/executor.ts`)
4. **React Render Surface** — mounts components from `display`/`ask`, handles forms (`src/components/`)

## Quick Reference

| Topic | Location |
|-------|----------|
| Token accumulation, pause/resume, context injection, serialization | [.claude/skills/stream-controller.md](.claude/skills/stream-controller.md) |
| Sandbox setup, scope persistence, TS compilation, error capture | [.claude/skills/repl-sandbox.md](.claude/skills/repl-sandbox.md) |
| All 12 globals — implementation details | [.claude/skills/globals.md](.claude/skills/globals.md) |
| AST pattern matching, hook actions, execution pipeline | [.claude/skills/hooks.md](.claude/skills/hooks.md) |
| SCOPE generation, knowledge tree, code window, stop payload decay, {{TASKS}} block | [.claude/skills/context-management.md](.claude/skills/context-management.md) |
| State machine, wire format, SessionConfig, type definitions | [.claude/skills/session-lifecycle.md](.claude/skills/session-lifecycle.md) |
| Sandbox isolation, function registry, JSX sanitization | [.claude/skills/security.md](.claude/skills/security.md) |
| Full implementation guide with code references | [HOW_TO.md](HOW_TO.md) |

## Specification Documents

| Document | Location |
|----------|----------|
| Agent System Prompt (what the LLM sees) | [docs/agent-system-prompt/](docs/agent-system-prompt/index.md) |
| Host Runtime Contract (how the host implements the protocol) | [docs/host-runtime-contract/](docs/host-runtime-contract/index.md) |
| UX Specification (what the user sees and interacts with) | [docs/ux-specification/](docs/ux-specification/index.md) |

## Key Concepts

### 12 Globals

All created in `src/sandbox/globals.ts` (`createGlobals()`) and injected into the sandbox at `src/session/session.ts`.

- **`await stop(...values)`** — Pause execution, serialize args (with argument name recovery via `recoverArgumentNames()`), merge async task results, inject as `← stop { ... }` user message. The agent's only way to read runtime values.
- **`display(jsx)`** — Non-blocking render of React components to the user's viewport. Generates unique ID, emits `display` event with serialized JSX.
- **`await ask(jsx)`** — Blocking form render. Pauses stream, renders `<form>`, waits for submission (timeout 5 min). Resumes silently — agent must call `stop` to see values. Cancellation resolves with `{ _cancelled: true }`, timeout with `{ _timeout: true }`. Form components: `TextInput`, `TextArea`, `NumberInput`, `Slider`, `Checkbox`, `Select`, `MultiSelect`, `DatePicker`, `FileUpload`.
- **`async(fn)`** — Fire-and-forget background task with `AbortController`. Results keyed as `async_0`, `async_1`, etc. Delivered via next `stop` call. Max concurrent tasks enforced. Cancellation sets `{ cancelled: true, message }`.
- **`tasklist(tasklistId, description, tasks)`** — Declare a task plan with milestones. Each task has `id`, `instructions`, `outputSchema`. Optional: `dependsOn` (DAG deps), `condition` (JS expression, auto-skip if falsy), `optional` (failure doesn't block dependents). Without `dependsOn`, tasks are implicitly sequential. With `dependsOn`, tasks form a DAG. Multiple tasklists per session supported. Max 20 tasks per tasklist. Cycle detection via topological sort.
- **`completeTask(tasklistId, taskId, output)`** — Mark task done with validated output matching `outputSchema`. Task must be in ready set. If agent stream ends with incomplete tasks, host injects `⚠ [system] Tasklist incomplete...` reminder (up to 3 times).
- **`completeTaskAsync(tasklistId, taskId, fn)`** — Launch task work in background. Return value becomes task output, delivered via next `stop()` as `task:<taskId>`. On throw, task marked failed; if optional, dependents unblocked.
- **`taskProgress(tasklistId, taskId, message, percent?)`** — Non-blocking progress update for running task. Displayed in `{{TASKS}}` block.
- **`failTask(tasklistId, taskId, error)`** — Mark task failed. Optional tasks that fail don't block dependents.
- **`retryTask(tasklistId, taskId)`** — Reset failed task to ready. Max 3 retries per task (configurable).
- **`await sleep(seconds)`** — Pause sandbox execution (max 30s). LLM stream and async tasks continue. Agent must call `stop()` after to read results.
- **`loadKnowledge(selector)`** — Synchronous. Load markdown from the space's knowledge base. Selector mirrors the knowledge tree: `{ domain: { field: { option: true } } }`. Returns same structure with markdown content. Knowledge content decays faster than other values.

### Conversation Protocol

Five types of user messages:

| Format | Meaning | Agent response |
|--------|---------|----------------|
| `← stop { ... }` | Values from `stop()` call | Continue writing code using those values |
| `← error [Type] ...` | Runtime error occurred | Write corrective code (don't redeclare existing `const`s) |
| Plain text (no prefix) | User intervention | Acknowledge with `//` comment, adjust approach |
| `⚠ [hook:id] ...` | Developer hook intercepted code | Comply with the hook's instruction |
| `⚠ [system] Tasklist incomplete...` | Stream ended with unfinished tasks | Continue from where you left off |

Turn boundaries are created by `stop`, `error`, user interventions, and hook interrupts. `ask` resumes silently — the assistant turn continues unbroken.

### `{{TASKS}}` Block

Appended to every `stop()` message when tasklists exist. Shows DAG state:

```
{{TASKS}}
┌ report ──────────────────────────────────────────────────────┐
│ ✓ scope              → { industry: "fintech", region: "EU" }│
│ ◉ data               (running — Fetching... 50%)            │
│ ✓ competitors        → { competitors: ["Stripe","Adyen"] }  │
│ ✗ sentiment          — API rate limited                      │
│ ○ compile            (blocked — waiting on: data)            │
└──────────────────────────────────────────────────────────────┘
```

| Symbol | State | Action |
|--------|-------|--------|
| `✓` | completed | Done — don't rework |
| `✗` | failed | `retryTask` or `failTask` |
| `⊘` | skipped | Condition was false — ignore |
| `◉` | running | Background task in progress — `sleep` + `stop` to check |
| `◎` | ready | Work on these next |
| `○` | pending | Blocked on dependencies |

Decay: full (0-2 turns), compact (3-5), removed (6+).

### Context Management

#### `{{SCOPE}}` — Variable State Table

The agent's primary source of truth. Replaced in full on every turn boundary by `generateScopeTable()` (`src/context/scope-generator.ts`). Injected at the `## Workspace — Current Scope` slot in the system prompt. System prompt is always `messages[0]`, overwritten each turn.

**SCOPE generation:** `Sandbox.getScope()` iterates declared variables, calls `describeType()` and `truncateValue()`. Default limits:

| Constraint | Default |
|------------|---------|
| Max variables shown | 50 (most recent first) |
| Max value column width | 50 chars |
| Array element preview | First 3, then `... +N more` |
| Object key preview | First 5 keys, then `... +N more` |
| Per-value string length | 50 chars |
| Total scope block size | ~3,000 tokens |

SCOPE is the **last** thing compressed — code and stop payloads are always evicted first.

#### Code Window Compression

Sliding window of 200 lines (`src/context/code-window.ts`). Older code replaced with summaries:

```
// [lines 1-12 executed] declared: input (Object), restaurants (Array<Object>)
```

#### Stop Payload Decay

Values fade over distance from current turn (`src/context/stop-decay.ts`):

| Distance | Treatment | Token cost |
|----------|-----------|------------|
| 0-2 turns | Full payload: all keys with serialized values | High |
| 3-5 turns | Keys and types only: values stripped | Medium |
| 6-10 turns | Count only: just number of values | Minimal |
| 11+ turns | Removed entirely | Zero |

#### Error Decay

Same tiers as stop payloads. Full error kept 0-5 turns, compressed at 6-10, removed at 11+.

#### Knowledge Decay

Faster than stop values because knowledge content is large. Tagged with `KNOWLEDGE_TAG` symbol. Agent loop rewrites knowledge stop messages in-place on each turn boundary:

| Distance | Treatment |
|----------|-----------|
| Same turn (0) | Full markdown content |
| 1-2 turns | Truncated to ~300 chars per file |
| 3-4 turns | Headings only |
| 5+ turns | File paths only |

#### Serialization Limits

Applied to all stop payloads at serialization time (`src/stream/serializer.ts`):

| Type | Limit |
|------|-------|
| Strings | 2,000 chars (first 1,000 + truncation note) |
| Arrays | 50 elements |
| Objects | 20 keys |
| Nesting depth | 5 levels |
| Circular references | `[Circular]` |
| Special types | `[Function: name]`, `[Promise]`, `[Error: msg]`, ISO dates |
| Maps | Same key limit as objects |
| Sets | Same element limit as arrays |

#### Token Budget Enforcement Order

Orchestrated by `AgentLoop.refreshSystemPrompt()` (`src/cli/agent-loop.ts`):

1. **Code window summarization** — oldest code turns evicted first
2. **Stop/error payload decay** — progressively strip older messages
3. **Knowledge content decay** — rewrite knowledge stop messages in-place
4. **SCOPE value width reduction** — `maxScopeValueWidth` reduced from 50 to 30
5. **Signature collapse** — class/function signatures collapsed to names only

### Developer Hooks

AST-based code interception registered at session init. Hooks fire between parse and execute.

**Registration:** Managed by `HookRegistry` (`src/hooks/hook-registry.ts`).

**Pattern language** (`src/hooks/pattern-matcher.ts`):

```ts
{ type: 'VariableDeclaration' }                           // match by node type
{ type: 'CallExpression', callee: { name: 'fetchData' } } // property filters
{ type: 'VariableDeclaration', declarations: [{ id: { name: '$varName' } }] }  // captures ($prefix)
{ oneOf: [pattern1, pattern2] }                            // OR
{ type: 'VariableDeclaration', not: { type: 'AwaitExpression' } }  // negation
```

**5 hook actions** (`src/hooks/hook-executor.ts`):

| Action | Effect |
|--------|--------|
| `continue` | No-op, execution proceeds |
| `side_effect` | Run external logic concurrently, don't block |
| `transform` | Rewrite code before execution (agent doesn't see the change) — before phase only |
| `interrupt` | Pause stream, inject `⚠ [hook:id]` user message — terminal |
| `skip` | Drop the statement silently — terminal |

**Phases:** `before` (can transform/interrupt/skip) and `after` (observe/side-effect only). Registration order determines priority. `skip` and `interrupt` are terminal. Multiple `transform`s compose. Hook errors logged and hook skipped; 3+ consecutive failures disables the hook for the session.

**Built-in hooks** (optional, developer-enabled):

| Hook | Pattern | Action | Purpose |
|------|---------|--------|---------|
| `await-guard` | `CallExpression` not inside `AwaitExpression` | `interrupt` | Catch missing awaits |
| `scope-guard` | `VariableDeclaration` shadowing a global | `interrupt` | Prevent accidental overwrites |
| `display-logger` | `CallExpression` to `display` | `side_effect` | Audit trail of UI output |
| `cost-tracker` | `CallExpression` matching registered API functions | `side_effect` | Track API costs per session |

### User Intervention

Users can interact at any time during execution:

- **Send a message** — Pauses the stream, injects as a plain user turn. Agent sees it and adjusts.
- **Cancel a form** — If `ask` is active, resolves with `{ _cancelled: true }`.
- **Cancel an async task** — From sidebar, fills result slot with `{ cancelled: true, message: "..." }`.
- **Pause/Resume** — UI button. While paused, user can send messages or cancel the session.

## Session Lifecycle

1. **INIT** — Create sandbox, inject globals, build system prompt with `{{SCOPE}}`, send to LLM. (`src/session/session.ts`)
2. **STREAM** — Tokens accumulate into statements (`src/stream/stream-controller.ts`), each parsed and executed. `stop`/`error` create turn boundaries.
3. **COMPLETION** — On stream end, check for incomplete tasklists (up to 3 reminder cycles). Drain async tasks.
4. **CLEANUP** — Destroy sandbox, unmount components, close connections.

Session status: `'idle' | 'executing' | 'waiting_for_input' | 'paused' | 'complete' | 'error'` (`src/session/types.ts`).

### Session Limits

All defaults in `src/session/config.ts` (`DEFAULT_CONFIG`):

| Setting | Default |
|---------|---------|
| `functionTimeout` | 30s |
| `askTimeout` | 5 min |
| `sessionTimeout` | 10 min |
| `maxStopCalls` | 50 |
| `maxAsyncTasks` | 10 |
| `maxTasklistReminders` | 3 |
| `maxTaskRetries` | 3 |
| `maxTasksPerTasklist` | 20 |
| `sleepMaxSeconds` | 30 |
| `codeWindowLines` | 200 |
| `maxContextTokens` | 100,000 |
| `taskAsyncTimeout` | 60s |

Config validation uses Zod schema. Merging via `mergeConfig()`.

## Security

- **Sandbox isolation** — No access to: filesystem, network, `process`, `require`, `import()`, `eval`, `Function` constructor, or `globalThis` modification beyond the injected API. Blocked globals enforced via non-configurable property getters. (`src/sandbox/sandbox.ts`)
- **Function registry** — All agent-accessible functions are proxy-wrapped with type validation, timeouts (default 30s), logging, and rate-limiting. (`src/security/function-registry.ts`)
- **JSX sanitization** — No `dangerouslySetInnerHTML`, `<script>` tags, or `javascript:` URLs. `ask` forms validated to only contain registered input components. (`src/security/jsx-sanitizer.ts`)

## Spaces and Agents

A **space** is a self-contained workspace that gives an agent its capabilities: domain knowledge, utility functions, UI components, and structured workflows. The REPL loads spaces at session init and wires everything into the sandbox and system prompt.

### Space Directory Structure

```
{space-slug}/
├── package.json                          # metadata (name, version)
├── agents/                               # one or more agent personas
│   └── {agent-slug}/
│       ├── config.json                   # what this agent can access
│       └── instruct.md                   # personality, behavior, slash actions
├── flows/                                # step-by-step workflows
│   └── {flow_id}/
│       ├── index.md                      # flow name, description, tags
│       └── {N}.{Step Name}.md            # numbered steps with output schemas
├── functions/                            # utility functions (TypeScript)
│   └── {functionName}.tsx
├── components/                           # React components
│   ├── view/                             # display components (read-only UI)
│   │   └── {ComponentName}.tsx
│   └── form/                             # form input components (for ask())
│       └── {ComponentName}.tsx
└── knowledge/                            # structured domain knowledge
    └── {domain}/
        ├── config.json                   # domain: label, icon, color
        └── {field}/
            ├── config.json               # field: type, variableName
            └── {option}.md               # selectable option (markdown + frontmatter)
```

### Loading Pipeline

Orchestrated by three modules in `src/cli/`:

1. **`agent-loader.ts`** — `loadAgent(spaceDir, agentSlug)` reads `config.json` and `instruct.md`, separates catalog vs local function references, returns a `LoadedAgent` struct
2. **`loader.ts`** — `classifyExports(filePath)` uses the TypeScript compiler API to extract type signatures from function/component/class files
3. **`run-agent.ts`** — `runAgent()` orchestrates the full pipeline: loads spaces, classifies exports, merges globals, creates `Session`, creates `AgentLoop`, starts the server

### Agent Configuration — `config.json`

Each agent declares what it can access:

```json
{
  "knowledge": {
    "cuisine": { "type": "italian" },
    "dietary": { "restrictions": false },
    "technique": true
  },
  "components": ["MealPlanCard", "RecipeCard", "catalog/component/form/*"],
  "functions": [
    "buildGroceryList",
    "scaleIngredients",
    "catalog/fs",
    ["catalog/fetch", { "allowedURLs": ["https://google.com"] }],
    ["catalog/shell", { "allowedCommands": ["ls", "cat", "echo"] }]
  ]
}
```

**`knowledge`** — Controls which knowledge domains/fields the agent sees:
- `true` → available, no restriction
- `false` → hidden from the agent
- `"option-name"` → pre-load a specific option at session start
- `["opt1", "opt2"]` → pre-load multiple options

**`components`** — Component references:
- `"RecipeCard"` → resolves to `spaces/{space}/components/view/RecipeCard.tsx` or `form/RecipeCard.tsx`
- `"catalog/component/form/*"` → loads all built-in form components

**`functions`** — Function references:
- `"buildGroceryList"` → local function from `spaces/{space}/functions/buildGroceryList.tsx`
- `"catalog/fs"` → built-in catalog module from `src/catalog/fs.ts`
- `["catalog/shell", { "allowedCommands": [...] }]` → catalog module with configuration (tuple format)

### Agent Instructions — `instruct.md`

Defines the agent's personality and behavior. YAML frontmatter:

```markdown
---
title: Food Assistant
model: claude-3-5-sonnet
actions:
  - id: mealplan
    label: Make a meal plan
    description: Do a configurable meal plan
    flow: meal_plan
---

You are a cooking assistant...
```

- **`title`** — Agent display name
- **`model`** — LLM model override (optional)
- **`actions`** — Slash commands that trigger flows (`id` = `/command`, `flow` = directory in `flows/`)

### Flows — Step-by-Step Workflows

Triggered by slash actions. Each flow is a directory of numbered markdown files. `parseFlow(flowDir)` reads `index.md` frontmatter, lists `N.Step Name.md` files sorted by number, extracts `<output target="varName">` JSON schema blocks.

When a user types a slash action, `AgentLoop` converts flow steps into a `tasklist()` call with sequential `dependsOn`, runs it via `runSetupCode()`, and the agent executes step by step.

### Knowledge — Structured Domain Content

Three levels: **domains** → **fields** → **options**. Types in `src/knowledge/types.ts`:
- `KnowledgeDomain` — slug, label, icon, color, fields
- `KnowledgeField` — slug, fieldType (`select`/`multiSelect`/`text`/`number`), variableName, options
- `KnowledgeOption` — slug, title, description, order (from markdown frontmatter)
- `KnowledgeTree` — full tree shown to agent in system prompt

### Functions — Utility Code

Plain TypeScript exports in `functions/*.tsx`. Classified by `loader.ts`, signatures injected into system prompt under `## Available Functions`. Agent can call them directly — injected as sandbox globals.

**Catalog functions** (`catalog/*`) — built-in modules from `src/catalog/`: `fs`, `fetch`, `shell`, `path`, `date`, `crypto`, `json`, `csv`, `env`, `image`, `db`. Can be restricted via config.

### Classes — Lazy-Loaded Method Namespaces

Classes group related methods under a namespace without consuming prompt space upfront. Initially the agent sees only a collapsed summary in `## Available Classes`:

```
DataProcessor — Processes raw data into structured formats
    → 5 methods — use `await loadClass("DataProcessor")` to expand
```

After `loadClass("DataProcessor")`, the prompt is refreshed with full method listing. At runtime: class is instantiated, methods bound to instance, bindings injected as namespace object via `session.injectGlobal()`.

### Components — React UI

Components in `components/view/` (for `display()`) and `components/form/` (for `ask()`). Props extracted by `loader.ts` and shown in system prompt.

**Built-in form components:** `TextInput`, `TextArea`, `NumberInput`, `Slider`, `Checkbox`, `Select`, `MultiSelect`, `DatePicker`, `FileUpload`

### Multi-Space Support

A session can load multiple spaces simultaneously. Each space's knowledge is namespaced by space name (from `package.json`). The knowledge tree shows all loaded spaces, agent uses space names as top-level keys in `loadKnowledge()` selectors.

## Execution Flow Pattern

```ts
// 1. Plan
tasklist("task_id", "description", [ ... ])

// 2. Greet
display(<Text>Let me help you with that.</Text>)

// 3. Gather input (ask → stop)
const input = await ask(<form>...</form>)
await stop(input)
completeTask("task_id", "first_task", { ... })

// 4. Do work
const results = await doWork(input.query)

// 5. Check before branching (stop to read)
await stop(results.length)
completeTask("task_id", "second_task", { count: results.length })

// 6. Show results
display(<ResultsList items={results} />)

// 7. Ask for next action (ask → stop)
const choice = await ask(<form>...</form>)
await stop(choice)
completeTask("task_id", "third_task", { action: choice.action })

// 8. Execute and finish
const file = await exportResults(results)
display(<DownloadLink href={file.url} />)
completeTask("task_id", "final_task", { done: true })
```

## Agent Rules

1. Output only valid TypeScript. No prose outside `//` comments.
2. Plan first — call `tasklist()` before implementation.
3. `await` every function call — no exceptions.
4. `{{SCOPE}}` is your source of truth for variable values.
5. `stop()` before branching on unknown values.
6. Always follow `ask()` with `stop()`.
7. Use `display()` for output, never `console.log`.
8. Don't redeclare existing `const` variables — use new names or `let`.
9. Keep lines independent where possible.
10. Comments are allowed and encouraged — they are your only form of "speech."
11. Background tasks (`async`) should be self-contained — don't depend on variables created after spawning.
12. Handle nullability with `?.` and `??`.
13. Use `loadKnowledge()` before domain-specific work when a Knowledge Tree is available.
14. Never import modules or write `export`/`module.exports` — everything is in scope, this is a REPL.
15. Never assume values — read them with `stop()`.
16. Never use synchronous function calls — always `await`.

## Agent Spawning

Accessible space agents are available the same way as the knowledge tree. The space tree can be fully expanded. Each agent can accept specific parameters computed from `config.json` based on field values, field/subdomain settings, and enabled domains. A specific JSON schema is extracted from field configs and markdown file names.

```ts
// System prompt shows:
// AVAILABLE agents
// cooking {
//   general_advisor({ cuisine?: { type?: 'italian' | ... }, ... }): {
//     mealplan(request: string): Promise<MealPlanResult>;
//   }
// }

var steakInstructions = cooking.general_advisor({
  technique: "saute"
}).mealplan("How to cook a steak?")
stop(steakInstructions)
```

## Agent Memory Management

The agent manages its own context by enabling/disabling scope variables. After using a value, the agent should trigger decay to minimize variable size — extract required info into separate variables then nullify the original. Storing `null` to a variable forgets it. A reminder of tokens used and max limit is given on every stop.

## Dependencies

- **TypeScript compiler API** — AST parsing, transpile-only compilation, hook pattern matching, export classification
- **Node.js `vm`** — Sandbox execution with persistent scope
- **React** — Render surface for `display` and `ask` components
- **Vercel AI SDK v6** — `streamText()` for LLM streaming, token consumption
- **Zod** — Config validation, tool schemas

## Source Layout

```
src/
├── cli/                  # Agent orchestration
│   ├── agent-loader.ts   # Load agent config, instruct.md, resolve functions/components/knowledge
│   ├── agent-loop.ts     # Main agent loop: context management, token budget, system prompt refresh
│   ├── buildSystemPrompt.ts  # System prompt template with SCOPE, classes, knowledge tree
│   ├── loader.ts         # TypeScript compiler API: classify exports, extract signatures
│   ├── run-agent.ts      # Full pipeline: load spaces → classify → session → agent loop → server
│   ├── server.ts         # HTTP/WebSocket server
│   ├── args.ts           # CLI argument parsing
│   └── bin.ts            # CLI entry point
├── sandbox/              # Code execution
│   ├── sandbox.ts        # vm.Context creation, scope tracking, blocked globals
│   ├── executor.ts       # Line-by-line execution
│   ├── transpiler.ts     # TypeScript → JavaScript transpilation
│   ├── globals.ts        # All 12 globals implementation
│   └── async-manager.ts  # Background task lifecycle
├── stream/               # Token processing
│   ├── line-accumulator.ts   # Token buffering, statement detection
│   ├── bracket-tracker.ts    # Bracket depth tracking for multi-line statements
│   ├── stream-controller.ts  # Parse → hooks → execute pipeline
│   └── serializer.ts         # Value serialization with limits
├── session/              # Session management
│   ├── session.ts        # Session state machine, event emitter
│   ├── config.ts         # SessionConfig defaults, Zod schema, merge
│   └── types.ts          # All type definitions
├── context/              # Context management
│   ├── scope-generator.ts    # {{SCOPE}} table generation
│   ├── code-window.ts        # Code window compression
│   ├── stop-decay.ts         # Stop payload and error decay
│   ├── knowledge-decay.ts    # Knowledge content decay
│   ├── message-builder.ts    # Build stop/error/intervention/hook/tasklist messages
│   └── system-prompt.ts      # System prompt utilities
├── hooks/                # Developer hooks
│   ├── hook-registry.ts  # Hook registration, phase filtering, failure tracking
│   ├── hook-executor.ts  # Hook execution: 5 actions
│   └── pattern-matcher.ts    # AST pattern matching
├── parser/               # Code analysis
│   ├── ast-utils.ts      # Declaration extraction, argument name recovery
│   └── statement-detector.ts # Statement boundary detection
├── security/             # Sandboxing
│   ├── function-registry.ts  # Function wrapping: validation, timeout, rate-limit
│   └── jsx-sanitizer.ts      # JSX validation, form component validation
├── catalog/              # Built-in modules (fs, fetch, shell, path, date, crypto, json, csv, env, image, db)
├── knowledge/            # Knowledge types
│   └── types.ts          # KnowledgeDomain, KnowledgeField, KnowledgeOption, KnowledgeTree
├── components/           # React components
│   ├── display/          # Display surface
│   ├── form/             # Built-in form components
│   └── shared/           # Block state, form extraction
├── providers/            # LLM provider adapters
├── rpc/                  # RPC interface, client, server
└── web/                  # Web RPC client
```
