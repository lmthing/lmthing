# Plan: Implement Claude Code Features via REPL Primitives

## Context

Claude Code has ~110 system prompt pieces implementing 8 feature categories. The REPL is a streaming TypeScript agent with globals, a catalog system, developer hooks, and context management. The goal is to bring Claude Code's most impactful capabilities to the REPL, mapping each to the REPL's code-first primitives.

**Key design decisions from user:**

- Skills are replicated via space knowledge (existing `loadKnowledge()`) — no separate skills system
- Memories are stored in the same domain/field/option structure as knowledge — need write capability
- The agent needs the ability to search through its own message history

---

## What Already Works

| Claude Code Feature       | REPL Equivalent                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------- |
| TodoWrite (3-state tasks) | `tasklist()` returns object with `.completeTask()` (6-state DAG) — already superior |
| Plan mode task tracking   | `tasklist()` with DAG dependencies, methods on the returned object                  |
| Tasklist reminders        | `finalize()` injects `⚠ [system]` on incomplete                                     |
| Context compaction        | SCOPE table + code window + stop decay                                              |
| Bash tool                 | `catalog/shell.ts` (`exec`, `execLive`, `which`)                                    |
| Read/Write/Glob           | `catalog/fs.ts` (readFile, writeFile, glob, stat)                                   |
| WebFetch                  | `catalog/fetch.ts` (httpGet, httpPost, fetchPage)                                   |
| Sandbox isolation         | `sandbox.ts` with BLOCKED_GLOBALS                                                   |
| Function registry         | `security/function-registry.ts` with timeouts                                       |
| JSX sanitization          | `security/jsx-sanitizer.ts`                                                         |
| Skills / Slash commands   | Space knowledge via `loadKnowledge()` + flows via slash actions                     |
| Knowledge loading         | `loadKnowledge()` global                                                            |
| Prose detection           | `cleanCode()` + prose nudge in agent-loop                                           |
| Hook interception         | AST pattern matching, 5 hook actions                                                |

---

## Phase 1a: Spawn Infrastructure

**Why:** Foundation for all agent spawning — child session creation, role-based catalog restrictions, and context branching.

### New files

- **`src/sandbox/roles.ts`** — Role definitions with catalog restrictions:

  ```
  explore: fs[readFile, glob, stat, listDir, exists], shell[exec: read-only cmds]
  plan:    fs[readFile, glob, stat, listDir, exists] (no write, no exec)
  worker:  full catalog (inherits parent)
  verify:  shell[exec], fs[read-only]
  ```

- **`src/sandbox/spawn.ts`** — `SpawnConfig` interface + child session factory:
  - Creates a child `Session` with role-restricted catalog
  - Creates a child `AgentLoop` with parent's `model` reference
  - Handles `.options({ context })`: `"empty"` (default) creates a fresh session with only SCOPE injected; `"branch"` clones the parent's message history as the child's starting context
  - Enforces structured output: `{ scope, result, keyFiles, issues? }`
  - Returns `SpawnResult` when child completes

### Modified files

- **`src/session/session.ts`** — Add `onSpawn` to `SessionOptions`, wire into globals config.
- **`src/session/types.ts`** — Add `SpawnConfig`, `SpawnOptions` (with `context: 'empty' | 'branch'`), `SpawnResult`, `spawn_start`/`spawn_complete` events.
- **`src/cli/agent-loop.ts`** — Add `handleSpawn()` method that creates child `AgentLoop`, runs directive, returns structured result. Child shares parent's `model`.

---

## Phase 1b: Agent Namespaces

**Why:** Expose space agents as callable namespace globals — the user-facing API for spawning agents.

**Depends on:** Phase 1a (spawn infrastructure)

Accessible space agents are available the same way as the knowledge tree. The space tree can be fully expanded. Each agent can accept specific parameters computed from `config.json` based on field values, field/subdomain settings, and enabled domains. A specific JSON schema is extracted from field configs and markdown file names. Agents are injected as namespace globals — no explicit `spawn()` function.

