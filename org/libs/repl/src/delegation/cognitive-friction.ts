import type {
  TaskProfile,
  PeerInfo,
  CognitiveFrictionResult,
  CognitiveFrictionConfig,
  FrictionLevel,
} from './types'

const DEFAULT_WEIGHTS = {
  criticality: 0.30,
  irreversibility: 0.25,
  uncertainty: 0.20,
  depthRatio: 0.15,
  trustDeficit: 0.10,
}

const DEFAULT_THRESHOLDS = {
  info: 0.30,
  confirm: 0.60,
  mandatoryHuman: 0.85,
}

const LEVEL_MAP: Record<string, number> = {
  low: 0.2,
  medium: 0.5,
  high: 0.9,
}

/**
 * Cognitive Friction Engine
 *
 * Paper basis: §2.3 (Zone of Indifference, Dynamic Cognitive Friction) and §5.1 (Meaningful Human Control).
 *
 * Prevents automation complacency by requiring graduated human oversight based on
 * task risk. Assesses delegation risk across five weighted factors and maps the
 * composite score to four friction levels.
 *
 * Anti-alarm fatigue: tracks escalation frequency in a rolling window. After
 * maxEscalations, downgrades `confirm` → `info` and `info` → `none`.
 * `mandatory_human` is never downgraded.
 */
export class CognitiveFrictionEngine {
  private weights: Required<NonNullable<CognitiveFrictionConfig['weights']>>
  private thresholds: Required<NonNullable<CognitiveFrictionConfig['thresholds']>>
  private maxEscalations: number
  private fatigueWindowMs: number
  private escalationTimestamps: number[] = []

  constructor(config: CognitiveFrictionConfig = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...config.weights }
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds }
    this.maxEscalations = config.alarmFatigueMaxEscalations ?? 5
    this.fatigueWindowMs = config.alarmFatigueWindowMs ?? 5 * 60 * 1000
  }

  /**
   * Assess the friction level for a delegation.
   */
  assess(
    task: TaskProfile,
    peer: PeerInfo,
    currentDepth: number,
    maxDepth: number,
  ): CognitiveFrictionResult {
    const factors = {
      criticality: LEVEL_MAP[task.criticality] ?? 0.5,
      irreversibility: 1 - (LEVEL_MAP[task.reversibility] ?? 0.5),
      uncertainty: 1 - (LEVEL_MAP[task.verifiability] ?? 0.5),
      depthRatio: Math.min(currentDepth / Math.max(maxDepth, 1), 1.0),
      trustDeficit: Math.max(0, 1 - peer.trustScore),
    }

    const compositeScore =
      factors.criticality * this.weights.criticality +
      factors.irreversibility * this.weights.irreversibility +
      factors.uncertainty * this.weights.uncertainty +
      factors.depthRatio * this.weights.depthRatio +
      factors.trustDeficit * this.weights.trustDeficit

    let level = this.scoreToLevel(compositeScore)
    let downgraded = false

    // Anti-alarm fatigue: downgrade if too many escalations in window
    if (level === 'info' || level === 'confirm') {
      const now = Date.now()
      this.escalationTimestamps = this.escalationTimestamps.filter(
        t => now - t < this.fatigueWindowMs,
      )

      if (this.escalationTimestamps.length >= this.maxEscalations) {
        if (level === 'confirm') {
          level = 'info'
          downgraded = true
        } else if (level === 'info') {
          level = 'none'
          downgraded = true
        }
      }

      // Record this escalation
      if (level !== 'none') {
        this.escalationTimestamps.push(now)
      }
    }

    return { level, compositeScore, factors, downgraded }
  }

  private scoreToLevel(score: number): FrictionLevel {
    if (score >= this.thresholds.mandatoryHuman) return 'mandatory_human'
    if (score >= this.thresholds.confirm) return 'confirm'
    if (score >= this.thresholds.info) return 'info'
    return 'none'
  }

  /**
   * Reset alarm fatigue tracking.
   */
  resetFatigue(): void {
    this.escalationTimestamps = []
  }
}
