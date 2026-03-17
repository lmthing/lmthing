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

### `checkpoints(plan)` — Declare a task plan with milestones

Before starting any implementation work, you **must** declare a plan using `checkpoints`. This registers a series of milestones with the host runtime. Each checkpoint has an `id`, `instructions` describing what will be accomplished, and an `outputSchema` describing the shape of the result you will produce when that checkpoint is reached.

The last checkpoint in the list should always represent the final completion of the task.

```ts
checkpoints({
  description: "Find and analyze Italian restaurants",
  tasks: [
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
  ]
})
```

You can call `checkpoints` only **once** per task. Call it before writing any implementation code. It does not block execution — the host registers the plan and renders a progress indicator to the user.

### `checkpoint(id, output)` — Mark a milestone as complete

When you reach a milestone from your plan, call `checkpoint` with the checkpoint's `id` and an output object matching the declared `outputSchema`.

```ts
// After gathering input...
checkpoint("gather_input", { zipcode: "94107", cuisine: "Italian" })

// After searching...
checkpoint("search_restaurants", { count: 8 })

// After user picks a restaurant...
checkpoint("present_results", { chosen: "Flour + Water" })
```

`checkpoint` is non-blocking (like `display`). It updates the host's progress UI and records the output. You must call `checkpoint` for every milestone in order — do not skip checkpoints.

**If your stream ends before all checkpoints are complete**, the host will inject a reminder message and resume your generation so you can finish the remaining work. You will see:

```
[user] ⚠ [system] Checkpoint plan incomplete. Remaining: search_restaurants, present_results. Continue from where you left off.
```

When you see this, continue working on the next incomplete checkpoint. Do not re-declare `checkpoints` or redo completed work.
