## 2. REPL Sandbox

### Scope Persistence

The sandbox maintains a **single persistent scope** across the entire agent session. Variables declared with `const`, `let`, or `var` survive across executed lines. This is critical — the agent may reference a variable declared 50 lines ago.

Implementation options:
- **`vm` module (Node.js):** Create a single `vm.Context` and execute each statement with `vm.runInContext`.
- **Isolated-vm:** For stronger sandboxing, use `isolated-vm` with a persistent `Context`.
- **Custom evaluator:** Wrap statements in an async IIFE that captures and re-exports scope.

### TypeScript Compilation

Each line buffer must be compiled from TypeScript to JavaScript before execution. Use the TypeScript compiler API in **transpile-only mode** for speed:

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

### Injected Globals

Before the agent's first line executes, inject into the sandbox scope:

```ts
// Control-flow primitives
globalThis.stop = async (...args: any[]) => { /* see §3 */ }
globalThis.display = (jsx: React.ReactElement) => { /* see §4 */ }
globalThis.ask = async (jsx: React.ReactElement) => { /* see §4 */ }
globalThis.async = (fn: () => Promise<void>) => { /* see §5 */ }

// React (required for transpiled JSX)
globalThis.React = React

// All domain functions from the function registry
globalThis.getUser = boundGetUser
globalThis.searchProducts = boundSearchProducts
// ... etc.

// All domain React components
globalThis.ProductGrid = ProductGridComponent
globalThis.TextInput = TextInputComponent
globalThis.Select = SelectComponent
// ... etc.
```

### Error Capture

Wrap each line's execution in try/catch:

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

On error, the stream controller pauses, updates `{{SCOPE}}`, and injects the error as a `role: 'user'` message (same pattern as `stop`). Generation then resumes.