```ts
// System prompt shows:
// AVAILABLE agents
// cooking {
//   general_advisor({ cuisine?: { type?: 'italian' | ... }, ... }): {
//     mealplan(request: string): Promise<MealPlanResult>;
//   }
// }
//
// knowledge {
//   writer({ field: string }): {
//     addOptions(description: string, ...data: any[]): Promise<void>;
//   }
// }

// TRACKED — saved to variable, registered in {{AGENTS}}, can receive questions
var steakInstructions = cooking
  .general_advisor({
    technique: "saute",
  })
  .mealplan("How to cook a steak?");

// blocking — await to wait for result inline
var spaghettiInstruction = await cooking
  .general_advisor({
    technique: "saute",
  })
  .mealplan("How to cook spaghetti?");

// FIRE AND FORGET — no variable, not tracked, cannot ask parent anything
cooking.general_advisor({ technique: "saute" }).mealplan("Generate a side dish suggestion");

// CONTEXT OPTIONS — .options() at the end of the chain
var research = cooking
  .general_advisor({ technique: "saute" })
  .mealplan("Based on what we discussed, suggest improvements")
  .options({ context: "branch" }); // child gets a copy of parent's conversation history
```

### Context options for spawned agents

Every agent action returns a chainable object with an `.options()` method that configures how the child agent is spawned. Calling `.options()` returns the same promise — it's a terminal modifier, not a new call.

| Option    | Values                  | Default   | Behavior                                                 |
| --------- | ----------------------- | --------- | -------------------------------------------------------- |
| `context` | `"empty"` \| `"branch"` | `"empty"` | Controls what conversation history the child starts with |

- **`"empty"`** — Child starts with a fresh conversation — only its system prompt, injected SCOPE, and the directive. Best for independent tasks.
- **`"branch"`** — Child gets a snapshot of the parent's conversation history (messages, scope, knowledge loaded) at the time of spawning. The child can reference prior context. Parent and child diverge from that point — the child's subsequent turns don't affect the parent's history.

### New files

- **`src/sandbox/agent-namespaces.ts`** — Builds namespace globals from the space agent tree:
  - Reads all loaded spaces + agent configs to build a tree of callable objects
  - Each leaf method (e.g., `.mealplan(request)`) creates a `SpawnConfig` from the chained parameters and calls the internal spawn handler
  - Returns a `Promise` — non-blocking unless the agent `await`s it
  - Namespace objects are injected as sandbox globals (one per space)

### Modified files

- **`src/sandbox/globals.ts`** — Add `onSpawn` callback to `GlobalsConfig`. No `spawnFn` global — agent namespaces are injected separately.
- **`src/session/session.ts`** — Inject agent namespace globals into sandbox via `agent-namespaces.ts`.
- **`src/cli/buildSystemPrompt.ts`** — Show `AVAILABLE agents` tree in system prompt with namespace signatures.

---

## Phase 1c: `stop()` Promise-Awaiting

**Why:** `stop()` should transparently await any Promise argument — not just agent promises, but any async work.

**Depends on:** Nothing (can be done in parallel with 1a/1b)

```ts
// All of these work — stop() awaits the promises automatically
var data = fetch("https://api.example.com/data").then((r) => r.json());
var steak = cooking.general_advisor({ technique: "saute" }).mealplan("steak");
var file = readFile("/src/index.ts");
stop(data, steak, file);
// ← stop { data: { ... }, steak: { result: "..." }, file: "contents..." }
```

### Modified files

- **`src/sandbox/globals.ts`** — Modify `stopFn` to detect any `Promise` in arguments and `await` them before building the stop payload.

---

## Phase 1d: Agent Registry & `{{AGENTS}}` Block

**Why:** The parent agent needs visibility into spawned agent state — running, resolved, failed, tasklist progress.

**Depends on:** Phase 1a, Phase 1b

Only agent calls **saved to a variable** are tracked in the registry. The variable name is the agent's identity — it's how the agent appears in `{{AGENTS}}` and how the parent references it in `respond()`. Calls without a variable assignment are **fire and forget** — they run to completion but are not tracked, cannot ask the parent questions, and don't appear in `{{AGENTS}}`.

On every `stop()` call, the response includes a `{{AGENTS}}` block showing all tracked agent promises — running, resolved, or failed — with their internal tasklist state:

```
{{AGENTS}}
┌ steakInstructions — cooking.general_advisor.mealplan ────────┐
│ ◉ running                                                    │
│ ┌ tasks ───────────────────────────────────────────────────┐  │
│ │ ✓ research_technique    → { method: "reverse sear" }    │  │
│ │ ◉ write_instructions    (running — Drafting steps... 60%)│  │
│ │ ○ format_output         (blocked — waiting on: write)    │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
┌ dessertOptions — cooking.general_advisor.mealplan ───────────┐
│ ◉ running (no tasklist)                                      │
└──────────────────────────────────────────────────────────────┘
┌ ingredients — resolved ──────────────────────────────────────┐
│ ✓ (value included in this stop payload)                      │
└──────────────────────────────────────────────────────────────┘
```

