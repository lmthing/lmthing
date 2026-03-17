import { describe, it, expect, vi } from 'vitest'
import { wrapFunction, FunctionRegistry } from './function-registry'

describe('security/function-registry', () => {
  describe('wrapFunction', () => {
    it('calls the underlying function', async () => {
      const fn = vi.fn((x: number) => x * 2)
      const wrapped = wrapFunction('double', fn)
      const result = await wrapped(5)
      expect(result).toBe(10)
      expect(fn).toHaveBeenCalledWith(5)
    })

    it('times out long-running functions', async () => {
      const slow = () => new Promise(resolve => setTimeout(resolve, 5000))
      const wrapped = wrapFunction('slow', slow, { timeout: 50 })
      await expect(wrapped()).rejects.toThrow('Timeout')
    })

    it('invokes onCall callback', async () => {
      const onCall = vi.fn()
      const fn = (x: number) => x + 1
      const wrapped = wrapFunction('inc', fn, { onCall })
      await wrapped(5)
      expect(onCall).toHaveBeenCalledWith('inc', [5], expect.any(Number))
    })

    it('enforces rate limits', async () => {
      const fn = () => 'ok'
      const wrapped = wrapFunction('limited', fn, {
        rateLimit: { maxCalls: 2, windowMs: 1000 },
      })
      await wrapped()
      await wrapped()
      await expect(wrapped()).rejects.toThrow('Rate limit exceeded')
    })

    it('preserves function name', () => {
      const fn = () => {}
      const wrapped = wrapFunction('myFn', fn)
      expect(wrapped.name).toBe('myFn')
    })
  })

  describe('FunctionRegistry', () => {
    it('registers and retrieves functions', () => {
      const registry = new FunctionRegistry()
      registry.register('add', (a: number, b: number) => a + b)
      expect(registry.has('add')).toBe(true)
      expect(registry.get('add')).toBeDefined()
    })

    it('getAll returns all registered functions', () => {
      const registry = new FunctionRegistry()
      registry.register('a', () => 1)
      registry.register('b', () => 2)
      const all = registry.getAll()
      expect(Object.keys(all)).toEqual(['a', 'b'])
    })

    it('names returns all function names', () => {
      const registry = new FunctionRegistry()
      registry.register('x', () => {})
      registry.register('y', () => {})
      expect(registry.names()).toEqual(['x', 'y'])
    })

    it('returns undefined for unknown function', () => {
      const registry = new FunctionRegistry()
      expect(registry.get('unknown')).toBeUndefined()
      expect(registry.has('unknown')).toBe(false)
    })

    it('applies registry-wide options to all functions', async () => {
      const onCall = vi.fn()
      const registry = new FunctionRegistry({ onCall })
      registry.register('test', () => 42)
      const fn = registry.get('test')!
      await fn()
      expect(onCall).toHaveBeenCalled()
    })
  })
})
