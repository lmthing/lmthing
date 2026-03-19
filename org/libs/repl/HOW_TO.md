# REPL — How To Guide

A streaming TypeScript REPL where an LLM agent writes code that executes line-by-line as tokens arrive. The agent communicates exclusively through TypeScript — no prose — using 12 injected globals to read values, render UI, collect input, manage tasks, and load knowledge.

---

## How It Works

```
User message → LLM generates TypeScript → each line executes as it arrives → results render in real time
```

Token-by-token accumulation happens in [`src/stream/line-accumulator.ts:27`](src/stream/line-accumulator.ts) (`feed()`), which buffers tokens and detects complete statements using bracket depth tracking ([`src/stream/bracket-tracker.ts:27`](src/stream/bracket-tracker.ts) `feedChunk()`, [`src/stream/bracket-tracker.ts:97`](src/stream/bracket-tracker.ts) `isBalanced()`). Each complete statement is executed via [`src/sandbox/executor.ts:10`](src/sandbox/executor.ts) (`executeLine()`), which transpiles TypeScript to JavaScript and runs it in a persistent `vm.Context` ([`src/sandbox/sandbox.ts:72`](src/sandbox/sandbox.ts) `vm.createContext()`).

The agent never sees its own runtime values directly. It must call `stop()` to pause execution and have values injected back into the conversation as a user message ([`src/sandbox/globals.ts:72`](src/sandbox/globals.ts) `stopFn()`). This is the core loop: **write code → stop to read → write more code**.

The system prompt contains a live `{{SCOPE}}` table showing all variables and their current values ([`src/context/scope-generator.ts:11`](src/context/scope-generator.ts) `generateScopeTable()`). This is the agent's primary source of truth — updated on every turn boundary ([`src/session/session.ts:203`](src/session/session.ts) emitting `scope` event) and the last thing to be compressed under token pressure.

---

## The 12 Globals

All 12 globals are created in [`src/sandbox/globals.ts:45`](src/sandbox/globals.ts) (`createGlobals()`) and injected into the sandbox at [`src/session/session.ts:168-180`](src/session/session.ts).

### `await stop(...values)` — Read runtime values

The agent's only way to inspect values. Pauses execution, serializes arguments, and injects them as a `← stop { ... }` user message. The agent then resumes with knowledge of those values.

**Implementation:** [`src/sandbox/globals.ts:72-106`](src/sandbox/globals.ts) — `stopFn()` recovers argument names via [`src/parser/ast-utils.ts:63`](src/parser/ast-utils.ts) (`recoverArgumentNames()`), serializes values via [`src/stream/serializer.ts:19`](src/stream/serializer.ts) (`serialize()`), merges async task results from [`src/sandbox/async-manager.ts:123`](src/sandbox/async-manager.ts) (`buildStopPayload()`), then pauses the stream via `pauseController.pause()`. The stop message is formatted at [`src/context/message-builder.ts:7`](src/context/message-builder.ts) (`buildStopMessage()`).

```ts
const data = await fetchData()
await stop(data.length)
// [user] ← stop { "data.length": 42 }
// Agent now knows data has 42 items
```

**When to use:** Before any branching decision that depends on a runtime value not already visible in `{{SCOPE}}` or a recent stop message.

### `display(jsx)` — Show UI to the user

Non-blocking. Renders a React component inline with execution. Call it as many times as needed.

**Implementation:** [`src/sandbox/globals.ts:122-126`](src/sandbox/globals.ts) — `displayFn()` generates a unique ID and calls `renderSurface.append()`. The session wires this to emit a `display` event with serialized JSX at [`src/session/session.ts:91-93`](src/session/session.ts). JSX serialization happens in [`src/session/session.ts:456-507`](src/session/session.ts) (`serializeReactElement()`), with client-side form components (`TextInput`, `Select`, etc.) listed at [`src/session/session.ts:451-454`](src/session/session.ts).

```ts
display(<Chart data={results} />)
// execution continues immediately
```

**When to use:** To show results, progress indicators, visualizations, or any user-facing output.

### `await ask(jsx)` — Collect user input

Blocking. Renders a `<form>` and waits for submission. The form data is assigned to the variable but the agent **cannot see it** until it calls `stop()`.

**Implementation:** [`src/sandbox/globals.ts:131-148`](src/sandbox/globals.ts) — `askFn()` pauses the stream, calls `renderSurface.renderForm()`, and races against a timeout ([`src/sandbox/globals.ts:50`](src/sandbox/globals.ts) default 300,000 ms = 5 min). On timeout, resolves with `{ _timeout: true }` ([`src/sandbox/globals.ts:140`](src/sandbox/globals.ts)). The form is wired through the session's EventEmitter at [`src/session/session.ts:94-104`](src/session/session.ts). Cancellation resolves with `{ _cancelled: true }` at [`src/session/session.ts:105-108`](src/session/session.ts). The `AskCancellation` type is defined at [`src/session/types.ts:28-30`](src/session/types.ts).

```ts
const input = await ask(
  <form>
    <TextInput name="city" label="City" />
    <NumberInput name="radius" label="Radius (km)" defaultValue={10} />
  </form>
)
await stop(input)
// [user] ← stop { input: { "city": "Tokyo", "radius": 25 } }
```

**Rule:** Always follow `ask` with `stop`. No exceptions.

**Form components:** `TextInput`, `TextArea`, `NumberInput`, `Slider`, `Checkbox`, `Select`, `MultiSelect`, `DatePicker`, `FileUpload`. Each must have a `name` attribute. Implemented in [`src/components/form/`](src/components/form/) — one file per component. Form validation happens in [`src/security/jsx-sanitizer.ts:80-112`](src/security/jsx-sanitizer.ts) (`validateFormComponents()`).

**Timeout:** If the user doesn't submit within 5 minutes, resolves with `{ _timeout: true }`.

**Cancellation:** If the user sends a message while a form is active, resolves with `{ _cancelled: true }`.

### `async(fn)` — Background task

Fire-and-forget. The function runs concurrently. Its results are queued and delivered the next time the agent calls `stop()`, keyed as `async_0`, `async_1`, etc.