| Symbol | State    | Meaning                                                |
| ------ | -------- | ------------------------------------------------------ |
| `◉`    | running  | Agent still executing in background                    |
| `?`    | waiting  | Agent is waiting for parent input (see question below) |
| `✓`    | resolved | Resolved — value included in this `stop()` payload     |
| `✗`    | failed   | Agent errored — error message shown                    |

Each running agent shows its **tasklist state** (if it declared one) — the parent agent can see which tasks the child has completed, which are running, and which are still pending. This uses the same `✓ ◉ ○ ✗ ◎ ⊘` symbols as the parent's own `{{TASKS}}` block. Agents without a tasklist just show their running/resolved status.

### New files

- **`src/sandbox/agent-registry.ts`** — Tracks all outstanding agent promises, child state, and pending questions:
  - `register(varName, promise, label, childSession)` — Add a promise + child session reference to the registry
  - `resolve(varName)` — Mark as resolved when child completes
  - `getPending()` → `AgentPromiseEntry[]` — All currently unresolved promises
  - `getSnapshot(varName)` → `AgentSnapshot` — Current state of a child agent: status, tasklist progress (tasks with states), pending question (if any), latest scope summary
  - `awaitIfPending(value)` — If value is a registered promise, await it and return the resolved value

- **`src/context/agents-block.ts`** — Generates the `{{AGENTS}}` block from `AgentRegistry.getPending()` + `getSnapshot()`. For each running agent, queries the child session's tasklist state and renders it inline. Appended to every `stop()` message when there are or were recent agent promises. Same decay strategy as `{{TASKS}}`.

### Modified files

- **`src/session/session.ts`** — Create `AgentRegistry` instance.
- **`src/session/types.ts`** — Add `AgentPromiseEntry`.
- **`src/cli/agent-loop.ts`** — On `stop()`, query `AgentRegistry.getPending()` and append `{{AGENTS}}` block to the stop message.

---

## Phase 1e: Child-to-Parent Questions (`respond`)

**Why:** Spawned agents need a way to ask the parent for structured input.

**Depends on:** Phase 1d (agent registry)

A **tracked** spawned agent (saved to a variable) can ask the parent agent for input by calling `ask()` with a JSON schema. Instead of rendering a form to the user, the child's `ask()` pauses the child and surfaces the question in the `{{AGENTS}}` block on the parent's next `stop()`. Fire-and-forget agents (no variable) cannot ask questions — their `ask()` calls resolve with `{ _noParent: true }`.

