# Runtime Contract — Host Implementation Guide

This document describes how the host system implements the other side of the agent protocol defined in the system prompt. It is written for the engineering team building the REPL runtime, the stream controller, and the React rendering layer.

---

## Architecture Overview

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

There are four subsystems:

1. **Stream Controller** — manages the LLM connection, token accumulation, pause/resume, and context injection.
2. **Line Parser** — buffers tokens into complete statements and detects global calls (`stop`, `display`, `ask`, `async`).
3. **REPL Sandbox** — executes TypeScript line-by-line, maintains persistent scope, captures errors.
4. **React Render Surface** — mounts components from `display` and `ask`, handles user interaction, returns form data.

---

## 1. Stream Controller

### Token Accumulation

The LLM streams tokens. The stream controller accumulates them into a **line buffer**. A "line" is defined as a complete TypeScript statement, determined by one of:

- A newline character (`\n`) where the accumulated text forms a syntactically complete statement.
- Closing of a multi-line construct (object literal, template literal, JSX block, function body).

The controller must track **bracket depth** (`{`, `}`, `(`, `)`, `<`, `>` for JSX) and **string context** (backticks, quotes) to avoid splitting mid-expression.

#### Statement Completeness Heuristic

```ts
interface LineAccumulator {
  buffer: string
  bracketDepth: { round: number; curly: number; angle: number; square: number }
  inString: false | "'" | '"' | '`'
  inComment: false | '//' | '/*'
  inJsx: boolean
}

function isComplete(acc: LineAccumulator): boolean {
  if (acc.inString || acc.inComment === '/*') return false
  const { round, curly, angle, square } = acc.bracketDepth
  return round === 0 && curly === 0 && square === 0 && !acc.inJsx
}
```

When `isComplete` returns true after a newline, flush the buffer to the REPL for execution.

### Pause / Resume

The stream controller must support **hard pause** — halting token consumption from the LLM stream without closing the connection (if the provider supports it) or cancelling generation and re-prompting.

Pause is triggered by:
- `await stop(...)` — pause, evaluate args, inject user message with values, resume
- `await ask(...)` — pause, render form, wait for user submit, assign to sandbox variable, resume **silently** (no message injected)
- Runtime/type error — pause, inject user message with error, resume
- **User intervention** — user sends a message mid-execution. Pause, finalize assistant turn, inject user message (raw text, no `←` prefix), update `{{SCOPE}}`, resume
- `async(...)` — **no pause** (but register the background task)

### Context Injection

There are two types of interruptions that inject `role: 'user'` messages:

**`stop` and `error`** — inject a user message containing the values or error, then resume generation:

```
← stop { argName: serializedValue, ... }
← stop { argName: serializedValue, ..., async_0: resolvedOrPending }
← error [ErrorType] message\n    at line N: <source line>
```

**`ask`** — pauses the stream, renders a form, waits for the user to submit, assigns the form data to the sandbox variable, then **resumes generation silently** without injecting any message. The agent cannot see the form data until it calls `stop`.

The `←` prefix is a convention to visually distinguish host-injected messages from actual user input. These messages use `role: 'user'` so the agent sees them as conversational turns it must respond to by continuing code generation.

#### Injection Pattern (stop / error)

1. **Pause** the LLM stream.
2. **Update `{{SCOPE}}`** in the system prompt with current sandbox variables.
3. **Append** the agent's code since the last pause as `{ role: 'assistant', content: ... }`.
4. **Append** the payload as `{ role: 'user', content: '← stop/error { ... }' }`.
5. **Resume** LLM generation (agent continues as assistant).

#### Resume Pattern (ask)

1. **Pause** the LLM stream.
2. **Render** the form and wait for user submission.
3. **Assign** the form data to the sandbox variable (e.g., `input = { city: "Tokyo", budget: 200 }`).
4. **Resume** LLM generation immediately — **no message is appended**, the agent's assistant turn continues uninterrupted.

#### Serialization Rules

| Type | Serialization |
|------|--------------|
| `string` | JSON string (quoted, escaped) |
| `number`, `boolean`, `null` | JSON literal |
| `undefined` | the string `undefined` |
| `Array` | JSON array (truncated to first 50 elements with `... +N more` if longer) |
| `object` | JSON object (truncated to 20 keys with `... +N more` if larger) |
| `function` | `[Function: name]` |
| `Error` | `[Error: message]` |
| `Promise` | `[Promise: pending\|resolved\|rejected]` |
| Circular | `[Circular]` |
| Large strings (>2000 chars) | First 1000 + `... (truncated, 5432 chars total)` |

#### Argument Naming in `stop`

The host must attempt to recover meaningful names for `stop` arguments:

```ts
await stop(user.name)    // ← stop { "user.name": "Alice" }
await stop(x)            // ← stop { x: 42 }
await stop(arr.length)   // ← stop { "arr.length": 5 }
await stop(a, b, c)      // ← stop { a: 1, b: 2, c: 3 }
await stop(getX())       // ← stop { "arg_0": <value> }  (can't recover name)
```

Use AST analysis on the `stop(...)` call to extract argument source text as keys. Fall back to `arg_0`, `arg_1`, etc. for complex expressions.

---

## 2. REPL Sandbox

### Scope Persistence

The sandbox maintains a **single persistent scope** across the entire agent session. Variables declared with `const`, `let`, or `var` survive across executed lines. This is critical — the agent may reference a variable declared 50 lines ago.

Implementation options:
- **`vm` module (Node.js):** Create a single `vm.Context` and execute each statement with `vm.runInContext`.
- **Isolated-vm:** For stronger sandboxing, use `isolated-vm` with a persistent `Context`.
- **Custom evaluator:** Wrap statements in an async IIFE that captures and re-exports scope.

### TypeScript Compilation

Each line buffer must be compiled from TypeScript to JavaScript before execution. Use the TypeScript compiler API in **transpile-only mode** for speed:

```ts
import ts from 'typescript'

function transpile(code: string): string {
  const result = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      strict: false,
      esModuleInterop: true,
    }
  })
  return result.outputText
}
```

### Injected Globals

Before the agent's first line executes, inject into the sandbox scope:

```ts
// Control-flow primitives
globalThis.stop = async (...args: any[]) => { /* see §3 */ }
globalThis.display = (jsx: React.ReactElement) => { /* see §4 */ }
globalThis.ask = async (jsx: React.ReactElement) => { /* see §4 */ }
globalThis.async = (fn: () => Promise<void>) => { /* see §5 */ }

// React (required for transpiled JSX)
globalThis.React = React

// All domain functions from the function registry
globalThis.getUser = boundGetUser
globalThis.searchProducts = boundSearchProducts
// ... etc.

