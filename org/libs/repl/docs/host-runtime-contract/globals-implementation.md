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

## 6. `checkpoints` Implementation

`checkpoints` registers a task plan with the host runtime. The agent calls it before writing implementation code, to declare the milestones it intends to reach. Multiple tasklists can be declared per session, each identified by a unique `tasklistId`.

```ts
interface CheckpointTask {
  id: string
  instructions: string
  outputSchema: Record<string, { type: string }>
}

interface CheckpointPlan {
  tasklistId: string
  description: string
  tasks: CheckpointTask[]
}

interface TasklistState {
  plan: CheckpointPlan
  completed: Map<string, { output: Record<string, any>; timestamp: number }>
  currentIndex: number  // index of next incomplete checkpoint
}

interface CheckpointState {
  tasklists: Map<string, TasklistState>
}

const checkpointState: CheckpointState = {
  tasklists: new Map(),
}

globalThis.checkpoints = (tasklistId: string, description: string, tasks: CheckpointTask[]) => {
  if (checkpointState.tasklists.has(tasklistId)) {
    throw new Error(`checkpoints() tasklist "${tasklistId}" already declared`)
  }

  if (!tasklistId) {
    throw new Error('checkpoints() requires a tasklistId')
  }

  // Validate plan structure
  if (!description || !Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('checkpoints() requires a description and at least one task')
  }

  const ids = new Set<string>()
  for (const task of tasks) {
    if (!task.id || !task.instructions || !task.outputSchema) {
      throw new Error(`Each checkpoint task must have id, instructions, and outputSchema`)
    }
    if (ids.has(task.id)) {
      throw new Error(`Duplicate checkpoint id: ${task.id}`)
    }
    ids.add(task.id)
  }

  const plan: CheckpointPlan = { tasklistId, description, tasks }
  const tasklistState: TasklistState = {
    plan,
    completed: new Map(),
    currentIndex: 0,
  }
  checkpointState.tasklists.set(tasklistId, tasklistState)

  // Render progress UI to the user
  renderSurface.appendCheckpointProgress(tasklistId, tasklistState)

  // Does NOT block execution — returns synchronously like display()
}
```

### Progress Rendering

The host renders a persistent progress indicator (e.g., a stepper or checklist) for each tasklist that updates as checkpoints are completed. This is separate from the `display()` render queue — it persists at the top or side of the viewport.

---

## 7. `checkpoint` Implementation

`checkpoint` marks a milestone as complete and validates its output against the declared schema. The `tasklistId` identifies which tasklist the checkpoint belongs to.

```ts
globalThis.checkpoint = (tasklistId: string, id: string, output: Record<string, any>) => {
  const tasklist = checkpointState.tasklists.get(tasklistId)
  if (!tasklist) {
    throw new Error(`checkpoint() called with unknown tasklist "${tasklistId}" — declare it with checkpoints() first`)
  }

  const taskIndex = tasklist.plan.tasks.findIndex(t => t.id === id)
  if (taskIndex === -1) {
    throw new Error(`Unknown checkpoint id: ${id} in tasklist "${tasklistId}"`)
  }

  if (tasklist.completed.has(id)) {
    throw new Error(`Checkpoint "${id}" in tasklist "${tasklistId}" already completed`)
  }

  // Enforce ordering — checkpoints must be completed sequentially within a tasklist
  if (taskIndex !== tasklist.currentIndex) {
    const expected = tasklist.plan.tasks[tasklist.currentIndex]
    throw new Error(
      `Checkpoint "${id}" in tasklist "${tasklistId}" called out of order. Expected: "${expected.id}"`
    )
  }

  // Validate output against schema (lightweight type check)
  const task = tasklist.plan.tasks[taskIndex]
  for (const [key, schema] of Object.entries(task.outputSchema)) {
    if (!(key in output)) {
      throw new Error(`Checkpoint "${id}" output missing required key: ${key}`)
    }
    const actual = Array.isArray(output[key]) ? 'array' : typeof output[key]
    if (actual !== (schema as any).type) {
      throw new Error(
        `Checkpoint "${id}" output key "${key}": expected ${(schema as any).type}, got ${actual}`
      )
    }
  }

  // Record completion
  tasklist.completed.set(id, {
    output,
    timestamp: Date.now(),
  })
  tasklist.currentIndex++

  // Update progress UI
  renderSurface.updateCheckpointProgress(tasklistId, tasklist)

  // Does NOT block execution — returns synchronously like display()
}
```

### Incomplete Checkpoint Reminder

When the LLM emits a stop token (stream completion) and there are still incomplete checkpoints in any tasklist, the host **does not** end the session. Instead:

1. Iterate all tasklists and find the first with incomplete checkpoints
2. Identify remaining checkpoints: `tasklist.plan.tasks.slice(tasklist.currentIndex)`
3. Build a reminder message listing the tasklist ID and incomplete checkpoint IDs
4. Inject as a user message with `⚠ [system]` prefix
5. Resume LLM generation

```ts
function onStreamComplete() {
  for (const [tasklistId, tasklist] of checkpointState.tasklists) {
    const remaining = tasklist.plan.tasks.slice(tasklist.currentIndex)
    if (remaining.length === 0) continue  // this tasklist is complete

    const ids = remaining.map(t => t.id).join(', ')
    streamController.pause()
    streamController.injectUserMessage(
      `⚠ [system] Tasklist "${tasklistId}" incomplete. Remaining: ${ids}. Continue from where you left off.`
    )
    streamController.resume()
    return  // handle one tasklist per reminder cycle
  }
  // All tasklists complete — normal completion
}
```

The host should limit the number of reminder cycles (default: 3) to avoid infinite loops. If the agent fails to complete after max retries, the session ends with a warning to the user.
