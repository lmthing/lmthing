import ts from 'typescript'
import { resolve, dirname, basename, join } from 'node:path'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
// NOTE: ClassMethodInfo is not yet exported from @lmthing/repl — needs to be added
import type { ClassMethodInfo } from '@lmthing/repl'

// ── Types ──

export interface ParamInfo {
  name: string
  type: string
  optional: boolean
  description: string
}

export interface PropInfo {
  name: string
  type: string
  optional: boolean
  description: string
}

export interface ClassifiedExport {
  name: string
  kind: 'function' | 'component' | 'class'
  /** Whether this component is a form component (used with ask()) */
  form: boolean
  description: string
  /** Detailed parameter info (for functions) */
  params: ParamInfo[]
  /** Return type string (for functions) */
  returnType: string
  /** Detailed prop info (for components) */
  props: PropInfo[]
  /** Raw full signature string (fallback) */
  signature: string
  /** Methods info (for classes) */
  methods?: ClassMethodInfo[]
}

// ── Export classification ──

/**
 * Load and classify exports from a user's TypeScript file.
 * Uses the TypeScript compiler API to extract detailed type information
 * for function parameters, return types, and component props.
 *
 * Components with a static `.form = true` property are marked as form components.
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

  // Scan AST for `ComponentName.form = true` assignments
  const formMarked = scanFormMarkers(sourceFile)

  const exports = checker.getExportsOfModule(moduleSymbol)
  const results: ClassifiedExport[] = []

  for (const sym of exports) {
    const type = checker.getTypeOfSymbol(sym)
    const callSignatures = type.getCallSignatures()
    if (callSignatures.length === 0) {
      // Check for class (construct signatures)
      const constructSigs = type.getConstructSignatures()
      if (constructSigs.length > 0) {
        const name = sym.getName()
        const description = ts.displayPartsToString(sym.getDocumentationComment(checker))
        const methods = extractClassMethods(type, checker)
        if (methods.length > 0) {
          results.push({
            name,
            kind: 'class',
            form: false,
            description,
            params: [],
            returnType: '',
            props: [],
            signature: checker.typeToString(type),
            methods,
          })
        }
      }
      continue
    }

    const sig = callSignatures[0]
    const kind = classifySignature(sig, type, checker)
    const description = ts.displayPartsToString(sym.getDocumentationComment(checker))
    const signature = checker.typeToString(type)
    const name = sym.getName()

    const result: ClassifiedExport = {
      name,
      kind,
      form: kind === 'component' && formMarked.has(name),
      description,
      params: [],
      returnType: '',
      props: [],
      signature,
    }

    if (kind === 'function') {
      result.params = extractParams(sig, checker)
      result.returnType = checker.typeToString(checker.getReturnTypeOfSignature(sig))
    } else {
      result.props = extractProps(sig, checker)
    }

    results.push(result)
  }

  return results
}

/**
 * Scan source file for `Name.form = true` expression statements.
 * Returns a set of component names that have the form marker.
 */
function scanFormMarkers(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  ts.forEachChild(sourceFile, node => {
    // Match: Name.form = true
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.expression.left) &&
      ts.isIdentifier(node.expression.left.expression) &&
      node.expression.left.name.text === 'form' &&
      node.expression.right.kind === ts.SyntaxKind.TrueKeyword
    ) {
      names.add(node.expression.left.expression.text)
    }
  })
  return names
}

function classifySignature(
  sig: ts.Signature,
  type: ts.Type,
  checker: ts.TypeChecker,
): 'function' | 'component' {
  const returnType = checker.getReturnTypeOfSignature(sig)
  const returnTypeStr = checker.typeToString(returnType)

  if (
    returnTypeStr === 'JSX.Element' ||
    returnTypeStr === 'Element' ||
    returnTypeStr.includes('ReactElement') ||
    returnTypeStr.includes('ReactNode')
  ) {
    return 'component'
  }

  const typeStr = checker.typeToString(type)
  if (typeStr.includes('FC<') || typeStr.includes('ComponentType<')) {
    return 'component'
  }

  return 'function'
}

