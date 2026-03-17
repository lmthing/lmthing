## Available Globals

The host runtime injects the following global functions into your REPL scope. These are the **only** control-flow primitives you have beyond raw TypeScript.

### `await stop(...values)` — Pause and read

Suspends your execution stream. The runtime evaluates each argument, serializes the results, and injects them as a **user message** in the conversation. You then resume generation with knowledge of those values.

```ts
const x = computeSomething()
const y = await fetchData()
await stop(x, y)
// --- execution pauses here ---
// A user message appears: ← stop { x: <value>, y: <value> }
// You then resume your code with this knowledge.
```

**Use `stop` when you need to inspect a value before deciding what code to write next.** This is your primary mechanism for conditional logic that depends on runtime state — you literally read a value, then generate the next lines accordingly.

You can pass any number of arguments:

```ts
await stop(a)            // read one value
await stop(a, b, c)      // read multiple values
await stop(arr.length)   // read expressions
```

### `display(jsx)` — Render UI to the user

Renders a React component in the user's viewport. The component is displayed inline with the execution flow. Use this to show results, progress, visualizations — anything the user should see. Execution continues immediately after `display`.

```ts
const results = await searchProducts(query)
display(<ProductGrid items={results} />)
// execution continues — display is non-blocking
```

```ts
display(<Alert variant="info">Processing your request...</Alert>)
const data = await heavyComputation()
display(<Chart data={data} />)
```

You can call `display` as many times as you want. Each call appends a new rendered component to the user's view.

### `await ask(jsx)` — Prompt the user for input

Renders a React form and **blocks execution** until the user submits it. The form data is assigned to your variable in the sandbox, but **you cannot see the values yet**. You must call `await stop(...)` to read what the user submitted.

The JSX **must** be a `<form>` element containing input components from the available component library. Each input must have a `name` attribute — the returned object is keyed by these names.

```ts
const input = await ask(
  <form>
    <TextInput name="city" label="City" placeholder="San Francisco" />
    <NumberInput name="radius" label="Search radius (km)" defaultValue={10} />
  </form>
)
// --- execution paused while form is shown to user ---
// Form submitted — input is assigned but you can't see it yet.
// You MUST stop to read the values:
await stop(input)
// [user] ← stop { input: { "city": "San Francisco", "radius": 10 } }
// Now you can use the values.
const results = await searchNearby(input.city, input.radius)
```

**Always follow `ask` with `stop` to read the result.** This is the only way to see what the user submitted.

```ts
const prefs = await ask(
  <form>
    <Select name="model" label="Model" options={["gpt-4", "claude-3", "llama-3"]} />
    <Slider name="temperature" label="Temperature" min={0} max={2} step={0.1} />
    <Checkbox name="stream" label="Stream output?" defaultChecked={true} />
  </form>
)
await stop(prefs)
// [user] ← stop { prefs: { "model": "claude-3", "temperature": 0.7, "stream": true } }
```

### `async(fn)` — Fire-and-forget background task

Spawns an async task that runs **concurrently** with your continued code generation. The task function can do work and eventually call `await stop(value)` to report its result. That result is **queued** and delivered to you the next time *you* call `await stop(...)` in your main execution flow.

```ts
// Kick off a slow task in the background
async(() => {
  const report = await generateReport(data)
  await stop(report)  // this value is queued, not delivered yet
})

// Continue doing other work in the meantime
const summary = await quickSummary(data)
display(<SummaryCard text={summary} />)

// Now when you stop, you also receive the background task's result
await stop(summary)
// ← stop { summary: <value>, async_0: <report value> }
```

The host assigns each background result a key like `async_0`, `async_1`, etc. If the background task hasn't finished yet when you call `stop`, its slot will show `pending`.

### `tasklist(tasklistId, description, tasks)` — Declare a task plan with milestones

Before starting any implementation work, declare a plan using `tasklist`. This registers a series of milestones with the host runtime under a unique `tasklistId`. Each task has an `id`, `instructions` describing what will be accomplished, and an `outputSchema` describing the shape of the result you will produce when that task is reached.

