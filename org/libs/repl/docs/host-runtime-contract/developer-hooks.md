## 8. Developer Hooks — AST-Based Code Interception

The host exposes a hook system that lets developers register **AST pattern matchers** against the agent's code stream. When a pattern matches, the developer's callback fires — it can observe, side-effect, transform, or interrupt execution. This is the primary extension point for integrating domain logic with the agent runtime.

### Concept

Every complete statement the agent writes is parsed into an AST before execution. The hook system walks the AST, checks it against registered patterns, and fires matching callbacks **between parse and execute** — giving developers a synchronous interception point.

```
  tokens arrive → accumulate → complete statement → parse AST
                                                        │
                                                   ┌────▼─────┐
                                                   │ Run hooks │
                                                   └────┬─────┘
                                                        │
                              ┌──────────────┬──────────┼──────────┬─────────────┐
                              │              │          │          │             │
                           observe      side-effect  transform  interrupt     skip
                              │              │          │          │             │
                              ▼              ▼          ▼          ▼             ▼
                           execute        execute    execute    pause +      drop
                           as-is          as-is      modified   inject msg   statement
```

### Hook Registration

```ts
interface Hook {
  /** Unique identifier for this hook */
  id: string

  /** Human-readable label (shown in UI debug panel) */
  label: string

  /** AST pattern to match — see Pattern Language below */
  pattern: ASTPattern

  /**
   * When in the pipeline this hook fires.
   * 'before' = after parse, before execute (can transform/interrupt/skip)
   * 'after'  = after successful execution (can observe/side-effect)
   */
  phase: 'before' | 'after'

  /**
   * The callback. Receives the matched AST node, the source code,
   * and a context object. Returns a HookAction.
   */
  handler: (match: HookMatch, ctx: HookContext) => HookAction | Promise<HookAction>
}

interface HookMatch {
  /** The AST node that matched the pattern */
  node: ts.Node
  /** The full source line/statement */
  source: string
  /** Captured sub-nodes from the pattern (named captures) */
  captures: Record<string, ts.Node>
  /** Line number in the agent's output */
  line: number
}

interface HookContext {
  /** Current sandbox scope — read variable values */
  scope: Record<string, any>
  /** Session metadata */
  session: { id: string; turnIndex: number; lineIndex: number }
  /** The full AST of the current statement */
  ast: ts.SourceFile
  /** Registered async tasks */
  asyncTasks: Map<string, { status: string }>
}

type HookAction =
  | { type: 'continue' }
  | { type: 'side_effect'; fn: () => void | Promise<void> }
  | { type: 'transform'; newSource: string }
  | { type: 'interrupt'; message: string }
  | { type: 'skip'; reason?: string }
```

Hooks are registered at session init, before the agent starts generating:

```ts
session.registerHook({
  id: 'log-declarations',
  label: 'Log variable declarations',
  pattern: { type: 'VariableDeclaration' },
  phase: 'after',
  handler: (match, ctx) => {
    console.log(`Agent declared: ${match.source}`)
    return { type: 'continue' }
  }
})
```

### Pattern Language

Patterns are objects that match against TypeScript AST nodes. The matching engine walks the statement's AST and fires the hook for every node that satisfies the pattern.

#### Basic patterns — match by node type

```ts
// Match any variable declaration (const, let, var)
{ type: 'VariableDeclaration' }

// Match any function call expression
{ type: 'CallExpression' }

// Match any await expression
{ type: 'AwaitExpression' }

// Match any assignment expression
{ type: 'AssignmentExpression' }
```

#### Property filters — narrow by AST properties

```ts
// Match only 'const' declarations
{ type: 'VariableDeclaration', kind: 'const' }

// Match calls to a specific function
{ type: 'CallExpression', callee: { name: 'fetchPatientData' } }

// Match calls to any method on a specific object
{ type: 'CallExpression', callee: { object: { name: 'db' } } }

// Match declarations of a specific variable name
{ type: 'VariableDeclaration', declarations: [{ id: { name: 'config' } }] }
```