// All domain React components
globalThis.ProductGrid = ProductGridComponent
globalThis.TextInput = TextInputComponent
globalThis.Select = SelectComponent
// ... etc.
```

### Error Capture

Wrap each line's execution in try/catch:

```ts
async function executeLine(code: string, lineNumber: number): Promise<LineResult> {
  try {
    const js = transpile(code)
    const result = await vm.runInContext(js, sandbox, { timeout: 30_000 })
    return { ok: true, result }
  } catch (err) {
    return {
      ok: false,
      error: {
        type: err.constructor.name,
        message: err.message,
        line: lineNumber,
        source: code.trim(),
      }
    }
  }
}
```

On error, the stream controller pauses, updates `{{SCOPE}}`, and injects the error as a `role: 'user'` message (same pattern as `stop`). Generation then resumes.

---

## 3. `stop` Implementation

`stop` is the agent's way of "reading" runtime values back into its context. It is an async function that **resolves only when the host resumes the agent's stream**.

```ts
let stopResolve: (() => void) | null = null
const asyncResults: Map<string, any> = new Map()

globalThis.stop = async (...args: any[]) => {
  // 1. Build the response payload
  const payload: Record<string, any> = {}
  const argNames = recoverArgNames(currentLineSource, args.length)
  args.forEach((val, i) => {
    payload[argNames[i]] = serialize(val)
  })

  // 2. Merge in any resolved async results
  for (const [key, value] of asyncResults) {
    payload[key] = serialize(value)
    asyncResults.delete(key)
  }

  // 3. Add pending markers for unfinished async tasks
  for (const [key, task] of pendingAsyncTasks) {
    if (!payload[key]) {
      payload[key] = 'pending'
    }
  }

  // 4. Signal the stream controller to pause and inject as user message
  streamController.pause()
  streamController.injectUserMessage(`← stop ${JSON.stringify(payload, null, 2)}`)

  // 5. Wait for the stream controller to resume us
  await new Promise<void>(resolve => { stopResolve = resolve })
}
```

### Sequencing

1. Agent writes `await stop(x)` → sandbox executes it → `stop` fires → stream pauses
2. Host updates `{{SCOPE}}` in the system prompt
3. Host appends the agent's code so far as `role: 'assistant'`
4. Host appends `← stop { ... }` as `role: 'user'`
5. Host resumes LLM generation (agent continues as assistant)
6. New tokens arrive → stream controller accumulates next line
7. `stopResolve()` is called → sandbox unblocks
8. Next line is sent to sandbox for execution

---

## 4. `display` and `ask` Implementation

### `display(jsx)` — Non-blocking render

```ts
globalThis.display = (element: React.ReactElement) => {
  const id = crypto.randomUUID()
  renderSurface.append(id, element)
  // Returns synchronously — does NOT block execution
}
```

Each `display` call appends a new mounted React tree to the user's scrollable viewport.

### `ask(jsx)` — Blocking input, silent resume

Unlike `stop`, `ask` does **not** inject a user message. It pauses, collects form data, assigns it to the sandbox, and resumes the agent's generation silently. The agent must call `stop(...)` to read the values.

```ts
let askResolve: ((data: Record<string, any>) => void) | null = null

globalThis.ask = async (formElement: React.ReactElement) => {
  const formId = crypto.randomUUID()

  // Render form with submit handler
  renderSurface.appendForm(formId, formElement, (formData) => {
    askResolve?.(formData)
  })

  // Pause the stream while waiting for user
  streamController.pause()

  // Wait for user submission
  const result = await new Promise<Record<string, any>>(resolve => {
    askResolve = resolve
  })

  // Resume generation silently — NO message is injected.
  // The form data is returned into the sandbox variable,
  // but the agent can't see it until it calls stop().
  streamController.resume()

  return result
}
```

**Why no message?** The agent is instructed to always follow `ask` with `stop`. This keeps `stop` as the single mechanism for reading values — whether computed, fetched, or user-provided. The conversation stays clean: every `[user]` message is either the original request or a `← stop`/`← error` injection.

#### Form Data Extraction

On submit, iterate all elements with a `name` attribute and extract values by component type:

| Component | Extracted Type |
|-----------|---------------|
| `TextInput`, `TextArea` | `string` |
| `NumberInput`, `Slider` | `number` |
| `Checkbox` | `boolean` |
| `Select` | `string` |
| `MultiSelect` | `string[]` |
| `DatePicker` | `string` (ISO date) |
| `FileUpload` | `{ name, size, type, data }` (base64) |

Return as a flat `Record<string, any>` keyed by `name`.

#### Ask Timeout

If the user does not submit within a configurable timeout (default: 5 minutes), `ask` resolves with an empty object or a sentinel value. The agent will discover this when it calls `stop`:

```ts
// In the sandbox:
const input = await ask(<form>...</form>)   // times out → input = { _timeout: true }
await stop(input)
// [user] ← stop { input: { "_timeout": true } }
// Agent sees the timeout and can react
```

---

## 5. `async` Implementation

```ts
let asyncCounter = 0
const pendingAsyncTasks: Map<string, Promise<any>> = new Map()
const asyncResults: Map<string, any> = new Map()

globalThis.async = (fn: () => Promise<void>) => {
  const taskId = `async_${asyncCounter++}`

  const taskFn = async () => {
    // Create a scoped stop that routes to asyncResults
    const taskStop = async (...args: any[]) => {
      const value = args.length === 1 ? args[0] : args
      asyncResults.set(taskId, value)
      pendingAsyncTasks.delete(taskId)
    }

    // Run with scoped stop (see note below on implementation)
    await fn.call({ stop: taskStop })
  }

  const promise = taskFn().catch(err => {
    asyncResults.set(taskId, { error: err.message })
    pendingAsyncTasks.delete(taskId)
  })

  pendingAsyncTasks.set(taskId, promise)
  // Returns synchronously — does NOT block
}
```

**Note on scoped `stop`:** Replacing the global `stop` is unsafe with concurrent tasks. Preferred approach: at transpile time, rewrite `stop` calls inside `async(() => { ... })` blocks to reference the task-scoped version. Alternatively, use `AsyncLocalStorage` (Node.js) to route `stop` calls to the correct task.

Results accumulate in `asyncResults` and are drained into the next `stop()` call's payload. If an async task hasn't finished when `stop` is called, its slot shows `"pending"`.

---

## 6. User Intervention

The user can send a message at any point during agent execution. This is the primary mechanism for the user to redirect, correct, or cancel the agent's work.

### Implementation

```ts
function handleUserIntervention(userMessage: string) {
  // 1. Pause the LLM stream
  streamController.pause()

  // 2. Update scope
  const scopeBlock = generateScopeTable(sandbox)
  updateSystemPromptScope(scopeBlock)

  // 3. Finalize agent code as assistant turn
  messages.push({
    role: 'assistant',
    content: agentCodeSinceLastTurn
  })

  // 4. Append the user's raw message (no ← prefix)
  messages.push({
    role: 'user',
    content: userMessage
  })

  // 5. Resume generation — agent sees the message and adjusts
  streamController.resume()
}
```

**Important:** User intervention messages do **not** use the `← ` prefix. The agent distinguishes them from protocol injections by the absence of the prefix:
- `← stop { ... }` — protocol: resume with values
- `← error [Type] ...` — protocol: recover from error
- `Actually, search for Japanese restaurants instead.` — human: adjust approach

The agent handles both naturally. For protocol messages it continues writing code. For human messages it adjusts its plan — it may acknowledge via a `//` comment and change direction.