**Implementation:** [`src/sandbox/globals.ts:153-160`](src/sandbox/globals.ts) — `asyncFn()` registers the task via [`src/sandbox/async-manager.ts:28-67`](src/sandbox/async-manager.ts) (`register()`), which creates an `AbortController` and assigns an incrementing `async_N` ID ([`src/sandbox/async-manager.ts:36`](src/sandbox/async-manager.ts)). Pending tasks show `"pending"` in stop payloads ([`src/sandbox/async-manager.ts:131`](src/sandbox/async-manager.ts)). Cancellation sets `{ cancelled: true, message }` at [`src/sandbox/async-manager.ts:72-79`](src/sandbox/async-manager.ts). The `AsyncCancellation` type is at [`src/session/types.ts:23-26`](src/session/types.ts). Max concurrent tasks enforced at [`src/sandbox/async-manager.ts:32-34`](src/sandbox/async-manager.ts).

```ts
async(() => {
  const report = await generateReport(data)
  await stop(report)
})
// continue other work...
await stop(summary)
// [user] ← stop { summary: <value>, async_0: <report> }
```

**When to use:** For slow operations that can run in parallel with continued work. If the task hasn't finished when `stop` is called, its slot shows `"pending"`.

Users can cancel async tasks from the UI sidebar. Cancelled tasks appear as `{ cancelled: true, message: "..." }` in the next stop payload.

### `tasklist(tasklistId, description, tasks)` — Declare a plan

Non-blocking. Registers a set of milestones before implementation begins. Every task needs `id`, `instructions`, and `outputSchema`. Renders a progress indicator to the user.

**Implementation:** [`src/sandbox/globals.ts:166-262`](src/sandbox/globals.ts) — `tasklistFn()` validates task structure ([`src/sandbox/globals.ts:183-191`](src/sandbox/globals.ts)), checks max tasks per tasklist ([`src/sandbox/globals.ts:177-179`](src/sandbox/globals.ts), default 20), validates `dependsOn` references ([`src/sandbox/globals.ts:194-205`](src/sandbox/globals.ts)), synthesizes implicit sequential deps when no `dependsOn` is present ([`src/sandbox/globals.ts:211-215`](src/sandbox/globals.ts)), performs DAG cycle detection via topological sort ([`src/sandbox/globals.ts:217-239`](src/sandbox/globals.ts)), and computes initial ready tasks ([`src/sandbox/globals.ts:242-247`](src/sandbox/globals.ts)). State is stored in `TasklistsState` ([`src/session/types.ts:77-79`](src/session/types.ts)) using `TasklistState` ([`src/session/types.ts:67-75`](src/session/types.ts)). The `TaskDefinition` type is at [`src/session/types.ts:42-49`](src/session/types.ts).

```ts
tasklist("search", "Find and present restaurants", [
  { id: "gather", instructions: "Ask for preferences", outputSchema: { query: { type: "string" } } },
  { id: "search", instructions: "Search restaurants", outputSchema: { count: { type: "number" } } },
  { id: "present", instructions: "Show results", outputSchema: { done: { type: "boolean" } } }
])
```

**Sequential vs DAG:** Without `dependsOn`, tasks are implicitly sequential ([`src/sandbox/globals.ts:211-215`](src/sandbox/globals.ts)). With `dependsOn`, tasks form a DAG — multiple tasks can be ready simultaneously ([`src/sandbox/globals.ts:329-363`](src/sandbox/globals.ts) `recomputeReadyTasks()`).

```ts
tasklist("report", "Build market report", [
  { id: "scope", dependsOn: [], instructions: "Define scope", outputSchema: { ... } },
  { id: "data", dependsOn: ["scope"], instructions: "Fetch data", outputSchema: { ... } },
  { id: "competitors", dependsOn: ["scope"], instructions: "Analyze competitors", outputSchema: { ... } },
  { id: "compile", dependsOn: ["data", "competitors"], instructions: "Write report", outputSchema: { ... } }
])
// After "scope" completes, both "data" and "competitors" become ready in parallel
```

**Optional fields per task:**
- `dependsOn: string[]` — task IDs that must complete first ([`src/session/types.ts:47`](src/session/types.ts))
- `condition: string` — JS expression; auto-skipped if falsy (e.g., `"fetch.count > 0"`) — evaluated at [`src/sandbox/globals.ts:365-375`](src/sandbox/globals.ts) (`evaluateCondition()`), auto-skip at [`src/sandbox/globals.ts:345-358`](src/sandbox/globals.ts)
- `optional: boolean` — failure doesn't block dependents ([`src/session/types.ts:48`](src/session/types.ts)), checked at [`src/sandbox/globals.ts:340`](src/sandbox/globals.ts) and [`src/sandbox/globals.ts:461`](src/sandbox/globals.ts)

Multiple tasklists per session are supported (different `tasklistId` values) — stored in a `Map<string, TasklistState>` at [`src/sandbox/globals.ts:54-56`](src/sandbox/globals.ts).

### `completeTask(tasklistId, taskId, output)` — Mark task done

Non-blocking. Output must match the declared `outputSchema`. The task must be in the ready set.

**Implementation:** [`src/sandbox/globals.ts:267-327`](src/sandbox/globals.ts) — `completeTaskFn()` validates the task is in the ready set ([`src/sandbox/globals.ts:283-296`](src/sandbox/globals.ts)), validates output against the declared schema ([`src/sandbox/globals.ts:299-311`](src/sandbox/globals.ts)), records the completion ([`src/sandbox/globals.ts:314-320`](src/sandbox/globals.ts)), and recomputes ready tasks ([`src/sandbox/globals.ts:323`](src/sandbox/globals.ts)).

```ts
completeTask("search", "gather", { query: "Italian restaurants in 94107" })
```

**If the agent's stream ends with incomplete tasks**, the host injects a `⚠ [system] Tasklist incomplete...` reminder ([`src/context/message-builder.ts:42-54`](src/context/message-builder.ts) `buildTasklistReminderMessage()`) and resumes generation (up to 3 times — [`src/session/session.ts:264`](src/session/session.ts), default from [`src/session/config.ts:46`](src/session/config.ts) `maxTasklistReminders: 3`).

### `completeTaskAsync(tasklistId, taskId, fn)` — Complete task in background

