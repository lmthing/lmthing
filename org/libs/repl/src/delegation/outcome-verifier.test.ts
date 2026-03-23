import { describe, it, expect } from 'vitest'
import { OutcomeVerifier } from './outcome-verifier'
import type { DelegationResult, SLORequirements } from './types'

const makeSLO = (overrides: Partial<SLORequirements> = {}): SLORequirements => ({
  maxDurationMs: 10_000,
  maxCostTokens: 5_000,
  minQualityScore: 0.6,
  monitoringInterval: 'periodic',
  ...overrides,
})

const makeResult = (overrides: Partial<DelegationResult> = {}): DelegationResult => ({
  peerId: 'peer_1',
  taskId: 'task_1',
  status: 'completed',
  output: { data: 'result' },
  durationMs: 5_000,
  costTokens: 2_500,
  qualityScore: 0.8,
  ...overrides,
})

describe('delegation/outcome-verifier', () => {
  const verifier = new OutcomeVerifier()

  it('passes when all SLOs met', () => {
    const result = verifier.verify(makeResult(), makeSLO())
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
    expect(result.score).toBeGreaterThan(0.9)
  })

  it('warns on duration slightly over SLO', () => {
    const result = verifier.verify(
      makeResult({ durationMs: 15_000 }),
      makeSLO({ maxDurationMs: 10_000 }),
    )
    expect(result.passed).toBe(true) // warning, not failure
    const durationViolation = result.violations.find(v => v.type === 'duration')
    expect(durationViolation).toBeDefined()
    expect(durationViolation!.severity).toBe('warning')
  })

  it('fails on duration far over SLO (2x+)', () => {
    const result = verifier.verify(
      makeResult({ durationMs: 25_000 }),
      makeSLO({ maxDurationMs: 10_000 }),
    )
    expect(result.passed).toBe(false)
    const durationViolation = result.violations.find(v => v.type === 'duration')
    expect(durationViolation!.severity).toBe('failure')
  })

  it('warns on cost slightly over SLO', () => {
    const result = verifier.verify(
      makeResult({ costTokens: 7_000 }),
      makeSLO({ maxCostTokens: 5_000 }),
    )
    const costViolation = result.violations.find(v => v.type === 'cost')
    expect(costViolation).toBeDefined()
    expect(costViolation!.severity).toBe('warning')
  })

  it('fails on cost far over SLO', () => {
    const result = verifier.verify(
      makeResult({ costTokens: 15_000 }),
      makeSLO({ maxCostTokens: 5_000 }),
    )
    expect(result.passed).toBe(false)
  })

  it('fails on quality below minimum', () => {
    const result = verifier.verify(
      makeResult({ qualityScore: 0.2 }),
      makeSLO({ minQualityScore: 0.6 }),
    )
    expect(result.passed).toBe(false)
    const qualityViolation = result.violations.find(v => v.type === 'quality')
    expect(qualityViolation).toBeDefined()
    expect(qualityViolation!.severity).toBe('failure') // 0.2 < 0.6 * 0.5
  })

  it('warns on quality slightly below minimum', () => {
    const result = verifier.verify(
      makeResult({ qualityScore: 0.5 }),
      makeSLO({ minQualityScore: 0.6 }),
    )
    const qualityViolation = result.violations.find(v => v.type === 'quality')
    expect(qualityViolation!.severity).toBe('warning')
  })

  it('fails on non-completed status', () => {
    const result = verifier.verify(
      makeResult({ status: 'failed' }),
      makeSLO(),
    )
    expect(result.passed).toBe(false)
    const completenessViolation = result.violations.find(v => v.type === 'completeness')
    expect(completenessViolation).toBeDefined()
    expect(result.score).toBe(0)
  })

  it('fails on timeout status', () => {
    const result = verifier.verify(
      makeResult({ status: 'timeout' }),
      makeSLO(),
    )
    expect(result.passed).toBe(false)
  })

  it('gives bonus score for being well under SLO limits', () => {
    const result = verifier.verify(
      makeResult({ durationMs: 1_000, costTokens: 500, qualityScore: 0.9 }),
      makeSLO({ maxDurationMs: 10_000, maxCostTokens: 5_000 }),
    )
    expect(result.score).toBeGreaterThan(1.0 - 0.01) // close to max with bonuses
  })

  it('includes duration and cost in result', () => {
    const result = verifier.verify(
      makeResult({ durationMs: 3_000, costTokens: 1_500 }),
      makeSLO(),
    )
    expect(result.durationMs).toBe(3_000)
    expect(result.costTokens).toBe(1_500)
  })

  it('accumulates multiple violations', () => {
    const result = verifier.verify(
      makeResult({ durationMs: 25_000, costTokens: 15_000, qualityScore: 0.1 }),
      makeSLO(),
    )
    expect(result.violations.length).toBeGreaterThanOrEqual(3)
    expect(result.passed).toBe(false)
  })
})
