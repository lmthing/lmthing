# CHATPLAN.md — Interactive Chat & Background Execution for lmthing

## Problem Statement

**Interactive Chat:** `runPrompt()` is designed for single-prompt, multi-step execution. Each call is isolated — `StateManager` is instance-scoped, `_executedOnce` prevents duplicate user messages, and there's no mechanism to accept new user input after execution starts. The product layer must manage multi-turn chat externally.

**Blocking Execution:** When the LLM calls a tool or agent, the entire agent loop blocks until that tool returns. Long-running operations (deep research, code execution, multi-source scraping) stall the conversation. There's no way to spawn work in the background and continue the conversation.

## Design Overview

Two additions to `runPrompt()`:

1. **`interactive: true`** — returns a session object with `send()` for multi-turn conversation, using the same `runPrompt()` entry point
2. **`background: true`** on `defTool`/`defAgent` — spawns execution in the background, returns a handle immediately, auto-registers companion tools for status/result checking

```
┌─────────────────────────────────────────────────────────────────┐
│                     runPrompt(promptFn, config)                  │
│                                                                  │
│  interactive: false (default)        interactive: true           │
│  ┌──────────────────────┐            ┌────────────────────────┐  │
│  │ Single execution     │            │ Returns ChatSession    │  │
│  │ Returns result +     │            │ with send() method     │  │
│  │ prompt + cleanup     │            │ State persists across  │  │
│  └──────────────────────┘            │ turns via shared mgrs  │  │
│                                      └────────────────────────┘  │
│                                                                  │
│  defTool / defAgent options:                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ background: true                                         │    │
│  │ → Tool returns { taskId, status: 'running' } immediately │    │
│  │ → Auto-registers {name}_status and {name}_result tools   │    │
│  │ → Work runs in background Promise                        │    │
│  │ → LLM can check/poll or continue other work              │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Feature 1: Interactive Mode on `runPrompt()`

### API Design

Instead of a separate `runChat()`, `runPrompt()` gains an `interactive` option. When true, the return type changes to include a `session` object:

```typescript
// Autonomous mode (unchanged)
const { result, prompt, cleanup } = await runPrompt(promptFn, {
  model: 'openai:gpt-4o',
});

// Interactive mode
const { session, cleanup } = await runPrompt(promptFn, {
  model: 'openai:gpt-4o',
  interactive: true,
});

// Send turns
const result1 = await session.send('Hello!');
for await (const chunk of result1.textStream) {
  process.stdout.write(chunk);
}

const result2 = await session.send('Follow up question');
for await (const chunk of result2.textStream) {
  process.stdout.write(chunk);
}

// Session properties
session.history;     // ReadonlyArray<ModelMessage>
session.turnCount;   // number
session.state;       // StateManager (shared across turns)
session.lastPrompt;  // StatefulPrompt from most recent turn

// Lifecycle
const snapshot = session.export();  // { history, state, turnCount }
await session.close();
```

### Return Type

```typescript
// Current return type (unchanged for non-interactive)
interface RunPromptResult {
  prompt: StatefulPrompt;
  result: StreamTextResult<any, any>;
  cleanup: Promise<void>;
}

// New return type when interactive: true
interface RunPromptInteractiveResult {
  session: ChatSession;
  cleanup: Promise<void>;
}

// Overloaded signatures
export function runPrompt<P extends readonly Plugin[] = []>(
  promptFn: PromptFn<P>,
  config: PromptConfig<P> & { interactive: true }
): Promise<RunPromptInteractiveResult>;

export function runPrompt<P extends readonly Plugin[] = []>(
  promptFn: PromptFn<P>,
  config: PromptConfig<P>
): Promise<RunPromptResult>;
```

### `ChatSession` Class

```typescript
interface ChatSession {
  /** Send a user message (string or rich content parts) */
  send(message: string | ContentPart[]): Promise<StreamTextResult<any, any>>;

  /** Full conversation history */
  readonly history: ReadonlyArray<ModelMessage>;

  /** Number of completed turns */
  readonly turnCount: number;

  /** Shared state manager (persists across turns) */
  readonly state: StateManager;

  /** StatefulPrompt from the most recent turn */
  readonly lastPrompt: StatefulPrompt | null;