### User intervention while `ask` is active

If the user sends a message while a form is waiting for input:

1. The form is cancelled — `ask` resolves with `{ _cancelled: true }`.
2. The agent resumes silently from the `ask`.
3. The agent's code from the `ask` up to its next `stop` is finalized as an assistant turn.
4. At the next `stop`, the user's message is injected as `role: 'user'` alongside the stop payload.

Alternatively, if the stop happens immediately after the ask (the common `ask → stop` pattern), the host can combine them: finalize the assistant code including both the `ask` and `stop`, then inject the user message. The agent sees the cancelled form data in the stop payload and the user's message in the next turn.

### Pause / Resume (user-initiated)

The user can explicitly pause via a UI button. While paused:
- No new lines are sent to the sandbox.
- The LLM stream is halted.
- The user can send a message (which triggers the intervention flow above).
- The user can click Resume (generation continues with no message injected).
- The user can cancel the session entirely.

---

## 7. Async Task Cancellation

The user can cancel running async tasks via the UI sidebar. When cancelled, the task's result slot is filled with a cancellation payload instead of the resolved value.

### Implementation

```ts
const abortControllers: Map<string, AbortController> = new Map()

// Modified async() registration to support cancellation
globalThis.async = (fn: () => Promise<void>) => {
  const taskId = `async_${asyncCounter++}`
  const abortController = new AbortController()
  abortControllers.set(taskId, abortController)

  const taskFn = async () => {
    const taskStop = async (...args: any[]) => {
      const value = args.length === 1 ? args[0] : args
      asyncResults.set(taskId, value)
      pendingAsyncTasks.delete(taskId)
      abortControllers.delete(taskId)
    }

    await fn.call({ stop: taskStop, signal: abortController.signal })
  }

  const promise = taskFn().catch(err => {
    if (abortController.signal.aborted) {
      // Cancellation — already handled by cancelAsyncTask
      return
    }
    asyncResults.set(taskId, { error: err.message })
    pendingAsyncTasks.delete(taskId)
    abortControllers.delete(taskId)
  })

  pendingAsyncTasks.set(taskId, promise)
}

// Called when the user cancels a task from the UI
function cancelAsyncTask(taskId: string, userMessage: string) {
  const controller = abortControllers.get(taskId)
  if (!controller) return

  // Abort the task
  controller.abort()

  // Store cancellation result — delivered in next stop()
  asyncResults.set(taskId, {
    cancelled: true,
    message: userMessage  // user's optional explanation
  })

  pendingAsyncTasks.delete(taskId)
  abortControllers.delete(taskId)
}
```

### What the agent sees

On the next `stop()` call, the cancellation result appears in the payload:

```
← stop { ..., async_0: { "cancelled": true, "message": "Not needed anymore" } }
```

The agent can check for `cancelled: true` and react accordingly — skip processing the result, inform the user, or continue with alternative logic.

### Task labels

The UI sidebar needs a human-readable label for each task. The host derives this from the agent's code:

1. **Comment before `async()`:** If the line before `async(() => { ... })` is a `//` comment, use it as the label. E.g., `// Fetch reviews for all restaurants` → "Fetch reviews for all restaurants".
2. **First function call inside the body:** Extract the function name. E.g., `generateReport(data)` → "generateReport".
3. **Fallback:** The task ID (`async_0`).

---

## 8. Developer Hooks — AST-Based Code Interception

The host exposes a hook system that lets developers register **AST pattern matchers** against the agent's code stream. When a pattern matches, the developer's callback fires — it can observe, side-effect, transform, or interrupt execution. This is the primary extension point for integrating domain logic with the agent runtime.

### Concept

Every complete statement the agent writes is parsed into an AST before execution. The hook system walks the AST, checks it against registered patterns, and fires matching callbacks **between parse and execute** — giving developers a synchronous interception point.

```
  tokens arrive → accumulate → complete statement → parse AST
                                                        │
                                                   ┌────▼─────┐
                                                   │ Run hooks │
                                                   └────┬─────┘
                                                        │
                              ┌──────────────┬──────────┼──────────┬─────────────┐
                              │              │          │          │             │
                           observe      side-effect  transform  interrupt     skip
                              │              │          │          │             │
                              ▼              ▼          ▼          ▼             ▼
                           execute        execute    execute    pause +      drop
                           as-is          as-is      modified   inject msg   statement
```

### Hook Registration

```ts
interface Hook {
  /** Unique identifier for this hook */
  id: string

  /** Human-readable label (shown in UI debug panel) */
  label: string

  /** AST pattern to match — see Pattern Language below */
  pattern: ASTPattern

  /** 
   * When in the pipeline this hook fires.
   * 'before' = after parse, before execute (can transform/interrupt/skip)
   * 'after'  = after successful execution (can observe/side-effect)
   */
  phase: 'before' | 'after'

  /** 
   * The callback. Receives the matched AST node, the source code,
   * and a context object. Returns a HookAction.
   */
  handler: (match: HookMatch, ctx: HookContext) => HookAction | Promise<HookAction>
}

interface HookMatch {
  /** The AST node that matched the pattern */
  node: ts.Node
  /** The full source line/statement */
  source: string
  /** Captured sub-nodes from the pattern (named captures) */
  captures: Record<string, ts.Node>
  /** Line number in the agent's output */
  line: number
}

interface HookContext {
  /** Current sandbox scope — read variable values */
  scope: Record<string, any>
  /** Session metadata */
  session: { id: string; turnIndex: number; lineIndex: number }
  /** The full AST of the current statement */
  ast: ts.SourceFile
  /** Registered async tasks */
  asyncTasks: Map<string, { status: string }>
}

type HookAction =
  | { type: 'continue' }
  | { type: 'side_effect'; fn: () => void | Promise<void> }
  | { type: 'transform'; newSource: string }
  | { type: 'interrupt'; message: string }
  | { type: 'skip'; reason?: string }
```

Hooks are registered at session init, before the agent starts generating:

```ts
session.registerHook({
  id: 'log-declarations',
  label: 'Log variable declarations',
  pattern: { type: 'VariableDeclaration' },
  phase: 'after',
  handler: (match, ctx) => {
    console.log(`Agent declared: ${match.source}`)
    return { type: 'continue' }
  }
})
```

