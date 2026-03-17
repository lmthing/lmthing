import { describe, it, expect } from 'vitest'
import { createBracketState, feedChunk, isBalanced, resetBracketState } from './bracket-tracker'

describe('stream/bracket-tracker', () => {
  it('starts balanced', () => {
    const state = createBracketState()
    expect(isBalanced(state)).toBe(true)
  })

  it('tracks round brackets', () => {
    const state = createBracketState()
    feedChunk(state, 'foo(')
    expect(isBalanced(state)).toBe(false)
    expect(state.round).toBe(1)
    feedChunk(state, 'bar)')
    expect(isBalanced(state)).toBe(true)
  })

  it('tracks curly brackets', () => {
    const state = createBracketState()
    feedChunk(state, 'if (true) {')
    expect(state.curly).toBe(1)
    expect(state.round).toBe(0) // (true) opened and closed
    feedChunk(state, ' x = 1 }')
    expect(isBalanced(state)).toBe(true)
  })

  it('tracks square brackets', () => {
    const state = createBracketState()
    feedChunk(state, '[1, 2,')
    expect(state.square).toBe(1)
    feedChunk(state, ' 3]')
    expect(isBalanced(state)).toBe(true)
  })

  it('ignores brackets inside single-quoted strings', () => {
    const state = createBracketState()
    feedChunk(state, "const x = 'hello { world'")
    expect(isBalanced(state)).toBe(true)
  })

  it('ignores brackets inside double-quoted strings', () => {
    const state = createBracketState()
    feedChunk(state, 'const x = "hello ( world"')
    expect(isBalanced(state)).toBe(true)
  })

  it('ignores brackets inside template literals', () => {
    const state = createBracketState()
    feedChunk(state, 'const x = `hello { world`')
    expect(isBalanced(state)).toBe(true)
  })

  it('tracks unclosed template literal', () => {
    const state = createBracketState()
    feedChunk(state, 'const x = `hello')
    expect(state.inString).toBe('`')
    expect(isBalanced(state)).toBe(false)
  })

  it('handles escaped quotes in strings', () => {
    const state = createBracketState()
    feedChunk(state, 'const x = "hello \\" world"')
    expect(isBalanced(state)).toBe(true)
  })

  it('ignores brackets in line comments', () => {
    const state = createBracketState()
    feedChunk(state, 'const x = 1 // {[(\n')
    expect(isBalanced(state)).toBe(true)
  })

  it('ignores brackets in block comments', () => {
    const state = createBracketState()
    feedChunk(state, 'const x = 1 /* {[( */')
    expect(isBalanced(state)).toBe(true)
  })

  it('detects unclosed block comment', () => {
    const state = createBracketState()
    feedChunk(state, 'const x = 1 /* unclosed')
    expect(isBalanced(state)).toBe(false)
  })

  it('handles incremental feeding', () => {
    const state = createBracketState()
    feedChunk(state, 'const obj = {')
    expect(isBalanced(state)).toBe(false)
    feedChunk(state, '\n  a: 1,')
    expect(isBalanced(state)).toBe(false)
    feedChunk(state, '\n  b: 2')
    expect(isBalanced(state)).toBe(false)
    feedChunk(state, '\n}')
    expect(isBalanced(state)).toBe(true)
  })

  it('resets state', () => {
    const state = createBracketState()
    feedChunk(state, 'foo(bar{')
    expect(isBalanced(state)).toBe(false)
    resetBracketState(state)
    expect(isBalanced(state)).toBe(true)
  })

  it('handles nested brackets', () => {
    const state = createBracketState()
    feedChunk(state, 'foo(bar({baz: [1]}))')
    expect(state.round).toBe(0)
    expect(isBalanced(state)).toBe(true)
  })

  it('clamps depth at 0 for extra closing brackets', () => {
    const state = createBracketState()
    feedChunk(state, '))')
    expect(state.round).toBe(0)
  })
})