  /** Export for persistence/restore */
  export(): ChatSessionSnapshot;

  /** Close session, flush debug logs */
  close(): Promise<void>;

  /** Event hooks */
  onTurnStart?: (turnNumber: number, message: string) => void;
  onTurnEnd?: (turnNumber: number, result: StreamTextResult<any, any>) => void;
}

interface ChatSessionSnapshot {
  history: ModelMessage[];
  state: Record<string, any>;
  turnCount: number;
}
```

### How `send()` Works

Each `send()` call:

1. Appends the user message to the shared `_history`
2. Creates a **fresh `StatefulPrompt`** for this turn
3. **Injects the shared `StateManager`** — so `defState` values persist across turns
4. **Injects the shared `EffectsManager`** — so `defEffect` dependency tracking carries over
5. Re-runs `promptFn` to register tools, system parts, variables, state (definitions can evolve based on state)
6. **Overwrites messages** with the managed history via `setMessages()`
7. Calls `prompt.run()` → returns `StreamTextResult`
8. After streaming completes, appends assistant response messages to `_history`

This means `promptFn` serves as a **setup function** that runs every turn. It can use `defState` to conditionally change behavior:

```typescript
const { session } = await runPrompt(async ({ defSystem, defState, defTool }) => {
  const [mode, setMode] = defState('mode', 'general');

  // System prompt evolves based on state
  if (mode === 'general') {
    defSystem('role', 'You are a helpful assistant.');
  } else if (mode === 'code') {
    defSystem('role', 'You are a code review specialist.');
  }

  defTool('switchMode', 'Switch conversation mode',
    z.object({ mode: z.enum(['general', 'code']) }),
    ({ mode }) => { setMode(mode); return `Switched to ${mode} mode`; }
  );
}, { model: 'openai:gpt-4o', interactive: true });
```

### Restoring Sessions

```typescript
// Save
const snapshot = session.export();
localStorage.setItem('chat', JSON.stringify(snapshot));

// Restore — use runPrompt with a restore option
const { session: restored } = await runPrompt(promptFn, {
  model: 'openai:gpt-4o',
  interactive: true,
  restore: JSON.parse(localStorage.getItem('chat')),
});

await restored.send('Where were we?');
```

### CLI Support

```typescript
// mybot.lmt.mjs
export default async ({ defSystem, defTool }) => {
  defSystem('role', 'You are a helpful assistant.');
  defTool('time', 'Get current time', z.object({}), () => new Date().toISOString());
};

export const config = {
  model: 'openai:gpt-4o',
  interactive: true,  // <-- lmthing run auto-detects and starts REPL
};
```

```bash
$ lmthing run mybot.lmt.mjs
Chat session started. Type /exit to quit.

> Hello!
Assistant: Hi! How can I help you today?
> What time is it?
Assistant: Let me check... It's 2026-03-16T14:32:00Z.
> /exit
```

When `lmthing run` detects `interactive: true` in the module config, it starts a readline REPL instead of single-shot execution. No separate `lmthing chat` command needed.

---

## Feature 2: Background Execution for Tools & Agents

### Problem

When the LLM calls a tool, the AI SDK waits for the tool's `execute()` to resolve before continuing. For a tool that takes 30 seconds (deep web search, large code analysis, agent delegation), the entire conversation stalls.

Background execution lets a tool return immediately with a task handle while the real work runs in a background Promise. The LLM can continue reasoning, call other tools, or work on parallel tasks, then check back for results.

### API Design

Add `background: true` to `ToolOptions` and `AgentOptions`:

```typescript
// Background tool
defTool('deepSearch', 'Deep search across many sources',
  z.object({ query: z.string(), sources: z.array(z.string()) }),
  async ({ query, sources }) => {
    // This runs in the background — can take as long as needed
    const results = [];
    for (const source of sources) {
      results.push(await searchSource(source, query));
    }
    return { results, totalSources: sources.length };
  },
  { background: true }
);

