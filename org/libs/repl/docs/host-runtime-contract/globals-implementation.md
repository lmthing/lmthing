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
