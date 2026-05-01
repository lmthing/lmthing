# @lmthing/repl

A streaming TypeScript REPL agent system. An LLM writes TypeScript code that executes **line-by-line as it streams** — no waiting for a complete response. The agent controls a live sandbox through 7 global primitives, renders React components to the user, and pulls structured knowledge from spaces.

## How It Works

```
┌─────────────┐    tokens     ┌────────────────┐    execute    ┌──────────────┐
│  LLM Agent  │ ────────────▶ │ Stream Parser & │ ───────────▶ │  TypeScript   │
│  (any model)│ ◀──────────── │ Line Accumulator│ ◀─────────── │  REPL Sandbox │
│             │    context     │                 │   results    │              │
└─────────────┘               └────────────────┘              └──────────────┘
                                      │                              │
                                      ▼                              │
                               ┌──────────────┐                     │
                               │ React Render  │ ◀──────────────────┘
                               │ Surface       │   display() / ask()
                               └──────────────┘
```

The agent outputs **only valid TypeScript** — no markdown, no prose. Each line is parsed, transpiled, and executed in a persistent `vm.Context` sandbox as it arrives from the LLM stream. The agent communicates with the user through 7 built-in globals rather than natural language.

## Quick Start

```bash
# Run with a user file that exports functions for the agent
npx tsx src/cli/bin.ts examples/01-math.ts --model openai:gpt-4o-mini

# Run with built-in catalog modules (fs, fetch, json, etc.)
npx tsx src/cli/bin.ts --model openai:gpt-4o-mini --catalog fs,fetch,json

# Run with space knowledge
npx tsx src/cli/bin.ts examples/09-space.tsx --model openai:gpt-4o-mini --space examples/spaces/cooking
```

The CLI starts a WebSocket server with an optional web UI. Open `http://localhost:3100` to interact with the agent in the browser.

## The 7 Globals

These are the only tools the agent has. Everything it does flows through them.

| Global | Blocking? | Purpose |
|--------|-----------|---------|
| `stop(...values)` | Yes | Pause execution, serialize values, inject them as a user message. The agent's **only way to read runtime values**. |
| `display(element)` | No | Render a React component to the user's viewport. |
| `ask(element)` | Yes | Render a form, wait for submission. Must be followed by `stop()` to read the values. |
| `async(fn)` | No | Fire-and-forget background task with AbortController support. |
| `checkpoints(id, desc, tasks)` | No | Declare a task plan with milestones before starting work. |
| `checkpoint(id, checkpointId, output)` | No | Mark a milestone as complete with validated output. |
| `loadKnowledge(selector)` | No | Load markdown files from the space knowledge base. |

### How `stop()` drives the conversation

`stop()` is the core primitive. The agent writes code, calls `stop(someVariable)`, and the runtime:

1. Pauses the LLM stream
2. Evaluates and serializes the arguments
3. Injects the result as a user message: `← stop { someVariable: <value> }`
4. Resumes the agent in a new turn with the values visible

```typescript
// Agent writes this:
var result = await fetchData("/api/users")
await stop(result)
// Agent sees: ← stop { result: [{ name: "Alice" }, { name: "Bob" }] }
// Now it can branch based on the actual data
```

### How `ask()` collects user input

```typescript
// Agent renders a form and waits
var prefs = await ask(<div>
  <Select name="cuisine" label="Pick cuisine" options={["italian", "japanese"]} />
  <TextInput name="notes" label="Any notes?" />
</div>)
await stop(prefs)
// ← stop { prefs: { cuisine: "italian", notes: "extra spicy" } }
```

## Writing a User File

A user file is a TypeScript/TSX module that exports functions, components, and configuration for the agent. Exports become globals in the REPL sandbox.

```typescript
// my-agent.ts

// Functions — callable by the agent
export function greet(name: string): string {
  return `Hello, ${name}!`
}

export function add(a: number, b: number): number {
  return a + b
}

// Configuration
export const replConfig = {
  instruct: "You are a friendly math tutor.",
  maxTurns: 10,
}
```

Run it:

```bash
npx tsx src/cli/bin.ts my-agent.ts --model openai:gpt-4o-mini
```

### `replConfig` options

| Option | Type | Description |
|--------|------|-------------|
| `functions` | `string[]` | Catalog module IDs to load (e.g. `['fs', 'fetch', 'json']`) |
| `components` | `{ form: string[], view: string[] }` | Built-in component groups to load |
| `spaces` | `string[]` | Paths to space directories for knowledge loading |
| `functionSignatures` | `string` | Manual function documentation injected into the system prompt |
| `instruct` | `string` | Custom instructions appended to the system prompt |
| `maxTurns` | `number` | Max LLM turns before stopping (default: 10) |
| `maxCheckpointReminders` | `number` | Max reminders for incomplete checkpoints (default: 3) |
| `debugFile` | `string` | Path to save session debug output |

