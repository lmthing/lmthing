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
  → On user intervention:
    → pause, update {{SCOPE}}, finalize assistant turn, inject user message, resume
  → On user pause:
    → halt stream, wait for resume or user message
  → On async task cancel:
    → abort task, store cancellation result, deliver in next stop()

COMPLETION
  → LLM emits stop token
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
```
