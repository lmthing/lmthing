import { describe, it, expect } from 'vitest'
import { createLineAccumulator, feed, flush, clear } from './line-accumulator'

describe('stream/line-accumulator', () => {
  it('accumulates tokens and flushes on newline', () => {
    const acc = createLineAccumulator()
    const r1 = feed(acc, 'const ')
    expect(r1.statements).toHaveLength(0)
    const r2 = feed(acc, 'x = 1\n')
    expect(r2.statements).toEqual(['const x = 1'])
  })

  it('does not flush incomplete statements', () => {
    const acc = createLineAccumulator()
    feed(acc, 'const obj = {\n')
    // Curly brace open, not balanced
    expect(feed(acc, '  a: 1,\n').statements).toHaveLength(0)
    const result = feed(acc, '}\n')
    expect(result.statements).toHaveLength(1)
    expect(result.statements[0]).toContain('const obj = {')
    expect(result.statements[0]).toContain('}')
  })

  it('handles multiple statements in one feed', () => {
    const acc = createLineAccumulator()
    const result = feed(acc, 'const x = 1\nconst y = 2\n')
    expect(result.statements).toEqual(['const x = 1', 'const y = 2'])
  })

  it('flush returns remaining buffer', () => {
    const acc = createLineAccumulator()
    feed(acc, 'const x = 1')
    const remaining = flush(acc)
    expect(remaining).toBe('const x = 1')
  })

  it('flush returns null for empty buffer', () => {
    const acc = createLineAccumulator()
    expect(flush(acc)).toBeNull()
  })

  it('clear empties the buffer', () => {
    const acc = createLineAccumulator()
    feed(acc, 'const x = 1')
    clear(acc)
    expect(flush(acc)).toBeNull()
  })

  it('hasRemaining is true when buffer has content', () => {
    const acc = createLineAccumulator()
    const r = feed(acc, 'const x = 1')
    expect(r.hasRemaining).toBe(true)
  })

  it('hasRemaining is false after flushing', () => {
    const acc = createLineAccumulator()
    const r = feed(acc, 'const x = 1\n')
    expect(r.hasRemaining).toBe(false)
  })

  it('handles function declarations across multiple tokens', () => {
    const acc = createLineAccumulator()
    feed(acc, 'function greet')
    feed(acc, '(name: string)')
    feed(acc, ' {\n')
    feed(acc, '  return "Hello " + name\n')
    const result = feed(acc, '}\n')
    expect(result.statements).toHaveLength(1)
    expect(result.statements[0]).toContain('function greet')
  })

  it('handles strings with newlines inside', () => {
    const acc = createLineAccumulator()
    // Template literal with newlines should not split
    const result = feed(acc, 'const x = `hello\nworld`\n')
    expect(result.statements).toHaveLength(1)
    expect(result.statements[0]).toContain('`hello\nworld`')
  })

  it('does not split multi-line JSX variable assignment', () => {
    const acc = createLineAccumulator()
    feed(acc, 'var card = <RecipeCard\n')
    expect(feed(acc, '  name="test"\n').statements).toHaveLength(0)
    expect(feed(acc, '  count={2}\n').statements).toHaveLength(0)
    const result = feed(acc, '/>\n')
    expect(result.statements).toHaveLength(1)
    expect(result.statements[0]).toContain('var card = <RecipeCard')
    expect(result.statements[0]).toContain('/>')
  })

  it('handles JSX fed token by token', () => {
    const acc = createLineAccumulator()
    // Simulate LLM streaming tokens one at a time
    const tokens = ['var ', 'card', ' = ', '<', 'Rec', 'ipe', 'Card\n',
      '  name', '="test"', '\n', '/>', '\n']
    let statements: string[] = []
    for (const token of tokens) {
      const result = feed(acc, token)
      statements.push(...result.statements)
    }
    expect(statements).toHaveLength(1)
    expect(statements[0]).toContain('<RecipeCard')
    expect(statements[0]).toContain('/>')
  })

  it('flushes JSX followed by separate statement', () => {
    const acc = createLineAccumulator()
    feed(acc, 'var x = <Component />\n')
    const r1 = feed(acc, 'display(x)\n')
    // First statement flushed on its own newline, second on its own
    // Total: the JSX assignment should flush at end of first line
    // Let's check both were captured
    const acc2 = createLineAccumulator()
    const result = feed(acc2, 'var x = <Component />\ndisplay(x)\n')
    expect(result.statements).toHaveLength(2)
    expect(result.statements[0]).toBe('var x = <Component />')
    expect(result.statements[1]).toBe('display(x)')
  })
})
