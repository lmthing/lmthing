# FEATURES.md — Next Core Features for lmthing

## Overview

Four interconnected features that evolve lmthing from a single-shot prompt runner into a stateful, interactive agent framework with background execution and persistent memory.

```
┌──────────────────────────────────────────────────────────────────┐
│                         runPrompt()                              │
│                                                                  │
│  Returns PromptSession (always)                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  result        → StreamTextResult (current turn)           │  │
│  │  send(msg)     → start new turn after agent finishes       │  │
│  │  interrupt()   → abort current execution, keep history     │  │
│  │  history       → full conversation                         │  │
│  │  state         → shared StateManager                       │  │
│  │  tasks         → BackgroundTaskRegistry                    │  │
│  │  export()      → serialize for persistence                 │  │
│  │  close()       → cleanup                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  defTool / defAgent: { background: true }                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  LLM chooses: call normally (blocking) or with             │  │
│  │  { runInBackground: true } to spawn and continue           │  │
│  │  Auto-registers {name}_status and {name}_result tools      │  │
│  │  Completed tasks announced on next turn start              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  defMemory(spacePath)                                            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Uses knowledge/ directory structure (domains/fields/opts) │  │
│  │  Injected into system prompt as context                    │  │
│  │  Auto-registers memory_save / memory_delete tools          │  │
│  │  Persists to disk as markdown files                        │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Feature 1: Remove `$` — Use `defMessage` Only

### What Changes

Remove the `$` tagged template literal from `StatefulPrompt`. All user messages go through `defMessage('user', content)`. The `$` method with its proxy interpolation, `_executedOnce` guard, and implicit message deduplication is the source of confusion in interactive scenarios and adds a code path that duplicates what `defMessage` already does.

### Why

- `$` silently swallows messages when `_executedOnce` is true — this is a hidden behavior that bites users in multi-step and interactive scenarios
- `$` and `defMessage('user', ...)` do the same thing but with different deduplication rules
- Proxy interpolation (`${userName}` resolving proxy objects) is clever but fragile — plain string concatenation with `def()` return values works just as well in `defMessage`
- Removing `$` makes the message contract explicit: `defMessage` adds messages, period

### Migration

```typescript
// Before
prompt.$`Hello ${userName}, help me with ${topic}`;

// After
prompt.defMessage('user', `Hello ${userName}, help me with ${topic}`);
```

The proxy objects returned by `def()` already implement `toString()`, so template literal interpolation works identically in `defMessage`.

### `defMessage` Behavior Change

Currently `defMessage('user', ...)` skips when `_executedOnce` is true (same guard as `$`). This guard exists to prevent duplicate messages during prompt re-execution within a multi-step run.

**New behavior:** `defMessage` gains a `{ once: true }` option (default for backward compat) that controls deduplication:

```typescript
// Added once during promptFn setup — deduplicated on re-execution (default)
prompt.defMessage('user', 'Help me count things.');

// Explicit control
prompt.defMessage('user', 'Help me count things.', { once: true });  // same as default
prompt.defMessage('user', dynamicContent, { once: false });          // added every re-execution
```

In the `PromptSession.send()` path, messages come from the managed history — `defMessage` calls in `promptFn` that use `once: true` are only added on the first turn (they become part of the initial context).

### Impact

- **71 occurrences** of `.$\`` across 10 files (mostly tests and doc comments)
- `knowledgeAgent` plugin already uses `prompt.addMessage()` — no change needed
- All test files need `.$\`` → `defMessage('user', ...)` migration
- Doc comments and examples updated

### Files Changed

| File | Change |
|------|--------|
| `src/StatefulPrompt.ts` | Remove `$()` method, update `defMessage` with `once` option |
| `src/runPrompt.ts` | Remove `$` from proxy binding |
| `src/index.ts` | No export change ($ was never exported as a standalone) |
| `src/types/core.ts` | Remove `$` from `PromptContext` if present |
| `src/defAgent.test.ts` | Migrate 29 `$` usages |
| `src/runPrompt.test.ts` | Migrate 2 usages |
| `src/integration.test.ts` | Migrate 3 usages |
| `src/agent-response-schema.test.ts` | Migrate 8 usages |
| `src/plugins/function/FunctionPlugin.test.ts` | Migrate 12 usages |
| `src/plugins/function/FunctionPlugin.ts` | Update doc examples |
| `src/plugins/function/index.ts` | Update doc examples |
| `src/plugins/taskGraph/taskGraph.test.ts` | Migrate 1 usage |
| `CLAUDE.md`, skill files | Update examples |

