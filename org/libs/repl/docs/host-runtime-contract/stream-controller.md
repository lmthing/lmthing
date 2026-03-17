## 1. Stream Controller

### Token Accumulation

The LLM streams tokens. The stream controller accumulates them into a **line buffer**. A "line" is defined as a complete TypeScript statement, determined by one of:

- A newline character (`\n`) where the accumulated text forms a syntactically complete statement.
- Closing of a multi-line construct (object literal, template literal, JSX block, function body).

The controller must track **bracket depth** (`{`, `}`, `(`, `)`, `<`, `>` for JSX) and **string context** (backticks, quotes) to avoid splitting mid-expression.

#### Statement Completeness Heuristic

```ts
interface LineAccumulator {
  buffer: string
  bracketDepth: { round: number; curly: number; angle: number; square: number }
  inString: false | "'" | '"' | '`'
  inComment: false | '//' | '/*'
  inJsx: boolean
}

function isComplete(acc: LineAccumulator): boolean {
  if (acc.inString || acc.inComment === '/*') return false
  const { round, curly, angle, square } = acc.bracketDepth
  return round === 0 && curly === 0 && square === 0 && !acc.inJsx
}
```

When `isComplete` returns true after a newline, flush the buffer to the REPL for execution.

### Pause / Resume

The stream controller must support **hard pause** — halting token consumption from the LLM stream without closing the connection (if the provider supports it) or cancelling generation and re-prompting.

Pause is triggered by:
- `await stop(...)` — pause, evaluate args, inject user message with values, resume
- `await ask(...)` — pause, render form, wait for user submit, assign to sandbox variable, resume **silently** (no message injected)
- Runtime/type error — pause, inject user message with error, resume
- **User intervention** — user sends a message mid-execution. Pause, finalize assistant turn, inject user message (raw text, no `←` prefix), update `{{SCOPE}}`, resume
- `async(...)` — **no pause** (but register the background task)

### Context Injection

There are two types of interruptions that inject `role: 'user'` messages:

**`stop` and `error`** — inject a user message containing the values or error, then resume generation:

```
← stop { argName: serializedValue, ... }
← stop { argName: serializedValue, ..., async_0: resolvedOrPending }
← error [ErrorType] message\n    at line N: <source line>
```

**`ask`** — pauses the stream, renders a form, waits for the user to submit, assigns the form data to the sandbox variable, then **resumes generation silently** without injecting any message. The agent cannot see the form data until it calls `stop`.

The `←` prefix is a convention to visually distinguish host-injected messages from actual user input. These messages use `role: 'user'` so the agent sees them as conversational turns it must respond to by continuing code generation.

#### Injection Pattern (stop / error)

1. **Pause** the LLM stream.
2. **Update `{{SCOPE}}`** in the system prompt with current sandbox variables.
3. **Append** the agent's code since the last pause as `{ role: 'assistant', content: ... }`.
4. **Append** the payload as `{ role: 'user', content: '← stop/error { ... }' }`.
5. **Resume** LLM generation (agent continues as assistant).

#### Resume Pattern (ask)

1. **Pause** the LLM stream.
2. **Render** the form and wait for user submission.
3. **Assign** the form data to the sandbox variable (e.g., `input = { city: "Tokyo", budget: 200 }`).
4. **Resume** LLM generation immediately — **no message is appended**, the agent's assistant turn continues uninterrupted.

#### Serialization Rules

| Type | Serialization |
|------|--------------|
| `string` | JSON string (quoted, escaped) |
| `number`, `boolean`, `null` | JSON literal |
| `undefined` | the string `undefined` |
| `Array` | JSON array (truncated to first 50 elements with `... +N more` if longer) |
| `object` | JSON object (truncated to 20 keys with `... +N more` if larger) |
| `function` | `[Function: name]` |
| `Error` | `[Error: message]` |
| `Promise` | `[Promise: pending\|resolved\|rejected]` |
| Circular | `[Circular]` |
| Large strings (>2000 chars) | First 1000 + `... (truncated, 5432 chars total)` |

#### Argument Naming in `stop`

The host must attempt to recover meaningful names for `stop` arguments:

```ts
await stop(user.name)    // ← stop { "user.name": "Alice" }
await stop(x)            // ← stop { x: 42 }
await stop(arr.length)   // ← stop { "arr.length": 5 }
await stop(a, b, c)      // ← stop { a: 1, b: 2, c: 3 }
await stop(getX())       // ← stop { "arg_0": <value> }  (can't recover name)
```

Use AST analysis on the `stop(...)` call to extract argument source text as keys. Fall back to `arg_0`, `arg_1`, etc. for complex expressions.

### Incomplete Tasklist Reminder

When the LLM stream completes (stop token emitted) and a tasklist exists with incomplete tasks, the stream controller must **not** finalize the session. Instead:

1. Identify remaining tasks from `tasklistsState.plan.tasks` that have not been completed.
2. Inject a `⚠ [system]` prefixed user message listing the incomplete task IDs.
3. Resume LLM generation so the agent can continue working.

```
← ⚠ [system] Tasklist incomplete. Remaining: search_restaurants, present_results. Continue from where you left off.
```

This follows the same injection pattern as `stop`/`error`: pause → update `{{SCOPE}}` → append assistant code → append user message → resume.

The host limits reminder cycles to a configurable maximum (default: 3). After exceeding the limit, the session ends with a warning displayed to the user.
