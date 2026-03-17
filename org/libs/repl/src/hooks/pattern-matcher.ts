import ts from 'typescript'
import type { ASTPattern, HookMatch } from '../session/types'

/**
 * Match an AST pattern against a TypeScript AST node.
 */
export function matchPattern(
  node: ts.Node,
  pattern: ASTPattern,
  sourceFile: ts.SourceFile,
): HookMatch | null {
  const captures: Record<string, unknown> = {}

  if ('oneOf' in pattern) {
    const p = pattern as { oneOf: ASTPattern[] }
    for (const sub of p.oneOf) {
      const match = matchPattern(node, sub, sourceFile)
      if (match) return match
    }
    return null
  }

  if ('not' in pattern && 'type' in pattern) {
    const p = pattern as { type: string; not: ASTPattern } & Record<string, unknown>
    if (!matchNodeType(node, p.type)) return null
    const negMatch = matchPatternProperties(node, p.not as Record<string, unknown>, sourceFile, captures)
    if (negMatch) return null
    return { node, source: node.getText(sourceFile), captures }
  }

  if ('type' in pattern) {
    const p = pattern as { type: string } & Record<string, unknown>
    if (!matchNodeType(node, p.type)) return null
    if (!matchPatternProperties(node, p, sourceFile, captures)) return null
    return { node, source: node.getText(sourceFile), captures }
  }

  return null
}

function matchNodeType(node: ts.Node, type: string): boolean {
  if (type === '*') return true
  const syntaxKind = ts.SyntaxKind[node.kind]
  return String(syntaxKind) === type
}

function matchPatternProperties(
  node: ts.Node,
  pattern: Record<string, unknown>,
  sourceFile: ts.SourceFile,
  captures: Record<string, unknown>,
): boolean {
  for (const [key, expectedValue] of Object.entries(pattern)) {
    if (key === 'type' || key === 'oneOf' || key === 'not') continue

    const actualValue = (node as any)[key]
    if (actualValue === undefined) return false

    if (typeof expectedValue === 'object' && expectedValue !== null) {
      // Nested pattern — recurse
      if (actualValue && typeof actualValue === 'object' && 'kind' in actualValue) {
        if (!matchPatternProperties(actualValue as ts.Node, expectedValue as Record<string, unknown>, sourceFile, captures)) {
          return false
        }
      } else {
        return false
      }
    } else if (typeof expectedValue === 'string') {
      if (expectedValue.startsWith('$')) {
        // Capture: $varName → captures.varName = actual text
        const captureName = expectedValue.slice(1)
        if (actualValue && typeof actualValue === 'object' && 'kind' in actualValue) {
          captures[captureName] = (actualValue as ts.Node).getText(sourceFile)
        } else {
          captures[captureName] = actualValue
        }
      } else {
        // Direct string match
        if (actualValue && typeof actualValue === 'object' && 'kind' in actualValue) {
          if ((actualValue as ts.Node).getText(sourceFile) !== expectedValue) return false
        } else if (String(actualValue) !== expectedValue) {
          return false
        }
      }
    } else {
      if (actualValue !== expectedValue) return false
    }
  }
  return true
}

/**
 * Find all matching nodes in a source file for a pattern.
 */
export function findMatches(
  sourceFile: ts.SourceFile,
  pattern: ASTPattern,
): HookMatch[] {
  const matches: HookMatch[] = []

  function visit(node: ts.Node) {
    const match = matchPattern(node, pattern, sourceFile)
    if (match) matches.push(match)
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return matches
}
