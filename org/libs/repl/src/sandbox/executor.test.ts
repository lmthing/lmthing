import { describe, it, expect } from 'vitest'
import vm from 'node:vm'
import { executeLine } from './executor'

describe('sandbox/executor', () => {
  function createContext() {
    const ctx = vm.createContext({
      console,
      setTimeout,
      Promise,
    })
    return ctx
  }

  it('executes simple expression', async () => {
    const ctx = createContext()
    const result = await executeLine('1 + 2', 1, ctx)
    expect(result.ok).toBe(true)
    expect(result.result).toBe(3)
  })

  it('executes variable declaration', async () => {
    const ctx = createContext()
    await executeLine('var x = 42', 1, ctx)
    const result = await executeLine('x', 2, ctx)
    expect(result.ok).toBe(true)
    expect(result.result).toBe(42)
  })

  it('captures errors', async () => {
    const ctx = createContext()
    const result = await executeLine('throw new Error("oops")', 5, ctx)
    expect(result.ok).toBe(false)
    expect(result.error?.type).toBe('Error')
    expect(result.error?.message).toBe('oops')
    expect(result.error?.line).toBe(5)
  })

  it('handles type-only statements', async () => {
    const ctx = createContext()
    const result = await executeLine('interface Foo { bar: string }', 1, ctx)
    expect(result.ok).toBe(true)
    expect(result.result).toBeUndefined()
  })

  it('handles TypeScript with type annotations', async () => {
    const ctx = createContext()
    const result = await executeLine('var n: number = 10', 1, ctx)
    expect(result.ok).toBe(true)
  })

  it('handles async code', async () => {
    const ctx = createContext()
    // Async code uses var so values persist in scope
    const result = await executeLine('var val = await Promise.resolve(99)', 1, ctx)
    expect(result.ok).toBe(true)
    // Check the value persisted in context
    const check = await executeLine('val', 2, ctx)
    expect(check.result).toBe(99)
  })

  it('times out on infinite loops', async () => {
    const ctx = createContext()
    const result = await executeLine('while(true) {}', 1, ctx, 100)
    expect(result.ok).toBe(false)
    expect(result.error?.message).toContain('timed out')
  })

  it('persists scope across calls', async () => {
    const ctx = createContext()
    await executeLine('var a = 1', 1, ctx)
    await executeLine('var b = 2', 2, ctx)
    const result = await executeLine('a + b', 3, ctx)
    expect(result.ok).toBe(true)
    expect(result.result).toBe(3)
  })
})
