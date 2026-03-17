# Globals Implementation — Implementation Guide

## Overview

Six globals are injected into the REPL sandbox: `stop`, `display`, `ask`, `async`, `checkpoints`, and `checkpoint`. These are the agent's only control-flow primitives beyond raw TypeScript.

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

## `checkpoints(plan)` — Declare Task Plan

Synchronous — registers a checkpoint plan with the host and renders a progress UI. Does NOT block execution.

### Key implementation details:
1. Can only be called **once** per session — throws if called again
2. Validates plan structure: requires `description`, non-empty `tasks` array
3. Each task must have unique `id`, `instructions`, and `outputSchema`
4. Stores plan in `CheckpointState` — tracks `plan`, `completed` map, and `currentIndex`
5. Renders persistent progress indicator (stepper/checklist) via render surface

## `checkpoint(id, output)` — Mark Milestone Complete

Synchronous — marks a checkpoint as done and validates output against the declared schema. Does NOT block execution.

### Key implementation details:
1. Throws if called before `checkpoints()` — plan must be declared first
2. Validates `id` exists in plan and hasn't already been completed
3. Enforces **sequential ordering** — checkpoints must be completed in declaration order
4. Validates output keys and types against the task's `outputSchema`
5. Records completion with output and timestamp
6. Updates persistent progress UI

### Incomplete Checkpoint Reminder
When LLM emits stop token with incomplete checkpoints:
1. Build list of remaining checkpoint IDs
2. Inject `⚠ [system] Checkpoint plan incomplete. Remaining: <ids>. Continue from where you left off.`
3. Resume LLM generation
4. Limit reminder cycles to `maxCheckpointReminders` (default: 3) to prevent infinite loops