#### Captures — extract sub-nodes for the handler

```ts
// Capture the variable name and initializer of any const declaration
{
  type: 'VariableDeclaration',
  kind: 'const',
  declarations: [{
    id: { name: '$varName' },      // $ prefix = capture as 'varName'
    init: '$initializer'            // capture the whole initializer node
  }]
}
// handler receives: match.captures.varName, match.captures.initializer

// Capture all arguments to a specific function call
{
  type: 'CallExpression',
  callee: { name: 'display' },
  arguments: '$args'                // capture the arguments array
}
```

#### Wildcard and compound patterns

```ts
// Match any node type (useful for capturing)
{ type: '*' }

// Match any of several patterns (OR)
{ oneOf: [
  { type: 'CallExpression', callee: { name: 'fetchData' } },
  { type: 'CallExpression', callee: { name: 'queryDB' } },
] }

// Match a pattern only if another pattern is NOT present in the same statement
{ type: 'VariableDeclaration', not: { type: 'AwaitExpression' } }
// → matches declarations without await (the agent forgot to await)
```

### Hook Actions

#### `continue` — observe only

The default. The hook saw the node, did nothing. Execution proceeds normally.

```ts
handler: (match) => {
  metrics.trackDeclaration(match.captures.varName)
  return { type: 'continue' }
}
```

#### `side_effect` — run external logic, don't block

Runs a function alongside execution. The statement executes as-is. The side effect runs concurrently. Useful for logging, metrics, syncing state to external systems.

```ts
handler: (match, ctx) => ({
  type: 'side_effect',
  fn: async () => {
    await auditLog.record({
      event: 'data_access',
      function: match.captures.callee.getText(),
      scope: ctx.session.id,
    })
  }
})
```

#### `transform` — rewrite the code before execution

Replaces the source code before it is executed. The agent does **not** see the transformation — its context still contains the original code. Only the sandbox receives the modified version.

Use cases: injecting middleware, adding instrumentation, wrapping calls with auth, enforcing policies.

```ts
// Wrap all database calls with a transaction
session.registerHook({
  id: 'auto-transaction',
  label: 'Wrap DB calls in transaction',
  pattern: { type: 'CallExpression', callee: { object: { name: 'db' } } },
  phase: 'before',
  handler: (match) => ({
    type: 'transform',
    newSource: match.source.replace(
      /db\.(\w+)\(/,
      'db.withinTransaction(txn => txn.$1('
    ) + '))'
  })
})
```

**Safety:** Transformed code is re-parsed and re-type-checked before execution. If the transformation produces invalid code, the hook is skipped and the original code executes.

#### `interrupt` — pause and inject a user message

Halts the agent's stream and injects a `role: 'user'` message, exactly like a user intervention. The agent sees the message and adjusts its behavior. The hook decides what the message says.

