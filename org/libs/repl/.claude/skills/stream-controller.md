# Stream Controller — Implementation Guide

## Overview

The Stream Controller manages the LLM connection, token accumulation, pause/resume, and context injection. It sits between the LLM provider and the REPL sandbox.

**Full specification:** [docs/host-runtime-contract/stream-controller.md](../../docs/host-runtime-contract/stream-controller.md)

## Key Interfaces

### LineAccumulator

Tracks bracket depth, string context, and comment state to determine when a buffered line is a complete TypeScript statement:

```ts
interface LineAccumulator {
  buffer: string
  bracketDepth: { round: number; curly: number; angle: number; square: number }
  inString: false | "'" | '"' | '`'
  inComment: false | '//' | '/*'
  inJsx: boolean
}
```

`isComplete(acc)` returns true when all bracket depths are 0, not inside a string/comment, and not in JSX. On true after a newline, flush to REPL.

## Statement Completeness Heuristic

A "line" is a complete TypeScript statement, determined by:
- A newline where accumulated text forms a syntactically complete statement
- Closing of a multi-line construct (object literal, template literal, JSX block, function body)

Track `{` `}` `(` `)` `<` `>` (for JSX) and `[` `]` bracket depth, plus string context (backticks, quotes).

## Pause / Resume State Machine

Pause is triggered by:
- `await stop(...)` — pause, evaluate args, inject user message with values, resume
- `await ask(...)` — pause, render form, wait for submit, assign to sandbox, resume **silently** (no message)
- Runtime/type error — pause, inject user message with error, resume
- User intervention — pause, finalize assistant turn, inject user message (raw text, no `←` prefix), update `{{SCOPE}}`, resume
- `async(...)` — **no pause** (register background task only)

## Context Injection Pattern

Two types of interruptions inject `role: 'user'` messages:

### stop / error injection
1. Pause the LLM stream
2. Update `{{SCOPE}}` in the system prompt
3. Append agent code so far as `{ role: 'assistant', content: ... }`
4. Append payload as `{ role: 'user', content: '← stop/error { ... }' }`
5. Resume LLM generation

### ask resume (silent)
1. Pause the LLM stream
2. Render form, wait for submission
3. Assign form data to sandbox variable
4. Resume LLM generation — **no message appended**, assistant turn continues

## Serialization Rules

| Type | Serialization |
|------|--------------|
| `string` | JSON string (quoted, escaped) |
| `number`, `boolean`, `null` | JSON literal |
| `undefined` | the string `undefined` |
| `Array` | JSON array (truncated to first 50 elements with `... +N more`) |
| `object` | JSON object (truncated to 20 keys with `... +N more`) |
| `function` | `[Function: name]` |
| `Error` | `[Error: message]` |
| `Promise` | `[Promise: pending|resolved|rejected]` |
| Circular | `[Circular]` |
| Large strings (>2000 chars) | First 1000 + `... (truncated, N chars total)` |

## Argument Naming in stop

Use AST analysis on `stop(...)` call to extract argument source text as keys:
- `await stop(user.name)` → `{ "user.name": "Alice" }`
- `await stop(x)` → `{ x: 42 }`
- `await stop(getX())` → `{ "arg_0": <value> }` (fallback for complex expressions)

## Incomplete Task Reminder

When LLM stream completes (stop token) with any tasklist that has incomplete tasks:
1. Do **not** finalize the session
2. Find the first tasklist with remaining tasks from `tasklistsState.tasklists`
3. Inject `⚠ [system] Tasklist "<tasklistId>" incomplete. Remaining: <ids>. Continue from where you left off.` as user message
4. Resume LLM generation (same injection pattern as stop/error)
5. Limit to `maxTasklistReminders` (default: 3) cycles to prevent infinite loops