// Background agent
defAgent('researcher', 'In-depth research agent',
  z.object({ topic: z.string() }),
  async ({ topic }, prompt) => {
    prompt.defSystem('role', 'You are a thorough researcher.');
    prompt.$`Research ${topic} in depth with multiple sources.`;
  },
  { background: true, model: 'openai:gpt-4o' }
);
```

### What Happens When the LLM Calls a Background Tool

When `deepSearch` is called with `{ background: true }`:

1. The `execute()` function starts running in a background `Promise`
2. The tool **immediately returns** to the LLM:
   ```json
   {
     "taskId": "deepSearch_1710590000000",
     "status": "running",
     "message": "deepSearch is running in the background. Use deepSearch_status to check progress, or deepSearch_result to get the final result."
   }
   ```
3. Two companion tools are **auto-registered**:
   - **`{name}_status`** — returns `{ taskId, status: 'running' | 'completed' | 'error', elapsed }`
   - **`{name}_result`** — blocks until completion, returns the actual result (or returns it immediately if already done)

```
LLM calls deepSearch({ query: "AI safety", sources: [...] })
    │
    ▼
Tool returns immediately: { taskId: "deepSearch_abc", status: "running" }
    │
    ▼
LLM continues reasoning, calls other tools...
    │
    ▼
LLM calls deepSearch_status({ taskId: "deepSearch_abc" })
    → { status: "running", elapsed: "12s" }
    │
    ▼
LLM calls deepSearch_result({ taskId: "deepSearch_abc" })
    → Blocks until done, then returns the actual search results
```

### Background Task Registry

`StatefulPrompt` gets a `BackgroundTaskRegistry` that tracks all spawned background tasks:

```typescript
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
  private tasks = new Map<string, BackgroundTask>();

  spawn(toolName: string, execute: () => Promise<any>): BackgroundTask;
  getTask(taskId: string): BackgroundTask | undefined;
  getTasksByTool(toolName: string): BackgroundTask[];
  getAllTasks(): BackgroundTask[];
}
```

### Auto-Generated Companion Tools

When `defTool('deepSearch', ..., { background: true })` is called, three tools are registered:

**1. `deepSearch`** (modified original) — starts the background task:
```typescript
// execute wraps the original:
async (args) => {
  const task = registry.spawn('deepSearch', () => originalExecute(args));
  return {
    taskId: task.taskId,
    status: 'running',
    message: `deepSearch started. Use deepSearch_status or deepSearch_result to check.`
  };
}
```

**2. `deepSearch_status`** — non-blocking status check:
```typescript
defTool('deepSearch_status', 'Check status of a running deepSearch task',
  z.object({ taskId: z.string().optional() }),
  ({ taskId }) => {
    if (taskId) {
      const task = registry.getTask(taskId);
      return { taskId, status: task.status, elapsed: `${Date.now() - task.startedAt}ms` };
    }
    // Return all tasks for this tool
    return registry.getTasksByTool('deepSearch').map(t => ({
      taskId: t.taskId, status: t.status
    }));
  }
);
```

**3. `deepSearch_result`** — blocks until complete (or returns immediately if done):
```typescript
defTool('deepSearch_result', 'Get the result of a completed deepSearch task',
  z.object({ taskId: z.string() }),
  async ({ taskId }) => {
    const task = registry.getTask(taskId);
    if (task.status === 'completed') return task.result;
    if (task.status === 'error') return { error: task.error.message };
    // Still running — await completion
    await task.promise;
    return task.result ?? { error: task.error?.message };
  }
);
```

### Background Agents

Background agents work identically — `defAgent` with `{ background: true }` spawns the child `StatefulPrompt` in a background Promise and returns a task handle. The auto-generated `{name}_status` and `{name}_result` companion tools work the same way.

```typescript
defAgent('researcher', 'Deep research agent',
  z.object({ topic: z.string() }),
  async ({ topic }, prompt) => {
    prompt.defSystem('role', 'Thorough researcher');
    prompt.$`Research: ${topic}`;
  },
  { background: true, model: 'anthropic:claude-sonnet-4-20250514' }
);

