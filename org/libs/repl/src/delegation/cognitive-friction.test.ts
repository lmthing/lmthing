import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CognitiveFrictionEngine } from './cognitive-friction'
import type { TaskProfile, PeerInfo } from './types'

const makeTask = (overrides: Partial<TaskProfile> = {}): TaskProfile => ({
  id: 'task_1',
  description: 'test task',
  criticality: 'medium',
  reversibility: 'medium',
  verifiability: 'medium',
  ...overrides,
})

const makePeer = (overrides: Partial<PeerInfo> = {}): PeerInfo => ({
  id: 'peer_1',
  name: 'TestPeer',
  capabilities: ['code'],
  trustScore: 0.5,
  ...overrides,
})

describe('delegation/cognitive-friction', () => {
  let engine: CognitiveFrictionEngine

  beforeEach(() => {
    engine = new CognitiveFrictionEngine()
  })

  it('returns "none" for low-risk tasks with trusted peers', () => {
    const result = engine.assess(
      makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
      makePeer({ trustScore: 0.95 }),
      0, 5,
    )
    expect(result.level).toBe('none')
    expect(result.compositeScore).toBeLessThan(0.30)
  })

  it('returns "info" for medium-risk tasks', () => {
    const result = engine.assess(
      makeTask({ criticality: 'medium', reversibility: 'medium', verifiability: 'medium' }),
      makePeer({ trustScore: 0.5 }),
      1, 5,
    )
    expect(result.level).toBe('info')
    expect(result.compositeScore).toBeGreaterThanOrEqual(0.30)
    expect(result.compositeScore).toBeLessThan(0.60)
  })

  it('returns "confirm" for high-risk tasks with low-trust peers', () => {
    const result = engine.assess(
      makeTask({ criticality: 'high', reversibility: 'low', verifiability: 'low' }),
      makePeer({ trustScore: 0.29 }),
      1, 3,
    )
    expect(result.level).toBe('confirm')
    expect(result.compositeScore).toBeGreaterThanOrEqual(0.60)
  })

  it('returns "mandatory_human" for extreme risk', () => {
    const result = engine.assess(
      makeTask({ criticality: 'high', reversibility: 'low', verifiability: 'low' }),
      makePeer({ trustScore: 0.05 }),
      3, 3,
    )
    expect(result.level).toBe('mandatory_human')
    expect(result.compositeScore).toBeGreaterThanOrEqual(0.85)
  })

  it('computes all five factors correctly', () => {
    const result = engine.assess(
      makeTask({ criticality: 'high', reversibility: 'low', verifiability: 'high' }),
      makePeer({ trustScore: 0.8 }),
      2, 4,
    )

    expect(result.factors.criticality).toBe(0.9)
    expect(result.factors.irreversibility).toBe(0.8) // 1 - 0.2 (low rev)
    expect(result.factors.uncertainty).toBeCloseTo(0.1) // 1 - 0.9 (high ver)
    expect(result.factors.depthRatio).toBe(0.5) // 2/4
    expect(result.factors.trustDeficit).toBeCloseTo(0.2) // 1 - 0.8
  })

  it('anti-alarm fatigue downgrades after max escalations', () => {
    const engine = new CognitiveFrictionEngine({
      alarmFatigueMaxEscalations: 3,
      alarmFatigueWindowMs: 60_000,
    })

    const task = makeTask({ criticality: 'medium', reversibility: 'medium', verifiability: 'low' })
    const peer = makePeer({ trustScore: 0.4 })

    // Trigger escalations
    for (let i = 0; i < 3; i++) {
      engine.assess(task, peer, 1, 3)
    }

    // Next assessment should be downgraded
    const result = engine.assess(task, peer, 1, 3)
    expect(result.downgraded).toBe(true)
  })

  it('never downgrades mandatory_human', () => {
    const engine = new CognitiveFrictionEngine({
      alarmFatigueMaxEscalations: 1,
      alarmFatigueWindowMs: 60_000,
    })

    const task = makeTask({ criticality: 'high', reversibility: 'low', verifiability: 'low' })
    const peer = makePeer({ trustScore: 0.05 })

    // Trigger many escalations
    for (let i = 0; i < 10; i++) {
      engine.assess(task, peer, 3, 3)
    }

    const result = engine.assess(task, peer, 3, 3)
    expect(result.level).toBe('mandatory_human')
    expect(result.downgraded).toBe(false)
  })

  it('accepts custom weights', () => {
    const engine = new CognitiveFrictionEngine({
      weights: { criticality: 1.0, irreversibility: 0, uncertainty: 0, depthRatio: 0, trustDeficit: 0 },
    })
    const result = engine.assess(
      makeTask({ criticality: 'high' }),
      makePeer(),
      0, 5,
    )
    // 0.9 * 1.0 = 0.9 → mandatory_human
    expect(result.compositeScore).toBeCloseTo(0.9)
    expect(result.level).toBe('mandatory_human')
  })

  it('accepts custom thresholds', () => {
    const engine = new CognitiveFrictionEngine({
      thresholds: { info: 0.10, confirm: 0.20, mandatoryHuman: 0.30 },
    })
    const result = engine.assess(
      makeTask({ criticality: 'medium' }),
      makePeer({ trustScore: 0.5 }),
      1, 5,
    )
    expect(result.compositeScore).toBeGreaterThanOrEqual(0.30)
    expect(result.level).toBe('mandatory_human')
  })

  it('resetFatigue clears escalation history', () => {
    const engine = new CognitiveFrictionEngine({
      alarmFatigueMaxEscalations: 2,
      alarmFatigueWindowMs: 60_000,
    })

    const task = makeTask({ criticality: 'medium', reversibility: 'medium', verifiability: 'low' })
    const peer = makePeer({ trustScore: 0.4 })

    engine.assess(task, peer, 1, 3)
    engine.assess(task, peer, 1, 3)
    engine.resetFatigue()

    const result = engine.assess(task, peer, 1, 3)
    expect(result.downgraded).toBe(false)
  })

  it('handles maxDepth of 0 without division error', () => {
    const result = engine.assess(makeTask(), makePeer(), 0, 0)
    expect(result.factors.depthRatio).toBe(0) // min(0/1, 1) = 0
  })
})