// ── Class method extraction ──

function extractClassMethods(classType: ts.Type, checker: ts.TypeChecker): ClassMethodInfo[] {
  const constructSigs = classType.getConstructSignatures()
  if (constructSigs.length === 0) return []

  const instanceType = constructSigs[0].getReturnType()
  const methods: ClassMethodInfo[] = []

  for (const prop of instanceType.getProperties()) {
    const propType = checker.getTypeOfSymbol(prop)
    const propCallSigs = propType.getCallSignatures()
    if (propCallSigs.length === 0) continue

    // Skip private/protected members
    const decl = prop.declarations?.[0]
    if (decl) {
      const modifiers = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) : undefined
      if (modifiers?.some(m =>
        m.kind === ts.SyntaxKind.PrivateKeyword ||
        m.kind === ts.SyntaxKind.ProtectedKeyword
      )) continue
    }

    const sig = propCallSigs[0]
    const params = extractParams(sig, checker)
    const returnType = checker.typeToString(checker.getReturnTypeOfSignature(sig))
    const description = ts.displayPartsToString(prop.getDocumentationComment(checker))
    const paramList = params.map(p => {
      const opt = p.optional ? '?' : ''
      return `${p.name}${opt}: ${p.type}`
    }).join(', ')

    methods.push({
      name: prop.getName(),
      description,
      signature: `(${paramList}): ${returnType}`,
    })
  }

  return methods
}

// ── Type extraction ──

function extractParams(sig: ts.Signature, checker: ts.TypeChecker): ParamInfo[] {
  return sig.getParameters().map(param => {
    const paramType = checker.getTypeOfSymbol(param)
    const declaration = param.declarations?.[0]
    const optional = declaration
      ? ts.isParameter(declaration) && !!declaration.questionToken
      : false
    const description = ts.displayPartsToString(param.getDocumentationComment(checker))

    return {
      name: param.getName(),
      type: checker.typeToString(paramType, undefined, ts.TypeFormatFlags.NoTruncation),
      optional,
      description,
    }
  })
}

function extractProps(sig: ts.Signature, checker: ts.TypeChecker): PropInfo[] {
  const params = sig.getParameters()
  if (params.length === 0) return []

  const propsType = checker.getTypeOfSymbol(params[0])
  return extractObjectProperties(propsType, checker)
}

function extractObjectProperties(type: ts.Type, checker: ts.TypeChecker): PropInfo[] {
  const props = type.getProperties()
  return props.map(prop => {
    const propType = checker.getTypeOfSymbol(prop)
    const declaration = prop.declarations?.[0]
    const optional = !!(prop.flags & ts.SymbolFlags.Optional)
      || (declaration != null && ts.isPropertySignature(declaration) && !!declaration.questionToken)
    const description = ts.displayPartsToString(prop.getDocumentationComment(checker))

    return {
      name: prop.getName(),
      type: checker.typeToString(propType, undefined, ts.TypeFormatFlags.NoTruncation),
      optional,
      description,
    }
  })
}

// ── Prompt formatting ──

export interface FormattedExports {
  functions: string
  formComponents: string
  viewComponents: string
  classes: string
}

/**
 * Generate the functions, form components, and view components blocks for the system prompt.
 */