// LLM calls researcher({ topic: "quantum computing" })
// → { taskId: "researcher_abc", status: "running" }
// LLM continues other work...
// LLM calls researcher_result({ taskId: "researcher_abc" })
// → { response: "Here's my research on quantum computing...", steps: [...] }
```

### Multiple Concurrent Background Tasks

The LLM can spawn multiple background tasks in parallel:

```typescript
// LLM makes three tool calls in one step:
// 1. deepSearch({ query: "AI safety" })         → taskId: "ds_1"
// 2. deepSearch({ query: "alignment" })          → taskId: "ds_2"
// 3. researcher({ topic: "interpretability" })   → taskId: "r_1"
//
// All three run concurrently in the background
// LLM can check on any of them independently
```

### Interaction with Interactive Mode

Background tasks compose naturally with interactive mode. Tasks survive across turns:

```typescript
const { session } = await runPrompt(async ({ defTool }) => {
  defTool('longTask', 'A long-running task', schema, handler, { background: true });
}, { model: 'openai:gpt-4o', interactive: true });

// Turn 1: Start background task
await session.send('Start processing that large dataset');
// LLM calls longTask → gets taskId, responds "I've started processing..."

// Turn 2: Check on it (minutes later)
await session.send('How is that processing going?');
// LLM calls longTask_status → "still running"

// Turn 3: Get result
await session.send('Is it done yet?');
// LLM calls longTask_result → returns the completed result
```

This requires the `BackgroundTaskRegistry` to be on the shared `ChatSession`, not per-`StatefulPrompt`. The registry is injected into each turn's prompt just like `StateManager`.

### Background Task Lifecycle & Cleanup

- Tasks run until completion or error
- On `session.close()` (interactive) or `cleanup` (autonomous): all running tasks are awaited with a timeout, then force-cancelled if still running
- Tasks can optionally support `AbortSignal` for cancellation:

```typescript
defTool('longTask', 'Long task', schema,
  async (args, { abortSignal }) => {
    // Tool can check abortSignal for cancellation
    for (const item of items) {
      if (abortSignal?.aborted) throw new Error('Cancelled');
      await processItem(item);
    }
  },
  { background: true }
);
```

---

## Implementation Plan

### Phase 1: Core Infrastructure Changes

#### Step 1.1: Make StateManager Injectable & Serializable

**File:** `src/state/StateManager.ts`

```typescript
// Add serialization methods
toJSON(): Record<string, any> {
  return Object.fromEntries(this.store);
}

static fromJSON(data: Record<string, any>): StateManager {
  const sm = new StateManager();
  sm.store = new Map(Object.entries(data));
  return sm;
}
```

**File:** `src/StatefulPrompt.ts`

```typescript
// Add injection methods
setStateManager(stateManager: StateManager): void {
  this._stateManager = stateManager;
}

setEffectsManager(effectsManager: EffectsManager): void {
  this._effectsManager = effectsManager;
}
```

#### Step 1.2: Add `setMessages()` to StreamTextBuilder

**File:** `src/StreamText.ts`

```typescript
public setMessages(messages: ModelMessage[]): this {
  this._messages = [...messages];
  return this;
}

public getMessages(): ReadonlyArray<ModelMessage> {
  return [...this._messages];
}
```

This lets `ChatSession` overwrite messages with managed history after `promptFn` runs.

### Phase 2: BackgroundTaskRegistry

#### Step 2.1: Create BackgroundTaskRegistry

**File:** `src/background/BackgroundTaskRegistry.ts` (~100 lines)

```typescript
export interface BackgroundTask {
  taskId: string;
  toolName: string;
  status: 'running' | 'completed' | 'error';
  promise: Promise<any>;
  result?: any;
  error?: Error;
  startedAt: number;
  completedAt?: number;
}

export class BackgroundTaskRegistry {
  private tasks = new Map<string, BackgroundTask>();
  private counter = 0;

  spawn(toolName: string, executeFn: () => Promise<any>): BackgroundTask {
    const taskId = `${toolName}_${++this.counter}_${Date.now()}`;
    const task: BackgroundTask = {
      taskId,
      toolName,
      status: 'running',
      startedAt: Date.now(),
      promise: null!, // set below
    };

    task.promise = executeFn()
      .then(result => {
        task.status = 'completed';
        task.result = result;
        task.completedAt = Date.now();
        return result;
      })
      .catch(error => {
        task.status = 'error';
        task.error = error instanceof Error ? error : new Error(String(error));
        task.completedAt = Date.now();
        throw error;
      });

    this.tasks.set(taskId, task);
    return task;
  }

  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  getTasksByTool(toolName: string): BackgroundTask[] {
    return [...this.tasks.values()].filter(t => t.toolName === toolName);
  }