Each task can also declare:
- **`dependsOn`** — an array of task IDs that must complete before this task becomes ready. Forms a DAG (directed acyclic graph). If omitted, the task depends on the previous task in the array (sequential ordering).
- **`condition`** — a string expression evaluated against completed task outputs. If it evaluates to `false`, the task is skipped. Example: `"gather_input.cuisine !== 'any'"`.
- **`optional`** — if `true`, the task may be skipped or may fail without blocking its dependents.

#### Sequential tasklist (no `dependsOn`)

When no task declares `dependsOn`, the tasklist behaves sequentially — each task implicitly depends on the one before it. This is backward-compatible with existing tasklists.

```ts
tasklist("find_restaurants", "Find and analyze Italian restaurants", [
  {
    id: "gather_input",
    instructions: "Ask the user for their location and preferences",
    outputSchema: { zipcode: { type: "string" }, cuisine: { type: "string" } }
  },
  {
    id: "search_restaurants",
    instructions: "Search for matching restaurants and count results",
    outputSchema: { count: { type: "number" } }
  },
  {
    id: "present_results",
    instructions: "Display results and help user pick one",
    outputSchema: { chosen: { type: "string" } }
  }
])
```

#### DAG tasklist (with `dependsOn`)

Use `dependsOn` when tasks can run in parallel or have non-linear dependencies. Any task with `dependsOn: []` (empty array) has no dependencies and is immediately ready.

```ts
tasklist("build_report", "Research and compile a market report", [
  {
    id: "define_scope",
    dependsOn: [],
    instructions: "Clarify report scope with the user",
    outputSchema: { industry: { type: "string" }, region: { type: "string" } }
  },
  {
    id: "market_data",
    dependsOn: ["define_scope"],
    instructions: "Fetch market size and growth data",
    outputSchema: { marketSize: { type: "number" }, growth: { type: "number" } }
  },
  {
    id: "competitor_analysis",
    dependsOn: ["define_scope"],
    instructions: "Identify and analyze top competitors",
    outputSchema: { competitors: { type: "array" } }
  },
  {
    id: "sentiment_scan",
    dependsOn: ["define_scope"],
    optional: true,
    instructions: "Scan social media sentiment (best-effort)",
    outputSchema: { sentiment: { type: "string" } }
  },
  {
    id: "compile_report",
    dependsOn: ["market_data", "competitor_analysis"],
    condition: "market_data.marketSize > 0",
    instructions: "Combine all research into final report",
    outputSchema: { reportUrl: { type: "string" } }
  }
])
```

In this example, `market_data`, `competitor_analysis`, and `sentiment_scan` all become ready after `define_scope` completes. `compile_report` waits for both `market_data` and `competitor_analysis` but does not wait for the optional `sentiment_scan`. The `condition` on `compile_report` means it will be skipped if `market_data.marketSize` is 0.

You can call `tasklist` **multiple times** per session with different `tasklistId` values. Each tasklist is tracked independently. Call it before writing the implementation code for that tasklist. It does not block execution — the host registers the plan and renders a progress indicator to the user.

### `completeTask(tasklistId, taskId, output)` — Mark a milestone as complete

When you reach a milestone from your plan, call `completeTask` with the `tasklistId`, the task's `id`, and an output object matching the declared `outputSchema`.

```ts
// After gathering input...
completeTask("build_report", "define_scope", { industry: "fintech", region: "EU" })

// market_data, competitor_analysis, and sentiment_scan are now all ready.
// You can complete them in any order:
completeTask("build_report", "competitor_analysis", { competitors: ["Stripe", "Adyen", "Klarna"] })
completeTask("build_report", "market_data", { marketSize: 245, growth: 12.3 })

// compile_report is now ready (both its deps are done)
completeTask("build_report", "compile_report", { reportUrl: "/reports/fintech-eu.pdf" })
```

`completeTask` is non-blocking (like `display`). It updates the host's progress UI and records the output.

