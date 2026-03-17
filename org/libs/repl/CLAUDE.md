# CLAUDE.md — Streaming TypeScript REPL Agent

## Project Overview

A streaming TypeScript REPL agent system that executes LLM-generated code line-by-line with control primitives (`stop`, `display`, `ask`, `async`, `tasklist`, `completeTask`, `completeTaskAsync`, `taskProgress`, `failTask`, `retryTask`, `sleep`, `loadKnowledge`) and a React render surface. The agent writes only TypeScript — no prose — and the host runtime parses, executes, and renders in real time.

No code exists yet. This package contains specifications only.

## Architecture

```
┌─────────────┐     token stream     ┌──────────────────┐     execute     ┌──────────────┐
│  LLM Agent  │ ──────────────────▶  │  Stream Parser &  │ ─────────────▶ │  TypeScript   │
│  (provider) │ ◀──────────────────  │  Line Accumulator │ ◀──────────── │  REPL Sandbox │
│             │   context injection  │                   │    results     │              │
└─────────────┘                      └──────────────────┘                └──────────────┘
                                            │                                   │
                                            ▼                                   │
                                     ┌──────────────┐                          │
                                     │  React       │ ◀────────────────────────┘
                                     │  Render      │    display() / ask() calls
                                     │  Surface     │
                                     └──────────────┘
```

Four subsystems:
1. **Stream Controller** — LLM connection, token accumulation, pause/resume, context injection
2. **Line Parser** — buffers tokens into complete statements, detects global calls
3. **REPL Sandbox** — executes TypeScript line-by-line, persistent scope, error capture
4. **React Render Surface** — mounts components from `display`/`ask`, handles forms

## Quick Reference

| Topic | Skill File |
|-------|-----------|
| Token accumulation, pause/resume, context injection, serialization | [.claude/skills/stream-controller.md](.claude/skills/stream-controller.md) |
| Sandbox setup, scope persistence, TS compilation, error capture | [.claude/skills/repl-sandbox.md](.claude/skills/repl-sandbox.md) |
| stop, display, ask, async, tasklist, completeTask, completeTaskAsync, taskProgress, failTask, retryTask, sleep, loadKnowledge — implementation details | [.claude/skills/globals.md](.claude/skills/globals.md) |
| AST pattern matching, hook actions, execution pipeline | [.claude/skills/hooks.md](.claude/skills/hooks.md) |
| SCOPE generation, knowledge tree, code window, stop payload decay, {{TASKS}} block | [.claude/skills/context-management.md](.claude/skills/context-management.md) |
| State machine, wire format, SessionConfig, type definitions | [.claude/skills/session-lifecycle.md](.claude/skills/session-lifecycle.md) |
| Sandbox isolation, function registry, JSX sanitization | [.claude/skills/security.md](.claude/skills/security.md) |

## Specification Documents

| Document | Location |
|----------|----------|
| Agent System Prompt (what the LLM sees) | [docs/agent-system-prompt/](docs/agent-system-prompt/index.md) |
| Host Runtime Contract (how the host implements the protocol) | [docs/host-runtime-contract/](docs/host-runtime-contract/index.md) |
| UX Specification (what the user sees and interacts with) | [docs/ux-specification/](docs/ux-specification/index.md) |

## Key Concepts