  getAllTasks(): BackgroundTask[] {
    return [...this.tasks.values()];
  }

  async awaitAll(timeoutMs = 30000): Promise<void> {
    const running = this.getAllTasks().filter(t => t.status === 'running');
    if (running.length === 0) return;
    await Promise.race([
      Promise.allSettled(running.map(t => t.promise)),
      new Promise(resolve => setTimeout(resolve, timeoutMs)),
    ]);
  }
}
```

#### Step 2.2: Wire Background into `defTool` and `defAgent`

**File:** `src/types/tools.ts` — add `background` option:

```typescript
export interface ToolOptions<TInput = unknown, TOutput = unknown> {
  responseSchema?: ZodSchema;
  onSuccess?: ToolEventCallback<TInput, TOutput>;
  onError?: ToolEventCallback<TInput, Error | unknown>;
  beforeCall?: ToolEventCallback<TInput, undefined>;
  background?: boolean;  // <-- new
}
```

**File:** `src/types/agents.ts` — add `background` option:

```typescript
export interface AgentOptions {
  model?: ModelInput;
  responseSchema?: ZodSchema;
  system?: string;
  plugins?: readonly Plugin[];
  background?: boolean;  // <-- new
  [key: string]: unknown;
}
```

**File:** `src/StatefulPrompt.ts` — modify `defTool()` and `defAgent()`:

When `options.background === true`:

1. Add `_backgroundRegistry: BackgroundTaskRegistry` to `StatefulPrompt` (injectable like StateManager)
2. In `defTool()`: wrap `execute` to spawn via registry and return handle
3. Auto-register `{name}_status` and `{name}_result` companion tools
4. In `defAgent()`: same wrapping for agent execution

```typescript
// In defTool, when background: true
if (options?.background) {
  // Register the main tool (spawns background task)
  this.addTool(name, {
    description: `${description} (runs in background)`,
    inputSchema,
    execute: async (args: any) => {
      const task = this._backgroundRegistry.spawn(name, () => originalExecute(args));
      return {
        taskId: task.taskId,
        status: 'running',
        message: `${name} started in background. Use ${name}_status to check progress or ${name}_result to get the final result.`,
      };
    },
  });

  // Register status companion tool
  this.addTool(`${name}_status`, {
    description: `Check the status of a running ${name} background task`,
    inputSchema: z.object({ taskId: z.string().optional().describe('Specific task ID, or omit to see all') }),
    execute: ({ taskId }: { taskId?: string }) => {
      if (taskId) {
        const task = this._backgroundRegistry.getTask(taskId);
        if (!task) return { error: 'Task not found' };
        return {
          taskId,
          status: task.status,
          elapsed: `${Date.now() - task.startedAt}ms`,
          ...(task.status === 'error' ? { error: task.error?.message } : {}),
        };
      }
      return this._backgroundRegistry.getTasksByTool(name).map(t => ({
        taskId: t.taskId,
        status: t.status,
        elapsed: `${Date.now() - t.startedAt}ms`,
      }));
    },
  });

  // Register result companion tool
  this.addTool(`${name}_result`, {
    description: `Get the result of a ${name} background task. Waits for completion if still running.`,
    inputSchema: z.object({ taskId: z.string().describe('The task ID returned by ' + name) }),
    execute: async ({ taskId }: { taskId: string }) => {
      const task = this._backgroundRegistry.getTask(taskId);
      if (!task) return { error: 'Task not found' };
      if (task.status === 'completed') return task.result;
      if (task.status === 'error') return { error: task.error?.message };
      try {
        return await task.promise;
      } catch (e: any) {
        return { error: e.message };
      }
    },
  });
}
```

#### Step 2.3: Inject BackgroundTaskRegistry

Add to `StatefulPrompt`:

```typescript
private _backgroundRegistry = new BackgroundTaskRegistry();

