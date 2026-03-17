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
})