---

## Feature 2: `PromptSession` — Always-On Session from `runPrompt`

### What Changes

`runPrompt()` always returns a `PromptSession` that wraps the current execution and allows sending follow-up messages or interrupting.

### API

```typescript
const session = await runPrompt(async ({ defSystem, defTool, defState }) => {
  defSystem('role', 'You are a helpful assistant.');

  const [mood, setMood] = defState('mood', 'neutral');

  defTool('setMood', 'Change conversation mood',
    z.object({ mood: z.enum(['happy', 'serious', 'playful']) }),
    ({ mood }) => { setMood(mood); return `Mood set to ${mood}`; }
  );

  defMessage('user', 'Hello!');
}, { model: 'openai:gpt-4o' });

// Stream the first turn
for await (const chunk of session.result.textStream) {
  process.stdout.write(chunk);
}

// Send a follow-up (waits for current turn to finish if still streaming)
const result2 = await session.send('What mood are we in?');
for await (const chunk of result2.textStream) {
  process.stdout.write(chunk);
}

// Or interrupt mid-execution and redirect
session.interrupt();
const result3 = await session.send('Actually, let me ask something else.');
```

### `PromptSession` Interface

```typescript
interface PromptSession {
  /** StreamTextResult for the current (or most recent) turn */
  readonly result: StreamTextResult<any, any>;

  /** The StatefulPrompt from the current turn */
  readonly prompt: StatefulPrompt;

  /**
   * Send a follow-up message to start a new turn.
   * If the current turn is still streaming, waits for it to complete first.
   * Accepts a string or rich content parts (images, etc.)
   */
  send(message: string): Promise<StreamTextResult<any, any>>;
  send(content: ContentPart[]): Promise<StreamTextResult<any, any>>;

  /**
   * Interrupt the current execution.
   * Aborts the in-flight API call and tool executions.
   * History is preserved up to the point of interruption.
   * The session remains usable — call send() to start a new turn.
   */
  interrupt(): void;

  /** Full conversation history across all turns */
  readonly history: ReadonlyArray<ModelMessage>;

  /** Number of completed turns */
  readonly turnCount: number;

  /** Shared state manager — persists across turns */
  readonly state: StateManager;

  /** Background task registry — persists across turns */
  readonly tasks: BackgroundTaskRegistry;

  /** Export session for persistence (serializable) */
  export(): SessionSnapshot;

  /** Close session, flush debug logs, cancel background tasks */
  close(): Promise<void>;

  /** Resolves when all debug logging has been flushed */
  readonly cleanup: Promise<void>;

  /** Event hooks */
  onTurnStart?: (turnNumber: number) => void;
  onTurnEnd?: (turnNumber: number) => void;
}

interface SessionSnapshot {
  history: ModelMessage[];
  state: Record<string, any>;
  turnCount: number;
}
```

### How `send()` Works

```
session.send("Follow-up question")
    │
    ▼
1. Wait for current turn to finish (await result.text)
    │
    ▼
2. Collect response messages from completed turn
   (result.response.messages → append to history)
    │
    ▼
3. Append new user message to history
    │
    ▼
4. Create fresh StatefulPrompt for this turn
   - Inject shared StateManager (state persists)
   - Inject shared EffectsManager (dependency tracking persists)
   - Inject shared BackgroundTaskRegistry (tasks persist)
    │
    ▼
5. Re-run promptFn for tool/definition setup
   - defMessage('user', ..., { once: true }) → skipped (not first turn)
   - defSystem, defTool, defState → re-registered with current state
    │
    ▼
6. Overwrite messages with managed history via setMessages()
    │
    ▼
7. Inject completed background task notifications (if any)
    │
    ▼
8. prompt.run() → return StreamTextResult
```