```
{{AGENTS}}
┌ steakInstructions — cooking.general_advisor.mealplan ────────┐
│ ? waiting — needs input from parent                          │
│ ┌ question ──────────────────────────────────────────────┐   │
│ │ "What doneness level do you want?"                     │   │
│ │ schema: {                                              │   │
│ │   doneness: "rare" | "medium-rare" | "medium" | "well",│   │
│ │   thickness_cm: number                                 │   │
│ │ }                                                      │   │
│ └────────────────────────────────────────────────────────┘   │
│ ┌ tasks ───────────────────────────────────────────────────┐  │
│ │ ✓ research_technique    → { method: "reverse sear" }    │  │
│ │ ◎ write_instructions    (ready — waiting on question)    │  │
│ │ ○ format_output         (blocked — waiting on: write)    │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

The parent answers by calling `respond(varName, data)`:

```ts
respond(steakInstructions, {
  doneness: "medium-rare",
  thickness_cm: 3,
});
```

- `respond(varName, data)` delivers the answer to the child's pending `ask()`, using the variable name as the reference
- The child sees the response as a normal `ask()` return value and continues executing
- If the parent ignores the question, the child stays paused — shown as `?` in `{{AGENTS}}` on every subsequent `stop()`
- Multiple children can have pending questions simultaneously — each shown in `{{AGENTS}}`

### Modified files

- **`src/sandbox/agent-registry.ts`** — Add `setPendingQuestion(varName, question, schema)` and `respond(varName, data)` methods.
- **`src/sandbox/globals.ts`** — Add `respondFn` global.
- **`src/cli/buildSystemPrompt.ts`** — Document `respond()` global and question format in `{{AGENTS}}`.

---

### Agent spawning rules (apply across all Phase 1 sub-phases)

- `stop()` awaits **any** Promise argument (agent or otherwise) before returning the payload
- Only agent calls **saved to a variable** are tracked in `{{AGENTS}}` — the variable name is the identifier
- Calls without a variable assignment are **fire and forget** — they run silently, are not tracked, and cannot ask the parent questions
- If `stop()` is called without referencing a tracked agent promise → unresolved agents stay running, shown in `{{AGENTS}}` with their current tasklist progress
- When a tracked child calls `ask()`, the question is queued and surfaced in the parent's next `stop()` — the child pauses until `respond(varName, data)` is called
- When an agent promise resolves while no `stop()` is pending, the result is held until the next `stop()` that references it (or until the agent reads it via `await`)
- `await` on any promise always blocks — standard Promise semantics
- Child tasklist state is a read-only view — the parent cannot complete or modify child tasks

---

## Phase 2: Knowledge-based Memory (write via knowledge agent)

**Why:** Claude Code has persistent file-based memory across sessions (user prefs, project notes, feedback). The REPL's knowledge system is read-only. Memories should use the same domain/field/option structure as knowledge.

**Design decision:** The top-level agent does not write knowledge directly. Instead, a `knowledge` agent namespace is always available (regardless of loaded spaces). The agent spawns a fire-and-forget knowledge writer agent to handle writes — this keeps the main agent unblocked and delegates file I/O to a child.

### Design: Memory as a `memory` domain in the knowledge tree

Memories are stored on disk in the same structure as regular knowledge:

```
{space}/knowledge/
├── memory/                          # Memory domain (auto-created)
│   ├── config.json                  # { label: "Memory", icon: "🧠", ... }
│   ├── user/                        # Field: user memories
│   │   ├── config.json              # { fieldType: "text", variableName: "userMemory" }
│   │   ├── role.md                  # Option: user's role
│   │   └── preferences.md           # Option: user's preferences
│   ├── project/                     # Field: project memories
│   │   ├── config.json
│   │   ├── auth-flow.md
│   │   └── deploy-pipeline.md
│   ├── feedback/                    # Field: feedback memories
│   │   ├── config.json
│   │   └── testing-approach.md
│   └── reference/                   # Field: external references
│       ├── config.json
│       └── linear-project.md
├── cuisine/                         # Regular knowledge domain
│   └── ...
```

### The `knowledge` agent namespace

The `knowledge` namespace is a built-in agent namespace — always available, not tied to any loaded space. It provides agents for writing and managing knowledge:

```
// System prompt shows:
// AVAILABLE agents
// knowledge {
//   writer({ field: string }): {
//     save(option: string, content: string): Promise<void>;
//     remove(option: string): Promise<void>;
//     addOptions(description: string, ...data: any[]): Promise<void>;
//   }
// }
```

### How the agent uses it

```typescript
// Fire and forget — save a project memory (no variable = not tracked)
knowledge
  .writer({ field: "memory/project" })
  .save("auth-flow", "Authentication uses SSO codes with 60s TTL. com/ is the auth hub.");

// Fire and forget — save feedback
knowledge
  .writer({ field: "memory/feedback" })
  .save(
    "testing-approach",
    "Use integration tests against real DB, not mocks. Why: prior mock/prod divergence incident.",
  );

// Fire and forget — delete a memory
knowledge.writer({ field: "memory/feedback" }).remove("old-approach");

// Fire and forget — add multiple options from data
knowledge
  .writer({ field: "cuisine" })
  .addOptions("Store these recipes appropriately", recipeData, moreData);

// Load a specific memory (existing global, synchronous)
var mem = loadKnowledge({ memory: { project: { "auth-flow": true } } });
await stop(mem);