### Default export — setup code

A default export function runs **before the agent starts**, in the REPL context. Use it to pre-declare checkpoints or initialize state:

```typescript
export default function ({ checkpoints }) {
  checkpoints("inventory", "Build a small inventory", [
    { id: "add_items", instructions: "Add 3 items", outputSchema: { count: { type: "number" } } },
    { id: "summarize", instructions: "Show totals", outputSchema: { total: { type: "number" } } },
  ])
}
```

### React components

Export React components for `display()` and `ask()`. Mark form components with `.form = true` so the system classifies them correctly:

```tsx
export function RecipeCard({ name, cuisine }: { name: string; cuisine: string }) {
  return <div><h2>{name}</h2><p>{cuisine}</p></div>
}

export function RequestForm() {
  return (
    <div>
      <TextInput name="query" label="What would you like?" />
      <Select name="cuisine" label="Cuisine" options={["italian", "japanese"]} />
    </div>
  )
}
RequestForm.form = true
```

## Built-in Catalog

11 function modules the agent can call directly. Enable via `replConfig.functions` or `--catalog`.

| Module | Functions | Description |
|--------|-----------|-------------|
| `fs` | `readFile`, `writeFile`, `listDir`, `glob`, `stat`, `exists`, `mkdir`, `remove`, ... | File system I/O |
| `fetch` | `get`, `post`, `put`, `delete` | HTTP requests |
| `json` | `parse`, `query`, `transform` | JSON manipulation with JSONPath |
| `csv` | `read`, `write`, `transform` | CSV processing |
| `shell` | `exec`, `spawn`, `pipe` | Shell command execution |
| `crypto` | `hash`, `randomBytes`, `uuid` | Cryptographic utilities |
| `date` | `parse`, `format`, `add`, `subtract` | Date arithmetic |
| `path` | `join`, `resolve`, `relative`, `parse` | Path manipulation |
| `env` | `get` | Allowlisted environment variable access |
| `image` | `resize`, `crop`, `convert` | Image processing (via sharp) |
| `db` | `query` | Database access (SQLite, Postgres, MySQL) |

```typescript
export const replConfig = {
  functions: ['fs', 'fetch', 'json'],  // or use --catalog fs,fetch,json
}
```

## Built-in Components

### Form components (for `ask()`)

`TextInput`, `TextArea`, `NumberInput`, `Slider`, `Checkbox`, `Select`, `MultiSelect`, `DatePicker`, `FileUpload`

Each requires a `name` prop. The host wraps them in a `<form>` with Submit/Cancel buttons automatically.

### Display components (for `display()`)

`CodeBlock`, `ReadBlock`, `ErrorBlock`, `HookBlock`, `FormCard`, `AsyncSidebar`

Enable with:

```typescript
export const replConfig = {
  components: { form: ['form'], view: ['display'] },
}
```

## Knowledge System

Spaces provide structured knowledge that agents can load at runtime. A space's `knowledge/` directory contains domains, fields, and markdown option files:

```
my-space/knowledge/
├── cuisine/
│   ├── config.json          # domain metadata
│   └── type/
│       ├── config.json      # field metadata
│       ├── italian.md       # selectable option
│       └── japanese.md
└── technique/
    └── method/
        ├── grilling.md
        └── braising.md
```

The agent sees a **Knowledge Tree** in its system prompt listing all available files. It loads specific options with `loadKnowledge()`:

```typescript
var docs = loadKnowledge({
  "my-space": {
    "cuisine": { "type": { "italian": true } },
    "technique": { "method": { "grilling": true } }
  }
})
await stop(docs)
// ← stop { docs: { "my-space": { cuisine: { type: { italian: "# Italian Cuisine\n..." } }, ... } } }
```

## Architecture

Four subsystems handle the pipeline from LLM tokens to executed code:

### 1. Stream Controller (`src/stream/`)

Buffers LLM tokens into complete TypeScript statements. Tracks bracket depth to avoid executing partial expressions. Manages pause/resume for `stop()` and `ask()`.

### 2. Line Parser (`src/parser/`)

Analyzes buffered code using the TypeScript compiler API. Detects calls to globals (`stop`, `display`, `ask`, `async`, `checkpoints`, `checkpoint`, `loadKnowledge`), checks statement completeness, and recovers argument names for serialization.