export function formatExportsForPrompt(
  exports: ClassifiedExport[],
  source?: string,
  label?: string,
): FormattedExports {
  const functions = exports.filter(e => e.kind === 'function')
  const formComponents = exports.filter(e => e.kind === 'component' && e.form)
  const viewComponents = exports.filter(e => e.kind === 'component' && !e.form)
  const classes = exports.filter(e => e.kind === 'class')

  const heading = label ?? 'User-defined'
  const sourceLabel = source ? ` (${source})` : ''

  const fnBlock = functions.length > 0
    ? functions.map(formatFunction).join('\n')
    : ''

  const formBlock = formComponents.length > 0
    ? formComponents.map(formatComponent).join('\n')
    : ''

  const viewBlock = viewComponents.length > 0
    ? viewComponents.map(formatComponent).join('\n')
    : ''

  const classBlock = classes.length > 0
    ? classes.map(formatCollapsedClass).join('\n')
    : ''

  return {
    functions: fnBlock ? `  # ${heading}${sourceLabel}\n${fnBlock}` : '',
    formComponents: formBlock ? `  # ${heading}${sourceLabel}\n${formBlock}` : '',
    viewComponents: viewBlock ? `  # ${heading}${sourceLabel}\n${viewBlock}` : '',
    classes: classBlock ? `  # ${heading}${sourceLabel}\n${classBlock}` : '',
  }
}

function formatFunction(f: ClassifiedExport): string {
  const paramList = f.params.length > 0
    ? f.params.map(p => {
        const opt = p.optional ? '?' : ''
        return `${p.name}${opt}: ${p.type}`
      }).join(', ')
    : ''

  const sig = `  ${f.name}(${paramList}): ${f.returnType}`
  const lines = [sig]

  if (f.description) {
    lines.push(`    — ${f.description}`)
  }

  // Add per-param docs if any param has a description
  const documented = f.params.filter(p => p.description)
  for (const p of documented) {
    lines.push(`    @${p.name} — ${p.description}`)
  }

  return lines.join('\n')
}

function formatComponent(c: ClassifiedExport): string {
  const lines: string[] = []

  if (c.props.length > 0) {
    const attrs = c.props.map(p => {
      const opt = p.optional ? '?' : ''
      return `${p.name}${opt}={${p.type}}`
    }).join(' ')
    lines.push(`  <${c.name} ${attrs} />`)
  } else {
    lines.push(`  <${c.name} />`)
  }

  if (c.description) {
    lines.push(`    — ${c.description}`)
  }

  // Add per-prop docs if any prop has a description
  const documented = c.props.filter(p => p.description)
  for (const p of documented) {
    lines.push(`    @${p.name} — ${p.description}`)
  }

  return lines.join('\n')
}

// ── Class formatting ──

export function formatCollapsedClass(c: ClassifiedExport): string {
  const lines = [`  ${c.name} — ${c.description || '(no description)'}`]
  const methodCount = c.methods?.length ?? 0
  lines.push(`    → ${methodCount} method${methodCount !== 1 ? 's' : ''} — use \`await loadClass("${c.name}")\` to expand`)
  return lines.join('\n')
}

export function formatExpandedClass(c: ClassifiedExport): string {
  const lines = [`  ${c.name} — ${c.description || '(no description)'}`]
  for (const m of c.methods ?? []) {
    lines.push(`    .${m.name}${m.signature}`)
    if (m.description) {
      lines.push(`      — ${m.description}`)
    }
  }
  return lines.join('\n')
}

// ── TSX/TS dynamic import ──

/**
 * Import a TypeScript or TSX file at runtime by transpiling it first.
 * Writes a temporary .mjs file next to the original so that relative imports
 * and bare specifiers (e.g. "react") resolve correctly, then cleans up.
 */
export async function importTs(filePath: string): Promise<Record<string, unknown>> {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (ext !== 'ts' && ext !== 'tsx') {
    return import(filePath) as Promise<Record<string, unknown>>
  }

  const source = readFileSync(filePath, 'utf-8')
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    },
  })

  const dir = dirname(filePath)
  const base = basename(filePath).replace(/\.(tsx?)$/, '')
  const rand = randomBytes(4).toString('hex')
  const tmpPath = join(dir, `.__lmt_${base}_${rand}.mjs`)

  writeFileSync(tmpPath, result.outputText, 'utf-8')
  try {
    return await import(tmpPath) as Record<string, unknown>
  } finally {
    try { unlinkSync(tmpPath) } catch { /* ignore */ }
  }
}
