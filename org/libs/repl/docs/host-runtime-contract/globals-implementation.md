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

  // 4. Collect completed async task results from tasklists
  const taskResults = collectAsyncTaskResults(tasklistsState)
  for (const [key, value] of taskResults) {
    payload[`task:${key}`] = serialize(value)
  }

  // 5. Signal the stream controller to pause and inject as user message
  //    Append {{TASKS}} block if any tasklists are active
  const tasksBlock = generateTasksBlock(tasklistsState)
  const message = tasksBlock
    ? `← stop ${JSON.stringify(payload, null, 2)}\n\n${tasksBlock}`
    : `← stop ${JSON.stringify(payload, null, 2)}`
  streamController.pause()
  streamController.injectUserMessage(message)

  // 6. Wait for the stream controller to resume us
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

## 6. `tasklist` Implementation

`tasklist` registers a task plan with the host runtime. The agent calls it before writing implementation code, to declare the milestones it intends to reach. Multiple tasklists can be declared per session, each identified by a unique `tasklistId`.

```ts
interface TaskDefinition {
  id: string
  instructions: string
  outputSchema: Record<string, { type: string }>
  dependsOn?: string[]         // task IDs that must complete first
  condition?: string           // JS expression; if falsy, auto-skip
  optional?: boolean           // if true, failure doesn't block dependents
}

type TaskStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped'

interface TaskCompletion {
  output: Record<string, any>
  timestamp: number
  status: 'completed' | 'failed' | 'skipped'
  error?: string
  duration?: number
}

interface Tasklist {
  tasklistId: string
  description: string
  tasks: TaskDefinition[]
}

interface TasklistState {
  plan: Tasklist
  completed: Map<string, TaskCompletion>
  readyTasks: Set<string>      // tasks whose deps are all satisfied
  runningTasks: Set<string>    // async tasks currently executing
  outputs: Map<string, Record<string, any>>  // completed task outputs for condition eval
}

interface TasklistsState {
  tasklists: Map<string, TasklistState>
}

const tasklistsState: TasklistsState = {
  tasklists: new Map(),
}

globalThis.tasklist = (tasklistId: string, description: string, tasks: TaskDefinition[]) => {
  if (tasklistsState.tasklists.has(tasklistId)) {
    throw new Error(`tasklist() tasklist "${tasklistId}" already declared`)
  }

  if (!tasklistId) {
    throw new Error('tasklist() requires a tasklistId')
  }

  // Validate plan structure
  if (!description || !Array.isArray(tasks) || tasks.length === 0) {
    throw new Error('tasklist() requires a description and at least one task')
  }

  const ids = new Set<string>()
  for (const task of tasks) {
    if (!task.id || !task.instructions || !task.outputSchema) {
      throw new Error(`Each task must have id, instructions, and outputSchema`)
    }
    if (ids.has(task.id)) {
      throw new Error(`Duplicate task id: ${task.id}`)
    }
    ids.add(task.id)
  }

  // If any task has dependsOn, validate the DAG
  const hasDeps = tasks.some(t => t.dependsOn && t.dependsOn.length > 0)
  if (hasDeps) {
    // Validate all dependsOn references point to valid task IDs
    for (const task of tasks) {
      if (task.dependsOn) {
        for (const dep of task.dependsOn) {
          if (!ids.has(dep)) {
            throw new Error(`Task "${task.id}" depends on unknown task "${dep}"`)
          }
        }
      }
    }

    // Topological sort for cycle detection
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const taskMap = new Map(tasks.map(t => [t.id, t]))

    function visit(id: string) {
      if (visiting.has(id)) {
        throw new Error(`Cycle detected in tasklist "${tasklistId}" involving task "${id}"`)
      }
      if (visited.has(id)) return
      visiting.add(id)
      const task = taskMap.get(id)!
      if (task.dependsOn) {
        for (const dep of task.dependsOn) {
          visit(dep)
        }
      }
      visiting.delete(id)
      visited.add(id)
    }

    for (const task of tasks) {
      visit(task.id)
    }
  } else {
    // No task has dependsOn — synthesize implicit sequential deps for backward compat
    for (let i = 1; i < tasks.length; i++) {
      tasks[i].dependsOn = [tasks[i - 1].id]
    }
  }

  // Compute initial readyTasks (tasks with no dependencies or all deps satisfied)
  const readyTasks = new Set<string>()
  for (const task of tasks) {
    if (!task.dependsOn || task.dependsOn.length === 0) {
      readyTasks.add(task.id)
    }
  }

  const plan: Tasklist = { tasklistId, description, tasks }
  const tasklistState: TasklistState = {
    plan,
    completed: new Map(),
    readyTasks,
    runningTasks: new Set(),
    outputs: new Map(),
  }
  tasklistsState.tasklists.set(tasklistId, tasklistState)

  // Render progress UI to the user
  renderSurface.appendTasklistProgress(tasklistId, tasklistState)

  // Does NOT block execution — returns synchronously like display()
}
```

