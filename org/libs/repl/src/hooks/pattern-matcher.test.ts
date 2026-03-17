import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { matchPattern, findMatches } from './pattern-matcher'

function parseSource(code: string): ts.SourceFile {
  return ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX)
}

describe('hooks/pattern-matcher', () => {
  describe('matchPattern', () => {
    it('matches by node type', () => {
      const sf = parseSource('foo()')
      const node = sf.statements[0] // ExpressionStatement
      // Get the call expression inside
      const callExpr = (node as ts.ExpressionStatement).expression
      const match = matchPattern(callExpr, { type: 'CallExpression' }, sf)
      expect(match).not.toBeNull()
      expect(match?.source).toBe('foo()')
    })

    it('returns null on type mismatch', () => {
      const sf = parseSource('const x = 1')
      const node = sf.statements[0]
      const match = matchPattern(node, { type: 'CallExpression' }, sf)
      expect(match).toBeNull()
    })

    it('matches wildcard type', () => {
      const sf = parseSource('const x = 1')
      const node = sf.statements[0]
      const match = matchPattern(node, { type: '*' }, sf)
      expect(match).not.toBeNull()
    })

    it('matches oneOf patterns', () => {
      const sf = parseSource('const x = 1')
      const node = sf.statements[0]
      const match = matchPattern(node, {
        oneOf: [
          { type: 'CallExpression' },
          { type: 'FirstStatement' }, // VariableStatement's SyntaxKind name
        ],
      }, sf)
      expect(match).not.toBeNull()
    })
  })

  describe('findMatches', () => {
    it('finds all call expressions', () => {
      const sf = parseSource('foo(); bar(); baz()')
      const matches = findMatches(sf, { type: 'CallExpression' })
      expect(matches).toHaveLength(3)
    })

    it('finds nested matches', () => {
      const sf = parseSource('foo(bar())')
      const matches = findMatches(sf, { type: 'CallExpression' })
      expect(matches.length).toBeGreaterThanOrEqual(2) // foo() and bar()
    })

    it('returns empty for no matches', () => {
      const sf = parseSource('const x = 1')
      const matches = findMatches(sf, { type: 'CallExpression' })
      expect(matches).toHaveLength(0)
    })
  })
})