```ts
// Interrupt if the agent tries to delete data without confirmation
session.registerHook({
  id: 'delete-guard',
  label: 'Guard destructive operations',
  pattern: { type: 'CallExpression', callee: { name: 'deleteRecord' } },
  phase: 'before',
  handler: (match) => ({
    type: 'interrupt',
    message: `⚠ Hold on — you're about to call deleteRecord(). Please confirm with the user via ask() before deleting data.`
  })
})
```

The interrupt message is injected using the same mechanism as user intervention (§6): pause, finalize assistant turn, append user message (with a configurable prefix, default `⚠ [hook:${hookId}]`), update scope, resume.

**The agent treats hook interrupts like any other user message.** It reads the message, acknowledges it with a comment, and adjusts. No special protocol is needed.

#### `skip` — drop the statement entirely

The statement is **not executed**. The agent doesn't know — its context still contains the line, but the sandbox never ran it. An optional reason is logged.

Use with caution — skipping can cause the agent to reference variables that were never created. Best used for defensive filtering (e.g., skip attempts to override globals, skip redundant fetches).

```ts
// Skip redundant data fetches if the variable already exists
session.registerHook({
  id: 'dedup-fetches',
  label: 'Skip redundant fetches',
  pattern: {
    type: 'VariableDeclaration',
    declarations: [{ init: { type: 'AwaitExpression' } }]
  },
  phase: 'before',
  handler: (match, ctx) => {
    const varName = match.captures?.varName
    if (varName && ctx.scope[varName] !== undefined) {
      return { type: 'skip', reason: `${varName} already in scope` }
    }
    return { type: 'continue' }
  }
})
```

### Hook Execution Pipeline

The full execution pipeline for a single statement:

```ts
async function executeStatement(source: string, lineNumber: number): Promise<void> {
  // 1. Parse
  const ast = ts.createSourceFile('line.ts', source, ts.ScriptTarget.ESNext, true)

  // 2. Run 'before' hooks
  let finalSource = source
  for (const hook of getMatchingHooks(ast, 'before')) {
    const match = buildMatch(hook, ast, source, lineNumber)
    const action = await hook.handler(match, buildContext())

    switch (action.type) {
      case 'continue':
        break
      case 'side_effect':
        // Fire-and-forget
        action.fn().catch(err => hookErrorLog.record(hook.id, err))
        break
      case 'transform':
        // Re-parse to validate
        try {
          ts.createSourceFile('transformed.ts', action.newSource, ts.ScriptTarget.ESNext, true)
          finalSource = action.newSource
        } catch {
          hookErrorLog.record(hook.id, 'Transform produced invalid code, skipped')
        }
        break
      case 'interrupt':
        // Pause agent, inject message, resume
        handleHookInterrupt(hook, action.message, source, lineNumber)
        return  // statement is NOT executed — agent will re-approach after seeing the message
      case 'skip':
        hookLog.record(hook.id, `Skipped line ${lineNumber}: ${action.reason ?? ''}`)
        return  // statement is NOT executed
    }
  }

  // 3. Transpile and execute
  const js = transpile(finalSource)
  const result = await vm.runInContext(js, sandbox, { timeout: 30_000 })

  // 4. Run 'after' hooks
  for (const hook of getMatchingHooks(ast, 'after')) {
    const match = buildMatch(hook, ast, source, lineNumber)
    const action = await hook.handler(match, buildContext())

    // 'after' hooks can only continue or side_effect
    if (action.type === 'side_effect') {
      action.fn().catch(err => hookErrorLog.record(hook.id, err))
    }
  }
}
```

### Hook Ordering

Multiple hooks can match the same statement. Execution order:

1. Hooks are run in **registration order** (first registered, first run).
2. A `skip` or `interrupt` action is **terminal** — subsequent hooks for that phase are not run.
3. Multiple `transform` actions compose — each transformation's output is the next's input.
4. `side_effect` actions are all fired (non-exclusive).

### Hook Error Handling

If a hook handler throws an error or rejects:

1. The error is logged to the hook error log.
2. The hook is **skipped** — execution continues as if the hook returned `{ type: 'continue' }`.
3. If the same hook fails 3+ times consecutively, it is **disabled** for the rest of the session with a warning in the hook log.

Hooks must never crash the agent runtime.

### Built-in Hooks (Optional)

The host may ship with optional built-in hooks that developers can enable:

| Hook ID | Pattern | Action | Purpose |
|---------|---------|--------|---------|
| `await-guard` | `CallExpression` not inside `AwaitExpression` | `interrupt`: "You forgot to await this call." | Catch missing awaits before they cause issues |
| `scope-guard` | `VariableDeclaration` where name shadows a global | `interrupt`: "This shadows the global `X`." | Prevent accidental overwrites |
| `display-logger` | `CallExpression` where callee is `display` | `side_effect`: log rendered components | Audit trail of UI output |
| `cost-tracker` | `CallExpression` matching registered API functions | `side_effect`: increment cost counter | Track API costs per session |
