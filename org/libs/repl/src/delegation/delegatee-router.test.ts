import { describe, it, expect } from 'vitest'
import { DelegateeRouter } from './delegatee-router'
import type { TaskProfile } from './types'

const makeTask = (overrides: Partial<TaskProfile> = {}): TaskProfile => ({
  id: 'task_1',
  description: 'test task',
  criticality: 'medium',
  reversibility: 'medium',
  verifiability: 'medium',
  ...overrides,
})

describe('delegation/delegatee-router', () => {
  const router = new DelegateeRouter()

  it('routes high criticality + low reversibility to human', () => {
    const result = router.route(makeTask({ criticality: 'high', reversibility: 'low' }))
    expect(result.target).toBe('human')
    expect(result.confidence).toBe(0.90)
    expect(result.rule).toBe('high_criticality_low_reversibility')
  })

  it('routes low verifiability to human', () => {
    const result = router.route(makeTask({ verifiability: 'low' }))
    expect(result.target).toBe('human')
    expect(result.confidence).toBe(0.80)
    expect(result.rule).toBe('low_verifiability')
  })

  it('routes high verifiability + low criticality to AI', () => {
    const result = router.route(makeTask({ verifiability: 'high', criticality: 'low' }))
    expect(result.target).toBe('ai')
    expect(result.confidence).toBe(0.90)
    expect(result.rule).toBe('high_verifiability_low_criticality')
  })

  it('routes medium/neutral tasks to "any"', () => {
    const result = router.route(makeTask())
    expect(result.target).toBe('any')
    expect(result.confidence).toBe(0.60)
    expect(result.rule).toBe('default')
  })

  it('applies rules in priority order (criticality+reversibility before verifiability)', () => {
    // High criticality + low reversibility should trump low verifiability
    const result = router.route(makeTask({
      criticality: 'high',
      reversibility: 'low',
      verifiability: 'low',
    }))
    expect(result.rule).toBe('high_criticality_low_reversibility')
  })

  it('filterPeers returns empty for human routing', () => {
    const peers = [{ id: 'p1' }, { id: 'p2' }]
    const decision = router.route(makeTask({ criticality: 'high', reversibility: 'low' }))
    expect(router.filterPeers(peers, decision)).toEqual([])
  })

  it('filterPeers returns all peers for AI routing', () => {
    const peers = [{ id: 'p1' }, { id: 'p2' }]
    const decision = router.route(makeTask({ verifiability: 'high', criticality: 'low' }))
    expect(router.filterPeers(peers, decision)).toEqual(peers)
  })

  it('filterPeers returns all peers for "any" routing', () => {
    const peers = [{ id: 'p1' }]
    const decision = router.route(makeTask())
    expect(router.filterPeers(peers, decision)).toEqual(peers)
  })

  it('provides a reason for each decision', () => {
    const result = router.route(makeTask())
    expect(result.reason).toBeTruthy()
    expect(typeof result.reason).toBe('string')
  })
})