### Pattern Language

Patterns are objects that match against TypeScript AST nodes. The matching engine walks the statement's AST and fires the hook for every node that satisfies the pattern.

#### Basic patterns — match by node type

```ts
// Match any variable declaration (const, let, var)
{ type: 'VariableDeclaration' }

// Match any function call expression
{ type: 'CallExpression' }

// Match any await expression
{ type: 'AwaitExpression' }

// Match any assignment expression
{ type: 'AssignmentExpression' }
```

#### Property filters — narrow by AST properties

```ts
// Match only 'const' declarations
{ type: 'VariableDeclaration', kind: 'const' }

// Match calls to a specific function
{ type: 'CallExpression', callee: { name: 'fetchPatientData' } }

// Match calls to any method on a specific object
{ type: 'CallExpression', callee: { object: { name: 'db' } } }

// Match declarations of a specific variable name
{ type: 'VariableDeclaration', declarations: [{ id: { name: 'config' } }] }
```

#### Captures — extract sub-nodes for the handler

```ts
// Capture the variable name and initializer of any const declaration
{
  type: 'VariableDeclaration',
  kind: 'const',
  declarations: [{
    id: { name: '$varName' },      // $ prefix = capture as 'varName'
    init: '$initializer'            // capture the whole initializer node
  }]
}
// handler receives: match.captures.varName, match.captures.initializer

// Capture all arguments to a specific function call
{
  type: 'CallExpression',
  callee: { name: 'display' },
  arguments: '$args'                // capture the arguments array
}
```

#### Wildcard and compound patterns

```ts
// Match any node type (useful for capturing)
{ type: '*' }

// Match any of several patterns (OR)
{ oneOf: [
  { type: 'CallExpression', callee: { name: 'fetchData' } },
  { type: 'CallExpression', callee: { name: 'queryDB' } },
] }

// Match a pattern only if another pattern is NOT present in the same statement
{ type: 'VariableDeclaration', not: { type: 'AwaitExpression' } }
// → matches declarations without await (the agent forgot to await)
```

### Hook Actions

#### `continue` — observe only

The default. The hook saw the node, did nothing. Execution proceeds normally.

```ts
handler: (match) => {
  metrics.trackDeclaration(match.captures.varName)
  return { type: 'continue' }
}
```

#### `side_effect` — run external logic, don't block

Runs a function alongside execution. The statement executes as-is. The side effect runs concurrently. Useful for logging, metrics, syncing state to external systems.

```ts
handler: (match, ctx) => ({
  type: 'side_effect',
  fn: async () => {
    await auditLog.record({
      event: 'data_access',
      function: match.captures.callee.getText(),
      scope: ctx.session.id,
    })
  }
})
```

#### `transform` — rewrite the code before execution

Replaces the source code before it is executed. The agent does **not** see the transformation — its context still contains the original code. Only the sandbox receives the modified version.

Use cases: injecting middleware, adding instrumentation, wrapping calls with auth, enforcing policies.

```ts
// Wrap all database calls with a transaction
session.registerHook({
  id: 'auto-transaction',
  label: 'Wrap DB calls in transaction',
  pattern: { type: 'CallExpression', callee: { object: { name: 'db' } } },
  phase: 'before',
  handler: (match) => ({
    type: 'transform',
    newSource: match.source.replace(
      /db\.(\w+)\(/,
      'db.withinTransaction(txn => txn.$1('
    ) + '))'
  })
})
```

**Safety:** Transformed code is re-parsed and re-type-checked before execution. If the transformation produces invalid code, the hook is skipped and the original code executes.

#### `interrupt` — pause and inject a user message

Halts the agent's stream and injects a `role: 'user'` message, exactly like a user intervention. The agent sees the message and adjusts its behavior. The hook decides what the message says.

