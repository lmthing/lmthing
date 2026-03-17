# REPL Sandbox — Implementation Guide

## Overview

The REPL sandbox executes TypeScript line-by-line, maintains a persistent scope across the session, and captures errors. It is the execution engine that runs the agent's code.

**Full specification:** [docs/host-runtime-contract/repl-sandbox.md](../../docs/host-runtime-contract/repl-sandbox.md)

## Scope Persistence

The sandbox maintains a **single persistent scope** across the entire session. Variables declared with `const`, `let`, or `var` survive across executed lines.

Implementation options:
- **`vm` module (Node.js):** Create a single `vm.Context` and execute each statement with `vm.runInContext`
- **Isolated-vm:** For stronger sandboxing, use `isolated-vm` with a persistent `Context`
- **Custom evaluator:** Wrap statements in an async IIFE that captures and re-exports scope

## TypeScript Compilation

Use the TypeScript compiler API in **transpile-only mode**:

```ts
import ts from 'typescript'

function transpile(code: string): string {
  const result = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      strict: false,
      esModuleInterop: true,
    }
  })
  return result.outputText
}
```

## Injected Globals

Before the agent's first line executes, inject into the sandbox scope:

```ts
// Control-flow primitives
globalThis.stop = async (...args: any[]) => { /* see globals skill */ }
globalThis.display = (jsx: React.ReactElement) => { /* see globals skill */ }
globalThis.ask = async (jsx: React.ReactElement) => { /* see globals skill */ }
globalThis.async = (fn: () => Promise<void>) => { /* see globals skill */ }
globalThis.tasklist = (tasklistId: string, description: string, tasks: TaskDefinition[]) => { /* see globals skill */ }
globalThis.completeTask = (tasklistId: string, id: string, output: Record<string, any>) => { /* see globals skill */ }
globalThis.loadKnowledge = (selector: KnowledgeSelector) => { /* see globals skill */ }

// React (required for transpiled JSX)
globalThis.React = React

// All domain functions + React components from the function registry
```

## Error Capture Pattern

```ts
async function executeLine(code: string, lineNumber: number): Promise<LineResult> {
  try {
    const js = transpile(code)
    const result = await vm.runInContext(js, sandbox, { timeout: 30_000 })
    return { ok: true, result }
  } catch (err) {
    return {
      ok: false,
      error: {
        type: err.constructor.name,
        message: err.message,
        line: lineNumber,
        source: code.trim(),
      }
    }
  }
}
```

On error, the stream controller pauses, updates `{{SCOPE}}`, and injects the error as a `role: 'user'` message.

## Scope Tracking Approaches

The host must track which variable names the agent has declared:

1. **AST analysis (recommended):** Before executing each statement, parse it and extract `const`/`let`/`var` declarations and destructuring bindings. Maintain a `Set<string>` of declared names.
2. **Scope diffing:** After each execution, compare `Object.keys(sandbox)` against the previous snapshot. Simplest but can miss variables that shadow existing globals.
3. **Proxy-based:** Wrap the sandbox context in a Proxy that traps `set` operations.
