# Globals Implementation — Implementation Guide

## Overview

Twelve globals are injected into the REPL sandbox: `stop`, `display`, `ask`, `async`, `tasklist`, `completeTask`, `completeTaskAsync`, `taskProgress`, `failTask`, `retryTask`, `sleep`, and `loadKnowledge`. These are the agent's only control-flow primitives beyond raw TypeScript.

**Full specification:** [docs/host-runtime-contract/globals-implementation.md](../../docs/host-runtime-contract/globals-implementation.md)

## `stop(...values)` — Pause and Read

The agent's way of reading runtime values back into its context. Async function that resolves only when the host resumes the stream.

### Key implementation details:
1. Build response payload using recovered argument names (AST analysis)
2. Merge in any resolved async task results from `asyncResults` map
3. Add `"pending"` markers for unfinished async tasks
4. Signal stream controller to pause
5. Inject `← stop { ... }` as user message
6. Wait for stream controller to call `stopResolve()`

### Sequencing (8 steps):
1. Agent writes `await stop(x)` → sandbox executes → `stop` fires → stream pauses
2. Host updates `{{SCOPE}}` in system prompt
3. Host appends agent code as `role: 'assistant'`
4. Host appends `← stop { ... }` as `role: 'user'`
5. Host resumes LLM generation
6. New tokens arrive → stream controller accumulates next line
7. `stopResolve()` called → sandbox unblocks
8. Next line sent to sandbox for execution

## `display(jsx)` — Non-blocking Render

Synchronous — appends a React element to the render surface and returns immediately. Does NOT block execution.

```ts
globalThis.display = (element: React.ReactElement) => {
  const id = crypto.randomUUID()
  renderSurface.append(id, element)
}
```

## `ask(jsx)` — Blocking Input, Silent Resume

Unlike `stop`, `ask` does **not** inject a user message. It:
1. Renders form with submit handler
2. Pauses the stream
3. Waits for user submission (Promise)
4. Resumes generation silently — NO message injected
5. Returns form data to sandbox variable

The agent must call `stop()` afterwards to see the values.

### Form Data Extraction

| Component | Extracted Type |
|-----------|---------------|
| `TextInput`, `TextArea` | `string` |
| `NumberInput`, `Slider` | `number` |
| `Checkbox` | `boolean` |
| `Select` | `string` |
| `MultiSelect` | `string[]` |
| `DatePicker` | `string` (ISO date) |
| `FileUpload` | `{ name, size, type, data }` (base64) |

### Ask Timeout
Default: 5 minutes. On timeout, resolves with `{ _timeout: true }`.

## `async(fn)` — Fire-and-forget Background Task

Spawns an async task that runs concurrently. Returns synchronously — does NOT block.

### Key implementation details:
- Each task gets a unique ID: `async_0`, `async_1`, etc.
- Tasks get a **scoped `stop`** that routes to `asyncResults` map instead of pausing the stream
- Results accumulate and are drained into the next main `stop()` call's payload
- If task hasn't finished when `stop` is called, its slot shows `"pending"`
- Support cancellation via AbortController (user can cancel from sidebar)

### Scoped stop safety
Replacing the global `stop` is unsafe with concurrent tasks. Options:
- At transpile time, rewrite `stop` calls inside `async(() => { ... })` blocks to reference the task-scoped version
- Use `AsyncLocalStorage` (Node.js) to route `stop` calls to the correct task

## `tasklist(tasklistId, description, tasks)` — Declare Task Plan

Synchronous — registers a tasklist with the host under a unique `tasklistId` and renders a progress UI. Does NOT block execution.