### How `interrupt()` Works

```
session.interrupt()
    │
    ▼
1. Signal AbortController → aborts in-flight streamText() call
    │
    ▼
2. Cancel any running tool executions (via AbortSignal)
    │
    ▼
3. Collect partial response (whatever streamed so far)
    │
    ▼
4. Append partial assistant response to history
   (marked as interrupted so the LLM knows context was cut)
    │
    ▼
5. Session is now idle — ready for send()
```

The interrupted turn adds a message like:
```json
{ "role": "assistant", "content": "[partial response...]" }
{ "role": "system", "content": "[Previous response was interrupted by user]" }
```

This way the LLM has context about what happened when the next turn starts.

### Restoring Sessions

```typescript
// Save
const snapshot = session.export();
fs.writeFileSync('session.json', JSON.stringify(snapshot));

// Restore — pass snapshot in config
const session2 = await runPrompt(promptFn, {
  model: 'openai:gpt-4o',
  restore: JSON.parse(fs.readFileSync('session.json', 'utf8')),
});
// session2 has the full history and state from the snapshot
// The first "turn" uses defMessage from promptFn as setup context
// but history from the snapshot is the actual conversation
```

### Return Type Change

```typescript
// Current
interface RunPromptResult {
  prompt: StatefulPrompt;
  result: StreamTextResult<any, any>;
  cleanup: Promise<void>;
}

// New — PromptSession IS the return value
// session.result, session.prompt, session.cleanup all exist
// Plus: session.send(), session.interrupt(), session.history, etc.
const session: PromptSession = await runPrompt(promptFn, config);
```

This is backward compatible — existing code that destructures `{ result, prompt, cleanup }` still works because `PromptSession` has those same properties.

### Infrastructure Changes

#### StateManager — Injectable + Serializable

```typescript
// src/state/StateManager.ts
setStateManager(stateManager: StateManager): void;

toJSON(): Record<string, any>;
static fromJSON(data: Record<string, any>): StateManager;
```

#### EffectsManager — Injectable

```typescript
// src/StatefulPrompt.ts
setEffectsManager(effectsManager: EffectsManager): void;
```

#### StreamTextBuilder — Message Control + Abort

```typescript
// src/StreamText.ts
setMessages(messages: ModelMessage[]): this;
getMessages(): ReadonlyArray<ModelMessage>;
setAbortSignal(signal: AbortSignal): this;  // threaded into streamText()
```

### CLI Support

When `lmthing run` detects `interactive: true` in the module config, it starts a REPL:

```typescript
// mybot.lmt.mjs
export default async ({ defSystem, defTool, defMessage }) => {
  defSystem('role', 'You are a helpful assistant.');
  defTool('time', 'Get current time', z.object({}), () => new Date().toISOString());
  defMessage('user', 'Hello!');  // initial message for first turn
};

export const config = {
  model: 'openai:gpt-4o',
  interactive: true,
};
```

```bash
$ lmthing run mybot.lmt.mjs
# Streams first turn response...
# Then enters REPL:
> What time is it?
Assistant: Let me check... It's 2026-03-16T14:32:00Z.
> /exit
```

When `interactive` is not set, `runPrompt()` works exactly as today — the session is returned but `send()` is available if the caller wants to use it.

### Files Changed

| File | Change |
|------|--------|
| `src/PromptSession.ts` | **New** — session class (~250 lines) |
| `src/runPrompt.ts` | Return `PromptSession` instead of plain object, add `restore` config option |
| `src/state/StateManager.ts` | Add `toJSON()`, `fromJSON()`, make injectable |
| `src/StatefulPrompt.ts` | Add `setStateManager()`, `setEffectsManager()`, `setBackgroundRegistry()` |
| `src/StreamText.ts` | Add `setMessages()`, `getMessages()`, `setAbortSignal()` |
| `src/index.ts` | Export `PromptSession`, `SessionSnapshot` |
| `src/cli.ts` | Add interactive REPL mode |