```ts
// Interrupt if the agent tries to delete data without confirmation
session.registerHook({
  id: 'delete-guard',
  label: 'Guard destructive operations',
  pattern: { type: 'CallExpression', callee: { name: 'deleteRecord' } },
  phase: 'before',
  handler: (match) => ({
    type: 'interrupt',
    message: `⚠ Hold on — you're about to call deleteRecord(). Please confirm with the user via ask() before deleting data.`
  })
})
```

The interrupt message is injected using the same mechanism as user intervention (§6): pause, finalize assistant turn, append user message (with a configurable prefix, default `⚠ [hook:${hookId}]`), update scope, resume.

**The agent treats hook interrupts like any other user message.** It reads the message, acknowledges it with a comment, and adjusts. No special protocol is needed.

#### `skip` — drop the statement entirely

The statement is **not executed**. The agent doesn't know — its context still contains the line, but the sandbox never ran it. An optional reason is logged.

Use with caution — skipping can cause the agent to reference variables that were never created. Best used for defensive filtering (e.g., skip attempts to override globals, skip redundant fetches).

```ts
// Skip redundant data fetches if the variable already exists
session.registerHook({
  id: 'dedup-fetches',
  label: 'Skip redundant fetches',
  pattern: {
    type: 'VariableDeclaration',
    declarations: [{ init: { type: 'AwaitExpression' } }]
  },
  phase: 'before',
  handler: (match, ctx) => {
    const varName = match.captures?.varName
    if (varName && ctx.scope[varName] !== undefined) {
      return { type: 'skip', reason: `${varName} already in scope` }
    }
    return { type: 'continue' }
  }
})
```

### Hook Execution Pipeline

The full execution pipeline for a single statement:

```ts
async function executeStatement(source: string, lineNumber: number): Promise<void> {
  // 1. Parse
  const ast = ts.createSourceFile('line.ts', source, ts.ScriptTarget.ESNext, true)

  // 2. Run 'before' hooks
  let finalSource = source
  for (const hook of getMatchingHooks(ast, 'before')) {
    const match = buildMatch(hook, ast, source, lineNumber)
    const action = await hook.handler(match, buildContext())

    switch (action.type) {
      case 'continue':
        break
      case 'side_effect':
        // Fire-and-forget
        action.fn().catch(err => hookErrorLog.record(hook.id, err))
        break
      case 'transform':
        // Re-parse to validate
        try {
          ts.createSourceFile('transformed.ts', action.newSource, ts.ScriptTarget.ESNext, true)
          finalSource = action.newSource
        } catch {
          hookErrorLog.record(hook.id, 'Transform produced invalid code, skipped')
        }
        break
      case 'interrupt':
        // Pause agent, inject message, resume
        handleHookInterrupt(hook, action.message, source, lineNumber)
        return  // statement is NOT executed — agent will re-approach after seeing the message
      case 'skip':
        hookLog.record(hook.id, `Skipped line ${lineNumber}: ${action.reason ?? ''}`)
        return  // statement is NOT executed
    }
  }

  // 3. Transpile and execute
  const js = transpile(finalSource)
  const result = await vm.runInContext(js, sandbox, { timeout: 30_000 })

  // 4. Run 'after' hooks
  for (const hook of getMatchingHooks(ast, 'after')) {
    const match = buildMatch(hook, ast, source, lineNumber)
    const action = await hook.handler(match, buildContext())

    // 'after' hooks can only continue or side_effect
    if (action.type === 'side_effect') {
      action.fn().catch(err => hookErrorLog.record(hook.id, err))
    }
  }
}
```

### Hook Ordering

Multiple hooks can match the same statement. Execution order:

1. Hooks are run in **registration order** (first registered, first run).
2. A `skip` or `interrupt` action is **terminal** — subsequent hooks for that phase are not run.
3. Multiple `transform` actions compose — each transformation's output is the next's input.
4. `side_effect` actions are all fired (non-exclusive).

### Hook Error Handling

If a hook handler throws an error or rejects:

1. The error is logged to the hook error log.
2. The hook is **skipped** — execution continues as if the hook returned `{ type: 'continue' }`.
3. If the same hook fails 3+ times consecutively, it is **disabled** for the rest of the session with a warning in the hook log.

Hooks must never crash the agent runtime.

### Built-in Hooks (Optional)

The host may ship with optional built-in hooks that developers can enable:

| Hook ID | Pattern | Action | Purpose |
|---------|---------|--------|---------|
| `await-guard` | `CallExpression` not inside `AwaitExpression` | `interrupt`: "You forgot to await this call." | Catch missing awaits before they cause issues |
| `scope-guard` | `VariableDeclaration` where name shadows a global | `interrupt`: "This shadows the global `X`." | Prevent accidental overwrites |
| `display-logger` | `CallExpression` where callee is `display` | `side_effect`: log rendered components | Audit trail of UI output |
| `cost-tracker` | `CallExpression` matching registered API functions | `side_effect`: increment cost counter | Track API costs per session |

---

## 9. Workspace State Generation

The system prompt contains a template slot — `{{SCOPE}}` — that the host replaces with live data on **every context injection**. This gives the agent a persistent, up-to-date view of all variables in the REPL so it can avoid redundant `stop` calls and make better decisions about variable reuse.

Stop and ask values are **not** tracked in a separate log. They are delivered as `role: 'user'` messages in the conversation history, which the agent can read directly by scrolling up. This avoids duplication and keeps the context lean.

### When to regenerate

Regenerate the scope block and replace it in the system prompt content whenever:
- A `stop()` is called (before injecting the stop payload)
- An error occurs (before injecting the error)
- A user intervention message is sent (before injecting the user message)
- Optionally: periodically during long uninterrupted execution stretches (every ~20 lines)

Note: `ask()` does **not** trigger a scope update or message injection. The scope is updated when the agent subsequently calls `stop()` to read the form data.

The system prompt in the conversation history is **mutable** — on each injection, the host replaces the `{{SCOPE}}` marker in the system message with fresh content.

### `{{SCOPE}}` — Variable Scope Snapshot

The host introspects the sandbox to enumerate all user-declared variables, their types, and truncated values.

#### Implementation

```ts
interface ScopeEntry {
  name: string
  type: string       // typeof result or constructor name
  value: string      // truncated serialized value
}

function generateScopeTable(sandbox: vm.Context): string {
  const entries: ScopeEntry[] = []

  // Get all user-declared variable names from the scope tracker
  for (const name of scopeTracker.declaredVariables) {
    // Skip injected globals
    if (INJECTED_GLOBALS.has(name)) continue

    const raw = sandbox[name]
    entries.push({
      name,
      type: describeType(raw),
      value: truncateValue(raw),
    })
  }

  return formatAsTable(entries)
}

function describeType(val: any): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (Array.isArray(val)) {
    if (val.length === 0) return 'Array<never>'
    const inner = describeType(val[0])
    return `Array<${inner}>`
  }
  if (typeof val === 'object') {
    return val.constructor?.name ?? 'Object'
  }
  return typeof val // string, number, boolean, function, symbol, bigint
}

