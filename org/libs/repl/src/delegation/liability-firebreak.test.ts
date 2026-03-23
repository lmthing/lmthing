import { describe, it, expect } from 'vitest'
import { LiabilityFirebreak } from './liability-firebreak'
import type { TaskProfile } from './types'

const makeTask = (overrides: Partial<TaskProfile> = {}): TaskProfile => ({
  id: 'task_1',
  description: 'test task',
  criticality: 'medium',
  reversibility: 'medium',
  verifiability: 'medium',
  ...overrides,
})

describe('delegation/liability-firebreak', () => {
  it('allows delegation within depth limit', () => {
    const fb = new LiabilityFirebreak()
    const result = fb.check(makeTask(), 0)
    expect(result.action).toBe('allow')
    expect(result.currentDepth).toBe(0)
  })

  it('halts delegation beyond depth limit (strict mode)', () => {
    const fb = new LiabilityFirebreak({ baseMaxDepth: 2 })
    const result = fb.check(makeTask(), 2)
    expect(result.action).toBe('halt')
  })

  it('requests authority beyond depth limit (permissive mode)', () => {
    const fb = new LiabilityFirebreak({ baseMaxDepth: 2, mode: 'permissive' })
    const result = fb.check(makeTask(), 2)
    expect(result.action).toBe('request_authority')
  })

  it('reduces depth for high criticality', () => {
    const fb = new LiabilityFirebreak({ baseMaxDepth: 3 })
    const task = makeTask({ criticality: 'high' })
    expect(fb.computeEffectiveMaxDepth(task)).toBe(2) // 3 - 1
  })

  it('reduces depth for low reversibility', () => {
    const fb = new LiabilityFirebreak({ baseMaxDepth: 3 })
    const task = makeTask({ reversibility: 'low' })
    expect(fb.computeEffectiveMaxDepth(task)).toBe(2) // 3 - 1
  })

  it('reduces depth for both high criticality and low reversibility', () => {
    const fb = new LiabilityFirebreak({ baseMaxDepth: 3 })
    const task = makeTask({ criticality: 'high', reversibility: 'low' })
    expect(fb.computeEffectiveMaxDepth(task)).toBe(1) // max(3-1-1, 1) = 1
  })

  it('enforces minimum depth', () => {
    const fb = new LiabilityFirebreak({ baseMaxDepth: 2, minDepth: 1 })
    const task = makeTask({ criticality: 'high', reversibility: 'low' })
    expect(fb.computeEffectiveMaxDepth(task)).toBe(1) // max(2-1-1, 1) = 1
  })

  it('does not reduce depth for low criticality', () => {
    const fb = new LiabilityFirebreak({ baseMaxDepth: 3 })
    const task = makeTask({ criticality: 'low', reversibility: 'high' })
    expect(fb.computeEffectiveMaxDepth(task)).toBe(3)
  })

  it('allows at depth 0 even for high-risk tasks', () => {
    const fb = new LiabilityFirebreak()
    const task = makeTask({ criticality: 'high', reversibility: 'low' })
    const result = fb.check(task, 0)
    expect(result.action).toBe('allow')
  })

  it('halts high-risk task at depth 1', () => {
    const fb = new LiabilityFirebreak()
    const task = makeTask({ criticality: 'high', reversibility: 'low' })
    // effective max = max(3-1-1, 1) = 1
    const result = fb.check(task, 1)
    expect(result.action).toBe('halt')
  })

  it('includes reason in result', () => {
    const fb = new LiabilityFirebreak({ baseMaxDepth: 1 })
    const result = fb.check(makeTask(), 2)
    expect(result.reason).toContain('exceeds')
    expect(result.effectiveMaxDepth).toBe(1)
  })

  it('accepts custom reduction values', () => {
    const fb = new LiabilityFirebreak({
      baseMaxDepth: 5,
      criticalityReduction: 2,
      reversibilityReduction: 2,
    })
    const task = makeTask({ criticality: 'high', reversibility: 'low' })
    expect(fb.computeEffectiveMaxDepth(task)).toBe(1) // max(5-2-2, 1) = 1
  })
})