### 3. REPL Sandbox (`src/sandbox/`)

A `vm.Context` wrapper that executes TypeScript line-by-line with persistent scope. Variables declared with `var` survive across turns. Includes the transpiler (TS → JS via SWC), executor, and async task manager with AbortController support.

### 4. Context Management (`src/context/`)

Keeps the system prompt fresh between turns:

- **Scope table** — live variable table (`{{SCOPE}}`) showing all declared variables and their current values. Never compressed.
- **Code window** — sliding window (default 200 lines) of recent code. Older lines are summarized to `// [lines N-M executed] declared: ...`
- **Stop payload decay** — values from older `stop()` calls are progressively compressed: full → keys only → count → removed.

## Session Lifecycle

```
idle → executing → waiting_for_input / paused → complete / error
```

The `Session` class manages the state machine, sandbox, stream controller, hook registry, async tasks, and checkpoint state. It emits events (`code`, `read`, `error`, `hook`, `display`, `ask`, `async`, `checkpoint`, `scope`) consumed by the web UI over RPC.

## Developer Hooks

AST-based code interception that fires between parse and execute:

```typescript
const hook: Hook = {
  id: 'log-fs',
  label: 'Log file operations',
  pattern: { type: 'call', callee: 'readFile' },
  phase: 'before',
  handler: (match, ctx) => {
    console.log(`Reading: ${match.args[0]}`)
    return { type: 'continue' }
  }
}
```

Five hook actions: `continue`, `side_effect`, `transform`, `interrupt`, `skip`.

## CLI Reference

```
npx tsx src/cli/bin.ts [file] [options]

Options:
  --model, -m     LLM model ID (required, e.g. openai:gpt-4o-mini)
  --file, -f      Path to user TypeScript/TSX file
  --catalog, -c   Catalog modules (comma-separated or "all")
  --space, -s     Path to space directory (repeatable)
  --instruct, -i  Custom instructions (repeatable)
  --port, -p      WebSocket/HTTP server port (default: 3100)
  --timeout, -t   Session timeout in seconds
  --debug-file    Path to save debug session output
  --no-ui         Disable web UI serving
```

## RPC Interface

The CLI exposes a WebSocket RPC interface for browser clients:

```typescript
interface ReplSession {
  sendMessage(text: string): Promise<void>
  submitForm(formId: string, data: Record<string, unknown>): Promise<void>
  cancelAsk(formId: string): Promise<void>
  cancelTask(taskId: string, message?: string): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  intervene(text: string): Promise<void>
  getSnapshot(): Promise<SessionSnapshot>
  subscribe(): AsyncIterable<SessionEvent>
}
```

Use `connectToRepl(url)` from the client or `useReplSession()` as a React hook.

## Examples

| Example | What it demonstrates |
|---------|---------------------|
| `01-math.ts` | Basic functions, `stop()` for reading values, multi-turn |
| `02-files.ts` | File I/O operations |
| `03-data.ts` | Data transformation |
| `04-weather.tsx` | API calls + display components |
| `05-todo.tsx` | Forms with `ask()`, mutable state, CRUD |
| `06-converter.tsx` | Unit conversion with `ask()` |
| `07-knowledge-base.tsx` | Knowledge loading |
| `08-async-scraper.tsx` | Background tasks with `async()` |
| `09-space.tsx` | Full multi-space integration with catalog + components |
| `10-load-class.ts` | Class method discovery and loading |
| `11-setup.ts` | Default export setup function |

## Project Structure

```
src/
├── cli/               # CLI entry point, agent loop, system prompt builder
├── stream/            # Token accumulation, bracket tracking, pause/resume
├── parser/            # Statement detection, global call detection, AST utilities
├── sandbox/           # vm.Context execution, transpiler, scope persistence
├── context/           # Scope table, code window, stop decay, message building
├── session/           # Session state machine, config, event types
├── hooks/             # AST pattern matching, hook registry, hook executor
├── security/          # Function registry proxy, JSX sanitization
├── catalog/           # 11 built-in function modules
├── knowledge/         # Knowledge tree builder, file loader, formatter
├── components/
│   ├── form/          # TextInput, Select, Checkbox, etc.
│   ├── display/       # CodeBlock, ReadBlock, ErrorBlock, etc.
│   └── shared/        # Block state, form data extraction
├── rpc/               # WebSocket RPC server + client
├── web/               # Browser UI (React app)
└── index.ts           # Public API barrel export
```
