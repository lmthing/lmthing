## 11. Security

### Sandbox Isolation

The REPL sandbox must **not** have access to:
- Host filesystem (beyond explicitly provided functions)
- Network (beyond explicitly provided functions)
- `process`, `require`, `import()`, `eval`, `Function` constructor
- `globalThis` modification beyond the injected API

### Function Registry

All agent-accessible functions are proxy-wrapped to enforce argument types, add timeouts (default 30s), log invocations, and rate-limit.

### JSX Sanitization

- Disallow `dangerouslySetInnerHTML`
- Disallow `<script>` tags
- Disallow `javascript:` URLs
- Validate that `ask` forms only contain registered input components

---

## 12. Session Lifecycle

```
INIT
  → Create sandbox, inject globals, compose system prompt, send to LLM

STREAM LOOP
  → Accumulate tokens into line buffer
  → On complete statement: execute in sandbox
    → error?             → pause, update {{SCOPE}}, append user message with error, resume
    → stop()?            → pause, update {{SCOPE}}, append user message with values, resume
    → ask()?             → pause, render form, wait for submit, assign to sandbox, resume silently
    → display()          → render component, continue
    → async()            → register task (+ abort controller), continue
    → tasklist()         → register plan, render progress UI, continue
    → completeTask()     → validate output, record completion, update progress UI, continue
  → On user intervention (message sent mid-execution):
    → pause, update {{SCOPE}}, finalize assistant turn, append user message, resume
  → On user pause:
    → halt stream, wait for resume or user message
  → On async task cancel (from sidebar):
    → abort task, store cancellation result, deliver in next stop()

COMPLETION
  → LLM emits stop token
  → If tasklist exists with incomplete tasks:
    → inject ⚠ [system] reminder as user message, resume generation
    → repeat up to maxTasklistReminders (default: 3) times
  → Drain remaining async tasks (with timeout)
  → Final render pass
  → Session complete

CLEANUP
  → Destroy sandbox, unmount components, close LLM connection, clear abort controllers
```