### Key implementation details:
1. Can be called **multiple times** per session with different `tasklistId` values — throws if same `tasklistId` is reused
2. Validates plan structure: requires `tasklistId`, `description`, non-empty `tasks` array
3. Each task must have unique `id`, `instructions`, and `outputSchema`
4. Tasks support **DAG dependencies** via an optional `dependsOn` array of task IDs within the same tasklist. Tasks with no `dependsOn` are immediately ready. Circular dependencies are detected and throw at declaration time. **Backward compatibility:** when no task declares `dependsOn`, the host synthesizes implicit sequential dependencies (task N depends on task N-1). Behavior is identical to the old sequential system.
5. Tasks support an optional `condition` field (a predicate string evaluated at readiness time) and an `optional` boolean (defaults to `false`) — optional tasks can be skipped without blocking dependents
6. Stores each tasklist as a `TasklistState` in `TasklistsState.tasklists` map — tracks `plan`, `completed` (Map<string, TaskCompletion>), `readyTasks`, `runningTasks`, and `outputs`. There is no explicit `failedTasks` or `blockedTasks` set — failed tasks are stored in the `completed` map with `status: 'failed'`, and tasks not in `completed`, `readyTasks`, or `runningTasks` are implicitly blocked.
7. Computes initial `readyTasks` (tasks with no `dependsOn`) at declaration time
8. Renders persistent progress indicator (stepper/checklist) per tasklist via render surface

## `completeTask(tasklistId, taskId, output)` — Mark Task Complete

Synchronous — marks a task as done and validates output against the declared schema. Does NOT block execution. The `tasklistId` identifies which tasklist the task belongs to.

### Key implementation details:
1. Throws if `tasklistId` is not found in `TasklistsState.tasklists` — tasklist must be declared first
2. Validates `taskId` exists in the tasklist's plan and hasn't already been completed
3. Task must be in the tasklist's `readyTasks` set — DAG dependencies must be satisfied before completion
4. Validates output keys and types against the task's `outputSchema`
5. Records completion with output and timestamp
6. Recomputes `readyTasks` — any tasks whose `dependsOn` are now fully satisfied are added to `readyTasks` (tasks not in any set are implicitly blocked)
7. Updates persistent progress UI for the tasklist

### Incomplete Task Reminder
When LLM emits stop token with incomplete tasks in any tasklist:
1. Wait for any `runningTasks` (async completions) to finish or timeout before nudging
2. Find all tasklists with remaining tasks
3. For each incomplete tasklist, build a status summary including ready, blocked, and failed tasks
4. Inject reminder as a single status line followed by the `{{TASKS}}` block:
   ```
   ⚠ [system] Tasklist "<tasklistId>" incomplete. Ready: X. Blocked: Y. Failed: Z. Continue with a ready task.

   {{TASKS}}
   ┌ <tasklistId> ──────────────────────────────────────────┐
   │ ✓ task_a       → { ... }                               │
   │ ✗ task_b       (failed — <error>)                      │
   │ ◎ task_c       (ready — dependsOn satisfied)           │
   │ ○ task_d       (blocked — waiting on: task_c)          │
   └────────────────────────────────────────────────────────┘
   ```
5. Resume LLM generation
6. Limit reminder cycles to `maxTasklistReminders` (default: 3) to prevent infinite loops

## `completeTaskAsync(tasklistId, taskId, fn)` — Async Task Completion

Launches task work in the background via AsyncManager. Non-blocking — returns immediately after spawning.

### Key implementation details:
1. Task must be in the tasklist's `readyTasks` set — throws if not found or `dependsOn` not satisfied
2. Moves task from `readyTasks` to `runningTasks`
3. Spawns `fn` via AsyncManager with an AbortController and `taskAsyncTimeout` (default: 60,000ms)
4. On `fn` return: validates output against the task's `outputSchema`, records completion with output and timestamp, recomputes `readyTasks`
5. On `fn` error: records task as failed with the error message
6. Results are delivered via the next `stop()` call with `task:<taskId>` keys in the payload
7. If `stop()` is called before the async task finishes, its slot shows `"running"`
8. Updates persistent progress UI as task transitions through states

## `taskProgress(tasklistId, taskId, message, percent?)` — Report Task Progress

Synchronous — reports progress on an active task. Does NOT block execution.

### Key implementation details:
1. Validates that `tasklistId` exists and `taskId` is in the `readyTasks` or `runningTasks` set — throws otherwise
2. `message` is a short human-readable string describing current progress
3. `percent` is an optional number (0-100) for determinate progress display
4. Updates the persistent progress UI for the task (progress bar or status text)
5. Does NOT inject any user message or affect the LLM conversation

