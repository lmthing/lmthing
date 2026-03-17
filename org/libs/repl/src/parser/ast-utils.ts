import ts from 'typescript'

/**
 * Parse a single TypeScript statement into an AST node.
 */
export function parseStatement(source: string): ts.Node | null {
  const sourceFile = ts.createSourceFile(
    'line.ts',
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  )
  const statements = sourceFile.statements
  if (statements.length === 0) return null
  return statements[0]
}

/**
 * Extract declared variable names from a statement.
 * Handles const/let/var and destructuring patterns.
 */
export function extractDeclarations(source: string): string[] {
  const node = parseStatement(source)
  if (!node) return []

  const names: string[] = []

  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      extractBindingNames(decl.name, names)
    }
  } else if (ts.isFunctionDeclaration(node) && node.name) {
    names.push(node.name.text)
  } else if (ts.isClassDeclaration(node) && node.name) {
    names.push(node.name.text)
  }

  return names
}

function extractBindingNames(node: ts.BindingName, names: string[]): void {
  if (ts.isIdentifier(node)) {
    names.push(node.text)
  } else if (ts.isObjectBindingPattern(node)) {
    for (const element of node.elements) {
      extractBindingNames(element.name, names)
    }
  } else if (ts.isArrayBindingPattern(node)) {
    for (const element of node.elements) {
      if (ts.isBindingElement(element)) {
        extractBindingNames(element.name, names)
      }
    }
  }
}

/**
 * Recover argument names from a stop(...) or similar call expression.
 * Given `stop(user.name, x, getX())`, returns:
 *   ["user.name", "x", "arg_2"]
 */
export function recoverArgumentNames(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    'line.ts',
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  )

  // Find the call expression (may be inside await or assignment)
  let callExpr: ts.CallExpression | null = null

  function visit(node: ts.Node): void {
    if (callExpr) return
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (ts.isIdentifier(callee)) {
        const name = callee.text
        if (name === 'stop' || name === 'display' || name === 'ask' || name === 'async') {
          callExpr = node
          return
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (!callExpr) return []

  return (callExpr as ts.CallExpression).arguments.map((arg, i) => {
    // Simple identifier: x → "x"
    if (ts.isIdentifier(arg)) {
      return arg.text
    }
    // Property access: user.name → "user.name"
    if (ts.isPropertyAccessExpression(arg)) {
      return arg.getText(sourceFile)
    }
    // Element access: arr[0] → "arr[0]"
    if (ts.isElementAccessExpression(arg)) {
      return arg.getText(sourceFile)
    }
    // Fallback for complex expressions
    return `arg_${i}`
  })
}

/**
 * Extract all variable names referenced in a source string.
 */
export function extractVariableNames(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    'line.ts',
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  )

  const names = new Set<string>()

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      // Skip property names in property access (the right side)
      const parent = node.parent
      if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
        // This is the property name, not a variable reference
      } else {
        names.add(node.text)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...names]
}
