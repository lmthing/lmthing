# Globals Implementation — Implementation Guide

## Overview

Four globals are injected into the REPL sandbox: `stop`, `display`, `ask`, and `async`. These are the agent's only control-flow primitives beyond raw TypeScript.

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
