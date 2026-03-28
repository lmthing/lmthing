import { describe, it, expect } from 'vitest'
import { createLineAccumulator, feed, flush, clear, type Statement } from './line-accumulator'

// Helper: extract code sources from a statement array
function codeSources(stmts: Statement[]): string[] {
  return stmts.filter(s => s.type === 'code').map(s => (s as { type: 'code'; source: string }).source)
}

describe('stream/line-accumulator', () => {
  it('accumulates tokens and flushes on newline', () => {
    const acc = createLineAccumulator()
    const r1 = feed(acc, 'const ')
    expect(r1.statements).toHaveLength(0)
    const r2 = feed(acc, 'x = 1\n')
    expect(codeSources(r2.statements)).toEqual(['const x = 1'])
  })

  it('does not flush incomplete statements', () => {
    const acc = createLineAccumulator()
    feed(acc, 'const obj = {\n')
    // Curly brace open, not balanced
    expect(feed(acc, '  a: 1,\n').statements).toHaveLength(0)
    const result = feed(acc, '}\n')
    expect(result.statements).toHaveLength(1)
    expect(codeSources(result.statements)[0]).toContain('const obj = {')
    expect(codeSources(result.statements)[0]).toContain('}')
  })

  it('handles multiple statements in one feed', () => {
    const acc = createLineAccumulator()
    const result = feed(acc, 'const x = 1\nconst y = 2\n')
    expect(codeSources(result.statements)).toEqual(['const x = 1', 'const y = 2'])
  })

  it('flush returns remaining buffer', () => {
    const acc = createLineAccumulator()
    feed(acc, 'const x = 1')
    const remaining = flush(acc)
    expect(remaining).toEqual({ type: 'code', source: 'const x = 1' })
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
    expect(codeSources(result.statements)[0]).toContain('function greet')
  })

  it('handles strings with newlines inside', () => {
    const acc = createLineAccumulator()
    // Template literal with newlines should not split
    const result = feed(acc, 'const x = `hello\nworld`\n')
    expect(result.statements).toHaveLength(1)
    expect(codeSources(result.statements)[0]).toContain('`hello\nworld`')
  })

  it('does not split multi-line JSX variable assignment', () => {
    const acc = createLineAccumulator()
    feed(acc, 'var card = <RecipeCard\n')
    expect(feed(acc, '  name="test"\n').statements).toHaveLength(0)
    expect(feed(acc, '  count={2}\n').statements).toHaveLength(0)
    const result = feed(acc, '/>\n')
    expect(result.statements).toHaveLength(1)
    expect(codeSources(result.statements)[0]).toContain('var card = <RecipeCard')
    expect(codeSources(result.statements)[0]).toContain('/>')
  })

  it('handles JSX fed token by token', () => {
    const acc = createLineAccumulator()
    // Simulate LLM streaming tokens one at a time
    const tokens = ['var ', 'card', ' = ', '<', 'Rec', 'ipe', 'Card\n',
      '  name', '="test"', '\n', '/>', '\n']
    let statements: Statement[] = []
    for (const token of tokens) {
      const result = feed(acc, token)
      statements.push(...result.statements)
    }
    expect(statements).toHaveLength(1)
    expect(codeSources(statements)[0]).toContain('<RecipeCard')
    expect(codeSources(statements)[0]).toContain('/>')
  })

  it('flushes JSX followed by separate statement', () => {
    const acc2 = createLineAccumulator()
    const result = feed(acc2, 'var x = <Component />\ndisplay(x)\n')
    expect(result.statements).toHaveLength(2)
    expect(codeSources(result.statements)[0]).toBe('var x = <Component />')
    expect(codeSources(result.statements)[1]).toBe('display(x)')
  })

  // ── File block tests ──

  it('detects a file write block', () => {
    const acc = createLineAccumulator()
    let statements: Statement[] = []
    for (const token of ['````', 'src/foo.ts\n', 'hello world\n', '````\n']) {
      statements.push(...feed(acc, token).statements)
    }
    expect(statements).toHaveLength(1)
    expect(statements[0].type).toBe('file_write')
    const fw = statements[0] as { type: 'file_write'; path: string; content: string }
    expect(fw.path).toBe('src/foo.ts')
    expect(fw.content).toBe('hello world\n')
  })

  it('detects a file diff block', () => {
    const acc = createLineAccumulator()
    const diffBody = '--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1,1 +1,1 @@\n-old\n+new\n'
    let statements: Statement[] = []
    for (const token of ['````diff src/foo.ts\n', diffBody, '````\n']) {
      statements.push(...feed(acc, token).statements)
    }
    expect(statements).toHaveLength(1)
    expect(statements[0].type).toBe('file_diff')
    const fd = statements[0] as { type: 'file_diff'; path: string; diff: string }
    expect(fd.path).toBe('src/foo.ts')
    expect(fd.diff).toBe(diffBody)
  })

  it('handles code before and after a file write block', () => {
    const acc = createLineAccumulator()
    let statements: Statement[] = []
    const tokens = [
      'const x = 1\n',
      '````src/out.txt\n',
      'content\n',
      '````\n',
      'const y = 2\n',
    ]
    for (const token of tokens) {
      statements.push(...feed(acc, token).statements)
    }
    expect(statements).toHaveLength(3)
    expect(statements[0]).toEqual({ type: 'code', source: 'const x = 1' })
    expect(statements[1].type).toBe('file_write')
    expect(statements[2]).toEqual({ type: 'code', source: 'const y = 2' })
  })

  it('discards an unclosed file block on flush', () => {
    const acc = createLineAccumulator()
    feed(acc, '````src/foo.ts\n')
    feed(acc, 'partial content\n')
    // No closing ````
    const result = flush(acc)
    expect(result).toBeNull()
  })

  it('feeds file block content token by token', () => {
    const acc = createLineAccumulator()
    let statements: Statement[] = []
    // Stream the file block character by character across tokens
    const raw = '````path/to/file.ts\nline1\nline2\n````\n'
    for (const char of raw) {
      statements.push(...feed(acc, char).statements)
    }
    expect(statements).toHaveLength(1)
    expect(statements[0].type).toBe('file_write')
    const fw = statements[0] as { type: 'file_write'; path: string; content: string }
    expect(fw.path).toBe('path/to/file.ts')
    expect(fw.content).toBe('line1\nline2\n')
  })

  it('does not treat single backtick as file block start', () => {
    const acc = createLineAccumulator()
    const result = feed(acc, 'const x = `template`\n')
    expect(result.statements).toHaveLength(1)
    expect(result.statements[0].type).toBe('code')
    expect(codeSources(result.statements)[0]).toContain('`template`')
  })
})
