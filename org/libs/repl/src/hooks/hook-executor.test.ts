import { describe, it, expect, vi } from 'vitest'
import { executeHooks } from './hook-executor'
import { HookRegistry } from './hook-registry'
import type { Hook, HookContext } from '../session/types'

const mockContext: HookContext = {
  lineNumber: 1,
  sessionId: 'test-session',
  scope: [],
}

describe('hooks/hook-executor', () => {
  it('returns execute for no matching hooks', async () => {
    const registry = new HookRegistry()
    const result = await executeHooks('const x = 1', 'before', registry, mockContext)
    expect(result.action).toBe('execute')
    expect(result.matchedHooks).toHaveLength(0)
  })

  it('fires side_effect hooks', async () => {
    const registry = new HookRegistry()
    const sideEffectFn = vi.fn()
    registry.register({
      id: 'logger',
      label: 'Logger',
      pattern: { type: 'CallExpression' },
      phase: 'before',
      handler: () => ({ type: 'side_effect', fn: sideEffectFn }),
    })

    const result = await executeHooks('foo()', 'before', registry, mockContext)
    expect(result.action).toBe('execute')
    expect(result.sideEffects).toHaveLength(1)
    await result.sideEffects[0]()
    expect(sideEffectFn).toHaveBeenCalled()
  })

  it('applies transform hooks', async () => {
    const registry = new HookRegistry()
    registry.register({
      id: 'transformer',
      label: 'Transformer',
      pattern: { type: 'CallExpression' },
      phase: 'before',
      handler: () => ({ type: 'transform', newSource: 'bar()' }),
    })

    const result = await executeHooks('foo()', 'before', registry, mockContext)
    expect(result.action).toBe('execute')
    expect(result.source).toBe('bar()')
  })

  it('interrupt is terminal', async () => {
    const registry = new HookRegistry()
    const secondHandler = vi.fn()
    registry.register({
      id: 'guard',
      label: 'Guard',
      pattern: { type: 'CallExpression' },
      phase: 'before',
      handler: () => ({ type: 'interrupt', message: 'blocked' }),
    })
    registry.register({
      id: 'second',
      label: 'Second',
      pattern: { type: 'CallExpression' },
      phase: 'before',
      handler: secondHandler,
    })

    const result = await executeHooks('foo()', 'before', registry, mockContext)
    expect(result.action).toBe('interrupt')
    expect(result.interruptMessage).toBe('blocked')
    expect(secondHandler).not.toHaveBeenCalled()
  })

  it('skip is terminal', async () => {
    const registry = new HookRegistry()
    registry.register({
      id: 'skipper',
      label: 'Skipper',
      pattern: { type: 'CallExpression' },
      phase: 'before',
      handler: () => ({ type: 'skip', reason: 'unsafe' }),
    })

    const result = await executeHooks('foo()', 'before', registry, mockContext)
    expect(result.action).toBe('skip')
  })

  it('handles hook errors gracefully', async () => {
    const registry = new HookRegistry()
    registry.register({
      id: 'buggy',
      label: 'Buggy',
      pattern: { type: 'CallExpression' },
      phase: 'before',
      handler: () => { throw new Error('hook crashed') },
    })

    const result = await executeHooks('foo()', 'before', registry, mockContext)
    expect(result.action).toBe('execute') // continues despite error
  })

  it('only processes hooks for matching phase', async () => {
    const registry = new HookRegistry()
    const handler = vi.fn(() => ({ type: 'continue' as const }))
    registry.register({
      id: 'before-hook',
      label: 'Before',
      pattern: { type: 'CallExpression' },
      phase: 'before',
      handler,
    })

    await executeHooks('foo()', 'after', registry, mockContext)
    expect(handler).not.toHaveBeenCalled()
  })

  it('after hooks cannot skip or interrupt', async () => {
    const registry = new HookRegistry()
    registry.register({
      id: 'after-skip',
      label: 'After Skip',
      pattern: { type: 'CallExpression' },
      phase: 'after',
      handler: () => ({ type: 'skip' }),
    })

    const result = await executeHooks('foo()', 'after', registry, mockContext)
    expect(result.action).toBe('execute') // skip ignored in after phase
  })
})
