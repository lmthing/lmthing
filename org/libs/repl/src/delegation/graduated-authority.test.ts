import { describe, it, expect } from 'vitest'
import { GraduatedAuthority } from './graduated-authority'
import type { TaskProfile, PeerInfo } from './types'

const makeTask = (overrides: Partial<TaskProfile> = {}): TaskProfile => ({
  id: 'task_1',
  description: 'test task',
  criticality: 'medium',
  reversibility: 'medium',
  verifiability: 'medium',
  maxDuration: 30_000,
  maxCost: 10_000,
  ...overrides,
})

const makePeer = (overrides: Partial<PeerInfo> = {}): PeerInfo => ({
  id: 'peer_1',
  name: 'TestPeer',
  capabilities: ['code'],
  trustScore: 0.5,
  ...overrides,
})

describe('delegation/graduated-authority', () => {
  const ga = new GraduatedAuthority()

  it('maps low trust to "restricted" level', () => {
    expect(ga.computeLevel(0.1)).toBe('restricted')
    expect(ga.computeLevel(0.39)).toBe('restricted')
  })

  it('maps medium trust to "standard" level', () => {
    expect(ga.computeLevel(0.40)).toBe('standard')
    expect(ga.computeLevel(0.69)).toBe('standard')
  })

  it('maps high trust to "elevated" level', () => {
    expect(ga.computeLevel(0.70)).toBe('elevated')
    expect(ga.computeLevel(0.89)).toBe('elevated')
  })

  it('maps very high trust to "autonomous" level', () => {
    expect(ga.computeLevel(0.90)).toBe('autonomous')
    expect(ga.computeLevel(1.0)).toBe('autonomous')
  })

  it('restricts SLOs for low-trust peers', () => {
    const grant = ga.computeGrant(makeTask(), makePeer({ trustScore: 0.1 }))
    expect(grant.level).toBe('restricted')
    expect(grant.slo.maxDurationMs).toBe(15_000) // 30000 * 0.5
    expect(grant.slo.maxCostTokens).toBe(5_000) // 10000 * 0.5
    expect(grant.slo.minQualityScore).toBe(0.8)
    expect(grant.slo.monitoringInterval).toBe('continuous')
  })

  it('relaxes SLOs for high-trust peers', () => {
    const grant = ga.computeGrant(makeTask(), makePeer({ trustScore: 0.95 }))
    expect(grant.level).toBe('autonomous')
    expect(grant.slo.maxDurationMs).toBe(60_000) // 30000 * 2.0
    expect(grant.slo.maxCostTokens).toBe(20_000) // 10000 * 2.0
    expect(grant.slo.minQualityScore).toBe(0.3)
    expect(grant.slo.monitoringInterval).toBe('minimal')
  })

  it('requires approval for restricted peers', () => {
    const grant = ga.computeGrant(makeTask(), makePeer({ trustScore: 0.1 }))
    expect(grant.requiresApproval).toBe(true)
  })

  it('requires approval for high-criticality tasks regardless of trust', () => {
    const grant = ga.computeGrant(
      makeTask({ criticality: 'high' }),
      makePeer({ trustScore: 0.95 }),
    )
    expect(grant.requiresApproval).toBe(true)
  })

  it('does not require approval for standard trust + non-critical task', () => {
    const grant = ga.computeGrant(
      makeTask({ criticality: 'low' }),
      makePeer({ trustScore: 0.5 }),
    )
    expect(grant.requiresApproval).toBe(false)
  })

  it('grants escalating permissions with trust level', () => {
    const restricted = ga.computeGrant(makeTask(), makePeer({ trustScore: 0.1 }))
    expect(restricted.permissions).toEqual(['read', 'execute'])

    const standard = ga.computeGrant(makeTask(), makePeer({ trustScore: 0.5 }))
    expect(standard.permissions).toContain('write')

    const elevated = ga.computeGrant(makeTask(), makePeer({ trustScore: 0.8 }))
    expect(elevated.permissions).toContain('delegate')

    const autonomous = ga.computeGrant(makeTask(), makePeer({ trustScore: 0.95 }))
    expect(autonomous.permissions).toContain('configure')
  })

  it('accepts custom thresholds', () => {
    const ga = new GraduatedAuthority({
      thresholds: { standard: 0.2, elevated: 0.5, autonomous: 0.8 },
    })
    expect(ga.computeLevel(0.25)).toBe('standard')
    expect(ga.computeLevel(0.55)).toBe('elevated')
    expect(ga.computeLevel(0.85)).toBe('autonomous')
  })

  it('uses default duration/cost when task has none', () => {
    const grant = ga.computeGrant(
      makeTask({ maxDuration: undefined, maxCost: undefined }),
      makePeer({ trustScore: 0.5 }),
    )
    expect(grant.slo.maxDurationMs).toBe(30_000) // default 30000 * 1.0
    expect(grant.slo.maxCostTokens).toBe(10_000) // default 10000 * 1.0
  })
})