### Progress Rendering

The host renders a persistent progress indicator (e.g., a stepper or checklist) for each tasklist that updates as tasks are completed. This is separate from the `display()` render queue — it persists at the top or side of the viewport.

---

## 7. `completeTask` Implementation

`completeTask` marks a milestone as complete and validates its output against the declared schema. The `tasklistId` identifies which tasklist the task belongs to. Tasks are completed based on DAG readiness, not sequential index.

```ts
globalThis.completeTask = (tasklistId: string, id: string, output: Record<string, any>) => {
  const tasklist = tasklistsState.tasklists.get(tasklistId)
  if (!tasklist) {
    throw new Error(`completeTask() called with unknown tasklist "${tasklistId}" — declare it with tasklist() first`)
  }

  const task = tasklist.plan.tasks.find(t => t.id === id)
  if (!task) {
    throw new Error(`Unknown task id: ${id} in tasklist "${tasklistId}"`)
  }

  if (tasklist.completed.has(id)) {
    throw new Error(`Task "${id}" in tasklist "${tasklistId}" already completed`)
  }

  // Enforce DAG readiness — task must be in readyTasks
  if (!tasklist.readyTasks.has(id)) {
    const blockedBy = (task.dependsOn || []).filter(dep => !tasklist.completed.has(dep))
    throw new Error(
      `Task "${id}" in tasklist "${tasklistId}" is not ready. Waiting on: ${blockedBy.join(', ')}`
    )
  }

  // Validate output against schema (lightweight type check)
  for (const [key, schema] of Object.entries(task.outputSchema)) {
    if (!(key in output)) {
      throw new Error(`Task "${id}" output missing required key: ${key}`)
    }
    const actual = Array.isArray(output[key]) ? 'array' : typeof output[key]
    if (actual !== (schema as any).type) {
      throw new Error(
        `Task "${id}" output key "${key}": expected ${(schema as any).type}, got ${actual}`
      )
    }
  }

  // Record completion
  tasklist.readyTasks.delete(id)
  tasklist.runningTasks.delete(id)
  tasklist.completed.set(id, {
    output,
    timestamp: Date.now(),
    status: 'completed',
  })
  tasklist.outputs.set(id, output)

  // Recompute readyTasks — find tasks whose deps are now all satisfied
  recomputeReadyTasks(tasklist)

  // Update progress UI
  renderSurface.updateTasklistProgress(tasklistId, tasklist)

  // Does NOT block execution — returns synchronously like display()
}

function recomputeReadyTasks(tasklist: TasklistState) {
  for (const task of tasklist.plan.tasks) {
    // Skip tasks already completed, ready, or running
    if (tasklist.completed.has(task.id)) continue
    if (tasklist.readyTasks.has(task.id)) continue
    if (tasklist.runningTasks.has(task.id)) continue

    // Check if all dependencies are satisfied (completed or skipped)
    const depsOk = (task.dependsOn || []).every(dep => {
      const completion = tasklist.completed.get(dep)
      return completion && (completion.status === 'completed' || completion.status === 'skipped')
    })
    // For non-optional deps, also check that they didn't fail
    const nonOptionalDepsOk = (task.dependsOn || []).every(dep => {
      const depTask = tasklist.plan.tasks.find(t => t.id === dep)
      if (depTask?.optional) return true  // optional deps don't block even on failure
      const completion = tasklist.completed.get(dep)
      return completion && completion.status !== 'failed'
    })

    if (depsOk && nonOptionalDepsOk) {
      // Evaluate condition if present — auto-skip if falsy
      if (task.condition) {
        try {
          const conditionResult = evaluateCondition(task.condition, tasklist.outputs)
          if (!conditionResult) {
            tasklist.completed.set(task.id, {
              output: {},
              timestamp: Date.now(),
              status: 'skipped',
            })
            // Recurse — skipping may unlock further tasks
            recomputeReadyTasks(tasklist)
            return
          }
        } catch {
          // Condition evaluation error — treat as ready, let the agent handle it
        }
      }
      tasklist.readyTasks.add(task.id)
    }
  }
}

function evaluateCondition(
  condition: string,
  outputs: Map<string, Record<string, any>>
): boolean {
  const ctx = Object.fromEntries(outputs)
  // Destructure task outputs into top-level variables so conditions
  // can reference task IDs directly (e.g., "fetch_data.count > 0")
  const paramNames = Object.keys(ctx)
  const paramValues = Object.values(ctx)
  const fn = new Function(...paramNames, `return !!(${condition})`)
  return fn(...paramValues)
}
```

