import type {
  ReputationRecord,
  ReputationEvent,
  ReputationConfig,
} from './types'

const DEFAULTS: Required<ReputationConfig> = {
  initialTrustScore: 0.5,
  successBonus: 0.05,
  failurePenalty: 0.10,
  slashPenalty: 0.25,
  maxHistorySize: 100,
}

/**
 * Reputation Store
 *
 * Paper basis: §4.6 (Trust and Reputation).
 *
 * Tracks peer reputation over time based on delegation outcomes.
 * Trust scores adjust dynamically: successes increase trust, failures
 * and bond slashes decrease it. Maintains a bounded history of events
 * for auditability.
 */
export class ReputationStore {
  private records = new Map<string, ReputationRecord>()
  private config: Required<ReputationConfig>

  constructor(config: ReputationConfig = {}) {
    this.config = { ...DEFAULTS, ...config }
  }

  /**
   * Get or create a reputation record for a peer.
   */
  getOrCreate(peerId: string): ReputationRecord {
    let record = this.records.get(peerId)
    if (!record) {
      record = {
        peerId,
        trustScore: this.config.initialTrustScore,
        totalDelegations: 0,
        successfulDelegations: 0,
        failedDelegations: 0,
        averageQuality: 0,
        averageDuration: 0,
        lastUpdated: Date.now(),
        history: [],
      }
      this.records.set(peerId, record)
    }
    return record
  }

  /**
   * Get a peer's current trust score.
   */
  getTrustScore(peerId: string): number {
    return this.getOrCreate(peerId).trustScore
  }

  /**
   * Record a successful delegation.
   */
  recordSuccess(peerId: string, taskId: string, quality: number, durationMs: number): ReputationRecord {
    const record = this.getOrCreate(peerId)

    record.totalDelegations++
    record.successfulDelegations++

    // Update running averages
    const n = record.successfulDelegations
    record.averageQuality = record.averageQuality + (quality - record.averageQuality) / n
    record.averageDuration = record.averageDuration + (durationMs - record.averageDuration) / n

    const delta = this.config.successBonus
    record.trustScore = Math.min(1, record.trustScore + delta)
    record.lastUpdated = Date.now()

    this.addEvent(record, {
      type: 'success',
      taskId,
      delta,
      timestamp: Date.now(),
      reason: `Quality: ${quality.toFixed(2)}, Duration: ${durationMs}ms`,
    })

    return record
  }

  /**
   * Record a failed delegation.
   */
  recordFailure(peerId: string, taskId: string, reason: string): ReputationRecord {
    const record = this.getOrCreate(peerId)

    record.totalDelegations++
    record.failedDelegations++

    const delta = -this.config.failurePenalty
    record.trustScore = Math.max(0, record.trustScore + delta)
    record.lastUpdated = Date.now()

    this.addEvent(record, {
      type: 'failure',
      taskId,
      delta,
      timestamp: Date.now(),
      reason,
    })

    return record
  }

  /**
   * Record a bond slash event.
   */
  recordSlash(peerId: string, taskId: string, reason: string): ReputationRecord {
    const record = this.getOrCreate(peerId)

    const delta = -this.config.slashPenalty
    record.trustScore = Math.max(0, record.trustScore + delta)
    record.lastUpdated = Date.now()

    this.addEvent(record, {
      type: 'slash',
      taskId,
      delta,
      timestamp: Date.now(),
      reason,
    })

    return record
  }

  /**
   * Apply a trust bonus (e.g. from consensus agreement).
   */
  recordBonus(peerId: string, taskId: string, bonus: number, reason: string): ReputationRecord {
    const record = this.getOrCreate(peerId)
    record.trustScore = Math.min(1, record.trustScore + bonus)
    record.lastUpdated = Date.now()

    this.addEvent(record, {
      type: 'bonus',
      taskId,
      delta: bonus,
      timestamp: Date.now(),
      reason,
    })

    return record
  }

  /**
   * Get all peer records sorted by trust score (descending).
   */
  getRanked(): ReputationRecord[] {
    return [...this.records.values()].sort((a, b) => b.trustScore - a.trustScore)
  }

  /**
   * Get a record by peer ID.
   */
  get(peerId: string): ReputationRecord | undefined {
    return this.records.get(peerId)
  }

  /**
   * Get all records.
   */
  getAll(): ReputationRecord[] {
    return [...this.records.values()]
  }

  /**
   * Clear all records.
   */
  clear(): void {
    this.records.clear()
  }

  private addEvent(record: ReputationRecord, event: ReputationEvent): void {
    record.history.push(event)
    if (record.history.length > this.config.maxHistorySize) {
      record.history = record.history.slice(-this.config.maxHistorySize)
    }
  }
}