## `failTask(tasklistId, taskId, error)` — Mark Task Failed

Synchronous — marks a task as permanently failed. Does NOT block execution.

### Key implementation details:
1. Validates that `tasklistId` exists and `taskId` is in the `readyTasks` or `runningTasks` set — throws otherwise
2. Removes task from `readyTasks`/`runningTasks`
3. Records task in `completed` map with `status: 'failed'`, the error message, and timestamp
4. If the task is marked `optional: true`: dependents are unblocked (treated as if completed, but with no output)
5. If the task is NOT optional: dependents remain implicitly blocked — they cannot proceed
6. Updates persistent progress UI to show failed state

## `retryTask(tasklistId, taskId)` — Retry Failed Task

Synchronous — resets a failed task back to ready state. Does NOT block execution.

### Key implementation details:
1. Only works on tasks in the `completed` map with `status: 'failed'` — throws if task is not failed
2. Each task tracks a retry count; throws if `maxTaskRetries` (default: 3) has been reached
3. Increments the task's retry count
4. Removes the failure record from `completed` and adds task back to `readyTasks`
5. Updates persistent progress UI to show ready state

## `sleep(seconds)` — Pause Sandbox Execution

Pauses sandbox execution for the specified duration. Does NOT pause the LLM stream or inject a user message.

### Key implementation details:
1. Duration is capped at `sleepMaxSeconds` (default: 30) — values above the cap are silently clamped
2. Returns a Promise that resolves after the delay — agent must `await` it
3. Async tasks continue running during sleep — this is the primary use case (wait for background work)
4. Does NOT create a turn boundary — no user message is injected
5. The agent must call `stop()` after sleeping to read async task results into context

## `loadKnowledge(selector)` — Load Knowledge Files

Synchronous — reads markdown files from the space's knowledge base and returns their content. Does NOT block execution (no `await` needed).

### Key implementation details:
1. Only available when a space is loaded (via `--space` CLI flag or `knowledgeLoader` session option)
2. Throws `"loadKnowledge() is not available — no space loaded"` if no space is configured
3. Validates that `selector` is a non-null object
4. Delegates to the `onLoadKnowledge` callback configured during globals creation
5. Emits a `knowledge_loaded` session event with the loaded domain names

### Selector format:
The selector mirrors the knowledge tree structure: `{ domain: { field: { option: true } } }`.
Only entries with value `true` are loaded. Non-`true` values are skipped.

```ts
// Load specific knowledge files
var docs = loadKnowledge({
  "cuisine": {
    "type": {
      "italian": true,
      "japanese": true
    }
  },
  "dietary": {
    "restriction": {
      "vegetarian": true
    }
  }
})
// Returns: { cuisine: { type: { italian: "# Italian Cuisine\n...", japanese: "# Japanese Cuisine\n..." } }, dietary: { restriction: { vegetarian: "# Vegetarian Cooking\n..." } } }
```

### File loading:
- Reads from `{knowledgeDir}/{domain}/{field}/{option}.md`
- Strips YAML frontmatter (everything between `---` delimiters)
- Returns the markdown body only
- Missing files are silently skipped (no error thrown)

### Knowledge content decay:
The returned object is tagged with `KNOWLEDGE_TAG` (a Symbol). When the agent calls `stop()` with this value, the agent-loop detects the tag and tracks the message for progressive decay. As turns progress, the markdown content in older stop messages is truncated:
- Turn 0: full content
- Turns 1–2: first ~300 chars per file
- Turns 3–4: just markdown headings
- Turn 5+: just file paths

See `context/knowledge-decay.ts` for the decay implementation.

### Knowledge tree in system prompt:
When a space is loaded, the system prompt includes a `## Knowledge Tree` section showing all available domains, fields, and options in ASCII tree format. The agent uses this to decide what to load.

### Integration:
- **Session** accepts a `knowledgeLoader` option: `(selector: KnowledgeSelector) => KnowledgeContent`
- **CLI** builds this from the space path via `buildKnowledgeTree()` and `loadKnowledgeFiles()`
- **AgentLoop** passes the formatted knowledge tree to `buildSystemPrompt()`
