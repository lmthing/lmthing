import { describe, it, expect } from 'vitest'
import { ConsensusVerifier } from './consensus-verifier'
import type { DelegationResult } from './types'

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

describe('delegation/consensus-verifier', () => {
  const verifier = new ConsensusVerifier()

  it('does not reach consensus with fewer than minPeers results', () => {
    const result = verifier.verify([makeResult()])
    expect(result.reached).toBe(false)
    expect(result.selectedResult).toBeDefined() // still selects the single result
  })

  it('reaches consensus when peers agree', () => {
    const results = [
      makeResult({ peerId: 'p1', qualityScore: 0.8 }),
      makeResult({ peerId: 'p2', qualityScore: 0.75 }),
      makeResult({ peerId: 'p3', qualityScore: 0.82 }),
    ]
    const result = verifier.verify(results)
    expect(result.reached).toBe(true)
    expect(result.agreementScore).toBeGreaterThanOrEqual(0.6)
    expect(result.selectedResult).toBeDefined()
    expect(result.outliers).toHaveLength(0)
  })

  it('detects outliers when one peer disagrees', () => {
    const results = [
      makeResult({ peerId: 'p1', qualityScore: 0.8 }),
      makeResult({ peerId: 'p2', qualityScore: 0.82 }),
      makeResult({ peerId: 'p3', qualityScore: 0.2 }), // outlier
    ]
    const result = verifier.verify(results)
    expect(result.outliers).toContain('p3')
  })

  it('selects highest quality inlier result', () => {
    const results = [
      makeResult({ peerId: 'p1', qualityScore: 0.75 }),
      makeResult({ peerId: 'p2', qualityScore: 0.85 }),
      makeResult({ peerId: 'p3', qualityScore: 0.80 }),
    ]
    const result = verifier.verify(results)
    expect(result.selectedResult?.peerId).toBe('p2')
  })

  it('does not reach consensus when all results are failed', () => {
    const results = [
      makeResult({ peerId: 'p1', status: 'failed' }),
      makeResult({ peerId: 'p2', status: 'failed' }),
    ]
    const result = verifier.verify(results)
    expect(result.reached).toBe(false)
    expect(result.selectedResult).toBeNull()
  })

  it('handles mix of completed and failed results', () => {
    const results = [
      makeResult({ peerId: 'p1', status: 'completed', qualityScore: 0.8 }),
      makeResult({ peerId: 'p2', status: 'failed' }),
      makeResult({ peerId: 'p3', status: 'completed', qualityScore: 0.75 }),
    ]
    const result = verifier.verify(results)
    // Failed results are excluded from completed set, so p2 is an outlier
    expect(result.outliers).toContain('p2')
    // Only 2 completed results meet minPeers (2), so consensus can still be reached
    expect(result.selectedResult).toBeDefined()
  })

  it('returns empty outliers when all agree', () => {
    const results = [
      makeResult({ peerId: 'p1', qualityScore: 0.80 }),
      makeResult({ peerId: 'p2', qualityScore: 0.80 }),
    ]
    const result = verifier.verify(results)
    expect(result.outliers).toHaveLength(0)
  })

  it('accepts custom agreement threshold', () => {
    const strictVerifier = new ConsensusVerifier({ agreementThreshold: 0.9 })
    const results = [
      makeResult({ peerId: 'p1', qualityScore: 0.8 }),
      makeResult({ peerId: 'p2', qualityScore: 0.5 }), // outlier
      makeResult({ peerId: 'p3', qualityScore: 0.75 }),
    ]
    const result = strictVerifier.verify(results)
    // With 1 outlier out of 3, agreement = 0.67 < 0.9
    expect(result.reached).toBe(false)
  })

  it('accepts custom minPeers', () => {
    const verifier = new ConsensusVerifier({ minPeers: 3 })
    const results = [
      makeResult({ peerId: 'p1' }),
      makeResult({ peerId: 'p2' }),
    ]
    const result = verifier.verify(results)
    expect(result.reached).toBe(false)
  })

  it('handles empty results array', () => {
    const result = verifier.verify([])
    expect(result.reached).toBe(false)
    expect(result.selectedResult).toBeNull()
    expect(result.outliers).toHaveLength(0)
  })
})
