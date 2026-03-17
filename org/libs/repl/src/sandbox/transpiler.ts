import ts from 'typescript'

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  jsx: ts.JsxEmit.React,
  jsxFactory: 'React.createElement',
  jsxFragmentFactory: 'React.Fragment',
  strict: false,
  esModuleInterop: true,
}

/**
 * Transpile a TypeScript statement to JavaScript.
 * Uses transpile-only mode (no type checking).
 */
export function transpile(code: string): string {
  const result = ts.transpileModule(code, { compilerOptions })
  return result.outputText
}