Non-blocking. Moves the task to running state and spawns the function. The return value becomes the task output. Results delivered via the next `stop()` call as `task:<taskId>`.

**Implementation:** [`src/sandbox/globals.ts:381-470`](src/sandbox/globals.ts) — `completeTaskAsyncFn()` moves the task from ready to running ([`src/sandbox/globals.ts:405-406`](src/sandbox/globals.ts)), spawns the async work ([`src/sandbox/globals.ts:412`](src/sandbox/globals.ts)), validates output on completion ([`src/sandbox/globals.ts:415-427`](src/sandbox/globals.ts)), stores results for delivery via `asyncManager.setResult()` with `task:<taskId>` keys ([`src/sandbox/globals.ts:440`](src/sandbox/globals.ts)). On throw, the task is marked failed ([`src/sandbox/globals.ts:446-467`](src/sandbox/globals.ts)), and if optional, dependents are unblocked ([`src/sandbox/globals.ts:461-463`](src/sandbox/globals.ts)).

```ts
completeTaskAsync("report", "data", async () => {
  const d = await fetchMarketData("fintech")
  return { marketSize: d.size, growth: d.rate }
})
// later...
await stop()
// [user] ← stop { "task:data": { marketSize: 245, growth: 12.3 } }
```

If the function throws, the task is marked failed.

### `taskProgress(tasklistId, taskId, message, percent?)` — Report progress

Non-blocking, synchronous. Updates the UI progress indicator for a running task.

**Implementation:** [`src/sandbox/globals.ts:475-498`](src/sandbox/globals.ts) — `taskProgressFn()` validates the task is in ready or running state ([`src/sandbox/globals.ts:491-493`](src/sandbox/globals.ts)), stores the progress message ([`src/sandbox/globals.ts:495`](src/sandbox/globals.ts)), and updates the render surface ([`src/sandbox/globals.ts:496`](src/sandbox/globals.ts)). Progress is displayed in the `{{TASKS}}` block at [`src/context/message-builder.ts:94-98`](src/context/message-builder.ts).

```ts
taskProgress("report", "data", "Fetching growth trends...", 50)
```

### `failTask(tasklistId, taskId, error)` — Mark task failed

Non-blocking. If the task is `optional`, dependents are unblocked. Otherwise, dependents stay blocked.

**Implementation:** [`src/sandbox/globals.ts:503-535`](src/sandbox/globals.ts) — `failTaskFn()` validates the task is in ready or running state ([`src/sandbox/globals.ts:515-517`](src/sandbox/globals.ts)), records the failure ([`src/sandbox/globals.ts:521-526`](src/sandbox/globals.ts)), and if the task is optional, unblocks dependents via `recomputeReadyTasks()` ([`src/sandbox/globals.ts:529-531`](src/sandbox/globals.ts)).

```ts
failTask("report", "sentiment", "API rate limited")
```

### `retryTask(tasklistId, taskId)` — Retry a failed task

Non-blocking. Resets a failed task to ready. Max 3 retries per task (configurable).

**Implementation:** [`src/sandbox/globals.ts:540-570`](src/sandbox/globals.ts) — `retryTaskFn()` checks the task status is `failed` ([`src/sandbox/globals.ts:552-553`](src/sandbox/globals.ts)), enforces max retries ([`src/sandbox/globals.ts:556-560`](src/sandbox/globals.ts), default 3 from [`src/session/config.ts:44`](src/session/config.ts)), increments retry count ([`src/sandbox/globals.ts:562`](src/sandbox/globals.ts)), and resets the task to ready ([`src/sandbox/globals.ts:563-566`](src/sandbox/globals.ts)).

```ts
retryTask("report", "sentiment")
```

### `await sleep(seconds)` — Pause sandbox

Pauses sandbox execution (max 30s). The LLM stream and async tasks continue during sleep. Does **not** inject a message — call `stop()` after to read results.

**Implementation:** [`src/sandbox/globals.ts:575-579`](src/sandbox/globals.ts) — `sleepFn()` caps the duration at `sleepMaxSeconds` (default 30, from [`src/session/config.ts:47`](src/session/config.ts)) and uses `setTimeout` via a Promise.

```ts
completeTaskAsync("report", "data", async () => { ... })
await sleep(5)
await stop()  // read background results
```

### `loadKnowledge(selector)` — Load knowledge files

Synchronous (no `await`). Loads markdown from the space's knowledge base. The selector mirrors the knowledge tree. Returns the same structure with markdown content.

**Implementation:** [`src/sandbox/globals.ts:586-594`](src/sandbox/globals.ts) — `loadKnowledgeFn()` validates the selector, delegates to the configured `onLoadKnowledge` callback, and tags the result via [`src/context/knowledge-decay.ts:62-69`](src/context/knowledge-decay.ts) (`tagAsKnowledge()`). The `KnowledgeSelector` type is at [`src/knowledge/types.ts:59`](src/knowledge/types.ts). The knowledge tree structure is defined at [`src/knowledge/types.ts:40-44`](src/knowledge/types.ts) (`KnowledgeTree`).

```ts
var docs = loadKnowledge({
  "chat-modes": { "mode": { "casual": true } }
})
// docs["chat-modes"]["mode"]["casual"] → "# Casual Mode\n\n..."
await stop(docs)  // must stop to read the content
```

**When to use:** Before domain-specific work, when a Knowledge Tree is available in the system prompt. Load only what's needed. Knowledge content decays faster than other values in context — reload if needed after several turns.

---

## Conversation Protocol

Five types of user messages can appear:

