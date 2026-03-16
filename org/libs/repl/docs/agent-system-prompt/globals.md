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