function truncateValue(val: any, maxLen: number = 50): string {
  const json = safeStringify(val)
  if (json.length <= maxLen) return json
  return json.slice(0, maxLen - 3) + '...'
}
```

#### Scope Tracking

The host must track which variable names the agent has declared. Options:

1. **AST analysis:** Before executing each statement, parse it and extract `const`/`let`/`var` declarations and destructuring bindings. Maintain a `Set<string>` of declared names.
2. **Scope diffing:** After each execution, compare `Object.keys(sandbox)` against the previous snapshot. New keys are user-declared variables.
3. **Proxy-based:** Wrap the sandbox context in a Proxy that traps `set` operations.

Option 1 is most reliable. Option 2 is simplest but can miss variables that shadow existing globals.

#### Output Format

```
{{SCOPE}}
┌─────────────────────────────────────────────────────────────────┐
│ VARIABLE        │ TYPE          │ VALUE                         │
├─────────────────┼───────────────┼───────────────────────────────┤
│ zipcode         │ string        │ "94107"                       │
│ restaurants     │ Array<Object> │ [{name:"Flour+Water",rat...}] │
│                 │               │   (8 items)                   │
│ chosen          │ Object        │ {name:"Flour + Water",ra...}  │
│ pick            │ string        │ "Flour + Water"               │
│ report          │ undefined     │ undefined                     │
└─────────────────┴───────────────┴───────────────────────────────┘
```

For arrays, append `(N items)` on a continuation line. For objects, append `(N keys)` if truncated. For strings, show the quoted and truncated value. For functions, show `[Function]`.

#### Size Limits

| Constraint | Limit |
|-----------|-------|
| Max variables shown | 50 (alphabetical, most recent declarations first if over limit) |
| Max value column width | 50 characters |
| Array element preview | First 3 elements, then `... +N more` |
| Object key preview | First 5 keys, then `... +N more` |
| Nested depth | 2 levels max |
| Total scope block size | ~3000 tokens (truncate oldest variables if exceeded) |

### System Prompt Mutation

The host treats the system prompt as a template with a live slot. On every injection:

```ts
function updateSystemPrompt(
  template: string,
  sandbox: vm.Context
): string {
  const scopeBlock = generateScopeTable(sandbox)
  return template.replace(/{{SCOPE}}[\s\S]*?(?=┌|{{|$)/, scopeBlock)
}
```

**Important:** The scope block is replaced in the **system message**, not appended as a new message. This keeps it in a fixed location in the context window and avoids bloating the conversation history. The agent always sees the latest scope in the same place.

---

## 10. Conversation Context Management

The LLM's conversation context has two mutable parts:
1. The **system prompt** — mutated in place to keep `{{SCOPE}}` current.
2. The **message log** — an append-only sequence of `assistant` and `user` messages.

Only `stop` and `error` create turn boundaries. `ask` resumes silently — the agent's assistant turn continues unbroken through an `ask` call. A turn boundary is created when the agent subsequently calls `stop` to read the form values.

```
[system]     System prompt (with filled signatures and live {{SCOPE}})
[user]       User's original request
[assistant]  <code block 1: ...ask(form)...stop(input)>
[user]       ← stop { input: { "city": "Tokyo", "budget": 200 } }
[assistant]  <code block 2: ...computation...>
[user]       ← stop { "results.length": 8 }
[assistant]  <code block 3: ...bad code...>
[user]       ← error [TypeError] Cannot read property 'name' of undefined
[assistant]  <recovery code>
```

The injected `user` messages serve as the agent's read history. The conversation itself **is** the log of all values the agent has inspected — no separate tracking structure is needed.

### Context Window Management

The conversation grows with every turn. Without management, long sessions will exceed the LLM's context window. The host applies **two progressive compression strategies**: code summarization and stop payload decay.

#### Strategy 1: Code Window — Sliding window over assistant turns

The host maintains a **code window** — only the most recent N lines of agent code are kept verbatim. Older code is replaced with a summary comment that preserves the information the agent needs (what was done, what variables were created) without the full source.

**Parameters:**
- `codeWindowLines`: Maximum total lines of agent code kept verbatim across all assistant turns. Default: 200.
- `codeSummaryStrategy`: How to summarize evicted code. Default: `"declaration_summary"`.

**How it works:**

When the total lines of agent code across all assistant turns exceeds `codeWindowLines`, the host replaces the **oldest** assistant turns (starting from the first) with summary comments. The most recent turn is never summarized — it is always kept verbatim.

**Before compression:**
```
[assistant]  const input = await ask(                          ← turn 1 (12 lines)
               <form>
                 <TextInput name="zipcode" label="Zip" />
               </form>
             )
             await stop(input)
[user]       ← stop { input: { "zipcode": "94107" } }
[assistant]  const restaurants = await search(                  ← turn 2 (8 lines)
               "Italian", { near: input.zipcode, limit: 10 }
             )
             await stop(restaurants.length)
[user]       ← stop { "restaurants.length": 8 }
[assistant]  display(<RestaurantList items={restaurants} />)    ← turn 3 (current, 15 lines)
             const choice = await ask(...)
             await stop(choice)
```

**After compression (turn 1 evicted):**
```
[assistant]  // [lines 1-12 executed] declared: input (Object)
[user]       ← stop { input: { "zipcode": "94107" } }
[assistant]  const restaurants = await search(                  ← turn 2 kept
               "Italian", { near: input.zipcode, limit: 10 }
             )
             await stop(restaurants.length)
[user]       ← stop { "restaurants.length": 8 }
[assistant]  display(<RestaurantList items={restaurants} />)    ← turn 3 (current, always kept)
             const choice = await ask(...)
             await stop(choice)
```

**Summary comment format:**
```
// [lines N-M executed] declared: varA (Type), varB (Type), varC (Type)
```

The summary includes:
- Line range that was summarized
- All variables declared in that block with their types (from the scope tracker)
- No values — values are available in `{{SCOPE}}` if still relevant

**Implementation:**

```ts
interface CodeTurn {
  index: number
  lines: string[]
  lineCount: number
  declaredVariables: Array<{ name: string; type: string }>
}

function compressCodeWindow(
  turns: CodeTurn[],
  maxLines: number
): Array<{ role: 'assistant'; content: string }> {
  // Calculate total lines
  let totalLines = turns.reduce((sum, t) => sum + t.lineCount, 0)

  // Never compress the most recent turn
  const result: Array<{ role: 'assistant'; content: string }> = []
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    const isLastTurn = i === turns.length - 1

    if (!isLastTurn && totalLines > maxLines) {
      // Summarize this turn
      const vars = turn.declaredVariables
        .map(v => `${v.name} (${v.type})`)
        .join(', ')
      const summary = `// [lines ${turn.lines[0]}-${turn.lines[turn.lineCount - 1]} executed]`
        + (vars ? ` declared: ${vars}` : '')
      result.push({ role: 'assistant', content: summary })
      totalLines -= (turn.lineCount - 1)  // summary = 1 line
    } else {
      // Keep verbatim
      result.push({ role: 'assistant', content: turn.lines.join('\n') })
    }
  }

  return result
}
```

#### Strategy 2: Stop Payload Decay — Progressive truncation by distance

Stop payloads (`← stop { ... }`) are progressively truncated the further they are from the current execution point. Recent reads are kept in full; older reads are compressed to key-only summaries or removed entirely.

**Decay tiers:**

| Distance from current turn | Treatment | Example |
|---------------------------|-----------|---------|
| 0–2 turns back | **Full** — payload kept verbatim | `← stop { input: { "zipcode": "94107", "radius": 10 } }` |
| 3–5 turns back | **Keys only** — values replaced with types | `← stop { input: Object{zipcode,radius} }` |
| 6–10 turns back | **Summary** — single-line count | `← stop (2 values read)` |
| 11+ turns back | **Removed** — the `[user]` turn is dropped entirely | *(gap in conversation)* |

**The agent is told about this.** The system prompt explains that older stop values are truncated and that `{{SCOPE}}` is the reliable source for current variable values. If the agent needs a historical value that has been truncated, it can re-read it with `await stop(variable)`.

**Implementation:**

```ts
interface StopTurn {
  index: number
  payload: Record<string, any>
  distanceFromCurrent: number  // how many turns ago
}

function decayStopPayload(turn: StopTurn): string {
  const d = turn.distanceFromCurrent

  if (d <= 2) {
    // Full — keep verbatim
    return `← stop ${JSON.stringify(turn.payload, null, 2)}`
  }

  if (d <= 5) {
    // Keys only — replace values with type summaries
    const keySummary = Object.entries(turn.payload).map(([k, v]) => {
      return `${k}: ${describeTypeBrief(v)}`
    }).join(', ')
    return `← stop { ${keySummary} }`
  }

  if (d <= 10) {
    // Count only
    const count = Object.keys(turn.payload).length
    return `← stop (${count} value${count !== 1 ? 's' : ''} read)`
  }

  // 11+ turns: remove entirely
  return null  // signal to drop this user turn
}

function describeTypeBrief(val: any): string {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  if (typeof val === 'string') return `"${val.slice(0, 20)}${val.length > 20 ? '...' : ''}"`
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (Array.isArray(val)) return `Array(${val.length})`
  if (typeof val === 'object') {
    const keys = Object.keys(val).slice(0, 5).join(',')
    return `Object{${keys}${Object.keys(val).length > 5 ? ',…' : ''}}`
  }
  return typeof val
}
```

#### Error turns

Error injections (`← error [Type] ...`) follow the same decay as stop payloads:
- Recent errors: kept in full (the agent may still need the context for recovery).
- Old errors: compressed to `← error [Type] (recovered)` or removed.

#### User intervention messages

Human messages (user interventions) are **never truncated or removed** — they represent the user's intent and may be critical context for the agent's ongoing plan. They are always kept verbatim regardless of distance.

#### Combined compression flow

On every context injection, the host runs both strategies:

```ts
function compressContext(messages: Message[], config: ContextWindowConfig): Message[] {
  const compressed: Message[] = []

  // 1. System prompt — always kept (with live {{SCOPE}})
  compressed.push(messages[0])

  // 2. Original user request — always kept
  compressed.push(messages[1])

  // 3. Process conversation turns
  const turns = parseTurns(messages.slice(2))
  const currentTurnIndex = turns.length - 1

  for (const turn of turns) {
    const distance = currentTurnIndex - turn.index

    if (turn.role === 'assistant') {
      // Apply code window compression
      compressed.push(compressCodeTurn(turn, distance, config))
    } else if (turn.role === 'user') {
      if (turn.isProtocol && turn.type === 'stop') {
        // Apply stop payload decay
        const decayed = decayStopPayload({ ...turn, distanceFromCurrent: distance })
        if (decayed !== null) {
          compressed.push({ role: 'user', content: decayed })
        }
        // else: 11+ turns back, drop entirely
      } else if (turn.isProtocol && turn.type === 'error') {
        // Apply same decay to errors
        const decayed = decayErrorPayload(turn, distance)
        if (decayed !== null) {
          compressed.push({ role: 'user', content: decayed })
        }
      } else {
        // Human message (intervention or original request) — always keep
        compressed.push({ role: 'user', content: turn.content })
      }
    }
  }

  return compressed
}
```

#### Token budget enforcement

After applying both strategies, the host checks the total token count. If it still exceeds `maxContextTokens`, it applies more aggressive eviction:

1. Increase code summarization — evict more turns (but never the current turn).
2. Shrink the "full" stop payload window from 2 turns to 1, then 0.
3. Shrink `{{SCOPE}}` value truncation — reduce `maxScopeValueWidth` from 50 to 30 chars.
4. If still over budget, summarize the system prompt's function/component signatures to just names and return types.

---

## 11. Security

### Sandbox Isolation

The REPL sandbox must **not** have access to:
- Host filesystem (beyond explicitly provided functions)
- Network (beyond explicitly provided functions)
- `process`, `require`, `import()`, `eval`, `Function` constructor
- `globalThis` modification beyond the injected API

### Function Registry

All agent-accessible functions are proxy-wrapped to enforce argument types, add timeouts (default 30s), log invocations, and rate-limit.

### JSX Sanitization

- Disallow `dangerouslySetInnerHTML`
- Disallow `<script>` tags
- Disallow `javascript:` URLs
- Validate that `ask` forms only contain registered input components

---

## 12. Session Lifecycle

```
INIT
  → Create sandbox, inject globals, compose system prompt, send to LLM

STREAM LOOP
  → Accumulate tokens into line buffer
  → On complete statement: execute in sandbox
    → error?             → pause, update {{SCOPE}}, append user message with error, resume
    → stop()?            → pause, update {{SCOPE}}, append user message with values, resume
    → ask()?             → pause, render form, wait for submit, assign to sandbox, resume silently
    → display()          → render component, continue
    → async()            → register task (+ abort controller), continue
  → On user intervention (message sent mid-execution):
    → pause, update {{SCOPE}}, finalize assistant turn, append user message, resume
  → On user pause:
    → halt stream, wait for resume or user message
  → On async task cancel (from sidebar):
    → abort task, store cancellation result, deliver in next stop()

COMPLETION
  → LLM emits stop token
  → Drain remaining async tasks (with timeout)
  → Final render pass
  → Session complete

CLEANUP
  → Destroy sandbox, unmount components, close LLM connection, clear abort controllers
```

---

## 13. Message Wire Format

```ts
// Initial request — workspace slots are empty
const systemPrompt = buildSystemPrompt({
  functionSignatures,
  componentSignatures,
  scope: '(no variables yet)',
})

const messages = [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userMessage }
]