---

## 8. `completeTaskAsync` Implementation

`completeTaskAsync` is the async counterpart to `completeTask`. It moves a task into the running state and spawns a background function via the AsyncManager. Results are delivered through the next `stop()` call.

```ts
declare function completeTaskAsync(
  tasklistId: string,
  taskId: string,
  fn: () => Promise<Record<string, any>>
): void
```

```ts
globalThis.completeTaskAsync = (
  tasklistId: string,
  taskId: string,
  fn: () => Promise<Record<string, any>>
) => {
  const tasklist = tasklistsState.tasklists.get(tasklistId)
  if (!tasklist) {
    throw new Error(`completeTaskAsync() called with unknown tasklist "${tasklistId}"`)
  }

  const task = tasklist.plan.tasks.find(t => t.id === taskId)
  if (!task) {
    throw new Error(`Unknown task id: ${taskId} in tasklist "${tasklistId}"`)
  }

  // Task must be in readyTasks
  if (!tasklist.readyTasks.has(taskId)) {
    const blockedBy = (task.dependsOn || []).filter(dep => !tasklist.completed.has(dep))
    throw new Error(
      `Task "${taskId}" in tasklist "${tasklistId}" is not ready. Waiting on: ${blockedBy.join(', ')}`
    )
  }

  // Move from ready to running
  tasklist.readyTasks.delete(taskId)
  tasklist.runningTasks.add(taskId)

  // Update progress UI
  renderSurface.updateTasklistProgress(tasklistId, tasklist)

  // Spawn via AsyncManager
  const startTime = Date.now()
  asyncManager.spawn(`task:${taskId}`, async () => {
    try {
      const output = await fn()

      // Validate output against schema
      for (const [key, schema] of Object.entries(task.outputSchema)) {
        if (!(key in output)) {
          throw new Error(`Task "${taskId}" output missing required key: ${key}`)
        }
        const actual = Array.isArray(output[key]) ? 'array' : typeof output[key]
        if (actual !== (schema as any).type) {
          throw new Error(
            `Task "${taskId}" output key "${key}": expected ${(schema as any).type}, got ${actual}`
          )
        }
      }

      // Record completion with status 'completed'
      tasklist.runningTasks.delete(taskId)
      tasklist.completed.set(taskId, {
        output,
        timestamp: Date.now(),
        status: 'completed',
        duration: Date.now() - startTime,
      })
      tasklist.outputs.set(taskId, output)

      // Recompute readyTasks — completing this may unlock dependents
      recomputeReadyTasks(tasklist)
      renderSurface.updateTasklistProgress(tasklistId, tasklist)

      return output
    } catch (err: any) {
      // Record with status 'failed'
      tasklist.runningTasks.delete(taskId)
      tasklist.completed.set(taskId, {
        output: {},
        timestamp: Date.now(),
        status: 'failed',
        error: err.message,
        duration: Date.now() - startTime,
      })

      // If optional, unblock dependents
      if (task.optional) {
        recomputeReadyTasks(tasklist)
      }
      renderSurface.updateTasklistProgress(tasklistId, tasklist)

      throw err
    }
  })

  // Returns synchronously — does NOT block execution
}
```

Results from `completeTaskAsync` are delivered via `stop()` with `task:<taskId>` keys in the payload.

---

## 9. `taskProgress` Implementation