---

## Feature 3: Background-Capable Tools & Agents

### What Changes

`defTool` and `defAgent` gain a `background: true` option. When set, the tool's schema is extended with an optional `runInBackground` boolean. The LLM decides per-call whether to run the tool normally (blocking) or spawn it in the background.

### Why LLM-Chosen, Not Always-Background

A tool marked `background: true` is *capable* of background execution, not forced into it. The LLM sees:

```
Tool: deepSearch
Description: Search across many sources (can run in background)
Schema: {
  query: string,
  sources: string[],
  runInBackground?: boolean  // Set true to run in background and continue
}
```

The LLM chooses based on context:
- "Search for X and tell me the results" → `runInBackground: false` (blocking, returns results directly)
- "Start searching for X while I ask you about Y" → `runInBackground: true` (spawns, returns task handle)
- Multiple searches at once → some blocking, some background, LLM's choice

### API

```typescript
// Tool that CAN run in background — LLM chooses per call
defTool('deepSearch', 'Search across many sources (can run in background)',
  z.object({ query: z.string(), sources: z.array(z.string()) }),
  async ({ query, sources }) => {
    const results = [];
    for (const source of sources) {
      results.push(await searchSource(source, query));
    }
    return { results, totalSources: sources.length };
  },
  { background: true }
);

// Agent that CAN run in background
defAgent('researcher', 'In-depth research (can run in background)',
  z.object({ topic: z.string() }),
  async ({ topic }, prompt) => {
    prompt.defSystem('role', 'You are a thorough researcher.');
    prompt.defMessage('user', `Research ${topic} in depth.`);
  },
  { background: true, model: 'anthropic:claude-sonnet-4-20250514' }
);
```

### Execution Flow

**When `runInBackground: false` or omitted (default):**

Tool executes normally — blocks until completion, returns result directly. Identical to current behavior.

**When `runInBackground: true`:**

```
LLM calls deepSearch({ query: "AI safety", sources: [...], runInBackground: true })
    │
    ▼
1. Tool execute() starts in a background Promise
2. Returns immediately to LLM:
   {
     taskId: "deepSearch_1",
     status: "running",
     message: "deepSearch is running in the background.
               Use deepSearch_status to check, deepSearch_result to collect."
   }
    │
    ▼
3. LLM continues reasoning, calls other tools, responds to user
    │
    ▼
4. Later — LLM checks:
   deepSearch_status({ taskId: "deepSearch_1" })
   → { taskId: "deepSearch_1", status: "completed", elapsed: "12340ms" }
    │
    ▼
5. LLM collects:
   deepSearch_result({ taskId: "deepSearch_1" })
   → { results: [...], totalSources: 5 }
```

### Auto-Registered Companion Tools

When `defTool('X', ..., { background: true })`, three tools exist:

**`X`** — the main tool (schema extended with `runInBackground?: boolean`):
- If `runInBackground` is falsy: executes normally, returns result
- If `runInBackground` is true: spawns background task, returns handle

**`X_status`** — non-blocking check:
```typescript
// Auto-generated
{
  name: 'X_status',
  description: 'Check status of background X tasks',
  schema: z.object({
    taskId: z.string().optional()  // omit to see all X tasks
  }),
  // Returns: { taskId, status, elapsed } or array of all
}
```

**`X_result`** — collect result (blocks if still running):
```typescript
// Auto-generated
{
  name: 'X_result',
  description: 'Get result of a background X task. Waits if still running.',
  schema: z.object({
    taskId: z.string()
  }),
  // Returns: the actual tool result, or { error: message }
}
```

### BackgroundTaskRegistry

```typescript
// src/background/BackgroundTaskRegistry.ts

interface BackgroundTask {
  taskId: string;
  toolName: string;
  status: 'running' | 'completed' | 'error';
  promise: Promise<any>;
  result?: any;
  error?: Error;
  startedAt: number;
  completedAt?: number;
}

class BackgroundTaskRegistry {
  spawn(toolName: string, executeFn: () => Promise<any>): BackgroundTask;
  getTask(taskId: string): BackgroundTask | undefined;
  getTasksByTool(toolName: string): BackgroundTask[];
  getCompletedSince(timestamp: number): BackgroundTask[];
  getAllRunning(): BackgroundTask[];
  async awaitAll(timeoutMs?: number): Promise<void>;
  cancelAll(reason?: string): void;  // triggers AbortSignal on all running
}
```