// After stop() — update scope in system prompt, then append injection as user message:
messages[0].content = buildSystemPrompt({
  functionSignatures,
  componentSignatures,
  scope: generateScopeTable(sandbox),
})
messages.push(
  { role: 'assistant', content: agentCodeSoFar },
  { role: 'user', content: '← stop { "count": 47 }' }
)

// After error — same pattern:
messages[0].content = buildSystemPrompt({ /* ... updated scope ... */ })
messages.push(
  { role: 'assistant', content: agentCodeSoFar },
  { role: 'user', content: '← error [TypeError] Cannot read property...\n    at line 14: ...' }
)

// After ask() — NO message is appended. The form data is assigned to the
// sandbox variable and generation resumes. The agent's assistant turn
// continues unbroken. The values become visible when the agent calls stop():
//
//   [assistant]  const input = await ask(<form>...</form>)  ← pauses here, form shown
//                                                            ← user submits, input assigned
//                await stop(input)                           ← agent continues, then stops
//   [user]       ← stop { input: { "city": "Tokyo" } }      ← NOW the turn boundary happens

// After user intervention — raw message, no ← prefix:
messages[0].content = buildSystemPrompt({ /* ... updated scope ... */ })
messages.push(
  { role: 'assistant', content: agentCodeSoFar },
  { role: 'user', content: 'Actually, search for Japanese restaurants instead.' }
)
// Agent resumes, sees the human message, and adjusts.
```

---

## 14. Type Definitions

```ts
// Host-injected globals
declare function stop(...values: any[]): Promise<void>
declare function display(element: React.ReactElement): void
declare function ask(formElement: React.ReactElement): Promise<Record<string, any>>
declare function async(fn: () => Promise<void>): void

// Injection payloads (only stop and error inject user messages)
interface StopPayload {
  [argNameOrExpression: string]: SerializedValue
}

interface ErrorPayload {
  type: string
  message: string
  line: number
  source: string
}

type SerializedValue =
  | string | number | boolean | null
  | 'undefined' | '[Circular]'
  | `[Function: ${string}]`
  | `[Error: ${string}]`
  | `[Promise: ${'pending' | 'resolved' | 'rejected'}]`
  | SerializedValue[]
  | { [key: string]: SerializedValue }
  | 'pending'
  | AsyncCancellation

// Async task cancellation (delivered via stop payload)
interface AsyncCancellation {
  cancelled: true
  message: string    // user's optional explanation, "" if none
}