// List available memories (the knowledge tree in {{SCOPE}} shows them)
// Agent sees in system prompt:
// knowledge/
// ├── memory/          🧠 Memory — Persistent agent memory
// │   ├── user         [text] — User preferences and context
// │   │   └── role     role — User's role
// │   ├── project      [text] — Project-specific knowledge
// │   │   └── auth-flow  auth-flow — ...
// │   └── feedback     [text] — Behavioral guidance
```

Since knowledge writes are fire-and-forget, the parent agent doesn't wait for the write to complete. The knowledge writer agent handles file creation, `config.json` setup, and knowledge tree rebuild internally. The updated knowledge tree appears in `{{SCOPE}}` on subsequent turns.

### New files

- **`src/knowledge/writer.ts`** — Knowledge write operations:
  - `saveKnowledgeFile(knowledgeDir, domain, field, option, content)` — Creates the domain/field directories if needed, writes `config.json` files for new domains/fields, writes the option `.md` file with frontmatter
  - `deleteKnowledgeFile(knowledgeDir, domain, field, option)` — Removes an option file
  - `ensureMemoryDomain(knowledgeDir)` — Creates the `memory` domain with `user`, `project`, `feedback`, `reference` fields if they don't exist
  - Auto-creates `config.json` files with sensible defaults for new memory entries

### Modified files

- **`src/sandbox/agent-namespaces.ts`** — Register the built-in `knowledge` namespace alongside space-derived namespaces. The `knowledge` writer agent is always available regardless of loaded spaces.

- **`src/session/session.ts`** — Add `knowledgeWriter` to `SessionOptions`. Emit `knowledge_saved` event when the writer agent completes.

- **`src/knowledge/index.ts`** — After a write, rebuild the affected part of the knowledge tree so the system prompt's `{{KNOWLEDGE_TREE}}` reflects the new entry on next turn.

- **`src/cli/agent-loop.ts`** — After `knowledge_saved` events, call `refreshSystemPrompt()` so the knowledge tree in the prompt is updated.

- **`src/cli/buildSystemPrompt.ts`** — Show `knowledge` in the `AVAILABLE agents` tree. Show memory entries in the knowledge tree (they appear naturally since they're in the same structure).

- **`src/cli/bin.ts`** — Wire `knowledgeWriter` into session options. Call `ensureMemoryDomain()` at startup for spaces that have knowledge directories.

---

## Phase 3: Tasklist Refactor (variable-based TasklistHandle)

**Why:** The current tasklist API uses a string `tasklistId` passed to 6 separate globals (`tasklist`, `completeTask`, `completeTaskAsync`, `taskProgress`, `failTask`, `retryTask`). This is verbose and error-prone. Refactoring to a variable-based handle is more natural for the REPL — the agent saves the tasklist to a variable and calls methods on it.

### New API

```ts
// tasklist() returns a TasklistHandle — saved to a variable
var tasks = tasklist("Analyze the dataset", [
  { id: "load", instructions: "Load the CSV", outputSchema: { count: { type: "number" } } },
  { id: "analyze", instructions: "Compute stats", outputSchema: { done: { type: "boolean" } }, dependsOn: ["load"] },
  { id: "report", instructions: "Present results", outputSchema: { done: { type: "boolean" } }, dependsOn: ["analyze"] },
]);

// Task operations are methods on the handle — no tasklistId needed
var data = await loadCSV("/data/employees.csv");
await stop(data);
tasks.completeTask("load", { count: data.length });

var stats = await computeStats(data);
tasks.taskProgress("analyze", "Computing correlations...", 75);
await stop(stats);
tasks.completeTask("analyze", { done: true });

// Async task completion
tasks.completeTaskAsync("report", async () => {
  var report = await generateReport(stats);
  return { done: true };
});