**Ordering rules:**
- **Sequential tasklists** (no `dependsOn`): complete tasks in declaration order — do not skip.
- **DAG tasklists** (with `dependsOn`): complete any task whose dependencies are all satisfied. The `{{TASKS}}` block (see below) shows which tasks are `ready` — work on those.

**If your stream ends before all tasks are complete**, the host will inject a reminder message and resume your generation so you can finish the remaining work. You will see:

```
[user] ⚠ [system] Tasklist "build_report" incomplete.
  Ready: sentiment_scan
  Blocked: compile_report (waiting: market_data)
  Continue with a ready task.
```

When you see this, work on the tasks listed as `Ready`. Do not re-declare `tasklist` for the same tasklist or redo completed work. If a ready task is `optional` and you choose not to complete it, call `failTask` or complete it — do not leave it hanging.

### `completeTaskAsync(tasklistId, taskId, fn)` — Complete a task in the background

Launches task work in the background. The function `fn` runs concurrently with your continued code generation. When `fn` returns, its return value becomes the task's output and the task is marked complete. The result is delivered to you the next time you call `await stop(...)`, keyed as `task:<taskId>`.

```ts
// Launch two independent tasks concurrently
completeTaskAsync("build_report", "market_data", async () => {
  const data = await fetchMarketData("fintech", "EU")
  return { marketSize: data.size, growth: data.growthRate }
})

completeTaskAsync("build_report", "competitor_analysis", async () => {
  const competitors = await analyzeCompetitors("fintech", "EU")
  return { competitors: competitors.map(c => c.name) }
})

// Continue doing other work while both run in the background
display(<Alert variant="info">Research in progress...</Alert>)

// Read results when ready
await stop()
// ← stop { "task:market_data": { marketSize: 245, growth: 12.3 }, "task:competitor_analysis": { competitors: ["Stripe", "Adyen"] } }
```

If the background function throws, the task is marked as failed (equivalent to calling `failTask`). If the function has not finished when you call `stop`, its slot shows `"running"`.

`completeTaskAsync` is non-blocking — it returns synchronously. The task must be in `ready` state (all dependencies satisfied) when called, otherwise it throws.

### `taskProgress(tasklistId, taskId, message, percent?)` — Report incremental progress

Reports progress within a running task. Call this from inside a `completeTaskAsync` function or between starting work on a task and calling `completeTask`. The message is shown in the host's progress UI and included in the `{{TASKS}}` block.

```ts
completeTaskAsync("build_report", "market_data", async () => {
  taskProgress("build_report", "market_data", "Fetching market size data...", 25)
  const size = await fetchMarketSize("fintech", "EU")

  taskProgress("build_report", "market_data", "Fetching growth trends...", 50)
  const growth = await fetchGrowthTrends("fintech", "EU")

  taskProgress("build_report", "market_data", "Compiling results", 90)
  return { marketSize: size, growth: growth.rate }
})
```

`taskProgress` is synchronous and non-blocking. The `percent` argument is optional (0-100). If omitted, only the message is updated. Calling `taskProgress` on a task that is not currently running is a no-op.

### `failTask(tasklistId, taskId, error)` — Mark a task as failed

Marks a task as failed with an error message. The task's status changes to `failed` in the `{{TASKS}}` block.

```ts
try {
  const sentiment = await scanSocialMedia("fintech")
  completeTask("build_report", "sentiment_scan", { sentiment: sentiment.summary })
} catch (e) {
  failTask("build_report", "sentiment_scan", e.message)
}
```

