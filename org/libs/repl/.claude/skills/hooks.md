# Developer Hooks — Implementation Guide

## Overview

The hook system lets developers register AST pattern matchers against the agent's code stream. When a pattern matches, the developer's callback fires — it can observe, side-effect, transform, or interrupt execution. This is the primary extension point for the agent runtime.

**Full specification:** [docs/host-runtime-contract/developer-hooks.md](../../docs/host-runtime-contract/developer-hooks.md)

## Core Interfaces

```ts
interface Hook {
  id: string
  label: string
  pattern: ASTPattern
  phase: 'before' | 'after'
  handler: (match: HookMatch, ctx: HookContext) => HookAction | Promise<HookAction>
}

type ASTPattern =
  | { type: string; [property: string]: any }  // node type + property filters
  | { oneOf: ASTPattern[] }                     // OR combinator
  | { type: string; not: ASTPattern }           // negation

type HookAction =
  | { type: 'continue' }
  | { type: 'side_effect'; fn: () => void | Promise<void> }
  | { type: 'transform'; newSource: string }
  | { type: 'interrupt'; message: string }
  | { type: 'skip'; reason?: string }
```

## Pattern Language

- **Basic patterns:** Match by node type: `{ type: 'CallExpression' }`
- **Property filters:** Narrow by AST properties: `{ type: 'CallExpression', callee: { name: 'fetchPatientData' } }`
- **Captures:** `$` prefix extracts sub-nodes: `{ id: { name: '$varName' } }` → `match.captures.varName`
- **Wildcards:** `{ type: '*' }` matches any node
- **OR combinator:** `{ oneOf: [...patterns] }`
- **Negation:** `{ type: 'VariableDeclaration', not: { type: 'AwaitExpression' } }`

## Hook Actions

| Action | Effect | Phase |
|--------|--------|-------|
| `continue` | Observe only, execution proceeds | before/after |
| `side_effect` | Run external logic concurrently, statement executes as-is | before/after |
| `transform` | Rewrite source before execution (agent doesn't see change) | before only |
| `interrupt` | Pause stream, inject user message with `⚠ [hook:id]` prefix | before only |
| `skip` | Drop statement entirely (agent doesn't know) | before only |

## Execution Pipeline

For each complete statement:
1. Parse AST
2. Run 'before' hooks (matching registration order)
   - `skip` or `interrupt` is **terminal** — subsequent hooks don't run
   - Multiple `transform` actions compose
   - `side_effect` actions all fire
3. Transpile and execute
4. Run 'after' hooks (can only `continue` or `side_effect`)

## Hook Error Handling

- On handler throw/reject: error logged, hook skipped (treated as `continue`)
- After 3+ consecutive failures: hook disabled for rest of session
- Hooks must never crash the agent runtime

## Built-in Hooks (Optional)

| Hook ID | Pattern | Action | Purpose |
|---------|---------|--------|---------|
| `await-guard` | `CallExpression` not inside `AwaitExpression` | `interrupt` | Catch missing awaits |
| `scope-guard` | `VariableDeclaration` where name shadows global | `interrupt` | Prevent accidental overwrites |
| `display-logger` | `CallExpression` → `display` | `side_effect` | Audit UI output |
| `cost-tracker` | `CallExpression` matching API functions | `side_effect` | Track API costs |