// Fail and retry
tasks.failTask("report", "API rate limited");
tasks.retryTask("report");
```

### TasklistHandle methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `completeTask` | `(taskId, output)` | Mark task done with validated output |
| `completeTaskAsync` | `(taskId, fn)` | Launch task work in background |
| `taskProgress` | `(taskId, message, percent?)` | Report progress on running task |
| `failTask` | `(taskId, error)` | Mark task as failed |
| `retryTask` | `(taskId)` | Reset failed task to ready (max 3 retries) |

Internally, each `TasklistHandle` gets a UUID as its `tasklistId` — the existing tasklist machinery (`TasklistsState`, `{{TASKS}}` block, reminders, events) works unchanged. The agent never sees or passes the ID directly.

### Slash action injection

When a slash action from the chat interface injects a tasklist (via `generateTasklistCode` → `runSetupCode`), the variable name is derived deterministically from the flow's `actionId` using camelCase conversion:

```
/mealplan       → var mealplanTasks_a3f = tasklist("Make a meal plan", [...])
/mealplan       → var mealplanTasks_x7k = tasklist("Make a meal plan", [...])  // second invocation
/create_agent   → var createAgentTasks_b2m = tasklist("Create a new agent", [...])
```

The pattern is `${camelCase(actionId)}Tasks_${randomAlphanumeric(3)}` — this ensures:
- Unique per invocation: the same slash action can run multiple times without variable collisions
- The agent sees the variable in `{{SCOPE}}` and can call `mealplanTasks_a3f.completeTask(...)` immediately

### Modified files

- **`src/sandbox/globals.ts`** — `tasklistFn` returns a `TasklistHandle` object with bound methods instead of `void`. Remove `completeTaskFn`, `completeTaskAsyncFn`, `taskProgressFn`, `failTaskFn`, `retryTaskFn` as separate globals — they become methods on the handle. UUID generation for tasklistId.

- **`src/session/types.ts`** — Add `TasklistHandle` type.

- **`src/cli/buildSystemPrompt.ts`** — Update tasklist documentation in system prompt to show variable-based API. Remove separate `completeTask`/`failTask`/`retryTask` global docs.

- **`src/cli/agent-loader.ts`** — Update `generateTasklistCode()` to emit `var ${camelCase(actionId)}Tasks_${randomAlphanumeric(3)} = tasklist(...)` instead of `tasklist("${tasklistId}", ...)`.

---

## Phase 4: Async Branching (stream forking with `.options()`)

**Why:** The current `async()` global only runs plain JS functions in the background. With agent spawning in Phase 1, the agent needs a way to fork its own stream — branching the current conversation into a parallel child agent that has full LLM capabilities.

### Enhanced `async()` with `.options()` chaining

The first argument is always a **description** of what the async work will do. The second argument is the function.

When the stream parser encounters the opening bracket of an `async()` call, the current LLM stream is **branched**: the child takes over the current stream (executing the function body), and a new parallel stream is forked for the parent continuing after the `async()` call.

The async function receives globals as arguments — `stop`, `display`, `ask`, `tasklist`, etc. — scoped to the child's own session. The child uses `stop()` to read values just like the parent does, and `return` to deliver the final result.

**`async()` must always be saved to a variable.** The variable name is how it appears in `{{AGENTS}}` and how the parent references it.

**Signature:** `async(description: string, fn: (stop, display, ask, ...) => Promise<T>): ChainablePromise<T>`

```ts
// Plain async — runs a JS function in the background
var fetchResult = async("Fetch restaurant data", () => fetchData());

// Branched async — the stream forks here:
//   - child: takes the current stream, executes the function body
//   - parent: a new stream starts, continuing after this line
var analysis = async("Analyze index.ts for code quality issues",
  async (stop, display, ask, tasklist) => {
    // stop() works just like in the parent — pause, read values, resume
    var data = await readFile("/src/index.ts");
    await stop(data);
    // ← stop { data: "file contents..." }

    // tasklist() returns an object — task operations are methods on it
    var tasks = tasklist("Analyze the code", [
      { id: "parse", instructions: "Parse the AST", outputSchema: { nodes: { type: "number" } } },
      { id: "report", instructions: "Summarize findings", outputSchema: { done: { type: "boolean" } }, dependsOn: ["parse"] },
    ]);

    var ast = await parseCode(data);
    await stop(ast);
    tasks.completeTask("parse", { nodes: ast.length });

    display(<AnalysisCard results={ast} />);
    tasks.completeTask("report", { done: true });

    return { nodeCount: ast.length, issues: [] }; // resolves the async promise
  },
).options({ context: "empty" });
// ↑ Parent's new stream starts here — two LLM streams running in parallel
stop(analysis);

