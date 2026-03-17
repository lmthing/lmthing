# Session Lifecycle — Implementation Guide

## Overview

Covers the session state machine, message wire format, complete type definitions, and the full execution trace example.

**Full specification:**
- [docs/host-runtime-contract/security-and-lifecycle.md](../../docs/host-runtime-contract/security-and-lifecycle.md)
- [docs/host-runtime-contract/wire-format-and-types.md](../../docs/host-runtime-contract/wire-format-and-types.md)

## Session State Machine

```
INIT
  → Create sandbox, inject globals, compose system prompt, send to LLM

STREAM LOOP
  → Accumulate tokens into line buffer
  → On complete statement: execute in sandbox
    → error?      → pause, update {{SCOPE}}, inject error as user message, resume
    → stop()?     → pause, update {{SCOPE}}, inject values as user message, resume
    → ask()?      → pause, render form, wait for submit, assign to sandbox, resume silently
    → display()   → render component, continue
    → async()     → register task (+ abort controller), continue
    → tasklist(tasklistId, description, tasks) → register plan in tasklists map, render progress UI, continue
    → completeTask(tasklistId, id, output)  → check readyTasks, record completion, recompute readyTasks, update progress UI, continue
    → completeTaskAsync(tasklistId, taskId, fn) → check readyTasks, mark running, spawn via AsyncManager, continue
    → taskProgress(tasklistId, taskId, message, percent?) → validate task exists & is ready/running, update progress UI, continue
    → failTask(tasklistId, taskId, error) → record failure, unblock dependents if optional, update UI, continue
    → retryTask(tasklistId, taskId) → reset failed task to ready (if retries remain), update UI, continue
    → sleep(seconds) → pause sandbox execution (not stream), async tasks continue, resume after delay
    → loadKnowledge(selector) → read files from knowledge dir, emit knowledge_loaded event, return content, continue
  → On user intervention:
    → pause, update {{SCOPE}}, finalize assistant turn, inject user message, resume
  → On user pause:
    → halt stream, wait for resume or user message
  → On async task cancel:
    → abort task, store cancellation result, deliver in next stop()

COMPLETION
  → LLM emits stop token
  → If any tasklist has incomplete tasks:
    → Wait for any runningTasks (async completions) to finish or timeout before nudging
    → Build DAG-aware reminder with ready/blocked/failed task info and {{TASKS}} block
    → inject ⚠ [system] tasklist reminder as user message, resume generation
    → repeat up to maxTasklistReminders (default: 3) times
  → Drain remaining async tasks (with timeout)
  → Final render pass
  → Session complete

CLEANUP
  → Destroy sandbox, unmount components, close LLM connection, clear abort controllers
```

## SessionConfig

```ts
interface SessionConfig {
  functionTimeout: number       // default: 30_000
  askTimeout: number            // default: 300_000
  sessionTimeout: number        // default: 600_000
  maxStopCalls: number          // default: 50
  maxAsyncTasks: number         // default: 10
  maxTasklistReminders: number  // default: 3
  maxContextTokens: number      // default: 100_000
  serializationLimits: {
    maxStringLength: number     // default: 2_000
    maxArrayElements: number    // default: 50
    maxObjectKeys: number       // default: 20
    maxDepth: number            // default: 5
  }
  workspace: {
    maxScopeVariables: number   // default: 50
    maxScopeValueWidth: number  // default: 50 chars
    maxScopeTokens: number      // default: 3_000
  }
  contextWindow: {
    codeWindowLines: number     // default: 200
    stopDecayTiers: {
      full: number              // default: 2
      keysOnly: number          // default: 5
      summary: number           // default: 10
    }
    neverTruncateInterventions: boolean  // default: true
  }
  maxTaskRetries: number         // default: 3
  maxTasksPerTasklist: number    // default: 20
  taskAsyncTimeout: number       // default: 60_000
  sleepMaxSeconds: number        // default: 30
}
```

## Message Wire Format

### Turn boundaries
- Only `stop` and `error` create turn boundaries
- `ask` resumes silently — assistant turn continues unbroken
- User interventions create turn boundaries (raw text, no `←` prefix)

### Message patterns:
```ts
// Initial: [system] + [user] request
// After stop: [assistant] code + [user] ← stop { ... }
// After error: [assistant] code + [user] ← error [Type] ...
// After ask: NO new messages (silent resume)
// After intervention: [assistant] code + [user] raw message
```

## Key Type Definitions

```ts
// Payloads
interface StopPayload { [argNameOrExpression: string]: SerializedValue }
interface ErrorPayload { type: string; message: string; line: number; source: string }
interface AsyncCancellation { cancelled: true; message: string }
interface AskCancellation { _cancelled: true }

// Host-injected globals
declare function stop(...values: any[]): Promise<void>
declare function display(element: React.ReactElement): void
declare function ask(formElement: React.ReactElement): Promise<Record<string, any>>
declare function async(fn: () => Promise<void>): void
declare function tasklist(tasklistId: string, description: string, tasks: TaskDefinition[]): void
declare function completeTask(tasklistId: string, id: string, output: Record<string, any>): void
declare function completeTaskAsync(tasklistId: string, taskId: string, fn: () => Promise<Record<string, any>>): void
declare function taskProgress(tasklistId: string, taskId: string, message: string, percent?: number): void
declare function failTask(tasklistId: string, taskId: string, error: string): void
declare function retryTask(tasklistId: string, taskId: string): void
declare function sleep(seconds: number): Promise<void>
declare function loadKnowledge(selector: KnowledgeSelector): KnowledgeContent

// Task definitions
interface TaskDefinition {
  id: string
  instructions: string
  outputSchema: Record<string, { type: string }>
  dependsOn?: string[]         // task IDs this task depends on (DAG)
  condition?: string           // JS expression; if falsy, auto-skip
  optional?: boolean           // default: false — optional tasks can be skipped without blocking dependents
}

// Task completion record
interface TaskCompletion {
  output: Record<string, any>
  timestamp: number
  status: 'completed' | 'failed' | 'skipped'
  error?: string
  duration?: number
}

// Tasklist state tracking
interface TasklistState {
  plan: Tasklist
  completed: Map<string, TaskCompletion>
  readyTasks: Set<string>
  runningTasks: Set<string>
  outputs: Map<string, Record<string, any>>
}
```