// Ask form cancellation (when user intervenes during ask)
interface AskCancellation {
  _cancelled: true
}

// Session configuration
interface SessionConfig {
  functionTimeout: number       // default: 30_000
  askTimeout: number            // default: 300_000
  sessionTimeout: number        // default: 600_000
  maxStopCalls: number          // default: 50
  maxAsyncTasks: number         // default: 10
  maxContextTokens: number      // default: 100_000
  serializationLimits: {
    maxStringLength: number     // default: 2_000
    maxArrayElements: number    // default: 50
    maxObjectKeys: number       // default: 20
    maxDepth: number            // default: 5
  }
  workspace: {
    maxScopeVariables: number   // default: 50
    maxScopeValueWidth: number  // default: 50 chars
    maxScopeTokens: number      // default: 3_000
  }
  contextWindow: {
    codeWindowLines: number     // default: 200 — max total lines of agent code kept verbatim
    stopDecayTiers: {           // distance thresholds for stop payload truncation
      full: number              // default: 2 — turns 0-2 kept verbatim
      keysOnly: number          // default: 5 — turns 3-5 compressed to keys+types
      summary: number           // default: 10 — turns 6-10 compressed to count
                                // turns 11+ removed entirely
    }
    neverTruncateInterventions: boolean  // default: true — human messages always kept
  }
}

// Workspace generation
interface ScopeEntry {
  name: string
  type: string
  value: string   // truncated serialized value
}

// Developer hooks (§8)
interface Hook {
  id: string
  label: string
  pattern: ASTPattern
  phase: 'before' | 'after'
  handler: (match: HookMatch, ctx: HookContext) => HookAction | Promise<HookAction>
}

type ASTPattern =
  | { type: string; [property: string]: any }        // node type + property filters
  | { oneOf: ASTPattern[] }                           // OR combinator
  | { type: string; not: ASTPattern }                 // negation

interface HookMatch {
  node: ts.Node
  source: string
  captures: Record<string, ts.Node>
  line: number
}

interface HookContext {
  scope: Record<string, any>
  session: { id: string; turnIndex: number; lineIndex: number }
  ast: ts.SourceFile
  asyncTasks: Map<string, { status: string }>
}

type HookAction =
  | { type: 'continue' }
  | { type: 'side_effect'; fn: () => void | Promise<void> }
  | { type: 'transform'; newSource: string }
  | { type: 'interrupt'; message: string }
  | { type: 'skip'; reason?: string }
```

---

## 15. Worked Example — Full Trace

User: *"Find me Italian restaurants nearby and help me pick one."*

### Message log as it builds up

```
[system]  <system prompt with {{SCOPE}}: (no variables yet)>
[user]    Find me Italian restaurants nearby and help me pick one.
```

### Execution trace

```
AGENT OUTPUT                              HOST ACTION
──────────────────────────────────────────────────────────────
// Let's find Italian restaurants        [noop — comment]

const input = await ask(                 [accumulate multi-line...]
  <form>
    <TextInput name="zipcode"
      label="What's your zip code?" />
  </form>
)                                        [execute ask() → render form, PAUSE]

                                         [User types "94107", submits]
                                         [assign: input = { zipcode: "94107" }]
                                         [RESUME silently — no message appended]

await stop(input)                        [execute stop() → PAUSE]
                                         [UPDATE {{SCOPE}}:]
                                         │  input │ Object │ { zipcode: "94107" }
                                         [APPEND messages:]
                                         │  { role: 'assistant', content: '<code so far>' }
                                         │  { role: 'user', content: '← stop { input: { "zipcode": "94107" } }' }
                                         [RESUME generation]

// User wants zipcode 94107              [noop]
const restaurants = await search(        [execute search()]
  "Italian restaurants",
  { near: input.zipcode, limit: 10 }
)

await stop(restaurants.length)           [execute stop() → PAUSE]
                                         [UPDATE {{SCOPE}}:]
                                         │  input       │ Object        │ { zipcode: "94107" }
                                         │  restaurants │ Array<Object> │ [{name:"Flour+W...}] (8)
                                         [APPEND messages:]
                                         │  { role: 'assistant', content: '<code since last pause>' }
                                         │  { role: 'user', content: '← stop { "restaurants.length": 8 }' }
                                         [RESUME]

// Found 8 options                       [noop]
display(                                 [accumulate...]
  <RestaurantList
    items={restaurants.slice(0, 5)}
  />
)                                        [execute display() → render, continue]

const choice = await ask(                [accumulate...]
  <form>
    <Select name="pick"
      label="Which one?"
      options={restaurants
        .slice(0, 5)
        .map(r => r.name)} />
  </form>
)                                        [execute ask() → render form, PAUSE]

                                         [User selects "Flour + Water", submits]
                                         [assign: choice = { pick: "Flour + Water" }]
                                         [RESUME silently — no message appended]

await stop(choice)                       [execute stop() → PAUSE]
                                         [UPDATE {{SCOPE}}:]
                                         │  input       │ Object        │ { zipcode: "94107" }
                                         │  restaurants │ Array<Object> │ [{name:"Flour+W...}] (8)
                                         │  choice      │ Object        │ { pick: "Flour + Water" }
                                         [APPEND messages:]
                                         │  { role: 'assistant', content: '<code since last pause>' }
                                         │  { role: 'user', content: '← stop { choice: { "pick": "Flour + Water" } }' }
                                         [RESUME]

// User picked Flour + Water             [noop]
const chosen = restaurants.find(         [execute]
  r => r.name === choice.pick
)

display(                                 [accumulate...]
  <RestaurantCard
    restaurant={chosen}
    showBooking={true}
  />
)                                        [execute display() → render]

// Done!                                 [LLM stop token → session complete]
```

### Final message log

```
[system]     <system prompt with {{SCOPE}} showing input, restaurants, choice, chosen>
[user]       Find me Italian restaurants nearby and help me pick one.
[assistant]  // Let's find...\nconst input = await ask(...)\nawait stop(input)
[user]       ← stop { input: { "zipcode": "94107" } }
[assistant]  // User wants zipcode 94107\nconst restaurants = await search(...)\nawait stop(restaurants.length)
[user]       ← stop { "restaurants.length": 8 }
[assistant]  // Found 8...\ndisplay(...)\nconst choice = await ask(...)\nawait stop(choice)
[user]       ← stop { choice: { "pick": "Flour + Water" } }
[assistant]  // User picked...\nconst chosen = ...\ndisplay(...)\n// Done!
```

Note how the `ask` calls do **not** produce turn boundaries — the agent's assistant turn continues unbroken through `ask` into the subsequent `stop`. The only `[user]` messages are `← stop` injections. This keeps `stop` as the single, uniform mechanism for the agent to read any value.
