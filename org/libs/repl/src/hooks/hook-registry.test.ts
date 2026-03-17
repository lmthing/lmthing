import { describe, it, expect } from 'vitest'
import { HookRegistry } from './hook-registry'
import type { Hook } from '../session/types'

function createHook(id: string, phase: 'before' | 'after' = 'before'): Hook {
  return {
    id,
    label: `Hook ${id}`,
    pattern: { type: 'CallExpression' },
    phase,
    handler: () => ({ type: 'continue' as const }),
  }
}

describe('hooks/hook-registry', () => {
  it('registers and retrieves hooks', () => {
    const registry = new HookRegistry()
    const hook = createHook('test')
    registry.register(hook)
    expect(registry.get('test')).toBe(hook)
  })

  it('unregisters hooks', () => {
    const registry = new HookRegistry()
    registry.register(createHook('test'))
    expect(registry.unregister('test')).toBe(true)
    expect(registry.get('test')).toBeUndefined()
  })

  it('lists hooks by phase', () => {
    const registry = new HookRegistry()
    registry.register(createHook('before-1', 'before'))
    registry.register(createHook('before-2', 'before'))
    registry.register(createHook('after-1', 'after'))

    expect(registry.listByPhase('before')).toHaveLength(2)
    expect(registry.listByPhase('after')).toHaveLength(1)
  })

  it('disables hooks after consecutive failures', () => {
    const registry = new HookRegistry(3)
    registry.register(createHook('flaky'))

    registry.recordFailure('flaky')
    registry.recordFailure('flaky')
    expect(registry.isDisabled('flaky')).toBe(false)

    registry.recordFailure('flaky')
    expect(registry.isDisabled('flaky')).toBe(true)
  })

  it('excludes disabled hooks from listByPhase', () => {
    const registry = new HookRegistry(1)
    registry.register(createHook('good'))
    registry.register(createHook('bad'))
    registry.recordFailure('bad')

    expect(registry.listByPhase('before')).toHaveLength(1)
    expect(registry.listByPhase('before')[0].id).toBe('good')
  })

  it('success resets failure count', () => {
    const registry = new HookRegistry(3)
    registry.register(createHook('test'))
    registry.recordFailure('test')
    registry.recordFailure('test')
    registry.recordSuccess('test')
    registry.recordFailure('test')
    expect(registry.isDisabled('test')).toBe(false)
  })

  it('getAll returns all hooks', () => {
    const registry = new HookRegistry()
    registry.register(createHook('a'))
    registry.register(createHook('b'))
    expect(registry.getAll()).toHaveLength(2)
  })

  it('clear removes all hooks', () => {
    const registry = new HookRegistry()
    registry.register(createHook('a'))
    registry.clear()
    expect(registry.getAll()).toHaveLength(0)
  })
})
