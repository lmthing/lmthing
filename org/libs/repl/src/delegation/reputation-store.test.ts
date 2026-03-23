import { describe, it, expect } from 'vitest'
import { ReputationStore } from './reputation-store'

describe('delegation/reputation-store', () => {
  it('creates new peer with initial trust score', () => {
    const store = new ReputationStore({ initialTrustScore: 0.5 })
    const record = store.getOrCreate('peer_1')
    expect(record.trustScore).toBe(0.5)
    expect(record.totalDelegations).toBe(0)
  })

  it('returns existing record on second call', () => {
    const store = new ReputationStore()
    const r1 = store.getOrCreate('peer_1')
    const r2 = store.getOrCreate('peer_1')
    expect(r1).toBe(r2)
  })

  it('increases trust on success', () => {
    const store = new ReputationStore({ initialTrustScore: 0.5, successBonus: 0.1 })
    store.recordSuccess('peer_1', 'task_1', 0.8, 5000)
    expect(store.getTrustScore('peer_1')).toBeCloseTo(0.6)
  })

  it('decreases trust on failure', () => {
    const store = new ReputationStore({ initialTrustScore: 0.5, failurePenalty: 0.1 })
    store.recordFailure('peer_1', 'task_1', 'timeout')
    expect(store.getTrustScore('peer_1')).toBeCloseTo(0.4)
  })

  it('decreases trust on slash', () => {
    const store = new ReputationStore({ initialTrustScore: 0.5, slashPenalty: 0.25 })
    store.recordSlash('peer_1', 'task_1', 'SLO violation')
    expect(store.getTrustScore('peer_1')).toBeCloseTo(0.25)
  })

  it('clamps trust score to [0, 1]', () => {
    const store = new ReputationStore({ initialTrustScore: 0.9, successBonus: 0.2 })
    store.recordSuccess('peer_1', 'task_1', 0.8, 5000)
    expect(store.getTrustScore('peer_1')).toBe(1.0)

    const store2 = new ReputationStore({ initialTrustScore: 0.1, slashPenalty: 0.5 })
    store2.recordSlash('peer_2', 'task_1', 'reason')
    expect(store2.getTrustScore('peer_2')).toBe(0)
  })

  it('tracks delegation counts', () => {
    const store = new ReputationStore()
    store.recordSuccess('peer_1', 't1', 0.8, 5000)
    store.recordSuccess('peer_1', 't2', 0.9, 3000)
    store.recordFailure('peer_1', 't3', 'error')

    const record = store.get('peer_1')!
    expect(record.totalDelegations).toBe(3)
    expect(record.successfulDelegations).toBe(2)
    expect(record.failedDelegations).toBe(1)
  })

  it('updates running averages correctly', () => {
    const store = new ReputationStore()
    store.recordSuccess('peer_1', 't1', 0.6, 4000)
    store.recordSuccess('peer_1', 't2', 0.8, 6000)

    const record = store.get('peer_1')!
    expect(record.averageQuality).toBeCloseTo(0.7)
    expect(record.averageDuration).toBeCloseTo(5000)
  })

  it('records bonus events', () => {
    const store = new ReputationStore({ initialTrustScore: 0.5 })
    store.recordBonus('peer_1', 'task_1', 0.1, 'consensus agreement')
    expect(store.getTrustScore('peer_1')).toBeCloseTo(0.6)
    const record = store.get('peer_1')!
    expect(record.history).toHaveLength(1)
    expect(record.history[0].type).toBe('bonus')
  })

  it('getRanked returns peers sorted by trust descending', () => {
    const store = new ReputationStore({ initialTrustScore: 0.5 })
    store.getOrCreate('peer_low')
    store.recordSuccess('peer_high', 'task_1', 0.9, 1000)
    store.recordFailure('peer_low', 'task_2', 'error')

    const ranked = store.getRanked()
    expect(ranked[0].peerId).toBe('peer_high')
    expect(ranked[1].peerId).toBe('peer_low')
  })

  it('limits history size', () => {
    const store = new ReputationStore({ maxHistorySize: 3 })
    for (let i = 0; i < 10; i++) {
      store.recordSuccess('peer_1', `task_${i}`, 0.8, 5000)
    }
    const record = store.get('peer_1')!
    expect(record.history).toHaveLength(3)
  })

  it('clear removes all records', () => {
    const store = new ReputationStore()
    store.getOrCreate('peer_1')
    store.getOrCreate('peer_2')
    store.clear()
    expect(store.getAll()).toHaveLength(0)
  })

  it('getAll returns all records', () => {
    const store = new ReputationStore()
    store.getOrCreate('peer_1')
    store.getOrCreate('peer_2')
    expect(store.getAll()).toHaveLength(2)
  })

  it('getTrustScore creates record if not exists', () => {
    const store = new ReputationStore({ initialTrustScore: 0.7 })
    expect(store.getTrustScore('new_peer')).toBe(0.7)
  })
})
