import vm from 'node:vm'
import { transpile } from './transpiler'
import { extractDeclarations } from '../parser/ast-utils'
import type { LineResult, ErrorPayload } from '../session/types'

/**
 * Execute a single line of TypeScript in the given sandbox context.
 * Handles both declarations (which must persist in scope) and expressions.
 */
export async function executeLine(
  code: string,
  lineNumber: number,
  context: vm.Context,
  timeout = 30_000,
): Promise<LineResult> {
  try {
    const js = transpile(code)
    const trimmedJs = js.trim()
    if (trimmedJs === '') {
      return { ok: true, result: undefined }
    }

    const hasAwait = trimmedJs.includes('await ')

    if (hasAwait) {
      // For code with await, we must use an async IIFE.
      // To preserve scope, we extract declared variable names
      // and assign them back to the context after execution.
      const declaredNames = extractDeclarations(code)

      // Build scope-preserving wrapper:
      // Run the code inside async IIFE, then copy vars back via globalThis
      const assignments = declaredNames
        .map(name => `globalThis[${JSON.stringify(name)}] = typeof ${name} !== 'undefined' ? ${name} : undefined;`)
        .join('\n')

      const wrapped = `(async () => {\n${trimmedJs}\n${assignments}\n})()`
      const script = new vm.Script(wrapped, { filename: `line-${lineNumber}.js` })
      const result = await script.runInContext(context, { timeout })
      return { ok: true, result }
    } else {
      const script = new vm.Script(trimmedJs, { filename: `line-${lineNumber}.js` })
      const result = await script.runInContext(context, { timeout })
      return { ok: true, result }
    }
  } catch (err) {
    const error = err as Error
    const payload: ErrorPayload = {
      type: error.constructor?.name ?? 'Error',
      message: error.message,
      line: lineNumber,
      source: code.trim(),
    }
    return { ok: false, error: payload }
  }
}