setBackgroundRegistry(registry: BackgroundTaskRegistry): void {
  this._backgroundRegistry = registry;
}
```

For interactive mode, `ChatSession` shares a single `BackgroundTaskRegistry` across turns (same pattern as `StateManager`).

### Phase 3: ChatSession & Interactive runPrompt

#### Step 3.1: Create ChatSession

**File:** `src/ChatSession.ts` (~200 lines)

Core implementation as described in API Design section. Key points:

- Holds shared `StateManager`, `EffectsManager`, `BackgroundTaskRegistry`
- `send()` creates fresh `StatefulPrompt` per turn, injects shared managers
- Re-runs `promptFn` each turn for definition setup
- Overwrites messages with managed history via `setMessages()`
- After stream completion, appends response messages to history

#### Step 3.2: Extend `runPrompt()` with `interactive` Option

**File:** `src/runPrompt.ts`

```typescript
// Add to PromptConfig
export interface PromptConfig<P extends readonly Plugin[] = []> {
  model: ModelInput;
  options?: /* ... existing ... */;
  plugins?: P;
  debug?: /* ... existing ... */;
  interactive?: boolean;                    // <-- new
  restore?: ChatSessionSnapshot;            // <-- new (for restoring sessions)
}

// Overloaded signatures
export async function runPrompt<const P extends readonly Plugin[] = []>(
  promptFn: (prompt: PromptWithPlugins<P>) => Promise<void>,
  config: PromptConfig<P> & { interactive: true }
): Promise<RunPromptInteractiveResult>;

export async function runPrompt<const P extends readonly Plugin[] = []>(
  promptFn: (prompt: PromptWithPlugins<P>) => Promise<void>,
  config: PromptConfig<P>
): Promise<RunPromptResult>;

// Implementation
export async function runPrompt(promptFn: any, config: any): Promise<any> {
  if (config.interactive) {
    // Create ChatSession with optional restore
    const session = new ChatSession(promptFn, config, config.restore ? {
      history: config.restore.history,
      state: StateManager.fromJSON(config.restore.state),
      turnCount: config.restore.turnCount,
    } : undefined);

    const cleanup = async () => {
      await session.close();
    };

    return { session, cleanup };
  }

  // ... existing runPrompt logic unchanged ...
}
```

#### Step 3.3: Export New Types

**File:** `src/index.ts`

```typescript
export { ChatSession, type ChatSessionSnapshot } from './ChatSession';
export { BackgroundTaskRegistry, type BackgroundTask } from './background/BackgroundTaskRegistry';
```

### Phase 4: CLI Support

#### Step 4.1: Auto-Detect Interactive Mode in `lmthing run`

**File:** `src/cli.ts`

When the module config has `interactive: true`, `runLmtFile` starts a readline REPL:

```typescript
export async function runLmtFile(filePath: string, options: RunOptions = {}): Promise<string> {
  // ... existing validation and loading ...

  if (config.interactive) {
    return runInteractiveSession(promptFn, config, options);
  }

  // ... existing single-shot logic ...
}