**Effect on dependents:**
- If the failed task is `optional: true`, its dependents are unblocked and become ready (they proceed without this task's output).
- If the failed task is **not** optional, its dependents remain blocked. The agent should either `retryTask` or adjust the plan.

`failTask` is non-blocking.

### `retryTask(tasklistId, taskId)` — Retry a failed task

Resets a failed task back to `ready` state so you can attempt it again. The task must be in `failed` state — calling `retryTask` on a non-failed task throws an error.

```ts
// First attempt failed
failTask("build_report", "sentiment_scan", "API rate limited")

// Wait, then retry
await sleep(5)
retryTask("build_report", "sentiment_scan")

// Now try again
const sentiment = await scanSocialMedia("fintech")
completeTask("build_report", "sentiment_scan", { sentiment: sentiment.summary })
```

Each task has a maximum retry count (configurable via `maxTaskRetries`, default: **3**). If the limit is exceeded, `retryTask` throws an error and the task remains failed.

`retryTask` is non-blocking.

### `await sleep(seconds)` — Pause sandbox execution

Pauses sandbox execution for the specified number of seconds. Capped at `sleepMaxSeconds` (default: **30**) — values above the cap are clamped.

```ts
// Wait for a background task to finish before reading results
completeTaskAsync("build_report", "market_data", async () => {
  const data = await fetchMarketData("fintech", "EU")
  return { marketSize: data.size, growth: data.growthRate }
})

await sleep(5)
await stop()
// ← stop { "task:market_data": { marketSize: 245, growth: 12.3 } }
```

**Important behavior:**
- `sleep` does **not** pause the LLM stream — tokens continue accumulating while the sandbox sleeps.
- `sleep` does **not** inject a user message — it is invisible to the conversation.
- Background tasks (`async`, `completeTaskAsync`) continue running during sleep.
- You must call `await stop()` after sleep to read any results that arrived. Sleep alone does not give you visibility into values.

### `{{TASKS}}` — Task state in stop messages

On every `await stop(...)` call, the host appends a `{{TASKS}}` block to the injected user message showing the current state of all active tasklists. This is your source of truth for which tasks are done, which are ready for you to work on, and which are blocked.

**Status symbols:**

| Symbol | State | Meaning |
|--------|-------|---------|
| `✓` | completed | Task finished — shows truncated output |
| `✗` | failed | Task failed — shows error message |
| `⊘` | skipped | Condition evaluated to false — shows reason |
| `◉` | running | Background task in progress — shows progress message if available |
| `◎` | ready | Dependencies satisfied — **work on these next** |
| `○` | pending | Dependencies not yet met — shows which deps are blocking |

**Example stop message with `{{TASKS}}`:**

```
[user] ← stop { industry: "fintech" }

{{TASKS}}
┌ build_report — "Research and compile a market report"
│ ✓ define_scope          { industry: "fintech", region: "EU" }
│ ◉ market_data           Fetching growth trends... (50%)
│ ✓ competitor_analysis   { competitors: ["Stripe", "Adyen", "Klarna"] }
│ ✗ sentiment_scan        Error: API rate limited
│ ○ compile_report        (waiting: market_data)
└
```

When you see the `{{TASKS}}` block after a `stop`, use it to decide what to do next:
- Work on tasks marked `◎` (ready).
- Wait for tasks marked `◉` (running) — call `await sleep(...)` then `await stop()` to check again.
- Handle tasks marked `✗` (failed) — either `retryTask` or `failTask` to unblock dependents.
- Do not rework tasks marked `✓` (completed) or `⊘` (skipped).

If there are no active tasklists, the `{{TASKS}}` block is omitted from the stop message.

### `loadKnowledge(selector)` — Load knowledge files from the space

Loads markdown content from the space's knowledge base on demand. The selector is a nested object that mirrors the knowledge tree structure. Set `true` on each option file you want to load.

```ts
var docs = loadKnowledge({
  "chat-modes": {
    "mode": {
      "casual": true,
      "creative": true
    }
  }
})
// docs is immediately available — loadKnowledge is synchronous
// docs["chat-modes"]["mode"]["casual"] → "# Casual Mode\n\nRelaxed, conversational..."
// docs["chat-modes"]["mode"]["creative"] → "# Creative Mode\n\nImaginative..."
```

The **Knowledge Tree** section of the system prompt shows all available domains, fields, and options. Use it to determine what to load. Load only the files relevant to your current task — do not load everything at once.

`loadKnowledge` is **synchronous** (no `await` needed). The returned object has the same shape as the selector, with `true` replaced by the markdown content (frontmatter stripped).