`taskProgress` updates the progress UI for a specific task without completing it. It is non-blocking and synchronous.

```ts
declare function taskProgress(
  tasklistId: string, taskId: string,
  message: string, percent?: number
): void
```

```ts
globalThis.taskProgress = (
  tasklistId: string,
  taskId: string,
  message: string,
  percent?: number
) => {
  const tasklist = tasklistsState.tasklists.get(tasklistId)
  if (!tasklist) {
    throw new Error(`taskProgress() called with unknown tasklist "${tasklistId}"`)
  }

  const task = tasklist.plan.tasks.find(t => t.id === taskId)
  if (!task) {
    throw new Error(`Unknown task id: ${taskId} in tasklist "${tasklistId}"`)
  }

  // Task must be in ready or running state
  if (!tasklist.readyTasks.has(taskId) && !tasklist.runningTasks.has(taskId)) {
    throw new Error(
      `taskProgress() called on task "${taskId}" which is not in ready or running state`
    )
  }

  // Clamp percent to 0-100 if provided
  const clampedPercent = percent !== undefined
    ? Math.max(0, Math.min(100, percent))
    : undefined

  // Update progress UI
  renderSurface.updateTaskProgress(tasklistId, taskId, message, clampedPercent)

  // Non-blocking, synchronous — returns immediately
}
```

---

## 10. `failTask` Implementation

`failTask` explicitly marks a task as failed with an error message. If the task is marked `optional: true`, its dependents are unblocked.

```ts
declare function failTask(tasklistId: string, taskId: string, error: string): void
```

```ts
globalThis.failTask = (tasklistId: string, taskId: string, error: string) => {
  const tasklist = tasklistsState.tasklists.get(tasklistId)
  if (!tasklist) {
    throw new Error(`failTask() called with unknown tasklist "${tasklistId}"`)
  }

  const task = tasklist.plan.tasks.find(t => t.id === taskId)
  if (!task) {
    throw new Error(`Unknown task id: ${taskId} in tasklist "${tasklistId}"`)
  }

  if (tasklist.completed.has(taskId)) {
    throw new Error(`Task "${taskId}" in tasklist "${tasklistId}" already completed`)
  }

  // Record status: 'failed' with error message
  tasklist.readyTasks.delete(taskId)
  tasklist.runningTasks.delete(taskId)
  tasklist.completed.set(taskId, {
    output: {},
    timestamp: Date.now(),
    status: 'failed',
    error,
  })

  // If task is optional, unblock dependents (recompute readyTasks)
  // If not optional, dependents stay blocked
  if (task.optional) {
    recomputeReadyTasks(tasklist)
  }

  // Update progress UI
  renderSurface.updateTasklistProgress(tasklistId, tasklist)

  // Does NOT block execution — returns synchronously
}
```

---

## 11. `retryTask` Implementation

`retryTask` resets a failed task back to the ready state so the agent can attempt it again. A per-task retry counter prevents infinite retry loops.

```ts
declare function retryTask(tasklistId: string, taskId: string): void
```

```ts
const taskRetryCounts: Map<string, number> = new Map()

globalThis.retryTask = (tasklistId: string, taskId: string) => {
  const tasklist = tasklistsState.tasklists.get(tasklistId)
  if (!tasklist) {
    throw new Error(`retryTask() called with unknown tasklist "${tasklistId}"`)
  }

  const task = tasklist.plan.tasks.find(t => t.id === taskId)
  if (!task) {
    throw new Error(`Unknown task id: ${taskId} in tasklist "${tasklistId}"`)
  }

  // Only works on failed tasks
  const completion = tasklist.completed.get(taskId)
  if (!completion || completion.status !== 'failed') {
    throw new Error(
      `retryTask() called on task "${taskId}" which is not in failed state`
    )
  }

  // Track retry count, throw if exceeds maxTaskRetries (default: 3)
  const retryKey = `${tasklistId}:${taskId}`
  const retryCount = (taskRetryCounts.get(retryKey) || 0) + 1
  const maxRetries = config.maxTaskRetries ?? 3
  if (retryCount > maxRetries) {
    throw new Error(
      `Task "${taskId}" in tasklist "${tasklistId}" exceeded max retries (${maxRetries})`
    )
  }
  taskRetryCounts.set(retryKey, retryCount)

  // Reset task back to ready status
  tasklist.completed.delete(taskId)
  tasklist.outputs.delete(taskId)
  tasklist.readyTasks.add(taskId)

  // Update progress UI
  renderSurface.updateTasklistProgress(tasklistId, tasklist)

  // Does NOT block execution — returns synchronously
}
```