async function runInteractiveSession(
  promptFn: Function,
  config: any,
  options: RunOptions
): Promise<string> {
  const { session } = await runPrompt(promptFn, { ...config, interactive: true });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('Chat session started. Type /exit to quit.\n');

  return new Promise((resolve) => {
    const askQuestion = () => {
      rl.question('> ', async (input) => {
        const trimmed = input.trim();
        if (trimmed === '/exit' || trimmed === '/quit') {
          await session.close();
          rl.close();
          resolve('');
          return;
        }
        if (!trimmed) { askQuestion(); return; }

        try {
          const result = await session.send(trimmed);
          process.stdout.write('\n');
          for await (const chunk of result.textStream) {
            process.stdout.write(chunk);
          }
          console.log('\n');
        } catch (error: any) {
          console.error(`Error: ${error.message}`);
        }
        askQuestion();
      });
    };
    askQuestion();
  });
}
```

### Phase 5: Testing

#### Step 5.1: Interactive Mode Tests

**File:** `src/ChatSession.test.ts`

```typescript
describe('ChatSession (interactive mode)', () => {
  it('should maintain history across turns');
  it('should persist defState across turns');
  it('should re-run promptFn each turn for definition updates');
  it('should support conditional defSystem based on state');
  it('should export and restore sessions');
  it('should reject sends after close');
  it('should reject concurrent sends');
  it('should support tools with state across turns');
  it('should support effects with cross-turn dependency tracking');
});
```

#### Step 5.2: Background Execution Tests

**File:** `src/background/BackgroundTaskRegistry.test.ts`

```typescript
describe('BackgroundTaskRegistry', () => {
  it('should spawn tasks and track status');
  it('should resolve task.promise when complete');
  it('should handle task errors');
  it('should return all tasks by tool name');
  it('should awaitAll with timeout');
});
```

**File:** `src/background/backgroundTool.test.ts`

```typescript
describe('defTool with background: true', () => {
  it('should return taskId immediately');
  it('should auto-register _status companion tool');
  it('should auto-register _result companion tool');
  it('should complete task in background');
  it('should support multiple concurrent tasks');
  it('should work with defAgent background: true');
  it('should persist across turns in interactive mode');
});
```

### Phase 6: Debug & Observability

- **Interactive mode:** each `send()` starts a new debug run. Turn number and session ID are included in log metadata.
- **Background tasks:** logged as sub-runs. The spawning step logs the taskId, the completion is logged when the background Promise resolves.
- **Langfuse:** works per-turn. Background tasks can optionally create child spans.

---

## Files Changed Summary

| File | Change | Description |
|------|--------|-------------|
| `src/state/StateManager.ts` | Modify | Add `toJSON()`, `fromJSON()` |
| `src/effects/EffectsManager.ts` | — | Already has what we need; injectable via setter |
| `src/StatefulPrompt.ts` | Modify | Add `setStateManager()`, `setEffectsManager()`, `setBackgroundRegistry()`, background wrapping in `defTool()`/`defAgent()` |
| `src/StreamText.ts` | Modify | Add `setMessages()`, `getMessages()` |
| `src/types/tools.ts` | Modify | Add `background?: boolean` to `ToolOptions` |
| `src/types/agents.ts` | Modify | Add `background?: boolean` to `AgentOptions` |
| `src/background/BackgroundTaskRegistry.ts` | **New** | Task registry (~100 lines) |
| `src/ChatSession.ts` | **New** | Chat session class (~200 lines) |
| `src/runPrompt.ts` | Modify | Add `interactive` option, overloaded return types |
| `src/index.ts` | Modify | Export new types |
| `src/cli.ts` | Modify | Auto-detect interactive mode, REPL loop |
| `src/ChatSession.test.ts` | **New** | Interactive mode tests |
| `src/background/BackgroundTaskRegistry.test.ts` | **New** | Registry tests |
| `src/background/backgroundTool.test.ts` | **New** | Background tool/agent tests |

## Implementation Order

1. **StateManager serialization** — `toJSON()`, `fromJSON()` (no risk)
2. **Injectable managers** — `setStateManager()`, `setEffectsManager()`, `setMessages()` on existing classes
3. **BackgroundTaskRegistry** — new file, no dependencies
4. **Background tool/agent wiring** — modify `defTool()`/`defAgent()` in `StatefulPrompt`
5. **ChatSession** — new file using the injectable infrastructure
6. **`runPrompt()` interactive option** — extend existing entry point
7. **Tests** — validate both features
8. **CLI interactive mode** — extend `lmthing run`
9. **Debug/observability** — add metadata for turns and background tasks

## Open Questions

1. **Concurrent sends:** Should `session.send()` queue concurrent calls or reject? **Recommendation:** Reject with a clear error. Callers can queue externally.

2. **Background task cancellation:** Should background tools receive an `AbortSignal`? **Recommendation:** Yes, passed as second arg to execute. `session.close()` triggers abort on all running tasks.

3. **History truncation:** Long conversations will exceed context windows. **Recommendation:** Not in v1. Users can access `session.history` and implement their own strategy. Add `maxHistory` option in v2.

4. **Background task result in system prompt:** Should completed background tasks be surfaced automatically (e.g., as a system message on the next step)? **Recommendation:** No — let the LLM poll via `_status`/`_result`. Auto-injection is too magical and would add complexity to the system prompt.

5. **Background + re-execution:** When `promptFn` re-runs on a new step (within a single turn), it will call `defTool('name', ..., { background: true })` again. The companion tools must not be re-registered if they already exist. **Solution:** `defTool` checks if `{name}_status` already exists before registering companions.

6. **Effects across turns:** `EffectsManager.clearEffects()` is called on prompt re-execution (within a turn). The shared `previousDeps` map preserves cross-turn tracking. This needs careful testing to ensure effects don't fire spuriously on the first step of a new turn.