| Format | Meaning | Agent response | Implementation |
|--------|---------|----------------|----------------|
| `← stop { ... }` | Values from `stop()` call | Continue writing code using those values | [`src/context/message-builder.ts:7-12`](src/context/message-builder.ts) `buildStopMessage()` |
| `← error [Type] ...` | Runtime error occurred | Write corrective code (don't redeclare existing `const`s) | [`src/context/message-builder.ts:18-20`](src/context/message-builder.ts) `buildErrorMessage()` |
| Plain text (no prefix) | User intervention | Acknowledge with `//` comment, adjust approach | [`src/context/message-builder.ts:26-28`](src/context/message-builder.ts) `buildInterventionMessage()` |
| `⚠ [hook:id] ...` | Developer hook intercepted code | Comply with the hook's instruction | [`src/context/message-builder.ts:34-36`](src/context/message-builder.ts) `buildHookInterruptMessage()` |
| `⚠ [system] Tasklist incomplete...` | Stream ended with unfinished tasks | Continue from where you left off | [`src/context/message-builder.ts:42-54`](src/context/message-builder.ts) `buildTasklistReminderMessage()` |

Turn boundaries are created by `stop`, `error`, user interventions, and hook interrupts. `ask` resumes silently — the assistant turn continues unbroken ([`src/sandbox/globals.ts:145-147`](src/sandbox/globals.ts) — `askFn` resumes via `pauseController.resume()` in the `finally` block).

### `{{TASKS}}` Block

Appended to every `stop()` message when tasklists exist ([`src/session/session.ts:191-193`](src/session/session.ts)). Shows the DAG state. Generated by [`src/context/message-builder.ts:68-115`](src/context/message-builder.ts) (`generateTasksBlock()`).

```
{{TASKS}}
┌ report ──────────────────────────────────────────────────────┐
│ ✓ scope              → { industry: "fintech", region: "EU" }│
│ ◉ data               (running — Fetching... 50%)            │
│ ✓ competitors        → { competitors: ["Stripe","Adyen"] }  │
│ ✗ sentiment          — API rate limited                      │
│ ○ compile            (blocked — waiting on: data)            │
└──────────────────────────────────────────────────────────────┘
```

| Symbol | State | Action | Code reference |
|--------|-------|--------|----------------|
| `✓` | completed | Done — don't rework | [`src/context/message-builder.ts:82-86`](src/context/message-builder.ts) |
| `✗` | failed | `retryTask` or `failTask` | [`src/context/message-builder.ts:87-89`](src/context/message-builder.ts) |
| `⊘` | skipped | Condition was false — ignore | [`src/context/message-builder.ts:90-92`](src/context/message-builder.ts) |
| `◉` | running | Background task in progress — `sleep` + `stop` to check | [`src/context/message-builder.ts:93-98`](src/context/message-builder.ts) |
| `◎` | ready | Work on these next | [`src/context/message-builder.ts:99-101`](src/context/message-builder.ts) |
| `○` | pending | Blocked on dependencies | [`src/context/message-builder.ts:102-106`](src/context/message-builder.ts) |

---

## Context Management

The host manages context size automatically via the `AgentLoop` orchestrator ([`src/cli/agent-loop.ts:57`](src/cli/agent-loop.ts)). On every turn boundary, `refreshSystemPrompt()` ([`src/cli/agent-loop.ts:656-673`](src/cli/agent-loop.ts)) rebuilds the system prompt with a fresh SCOPE table and applies progressive decay to older messages. Be aware of what gets compressed:

### `{{SCOPE}}` — Variable State Table

The agent's primary source of truth. **Replaced in full** on every turn boundary by `refreshSystemPrompt()` → `session.getScopeTable()` ([`src/session/session.ts:418-423`](src/session/session.ts)) → `generateScopeTable()` ([`src/context/scope-generator.ts:11-39`](src/context/scope-generator.ts)). The table is injected into the system prompt at the `## Workspace — Current Scope` slot ([`src/cli/buildSystemPrompt.ts:156-157`](src/cli/buildSystemPrompt.ts)). The system prompt itself is always `messages[0]` and is overwritten each turn ([`src/cli/agent-loop.ts:668`](src/cli/agent-loop.ts)).

**How SCOPE is generated:** `Sandbox.getScope()` ([`src/sandbox/sandbox.ts:124-139`](src/sandbox/sandbox.ts)) iterates all declared variable names and for each variable calls `describeType()` ([`src/sandbox/sandbox.ts:165-179`](src/sandbox/sandbox.ts)) and `truncateValue()` ([`src/sandbox/sandbox.ts:181-209`](src/sandbox/sandbox.ts)). The resulting `ScopeEntry[]` ([`src/session/types.ts:83-87`](src/session/types.ts)) is then formatted by `generateScopeTable()` into a padded table string.

**SCOPE compression — default limits** (always applied). Configured in [`src/session/config.ts:55-59`](src/session/config.ts), enforced in [`src/context/scope-generator.ts:11-39`](src/context/scope-generator.ts) and [`src/sandbox/sandbox.ts:181-209`](src/sandbox/sandbox.ts):

| Constraint | Default | Where configured | Where enforced |
|------------|---------|-----------------|----------------|
| Max variables shown | 50 (most recent first if over limit) | [`src/session/config.ts:56`](src/session/config.ts) `maxScopeVariables: 50` | [`src/context/scope-generator.ts:13`](src/context/scope-generator.ts) — `entries.slice(0, maxVariables)` |
| Max value column width | 50 characters | [`src/session/config.ts:57`](src/session/config.ts) `maxScopeValueWidth: 50` | [`src/context/scope-generator.ts:26-28`](src/context/scope-generator.ts) — value truncated to `maxValueWidth` chars |
| Array element preview | First 3 elements, then `... +N more` | Hardcoded in `truncateValue()` | [`src/sandbox/sandbox.ts:192-193`](src/sandbox/sandbox.ts) — `val.slice(0, 3)` then `... +${val.length - 3}` |
| Object key preview | First 5 keys, then `... +N more` | Hardcoded in `truncateValue()` | [`src/sandbox/sandbox.ts:195-197`](src/sandbox/sandbox.ts) — `keys.slice(0, 5)` then `... +${keys.length - 5}` |
| Per-value string length | 50 characters (in scope table) | Hardcoded in `truncateValue()` | [`src/sandbox/sandbox.ts:202-204`](src/sandbox/sandbox.ts) — `str.slice(0, maxLen - 3) + '...'` |
| Total scope block size | ~3,000 tokens | [`src/session/config.ts:58`](src/session/config.ts) `maxScopeTokens: 3_000` | Passed to `getScopeTable()` at [`src/session/session.ts:418-423`](src/session/session.ts) |

**SCOPE overflow handling:** When variables exceed `maxScopeVariables` (50), the oldest are dropped ([`src/context/scope-generator.ts:13`](src/context/scope-generator.ts) — `entries.slice(0, maxVariables)`) with a count footer ([`src/context/scope-generator.ts:34-36`](src/context/scope-generator.ts) — `... +N more variables`). When the overall context still exceeds `maxContextTokens` ([`src/session/config.ts:48`](src/session/config.ts) default 100,000) after code window and stop decay are applied, the host applies aggressive SCOPE compression:

1. `maxScopeValueWidth` is reduced from 50 to 30 characters ([`src/session/config.ts:57`](src/session/config.ts), passed to `generateScopeTable` via [`src/session/session.ts:421`](src/session/session.ts))
2. If still over budget, function/component signatures in the system prompt are collapsed to names and return types only (collapsed format in [`src/cli/loader.ts`](src/cli/loader.ts) via `formatCollapsedClass()` called at [`src/cli/agent-loop.ts:650`](src/cli/agent-loop.ts))

SCOPE is the **last** thing compressed — code and stop payloads are always evicted first.

### Code Window Compression

Sliding window of 200 lines ([`src/session/config.ts:61`](src/session/config.ts) `codeWindowLines: 200`). Older code is replaced with summaries by [`src/context/code-window.ts:11-46`](src/context/code-window.ts) (`compressCodeWindow()`). The algorithm works backwards from the most recent turn, keeping turns verbatim while they fit within `maxLines` ([`src/context/code-window.ts:29-33`](src/context/code-window.ts)), then summarizing older turns:
```
// [lines 1-12 executed] declared: input (Object), restaurants (Array<Object>)
```
Summary format built at [`src/context/code-window.ts:51-60`](src/context/code-window.ts) (`buildSummaryComment()`). Declarations are extracted from each turn via [`src/parser/ast-utils.ts:23-40`](src/parser/ast-utils.ts) (`extractDeclarations()`), which handles `const`/`let`/`var`, function declarations, class declarations, and destructuring patterns.

### Stop Payload Decay

Values fade over distance from the current turn. The decay tier is determined by [`src/context/stop-decay.ts:16-21`](src/context/stop-decay.ts) (`getDecayLevel()`). Default tier thresholds are configured at [`src/session/config.ts:62-66`](src/session/config.ts) (`stopDecayTiers: { full: 2, keysOnly: 5, summary: 10 }`). The `decayStopPayload()` function at [`src/context/stop-decay.ts:26-43`](src/context/stop-decay.ts) dispatches to four formatters:

| Distance | Treatment | Token cost | Code reference |
|----------|-----------|------------|----------------|
| 0-2 turns (`≤ full`) | Full payload: all keys with serialized values | High | [`src/context/stop-decay.ts:45-48`](src/context/stop-decay.ts) `formatFullPayload()` — `← stop { key: <serialized value>, ... }` |
| 3-5 turns (`≤ keysOnly`) | Keys and types only: values stripped | Medium | [`src/context/stop-decay.ts:50-56`](src/context/stop-decay.ts) `formatKeysPayload()` — `← stop { key: Array(5), ... }`. Type described by `describeValueType()` at [`src/context/stop-decay.ts:63-73`](src/context/stop-decay.ts) |
| 6-10 turns (`≤ summary`) | Count only: just number of values | Minimal | [`src/context/stop-decay.ts:58-61`](src/context/stop-decay.ts) `formatCountPayload()` — `← stop (N values read)` |
| 11+ turns (`> summary`) | Removed entirely | Zero | [`src/context/stop-decay.ts:41`](src/context/stop-decay.ts) returns `null` |

The UI-side block state mirror of these tiers is at [`src/components/shared/block-state.ts:25-37`](src/components/shared/block-state.ts) (`applyDecay()`), which maps the same distance thresholds to `BlockDecayState` (`'full' | 'keys' | 'count' | 'removed'`).

### Error Decay

Same tiers as stop payloads. Implemented at [`src/context/stop-decay.ts:78-87`](src/context/stop-decay.ts) (`decayErrorMessage()`):

| Distance | Treatment | Code reference |
|----------|-----------|----------------|
| 0-5 turns (`≤ keysOnly`) | Full error: `← error [Type] message (line N)` | [`src/context/stop-decay.ts:86`](src/context/stop-decay.ts) — returns original |
| 6-10 turns (`= count`) | Compressed: `← error (1 error occurred)` | [`src/context/stop-decay.ts:85`](src/context/stop-decay.ts) |
| 11+ turns (`= removed`) | Removed entirely | [`src/context/stop-decay.ts:84`](src/context/stop-decay.ts) — returns `null` |

### `{{TASKS}}` Decay

Separate from stop decay:

| Distance | Treatment |
|----------|-----------|
| 0-2 turns | Full table with outputs |
| 3-5 turns | Status symbols + task names only |
| 6+ turns | Removed |

### Knowledge Decay

Faster than stop values because knowledge content is large (full markdown). The `AgentLoop` tracks which stop messages contain knowledge content ([`src/cli/agent-loop.ts:78-85`](src/cli/agent-loop.ts) `knowledgeStops` array) by detecting the `KNOWLEDGE_TAG` symbol via [`src/context/knowledge-decay.ts:51-57`](src/context/knowledge-decay.ts) (`isKnowledgeContent()`). On every `refreshSystemPrompt()` call, `decayKnowledgeMessages()` ([`src/cli/agent-loop.ts:679-698`](src/cli/agent-loop.ts)) iterates all tracked knowledge stops, computes distance from the current turn ([`src/cli/agent-loop.ts:681`](src/cli/agent-loop.ts)), and **rewrites the actual message in `this.messages[]`** with decayed content ([`src/cli/agent-loop.ts:693-696`](src/cli/agent-loop.ts)).

The decay level is determined by [`src/context/knowledge-decay.ts:38-46`](src/context/knowledge-decay.ts) (`getKnowledgeDecayLevel()`). Default tier thresholds at [`src/context/knowledge-decay.ts:30-34`](src/context/knowledge-decay.ts) (`{ full: 0, truncated: 2, headers: 4 }`). The `decayKnowledgeValue()` function at [`src/context/knowledge-decay.ts:74-91`](src/context/knowledge-decay.ts) dispatches to four formatters:

| Distance | Treatment | Token cost | Code reference |
|----------|-----------|------------|----------------|
| Same turn (`= 0`) | Full markdown content | Very high | [`src/context/knowledge-decay.ts:95-97`](src/context/knowledge-decay.ts) `formatFull()` — complete markdown, JSON-escaped |
| 1-2 turns (`≤ truncated = 2`) | Truncated to ~300 chars per file | Medium | [`src/context/knowledge-decay.ts:101-106`](src/context/knowledge-decay.ts) `formatTruncated()` — `md.slice(0, 300) + "...(truncated, N chars)"` |
| 3-4 turns (`≤ headers = 4`) | Headings only | Low | [`src/context/knowledge-decay.ts:110-118`](src/context/knowledge-decay.ts) `formatHeaders()` — extracts lines matching `/^#{1,4}\s/` |
| 5+ turns (`> headers`) | File paths only | Minimal | [`src/context/knowledge-decay.ts:122-126`](src/context/knowledge-decay.ts) `formatNames()` — `[knowledge: domain/field/option]` via `collectPaths()` at [`src/context/knowledge-decay.ts:128-136`](src/context/knowledge-decay.ts) |

The `KNOWLEDGE_TAG` symbol ([`src/context/knowledge-decay.ts:18`](src/context/knowledge-decay.ts)) is attached to knowledge content by `tagAsKnowledge()` ([`src/context/knowledge-decay.ts:62-69`](src/context/knowledge-decay.ts)), called from `loadKnowledgeFn()` at [`src/sandbox/globals.ts:593`](src/sandbox/globals.ts). This is a non-enumerable symbol property, so it doesn't appear in serialized output but allows the agent loop to identify knowledge values in stop payloads.

Reload with `loadKnowledge()` if needed.

### User Messages

Never compressed. Always kept verbatim. Configured at [`src/session/config.ts:67`](src/session/config.ts) `neverTruncateInterventions: true`.

### Serialization Limits

Applied to all stop payloads at serialization time. Defaults at [`src/stream/serializer.ts:8-13`](src/stream/serializer.ts) (`DEFAULT_LIMITS`), overridable via config at [`src/session/config.ts:49-54`](src/session/config.ts). The `serialize()` function at [`src/stream/serializer.ts:19-23`](src/stream/serializer.ts) delegates to `serializeValue()` which applies limits recursively:

| Type | Limit | Where enforced |
|------|-------|----------------|
| Strings | 2,000 chars (first 1,000 + `... (truncated, N chars total)`) | [`src/stream/serializer.ts:38-41`](src/stream/serializer.ts) — `str.slice(0, half) + truncation note` |
| Arrays | 50 elements (then `... +N more`) | [`src/stream/serializer.ts:138-144`](src/stream/serializer.ts) — `Math.min(arr.length, limits.maxArrayElements)` |
| Objects | 20 keys (then `... +N more`) | [`src/stream/serializer.ts:158-166`](src/stream/serializer.ts) — `Math.min(keys.length, limits.maxObjectKeys)` |
| Nesting depth | 5 levels (then `[Array(N)]` or `[Object]`) | [`src/stream/serializer.ts:84-87`](src/stream/serializer.ts) — `if (depth >= limits.maxDepth)` |
| Circular references | `[Circular]` | [`src/stream/serializer.ts:81`](src/stream/serializer.ts) — `WeakSet` tracking |
| Special types | `[Function: name]`, `[Promise]`, `[Error: msg]`, ISO dates, etc. | [`src/stream/serializer.ts:49-76`](src/stream/serializer.ts) |
| Maps | Same key limit as objects | [`src/stream/serializer.ts:94-106`](src/stream/serializer.ts) — `Map { key: val, ... +N more }` |
| Sets | Same element limit as arrays | [`src/stream/serializer.ts:109-121`](src/stream/serializer.ts) — `Set { val, ... +N more }` |

### Token Budget Enforcement Order

The overall context management cascade, orchestrated by `AgentLoop.refreshSystemPrompt()` ([`src/cli/agent-loop.ts:656-673`](src/cli/agent-loop.ts)):

1. **Code window summarization** — `compressCodeWindow()` evicts oldest code turns first ([`src/context/code-window.ts:11-46`](src/context/code-window.ts))
2. **Stop/error payload decay** — `decayStopPayload()` / `decayErrorMessage()` progressively strip older messages ([`src/context/stop-decay.ts:26-43`](src/context/stop-decay.ts), [`src/context/stop-decay.ts:78-87`](src/context/stop-decay.ts))
3. **Knowledge content decay** — `decayKnowledgeMessages()` rewrites knowledge stop messages in-place ([`src/cli/agent-loop.ts:679-698`](src/cli/agent-loop.ts))
4. **SCOPE value width reduction** — `maxScopeValueWidth` reduced from 50 to 30 ([`src/session/config.ts:57`](src/session/config.ts))
5. **Signature collapse** — class/function signatures collapsed to names only ([`src/cli/agent-loop.ts:643-654`](src/cli/agent-loop.ts) `buildClassBlock()` choosing collapsed vs expanded format)

---

## Developer Hooks

AST-based code interception registered at session init ([`src/session/session.ts:60-64`](src/session/session.ts)). Hooks fire between parse and execute ([`src/stream/stream-controller.ts:79-84`](src/stream/stream-controller.ts) before hooks, [`src/stream/stream-controller.ts:126`](src/stream/stream-controller.ts) after hooks).

### Registration

Hooks are managed by [`src/hooks/hook-registry.ts:3-68`](src/hooks/hook-registry.ts) (`HookRegistry`). The `Hook` type is defined at [`src/session/types.ts:115-121`](src/session/types.ts).

```ts
session.registerHook({
  id: 'delete-guard',
  label: 'Guard destructive operations',
  pattern: { type: 'CallExpression', callee: { name: 'deleteRecord' } },
  phase: 'before',
  handler: (match) => ({
    type: 'interrupt',
    message: 'Confirm with the user via ask() before deleting data.'
  })
})
```

### Pattern Language

Pattern matching is implemented in [`src/hooks/pattern-matcher.ts:7-39`](src/hooks/pattern-matcher.ts) (`matchPattern()`). The `ASTPattern` type is at [`src/session/types.ts:91-94`](src/session/types.ts).

```ts
{ type: 'VariableDeclaration' }                           // match by node type — matchNodeType() at pattern-matcher.ts:41
{ type: 'CallExpression', callee: { name: 'fetchData' } } // property filters — matchPatternProperties() at pattern-matcher.ts:47
{ type: 'VariableDeclaration', declarations: [{ id: { name: '$varName' } }] }  // captures ($prefix) — pattern-matcher.ts:69-76
{ oneOf: [pattern1, pattern2] }                            // OR — pattern-matcher.ts:14-19
{ type: 'VariableDeclaration', not: { type: 'AwaitExpression' } }  // negation — pattern-matcher.ts:23-29
```

### 5 Hook Actions

Hook execution is implemented in [`src/hooks/hook-executor.ts:18-91`](src/hooks/hook-executor.ts) (`executeHooks()`). The `HookAction` type is at [`src/session/types.ts:108-113`](src/session/types.ts).

| Action | Effect | Code reference |
|--------|--------|----------------|
| `continue` | No-op, execution proceeds | [`src/hooks/hook-executor.ts:59-60`](src/hooks/hook-executor.ts) |
| `side_effect` | Run external logic concurrently, don't block | [`src/hooks/hook-executor.ts:62-63`](src/hooks/hook-executor.ts), fired at [`src/stream/stream-controller.ts:87-89`](src/stream/stream-controller.ts) |
| `transform` | Rewrite code before execution (agent doesn't see the change) | [`src/hooks/hook-executor.ts:66-69`](src/hooks/hook-executor.ts) (before phase only) |
| `interrupt` | Pause stream, inject `⚠ [hook:id]` user message | [`src/hooks/hook-executor.ts:72-77`](src/hooks/hook-executor.ts) (terminal) |
| `skip` | Drop the statement silently | [`src/hooks/hook-executor.ts:80-84`](src/hooks/hook-executor.ts) (terminal), [`src/stream/stream-controller.ts:102-104`](src/stream/stream-controller.ts) |

**Phases:** `before` (can transform/interrupt/skip) and `after` (observe/side-effect only) — phase filtering at [`src/hooks/hook-registry.ts:31-35`](src/hooks/hook-registry.ts) (`listByPhase()`), phase checks in executor at [`src/hooks/hook-executor.ts:67`](src/hooks/hook-executor.ts), [`src/hooks/hook-executor.ts:73`](src/hooks/hook-executor.ts), [`src/hooks/hook-executor.ts:81`](src/hooks/hook-executor.ts).

**Ordering:** Registration order. `skip` and `interrupt` are terminal ([`src/hooks/hook-executor.ts:76`](src/hooks/hook-executor.ts), [`src/hooks/hook-executor.ts:83`](src/hooks/hook-executor.ts) — both `return result`). Multiple `transform`s compose ([`src/hooks/hook-executor.ts:68`](src/hooks/hook-executor.ts) — overwrites `result.source`).

**Error handling:** Hook errors are logged and the hook is skipped ([`src/hooks/hook-executor.ts:51-53`](src/hooks/hook-executor.ts) — `catch` block calls `registry.recordFailure()` and `continue`s). 3+ consecutive failures disables the hook for the session ([`src/hooks/hook-registry.ts:40-46`](src/hooks/hook-registry.ts) `recordFailure()`, default threshold at [`src/hooks/hook-registry.ts:9`](src/hooks/hook-registry.ts)).

**Built-in hooks** (optional, developer-enabled):

| Hook | Pattern | Action | Purpose |
|------|---------|--------|---------|
| `await-guard` | `CallExpression` not inside `AwaitExpression` | `interrupt` | Catch missing awaits |
| `scope-guard` | `VariableDeclaration` shadowing a global | `interrupt` | Prevent accidental overwrites |
| `display-logger` | `CallExpression` to `display` | `side_effect` | Audit trail of UI output |
| `cost-tracker` | `CallExpression` matching registered API functions | `side_effect` | Track API costs per session |

---

## User Intervention

Users can interact at any time during execution:

- **Send a message** — Pauses the stream ([`src/session/session.ts:352`](src/session/session.ts)), injects the message as a plain user turn ([`src/session/session.ts:354-355`](src/session/session.ts) via `buildInterventionMessage()`). The agent sees it and adjusts.
- **Cancel a form** — If `ask` is active, resolves with `{ _cancelled: true }` ([`src/session/session.ts:320-322`](src/session/session.ts) `cancelAsk()`, [`src/session/session.ts:105-108`](src/session/session.ts)).
- **Cancel an async task** — From the sidebar, fills the result slot with `{ cancelled: true, message: "..." }` ([`src/session/session.ts:327-330`](src/session/session.ts) `cancelAsyncTask()`, [`src/sandbox/async-manager.ts:72-79`](src/sandbox/async-manager.ts) `cancel()`).
- **Pause/Resume** — UI button ([`src/session/session.ts:335-346`](src/session/session.ts) `pause()`/`resume()`). While paused, the user can send messages or cancel the session.

---

## Session Lifecycle

1. **INIT** — Create sandbox ([`src/sandbox/sandbox.ts:20-83`](src/sandbox/sandbox.ts)), inject globals ([`src/session/session.ts:168-180`](src/session/session.ts)), build system prompt with `{{SCOPE}}` ([`src/context/scope-generator.ts:11`](src/context/scope-generator.ts)), send to LLM. Session constructor at [`src/session/session.ts:52-181`](src/session/session.ts).
2. **STREAM** — Tokens accumulate into statements ([`src/stream/stream-controller.ts:40-62`](src/stream/stream-controller.ts) `feedToken()`), each parsed and executed ([`src/stream/stream-controller.ts:74-136`](src/stream/stream-controller.ts) `processStatement()`). `stop`/`error` create turn boundaries ([`src/session/session.ts:188-211`](src/session/session.ts)).
3. **COMPLETION** — On stream end ([`src/session/session.ts:232-291`](src/session/session.ts) `finalize()`), check for incomplete tasklists ([`src/session/session.ts:237-285`](src/session/session.ts), up to 3 reminder cycles — [`src/session/config.ts:46`](src/session/config.ts)). Drain async tasks ([`src/session/session.ts:288`](src/session/session.ts), [`src/sandbox/async-manager.ts:143-151`](src/sandbox/async-manager.ts) `drain()`).
4. **CLEANUP** — Destroy sandbox, unmount components, close connections ([`src/session/session.ts:437-442`](src/session/session.ts) `destroy()`).

Session status is tracked as a `SessionStatus` union type at [`src/session/types.ts:125-131`](src/session/types.ts): `'idle' | 'executing' | 'waiting_for_input' | 'paused' | 'complete' | 'error'`.

### Session Limits

All defaults defined in [`src/session/config.ts:37-69`](src/session/config.ts) (`DEFAULT_CONFIG`):

| Setting | Default | Code reference |
|---------|---------|----------------|
| `functionTimeout` | 30s | [`src/session/config.ts:38`](src/session/config.ts) `30_000` |
| `askTimeout` | 5 min | [`src/session/config.ts:39`](src/session/config.ts) `300_000` |
| `sessionTimeout` | 10 min | [`src/session/config.ts:40`](src/session/config.ts) `600_000` |
| `maxStopCalls` | 50 | [`src/session/config.ts:41`](src/session/config.ts) |
| `maxAsyncTasks` | 10 | [`src/session/config.ts:42`](src/session/config.ts) |
| `maxTasklistReminders` | 3 | [`src/session/config.ts:43`](src/session/config.ts) |
| `maxTaskRetries` | 3 | [`src/session/config.ts:44`](src/session/config.ts) |
| `maxTasksPerTasklist` | 20 | [`src/session/config.ts:45`](src/session/config.ts) |
| `sleepMaxSeconds` | 30 | [`src/session/config.ts:47`](src/session/config.ts) |
| `codeWindowLines` | 200 | [`src/session/config.ts:61`](src/session/config.ts) |
| `maxContextTokens` | 100,000 | [`src/session/config.ts:48`](src/session/config.ts) |
| `taskAsyncTimeout` | 60s | [`src/session/config.ts:46`](src/session/config.ts) `60_000` |

Config validation uses Zod schema at [`src/session/config.ts:75-107`](src/session/config.ts). Merging at [`src/session/config.ts:122-157`](src/session/config.ts) (`mergeConfig()`).

---

## Security

- **Sandbox isolation** — No access to: filesystem, network, `process`, `require`, `import()`, `eval`, `Function` constructor, or `globalThis` modification beyond the injected API. Blocked globals listed at [`src/sandbox/sandbox.ts:7-10`](src/sandbox/sandbox.ts) (`BLOCKED_GLOBALS`), enforced via non-configurable property getters at [`src/sandbox/sandbox.ts:75-82`](src/sandbox/sandbox.ts). Safe globals allowlist at [`src/sandbox/sandbox.ts:30-69`](src/sandbox/sandbox.ts). VM context created at [`src/sandbox/sandbox.ts:72`](src/sandbox/sandbox.ts).
- **Function registry** — All agent-accessible functions are proxy-wrapped with type validation, timeouts (default 30s), logging, and rate-limiting. Implemented in [`src/security/function-registry.ts:14-56`](src/security/function-registry.ts) (`wrapFunction()`), with rate limiting at [`src/security/function-registry.ts:26-34`](src/security/function-registry.ts) and timeout racing at [`src/security/function-registry.ts:39-44`](src/security/function-registry.ts). Registry class at [`src/security/function-registry.ts:61-92`](src/security/function-registry.ts).
- **JSX sanitization** — No `dangerouslySetInnerHTML`, `<script>` tags, or `javascript:` URLs. Blocked tags at [`src/security/jsx-sanitizer.ts:3`](src/security/jsx-sanitizer.ts), dangerous props at [`src/security/jsx-sanitizer.ts:4`](src/security/jsx-sanitizer.ts), URL pattern at [`src/security/jsx-sanitizer.ts:5`](src/security/jsx-sanitizer.ts). Full validation in [`src/security/jsx-sanitizer.ts:16-68`](src/security/jsx-sanitizer.ts) (`sanitizeJSX()`). `ask` forms are validated to only contain registered input components at [`src/security/jsx-sanitizer.ts:80-112`](src/security/jsx-sanitizer.ts) (`validateFormComponents()`).

---

## Execution Flow Pattern

A typical session follows this structure:

```ts
// 1. Plan
tasklist("task_id", "description", [ ... ])

// 2. Greet
display(<Text>Let me help you with that.</Text>)

// 3. Gather input (ask → stop)
const input = await ask(<form>...</form>)
await stop(input)
completeTask("task_id", "first_task", { ... })

// 4. Do work
const results = await doWork(input.query)

// 5. Check before branching (stop to read)
await stop(results.length)
completeTask("task_id", "second_task", { count: results.length })

// 6. Show results
display(<ResultsList items={results} />)

// 7. Ask for next action (ask → stop)
const choice = await ask(<form>...</form>)
await stop(choice)
completeTask("task_id", "third_task", { action: choice.action })

// 8. Execute and finish
const file = await exportResults(results)
display(<DownloadLink href={file.url} />)
completeTask("task_id", "final_task", { done: true })
```

---

## Agent Rules (Summary)

1. Output only valid TypeScript. No prose outside `//` comments.
2. Plan first — call `tasklist()` before implementation.
3. `await` every function call — no exceptions.
4. `{{SCOPE}}` is your source of truth for variable values.
5. `stop()` before branching on unknown values.
6. Always follow `ask()` with `stop()`.
7. Use `display()` for output, never `console.log`.
8. Don't redeclare existing `const` variables — use new names or `let`.
9. Keep lines independent where possible.
10. Comments are allowed and encouraged — they are your only form of "speech."
11. Background tasks (`async`) should be self-contained — don't depend on variables created after spawning.
12. Handle nullability with `?.` and `??`.
13. Use `loadKnowledge()` before domain-specific work when a Knowledge Tree is available.
14. Never import modules or write `export`/`module.exports` — everything is in scope, this is a REPL.
15. Never assume values — read them with `stop()`.
16. Never use synchronous function calls — always `await`.