### 12 Globals
- **`stop(...values)`** — Pause execution, serialize args, inject as user message. The agent's only way to read runtime values.
- **`display(jsx)`** — Non-blocking render of React components to the user's viewport.
- **`ask(jsx)`** — Blocking form render. Resumes silently — agent must call `stop` to see values.
- **`async(fn)`** — Fire-and-forget background task. Results delivered via next `stop` call.
- **`tasklist(tasklistId, description, tasks)`** — Declare a task plan with milestones before starting work. Each task has `id`, `instructions`, and `outputSchema`. Tasks can declare `dependsOn` for DAG dependencies, `condition` for conditional execution, and `optional` for non-blocking failure. Can be called multiple times per session with different `tasklistId` values.
- **`completeTask(tasklistId, taskId, output)`** — Mark a task as complete with validated output. Must include the `tasklistId`. Task must be in the `readyTasks` set (all dependencies satisfied). If the agent's stream ends with incomplete tasks, the host injects a reminder and resumes generation.
- **`completeTaskAsync(tasklistId, taskId, fn)`** — Launch task work in the background. The async function's return value becomes the task output, delivered via the next `stop()` call with `task:<taskId>` keys.
- **`taskProgress(tasklistId, taskId, message, percent?)`** — Report incremental progress within a running task. Synchronous, non-blocking.
- **`failTask(tasklistId, taskId, error)`** — Mark a task as failed. Optional tasks that fail don't block dependents.
- **`retryTask(tasklistId, taskId)`** — Reset a failed task back to ready. Limited by `maxTaskRetries` (default: 3).
- **`sleep(seconds)`** — Pause sandbox execution for a specified duration. Async tasks continue during sleep. Agent must call `stop()` after to read results.
- **`loadKnowledge(selector)`** — Synchronously load markdown files from the space's knowledge base. The selector mirrors the knowledge tree: `{ domain: { field: { option: true } } }`. Returns the same structure with markdown content as values.

### Conversation Protocol
- `stop` and `error` create turn boundaries (inject `role: 'user'` messages with `←` prefix)
- `ask` resumes silently — no message injected, assistant turn continues
- User interventions inject raw text (no prefix) — agent adjusts via `//` comments
- Hook interrupts inject `⚠ [hook:id]` prefixed messages
- Incomplete task reminders inject `⚠ [system] Tasklist "<tasklistId>" incomplete. Ready: <ids>. Blocked: <id> (waiting on <deps>). Failed: <id>. Continue with a ready task.` prefixed messages when the agent's stream ends before all non-optional tasks are complete

### Context Management
- **`{{SCOPE}}`** — Live variable table in system prompt, replaced on every injection. Never compressed. Agent's source of truth.
- **Code window** — Sliding window (default 200 lines). Older code summarized to `// [lines N-M executed] declared: ...`
- **Stop payload decay** — 4 tiers by distance: full → keys only → count → removed
- **`{{TASKS}}`** — Task state block appended to every `stop()` message showing current state of all active tasklists. Decays separately: full (0-2 turns), compact (3-5), removed (6+).
- **User messages** — Never compressed

### Developer Hooks
AST-based code interception with 5 actions: `continue`, `side_effect`, `transform`, `interrupt`, `skip`. Hooks fire between parse and execute. Registered at session init.

## Implementation Order

Suggested build sequence:

1. **REPL Sandbox** — vm.Context, scope persistence, TS transpilation, error capture
2. **Stream Controller** — LineAccumulator, bracket depth tracking, statement completeness
3. **Globals** — `stop` (with argument name recovery), `display`, `ask`, `async`, `tasklist`, `completeTask`, `completeTaskAsync`, `taskProgress`, `failTask`, `retryTask`, `sleep`
4. **Workspace State** — SCOPE table generation, system prompt mutation
5. **Context Management** — Code window compression, stop payload decay
6. **Developer Hooks** — AST pattern matching, hook actions, execution pipeline
7. **User Intervention** — Pause/resume, message injection, ask cancellation
8. **React Render Surface** — Component mounting, form rendering, form data extraction
9. **Async Tasks** — Background task registration, cancellation, AbortController
10. **Security** — Sandbox isolation, function registry proxy, JSX sanitization

## Dependencies

- **TypeScript compiler API** — AST parsing, transpile-only compilation, hook pattern matching
- **Node.js `vm` or `isolated-vm`** — Sandbox execution with persistent scope
- **React** — Render surface for `display` and `ask` components
- **Vercel AI SDK v6** — `streamText()` for LLM streaming, token consumption