The registry lives on the `PromptSession` and is injected into each turn's `StatefulPrompt`. Background tasks survive across turns.

### Completed Task Notification on Turn Start

When `session.send()` starts a new turn, it checks for background tasks that completed since the last turn ended. If any exist, it injects a system message:

```
[Background tasks completed since your last response:
- deepSearch_1: completed (14.2s) — call deepSearch_result to get results
- researcher_3: completed (28.7s) — call researcher_result to get results
- deepSearch_2: error — "Rate limit exceeded"]
```

This solves the "orphaned task" problem — the LLM is told about completions without having to poll.

### Interaction with `interrupt()`

When `session.interrupt()` is called:
- Background tasks keep running (they're independent of the current step loop)
- The next `send()` will include their completion notifications
- `session.close()` cancels all running background tasks via `AbortSignal`

### Companion Tool Name Collision Prevention

When registering companion tools, check if the name already exists:

```typescript
if (this._tools[`${name}_status`]) {
  throw new PluginError(
    `Cannot register background tool "${name}": "${name}_status" already exists`,
    ErrorCodes.TOOL_COLLISION
  );
}
```

### Files Changed

| File | Change |
|------|--------|
| `src/background/BackgroundTaskRegistry.ts` | **New** — registry (~120 lines) |
| `src/background/index.ts` | **New** — barrel export |
| `src/types/tools.ts` | Add `background?: boolean` to `ToolOptions` |
| `src/types/agents.ts` | Add `background?: boolean` to `AgentOptions` |
| `src/StatefulPrompt.ts` | Background wrapping in `defTool()` and `defAgent()`, registry injection |
| `src/PromptSession.ts` | Hold shared registry, inject completion notifications on turn start |
| `src/index.ts` | Export `BackgroundTaskRegistry`, `BackgroundTask` |

---

## Feature 4: `defMemory` — Persistent Knowledge-Structured Memory

### What Changes

A new built-in plugin that gives agents persistent, structured memory using the same `knowledge/` directory structure that `defKnowledgeAgent` uses. Memories are stored as markdown files with frontmatter, organized into domains and fields, persisted to disk, and auto-injected into the system prompt.

### Why Knowledge Structure

The knowledge structure (domains → fields → options as markdown files) already exists in lmthing and solves exactly the right problem:

- **Domains** = memory categories (e.g., "user-preferences", "project-context", "learned-facts")
- **Fields** = specific aspects (e.g., "coding-style", "tech-stack", "communication-preferences")
- **Options/entries** = individual memories as markdown files with frontmatter

This gives memory:
- **Structure** — not a flat append-only text file, but organized by category
- **Rich content** — each memory is a markdown file, can hold detailed information
- **Queryable** — organized by domain/field, easy to search
- **UI-ready** — the Studio already knows how to render knowledge structures
- **Consistent** — same format as THING spaces, same tooling

### Directory Structure

```
memory/
├── user-preferences/                    # domain
│   ├── config.json                      # { label: "User Preferences", icon: "👤", ... }
│   ├── coding-style/                    # field
│   │   ├── config.json                  # { label: "Coding Style", fieldType: "multiSelect", ... }
│   │   ├── typescript-strict.md         # memory entry
│   │   └── functional-patterns.md       # memory entry
│   └── communication/                   # field
│       ├── config.json
│       └── concise-responses.md
├── project-context/                     # domain
│   ├── config.json
│   └── architecture/
│       ├── config.json
│       ├── monorepo-structure.md
│       └── supabase-backend.md
└── learned-facts/                       # domain
    ├── config.json
    └── corrections/
        ├── config.json
        └── api-v2-not-v1.md
```

Each memory entry is a markdown file:

```markdown
---
title: Prefers TypeScript strict mode
description: User always wants strict TypeScript with no-any rules
order: 1
createdAt: 2026-03-16T10:00:00Z
updatedAt: 2026-03-16T10:00:00Z
---

The user prefers TypeScript with strict mode enabled. Always use:
- `strict: true` in tsconfig
- `noImplicitAny: true`
- Explicit return types on exported functions
- Zod for runtime validation at boundaries
```

### API

```typescript
const session = await runPrompt(async ({ defMemory, defSystem }) => {
  defSystem('role', 'You are a helpful coding assistant.');

  // Load memory from disk, inject into context, register tools
  defMemory('./memory', {
    inject: 'system',           // inject as system prompt section (default)
    maxEntries: 50,             // limit entries to prevent context overflow
    autoTools: true,            // register memory_save, memory_delete, memory_list (default)
  });

  defMessage('user', 'Help me write some code.');
}, { model: 'openai:gpt-4o' });
```

### What `defMemory` Does

1. **Reads** the knowledge structure from disk (same reader as `defKnowledgeAgent`)
2. **Injects** all memory entries as a system prompt section:
   ```
   <memory>
     <user-preferences>
       ## Coding Style: Prefers TypeScript strict mode
       The user prefers TypeScript with strict mode enabled...

       ## Coding Style: Functional patterns preferred
       Use map/filter/reduce over imperative loops...
     </user-preferences>
     <project-context>
       ## Architecture: Monorepo structure
       The project is organized by TLD...
     </project-context>
   </memory>
   ```
3. **Registers** auto-tools for the LLM to manage memory:

#### Auto-Registered Tools

**`memory_save`** — save a new memory entry:
```typescript
{
  name: 'memory_save',
  description: 'Save a new memory. Use this to remember important user preferences, corrections, project details, or learned facts.',
  schema: z.object({
    domain: z.string().describe('Category (e.g., "user-preferences", "project-context", "learned-facts")'),
    field: z.string().describe('Specific aspect (e.g., "coding-style", "architecture")'),
    slug: z.string().describe('Short kebab-case identifier for this memory'),
    title: z.string().describe('Brief title'),
    content: z.string().describe('Detailed memory content in markdown'),
  }),
}
```

When called:
- Creates domain directory + `config.json` if it doesn't exist
- Creates field directory + `config.json` if it doesn't exist
- Writes the markdown file with frontmatter
- Updates the system prompt injection (via `defSystem` re-registration)

**`memory_delete`** — remove a memory:
```typescript
{
  name: 'memory_delete',
  description: 'Delete a memory that is outdated or incorrect.',
  schema: z.object({
    domain: z.string(),
    field: z.string(),
    slug: z.string(),
  }),
}
```

**`memory_list`** — browse available memories:
```typescript
{
  name: 'memory_list',
  description: 'List all stored memories, optionally filtered by domain.',
  schema: z.object({
    domain: z.string().optional(),
  }),
}
```

### Interaction with `PromptSession`

Since `promptFn` re-runs every turn, `defMemory` re-reads from disk each turn. This means:
- Memories saved in turn 1 are visible in turn 2's system prompt
- External changes to the memory directory are picked up automatically
- No in-memory cache to go stale

For performance, `defMemory` can cache the disk read and only re-read if the directory's mtime has changed.

### Interaction with `defKnowledgeAgent`

`defMemory` reuses the same internal functions as `defKnowledgeAgent`:
- `readKnowledgeFields()` for reading the structure
- `buildKnowledgeContext()` for building injection text
- Same `config.json` format for domains and fields
- Same markdown + frontmatter format for entries

The difference:
- `defKnowledgeAgent` reads a **static** knowledge base configured at design time
- `defMemory` reads a **dynamic** knowledge base that the agent can write to at runtime

### Auto-Creation of Structure

When `memory_save` is called with a new domain or field that doesn't exist yet, the tool creates the directory structure and `config.json` files automatically:

```typescript
// LLM calls: memory_save({
//   domain: "user-preferences",
//   field: "testing-style",
//   slug: "integration-over-mocks",
//   title: "Prefers integration tests over mocks",
//   content: "User got burned by mocked tests passing..."
// })

// If user-preferences/testing-style/ doesn't exist:
// 1. Creates user-preferences/config.json (if missing):
//    { "label": "User Preferences", "renderAs": "section" }
// 2. Creates user-preferences/testing-style/config.json:
//    { "label": "Testing Style", "fieldType": "multiSelect", "variableName": "testingStyle", "renderAs": "field" }
// 3. Writes user-preferences/testing-style/integration-over-mocks.md
```

Domain labels and field labels are auto-generated from the kebab-case names (e.g., "testing-style" → "Testing Style"). The LLM can provide better names if it wants, but the defaults are sensible.

### Files Changed

| File | Change |
|------|--------|
| `src/plugins/memory/memoryPlugin.ts` | **New** — plugin implementation (~200 lines) |
| `src/plugins/memory/index.ts` | **New** — barrel export |
| `src/plugins/index.ts` | Add `memoryPlugin` to built-in plugins |
| `src/StatefulPrompt.ts` | Add `defMemory()` built-in plugin method |
| `src/index.ts` | Export memory types |

---

## Implementation Order

### Phase 1: Foundation (no behavior changes)

1. **StateManager** — add `toJSON()`, `fromJSON()` serialization
2. **StatefulPrompt** — add `setStateManager()`, `setEffectsManager()`, `setBackgroundRegistry()`
3. **StreamTextBuilder** — add `setMessages()`, `getMessages()`, `setAbortSignal()`

### Phase 2: Remove `$`

4. **StatefulPrompt** — remove `$()` method, add `once` option to `defMessage()`
5. **Tests** — migrate all `.$\`` usages to `defMessage('user', ...)`
6. **Docs** — update all examples

### Phase 3: PromptSession

7. **BackgroundTaskRegistry** — new file
8. **PromptSession** — new file
9. **runPrompt()** — return `PromptSession` instead of plain object
10. **Tests** — session lifecycle, multi-turn, interrupt, export/restore

### Phase 4: Background Execution

11. **ToolOptions / AgentOptions** — add `background` field
12. **StatefulPrompt.defTool()** — background wrapping with `runInBackground` schema extension
13. **StatefulPrompt.defAgent()** — same wrapping
14. **PromptSession.send()** — inject completed task notifications
15. **Tests** — background spawn, status, result, cross-turn persistence

### Phase 5: Memory Plugin

16. **memoryPlugin** — `defMemory()` implementation using knowledge structure readers
17. **Auto-tools** — `memory_save`, `memory_delete`, `memory_list`
18. **Built-in registration** — add to `builtInPlugins`
19. **Tests** — save, delete, list, injection, auto-creation

### Phase 6: CLI

20. **cli.ts** — interactive REPL when `interactive: true` in module config

---

## Files Summary

| File | Phase | Change |
|------|-------|--------|
| `src/state/StateManager.ts` | 1 | Add serialization methods |
| `src/effects/EffectsManager.ts` | 1 | (already sufficient, injectable via setter) |
| `src/StatefulPrompt.ts` | 1-4 | Injectable managers, remove `$`, `defMemory`, background wrapping |
| `src/StreamText.ts` | 1 | `setMessages()`, `getMessages()`, `setAbortSignal()` |
| `src/background/BackgroundTaskRegistry.ts` | 3 | **New** (~120 lines) |
| `src/PromptSession.ts` | 3 | **New** (~250 lines) |
| `src/runPrompt.ts` | 3 | Return `PromptSession`, `restore` option |
| `src/types/tools.ts` | 4 | Add `background?: boolean` |
| `src/types/agents.ts` | 4 | Add `background?: boolean` |
| `src/plugins/memory/memoryPlugin.ts` | 5 | **New** (~200 lines) |
| `src/plugins/memory/index.ts` | 5 | **New** |
| `src/plugins/index.ts` | 5 | Add memoryPlugin |
| `src/index.ts` | 3-5 | Export new types |
| `src/cli.ts` | 6 | Interactive REPL |
| Tests (multiple) | 2-5 | Migration + new test files |