---

## 12. `sleep` Implementation

`sleep` pauses sandbox execution for a specified duration. It does not affect the LLM stream or async tasks.

```ts
declare function sleep(seconds: number): Promise<void>
```

```ts
globalThis.sleep = async (seconds: number): Promise<void> => {
  // Cap at sleepMaxSeconds (default: 30)
  const maxSeconds = config.sleepMaxSeconds ?? 30
  const clamped = Math.max(0, Math.min(seconds, maxSeconds))

  // Pauses sandbox execution for the specified duration
  // Does NOT pause the LLM stream — only the sandbox
  // Does NOT inject a user message
  // Async tasks continue running during sleep
  await new Promise<void>(resolve => setTimeout(resolve, clamped * 1000))

  // Returns void
}
```

**Key behaviors:**
- Capped at `sleepMaxSeconds` (default: 30) — values above the cap are silently clamped
- Does **not** pause the LLM stream — only sandbox execution is suspended
- Does **not** inject a user message — the conversation is unaffected
- Async tasks and `completeTaskAsync` background functions continue running during sleep
- Returns `void` — the agent simply resumes execution after the delay

---

### Incomplete Tasklist Reminder

When the LLM emits a stop token (stream completion) and there are still incomplete tasks in any tasklist, the host **does not** end the session. Instead:

1. Iterate all tasklists and find the first with incomplete required tasks
2. Skip tasklists where all remaining incomplete tasks are optional
3. Wait for any running async tasks before nudging (with timeout)
4. Build a DAG-aware reminder message listing ready, blocked, and failed tasks
5. Inject as a user message with `⚠ [system]` prefix and a `{{TASKS}}` block
6. Resume LLM generation

```ts
function onStreamComplete() {
  for (const [tasklistId, tasklist] of tasklistsState.tasklists) {
    const hasIncomplete = tasklist.plan.tasks.some(t => {
      const completion = tasklist.completed.get(t.id)
      return !completion || (completion.status !== 'completed' && completion.status !== 'skipped')
    })

    // Skip if all remaining tasks are optional
    const hasRequiredIncomplete = tasklist.plan.tasks.some(t => {
      const completion = tasklist.completed.get(t.id)
      const isIncomplete = !completion || (completion.status !== 'completed' && completion.status !== 'skipped')
      return isIncomplete && !t.optional
    })
    if (!hasRequiredIncomplete) continue

    // Wait for running async tasks before nudging
    if (tasklist.runningTasks.size > 0) {
      await Promise.race([
        waitForRunningTasks(tasklist),
        timeout(config.taskAsyncTimeout)
      ])
    }

    const ready = [...tasklist.readyTasks].join(', ')
    const blocked = tasklist.plan.tasks
      .filter(t => !tasklist.readyTasks.has(t.id) && !tasklist.completed.has(t.id) && !tasklist.runningTasks.has(t.id))
      .map(t => `${t.id} (waiting on ${t.dependsOn?.join(', ')})`)
      .join(', ')
    const failed = [...tasklist.completed.entries()]
      .filter(([_, c]) => c.status === 'failed')
      .map(([id]) => id)
      .join(', ')

    // Build tasks block
    const tasksBlock = generateTasksBlock(tasklistsState)

    let msg = `⚠ [system] Tasklist "${tasklistId}" incomplete.`
    if (ready) msg += ` Ready: ${ready}.`
    if (blocked) msg += ` Blocked: ${blocked}.`
    if (failed) msg += ` Failed: ${failed}.`
    msg += ` Continue with a ready task.`
    if (tasksBlock) msg += `\n\n${tasksBlock}`

    streamController.pause()
    streamController.injectUserMessage(msg)
    streamController.resume()
    return  // handle one tasklist per reminder cycle
  }
  // All tasklists complete — normal completion
}
```

The host should limit the number of reminder cycles (default: 3) to avoid infinite loops. If the agent fails to complete after max retries, the session ends with a warning to the user.