// Branched async with parent's conversation history
var continuation = async("Continue investigating the auth flow we discussed",
  async (stop, display) => {
    var deeper = await investigateFurther();
    await stop(deeper);
    display(<ResultCard data={deeper} />);
    return deeper;
  },
).options({ context: "branch" });
stop(continuation);
```

| Call                                                                                 | Behavior                                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `var x = async("desc", () => fn())`                                                  | **Plain** — runs `fn` as a background JS function, no agent session                             |
| `var x = async("desc", async (stop, ...) => { ... }).options({ context: "empty" })`  | **Branched** — child takes current stream, parent gets a new fork, child starts with no history |
| `var x = async("desc", async (stop, ...) => { ... }).options({ context: "branch" })` | **Branched** — same fork, but child starts with a copy of parent's conversation history         |

**Stream forking:** When the parser detects the `async(` opening bracket, it branches the current LLM stream. The child inherits the current stream and executes the function body. The parent gets a new forked stream that starts executing from the line after the `async()` call. This means the child doesn't "start cold" — it continues from where the parent was, while the parent spins up fresh.

**Parent's code history after fork:** The forked parent stream sees the async call collapsed to just the description — the function body is stripped:

```
// What the parent's code window shows:
var analysis = async("Analyze index.ts for code quality issues")
// ↑ inner function body omitted — running in background
// parent code continues from here...
```

This keeps the parent's context clean — it knows an async agent named `analysis` was spawned with that description, but doesn't waste tokens on the child's implementation. The full function body only exists in the child's stream.

**Function arguments** (in order): `stop`, `display`, `ask`, `tasklist`, `sleep`, `loadKnowledge`. Each is scoped to the child's session — the child's `stop()` pauses the child's stream, not the parent's. Task operations (`completeTask`, `completeTaskAsync`, `taskProgress`, `failTask`, `retryTask`) are methods on the object returned by `tasklist()`.

When `.options({ context })` is used:

- The current stream is handed to the child, a **new parallel LLM stream** forks for the parent
- Both agents run concurrently from that point
- Globals are passed as function arguments, scoped to the child's session
- The child's `stop()` pauses and resumes the child's own stream — the parent is unaffected
- `return` resolves the async promise — delivered via the parent's next `stop()`
- Always tracked in `{{AGENTS}}` (must be saved to a variable)

### Modified files

- **`src/sandbox/globals.ts`** — Modify `asyncFn` to accept `(description, fn)` signature, return a chainable object with `.options()`. When `context` is set, delegate to spawn instead of `AsyncManager`.

- **`src/sandbox/async-manager.ts`** — No changes for plain `async()` calls. Branched `async()` calls bypass `AsyncManager` and go through `spawn.ts` instead.

- **`src/stream/line-accumulator.ts`** — Detect `async(` bracket open to trigger stream fork. Strip function body from parent's code window.

- **`src/cli/agent-loop.ts`** — Handle stream forking: when async branching is detected, hand current stream to child, create new forked stream for parent.

- **`src/cli/buildSystemPrompt.ts`** — Update `async()` documentation to show `(description, fn)` signature, `.options()` chaining, and branching behavior.

---

## Build Order

```
Phase 1a: Spawn Infrastructure               [foundational — child sessions, roles]
  └── No dependencies

Phase 1b: Agent Namespaces                    [namespace chaining API]
  └── Requires Phase 1a

Phase 1c: stop() Promise-Awaiting            [independent — await any Promise in stop]
  └── No dependencies

Phase 1d: Agent Registry & {{AGENTS}}        [tracking, visibility]
  └── Requires Phase 1a, 1b

Phase 1e: Child-to-Parent Questions          [respond() global]
  └── Requires Phase 1d

Phase 2:  Knowledge-based Memory              [write to knowledge via agent]
  └── Requires Phase 1b (uses agent namespaces)

Phase 3:  Tasklist Refactor                   [variable-based TasklistHandle]
  └── No dependencies

Phase 4:  Async Branching                     [stream forking with .options()]
  └── Requires Phase 1a, 1d
```

**Parallel tracks:**

- Track A: 1a → 1b → 1d → 1e
- Track B: 1c (independent)
- Track C: 3 (independent)
- Track D: 1b → 2
- Track E: 1a + 1d → 4

Phases 1a, 1c, and 3 can all start in parallel.

---

## Globals Summary

After implementation, the REPL has **9+ globals** (down from 12, up with new additions):

| #   | Global                                          | Type                | Phase    |
| --- | ----------------------------------------------- | ------------------- | -------- |
| 1   | `stop(...values)`                               | Existing (enhanced) | Phase 1c |
| 2   | `display(jsx)`                                  | Existing            | —        |
| 3   | `ask(jsx)`                                      | Existing            | —        |
| 4   | `async(description, fn)`                        | Existing (enhanced) | Phase 4  |
| 5   | `tasklist(description, tasks)` → TasklistHandle | Existing (changed)  | Phase 3  |
| 6   | `sleep(seconds)`                                | Existing            | —        |
| 7   | `loadKnowledge(selector)`                       | Existing            | —        |
| 8   | `loadClass(className)`                          | Existing            | —        |
| 9   | `respond(agentPromise, data)`                   | New, sync           | Phase 1e |
| +N  | Agent namespaces (e.g., `cooking`, `knowledge`) | New, non-blocking   | Phase 1b |

**`tasklist()` returns a `TasklistHandle`** with methods: `.completeTask(taskId, output)`, `.completeTaskAsync(taskId, fn)`, `.taskProgress(taskId, message, percent?)`, `.failTask(taskId, error)`, `.retryTask(taskId)`. The separate `completeTask`, `completeTaskAsync`, `taskProgress`, `failTask`, `retryTask` globals are removed — all task operations go through the returned object. Internally, each `TasklistHandle` gets a UUID as its `tasklistId`.

**Agent namespaces** are injected as globals per loaded space — not a single `spawn()` function. Each namespace is a chainable object tree reflecting the space's agents and their actions. Calls return a `Promise` (non-blocking by default, blocking with `await`). The `knowledge` namespace is always available as a built-in (Phase 2) — it replaces direct `saveKnowledge`/`forgetKnowledge` globals with fire-and-forget agent calls.

**`respond(varName, data)`** delivers structured input to a child agent's pending `ask()`. The child's question (with JSON schema) is shown in `{{AGENTS}}` on the parent's next `stop()`.

---

## Critical Files Summary

| File                              | Phases            | Changes                                                     |
| --------------------------------- | ----------------- | ----------------------------------------------------------- |
| `src/sandbox/globals.ts`          | 1b,1c,1e, 3, 4   | onSpawn, stop Promise-awaiting, respondFn, tasklist, async  |
| `src/sandbox/spawn.ts`            | 1a                | **New** — SpawnConfig, child session factory                |
| `src/sandbox/roles.ts`            | 1a                | **New** — Role definitions + catalog restrictions           |
| `src/sandbox/agent-namespaces.ts` | 1b                | **New** — Build namespace globals from space agent tree     |
| `src/sandbox/agent-registry.ts`   | 1d, 1e            | **New** — Track agent promises, questions, respond          |
| `src/sandbox/async-manager.ts`    | 4                 | Branched calls bypass to spawn.ts                           |
| `src/context/agents-block.ts`     | 1d                | **New** — Generate `{{AGENTS}}` block for stop messages     |
| `src/knowledge/writer.ts`         | 2                 | **New** — Write/delete knowledge files, ensure memory domain|
| `src/knowledge/index.ts`          | 2                 | Add rebuild after write                                     |
| `src/knowledge/types.ts`          | 2                 | Add SaveKnowledgeSelector type                              |
| `src/session/session.ts`          | 1a, 1b, 1d, 2    | Wire spawn, namespaces, registry, knowledgeWriter           |
| `src/session/types.ts`            | 1a, 1d, 3         | SpawnConfig, SpawnResult, AgentPromiseEntry, TasklistHandle |
| `src/stream/line-accumulator.ts`  | 4                 | Detect `async(` bracket to trigger stream fork              |
| `src/cli/agent-loop.ts`           | 1a, 1d, 4         | handleSpawn, {{AGENTS}} block, stream forking               |
| `src/cli/buildSystemPrompt.ts`    | 1b, 1e, 2, 3, 4  | Agents tree, respond, knowledge, tasklist, async docs       |
| `src/cli/bin.ts`                  | 2                 | Wire knowledge writer, ensure memory domain at startup      |

---

## Verification

1. **Unit tests** — Each new file gets `.test.ts` sibling (vitest, following existing patterns)
2. **Tasklist refactor test** — Declare tasklist via `var tasks = tasklist(...)`, complete/fail/retry tasks via handle methods, verify `{{TASKS}}` block renders correctly
3. **Knowledge write test** — Save a memory via `knowledge.writer().save()`, verify it appears in knowledge tree, load it back via `loadKnowledge()`, delete via `knowledge.writer().remove()`
4. **Spawn test** — Spawn an explore sub-agent, verify it returns structured findings, verify its catalog is restricted to read-only
5. **Async branching test** — Fork via `async("desc", (stop, ...) => { ... }).options({ context: "empty" })`, verify two parallel streams, verify parent code window shows collapsed call
6. **Integration test** — Run `lmthing-repl` CLI with a real LLM:
   - "Search the codebase for auth patterns" → triggers agent namespace spawn
   - "Remember that auth uses SSO codes" → triggers fire-and-forget `knowledge.writer().save()` call
