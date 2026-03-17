import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface ClassifiedExport {
  name: string
  kind: 'function' | 'component'
  signature: string
  description: string
  propsType?: string
}

/**
 * Load and classify exports from a user's TypeScript file.
 * Uses the TypeScript compiler API to analyze types.
 */
export function classifyExports(filePath: string): ClassifiedExport[] {
  const absolutePath = resolve(filePath)
  const program = ts.createProgram([absolutePath], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: false,
    skipLibCheck: true,
  })

  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(absolutePath)
  if (!sourceFile) {
    throw new Error(`Could not find source file: ${filePath}`)
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
  if (!moduleSymbol) return []

  const exports = checker.getExportsOfModule(moduleSymbol)
  const results: ClassifiedExport[] = []

  for (const sym of exports) {
    const kind = classifyExport(sym, checker)
    if (!kind) continue

    const type = checker.getTypeOfSymbol(sym)
    const signature = checker.typeToString(type)
    const description = ts.displayPartsToString(sym.getDocumentationComment(checker))

    const result: ClassifiedExport = {
      name: sym.getName(),
      kind,
      signature,
      description,
    }

    if (kind === 'component') {
      const callSignatures = type.getCallSignatures()
      if (callSignatures.length > 0) {
        const params = callSignatures[0].getParameters()
        if (params.length > 0) {
          const propsType = checker.getTypeOfSymbol(params[0])
          result.propsType = checker.typeToString(propsType)
        }
      }
    }

    results.push(result)
  }

  return results
}

function classifyExport(symbol: ts.Symbol, checker: ts.TypeChecker): 'function' | 'component' | null {
  const type = checker.getTypeOfSymbol(symbol)
  const callSignatures = type.getCallSignatures()
  if (callSignatures.length === 0) return null

  const returnType = checker.getReturnTypeOfSignature(callSignatures[0])
  const returnTypeStr = checker.typeToString(returnType)

  // Component: returns JSX.Element, React.ReactElement, React.ReactNode, or ReactElement
  if (
    returnTypeStr === 'JSX.Element' ||
    returnTypeStr === 'Element' ||
    returnTypeStr.includes('ReactElement') ||
    returnTypeStr.includes('ReactNode')
  ) {
    return 'component'
  }

  // Component: FC<P> or ComponentType<P>
  const typeStr = checker.typeToString(type)
  if (typeStr.includes('FC<') || typeStr.includes('ComponentType<')) {
    return 'component'
  }

  return 'function'
}

/**
 * Generate the {{FUNCTIONS}} and {{COMPONENTS}} blocks for the system prompt.
 */
export function formatExportsForPrompt(
  exports: ClassifiedExport[],
  source?: string,
): { functions: string; components: string } {
  const functions = exports.filter(e => e.kind === 'function')
  const components = exports.filter(e => e.kind === 'component')

  const sourceLabel = source ? ` (${source})` : ''

  const fnBlock = functions.length > 0
    ? functions.map(f => {
        const desc = f.description ? `\n    — ${f.description}` : ''
        return `  ${f.name}${f.signature}${desc}`
      }).join('\n')
    : ''

  const compBlock = components.length > 0
    ? components.map(c => {
        const props = c.propsType ? ` ${c.propsType}` : ''
        const desc = c.description ? `\n    — ${c.description}` : ''
        return `  <${c.name}${props} />${desc}`
      }).join('\n')
    : ''

  return {
    functions: fnBlock ? `  # User-defined${sourceLabel}\n${fnBlock}` : '',
    components: compBlock ? `  # User-defined${sourceLabel}\n${compBlock}` : '',
  }
}
