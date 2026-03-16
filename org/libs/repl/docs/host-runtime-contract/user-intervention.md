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
