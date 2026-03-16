## Session Data Model (Frontend)

```ts
interface Session {
  id: string
  status: 'executing' | 'waiting_for_input' | 'paused' | 'complete' | 'error'
  blocks: Block[]
  activeFormId: string | null
  asyncTasks: AsyncTask[]
  contextBudget: ContextBudget
}

type Block =
  | { type: 'code'; id: string; lines: string[]; streaming: boolean; compression: 'none' | 'summarized'; declaredVars?: string[]; timestamp: number }
  | { type: 'read'; id: string; payload: Record<string, any>; fullPayload: Record<string, any>; compression: 'none' | 'keys_only' | 'summary' | 'removed'; timestamp: number }
  | { type: 'error'; id: string; errorType: string; message: string; source?: string; line?: number; recovered: boolean; attempts: number; compression: 'none' | 'summary' | 'removed'; timestamp: number }
  | { type: 'hook'; id: string; hookId: string; hookLabel: string; action: 'continue' | 'side_effect' | 'transform' | 'interrupt' | 'skip'; matchedSource: string; matchedLine: number; message?: string; timestamp: number }
  | { type: 'display'; id: string; component: React.ReactElement; timestamp: number }
  | { type: 'form'; id: string; component: React.ReactElement; status: 'active' | 'submitted' | 'timeout'; values?: Record<string, any>; timestamp: number }
  | { type: 'user_intervention'; id: string; message: string; timestamp: number }
  | { type: 'status'; id: string; text: string; timestamp: number }

interface AsyncTask {
  id: string               // e.g., "async_0"
  label: string            // human-readable label
  status: 'running' | 'completed' | 'cancelled' | 'failed'
  startedAt: number
  completedAt?: number
  result?: any             // truncated result on completion
  error?: string           // error message on failure
  cancelMessage?: string   // user's cancel message
}

interface ContextBudget {
  usedTokens: number
  maxTokens: number
  percentage: number       // 0-100
  breakdown: {
    systemPrompt: number
    code: number
    reads: number
    scope: number
    other: number
  }
}
```

The `blocks` array is append-only during a session. The renderer walks it top-to-bottom. Code blocks are the only block type that can be in a "streaming" state (actively receiving lines). The `asyncTasks` array drives the sidebar.

**Compression fields:** Each code, read, and error block tracks its compression state. The UI stores the **full original data** in the block (e.g., `fullPayload` for reads) even when the agent's context has been compressed. This means the user can always review the complete history — the `compression` field just controls the visual styling (dimmed, labeled, non-expandable for summarized blocks). The context budget is updated by the host on every injection and pushed to the frontend.

---

## Protocol Impact — Updates to Runtime Contract

This UX specification introduces requirements that affect the host runtime:

### User intervention injection

When the user sends a message mid-execution (or while paused), the host must:

1. Pause the LLM stream (if not already paused).
2. Finalize the agent's code so far as `{ role: 'assistant', content: codeUpToPausePoint }`.
3. Append `{ role: 'user', content: userMessage }` (the raw text the user typed — no `←` prefix).
4. Update `{{SCOPE}}` in the system prompt.
5. Resume LLM generation.

The agent sees the user's message as a normal conversational turn and adjusts accordingly.

### Async task cancellation

When the user cancels an async task, the host must:

1. Abort the running task (terminate the promise / kill the function execution).
2. Store the cancellation result: `{ cancelled: true, message: "user's message" }`.
3. Deliver this in `asyncResults` on the next `stop` call, in place of the task's normal resolved value.

### Developer hook events

When hooks fire during execution, the host must push hook events to the frontend so they can be rendered as hook blocks:

1. After every hook fires, emit a `HookEvent` to the frontend with the hook ID, label, action type, matched source line, and any message.
2. For `interrupt` hooks, the host pauses the stream and injects the interrupt message as a `role: 'user'` message (prefixed with `⚠ [hook:${hookId}]`). The UI shows both the hook block and the agent's response to the interrupt.
3. For `skip` and `transform` hooks, the UI shows the hook block at the point in the flow where the hook altered execution. The agent is **not** aware of skips or transforms — only the user sees them.
4. For `side_effect` and `continue` hooks, the UI shows a minimal hook block. These are informational — no execution was altered.

### Distinguishing user messages

The agent now receives two types of user messages:

1. **Protocol injections:** `← stop { ... }` and `← error [Type] ...` — prefixed with `←`.
2. **Human messages:** The original request and any mid-execution interventions — no prefix.

The agent already handles both: the system prompt instructs it to respond to `← stop/error` by continuing code, and to respond to human messages by adjusting its approach. No system prompt changes are needed — the existing instruction "output only valid TypeScript" still applies, and the agent can use `//` comments to acknowledge the user's intervention before continuing.

---

## Summary: The User's Mental Model

From the user's perspective:

1. **I ask a question.** I type into the chat and hit send.
2. **The agent starts working.** I see collapsed code blocks ticking up as it writes code. A subtle indicator shows it's active.
3. **Results appear.** Components materialize — a list, a chart, a card. I can see the agent building an answer in real time.
4. **I can peek under the hood.** Expanding a code block shows me what the agent wrote. Expanding a read block shows me what it inspected. Errors show me what went wrong and whether it recovered.
5. **Sometimes the agent needs my input.** A form appears. I fill it in and submit.
6. **I can intervene anytime.** If I don't like where things are going, I type a message and send it. The agent sees my message and adjusts. I can also pause, or cancel background tasks from the sidebar.
7. **Background work happens in the sidebar.** I can see slow tasks running, check their progress, and cancel them with an explanation.
8. **It's done.** The indicator disappears. Everything is scrollable history. I can review every step the agent took, every value it read, every error it hit.

The process is transparent. The results are prominent. The user is in charge.
