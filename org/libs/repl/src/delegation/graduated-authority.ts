import type {
  TaskProfile,
  PeerInfo,
  AuthorityGrant,
  AuthorityLevel,
  SLORequirements,
  GraduatedAuthorityConfig,
} from './types'

const DEFAULT_THRESHOLDS = {
  standard: 0.40,
  elevated: 0.70,
  autonomous: 0.90,
}

/**
 * Graduated Authority
 *
 * Paper basis: §2.3 (Authority Gradient, Trust Calibration), §4.6 (Trust and Reputation),
 * and §4.7 (Permission Handling).
 *
 * Scales SLOs, monitoring intensity, and permission boundaries based on peer trust.
 * Low-trust agents face strict constraints; high-reputation agents get wider autonomy.
 */
export class GraduatedAuthority {
  private thresholds: Required<NonNullable<GraduatedAuthorityConfig['thresholds']>>

  constructor(config: GraduatedAuthorityConfig = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds }
  }

  /**
   * Compute the authority grant for a peer given a task.
   */
  computeGrant(task: TaskProfile, peer: PeerInfo): AuthorityGrant {
    const level = this.computeLevel(peer.trustScore)
    const slo = this.computeSLO(task, level)
    const permissions = this.computePermissions(level)
    const requiresApproval = level === 'restricted' || task.criticality === 'high'

    return { level, slo, permissions, requiresApproval }
  }

  /**
   * Map trust score to authority level.
   */
  computeLevel(trustScore: number): AuthorityLevel {
    if (trustScore >= this.thresholds.autonomous) return 'autonomous'
    if (trustScore >= this.thresholds.elevated) return 'elevated'
    if (trustScore >= this.thresholds.standard) return 'standard'
    return 'restricted'
  }

  /**
   * Compute SLO requirements based on task profile and authority level.
   * Lower authority = stricter SLOs.
   */
  computeSLO(task: TaskProfile, level: AuthorityLevel): SLORequirements {
    const baseDuration = task.maxDuration ?? 30_000
    const baseCost = task.maxCost ?? 10_000

    const multipliers: Record<AuthorityLevel, number> = {
      restricted: 0.5,
      standard: 1.0,
      elevated: 1.5,
      autonomous: 2.0,
    }

    const qualityFloors: Record<AuthorityLevel, number> = {
      restricted: 0.8,
      standard: 0.6,
      elevated: 0.4,
      autonomous: 0.3,
    }

    const monitoring: Record<AuthorityLevel, SLORequirements['monitoringInterval']> = {
      restricted: 'continuous',
      standard: 'periodic',
      elevated: 'periodic',
      autonomous: 'minimal',
    }

    const m = multipliers[level]

    return {
      maxDurationMs: Math.round(baseDuration * m),
      maxCostTokens: Math.round(baseCost * m),
      minQualityScore: qualityFloors[level],
      monitoringInterval: monitoring[level],
    }
  }

  private computePermissions(level: AuthorityLevel): string[] {
    const base = ['read', 'execute']
    if (level === 'restricted') return base
    if (level === 'standard') return [...base, 'write']
    if (level === 'elevated') return [...base, 'write', 'delegate']
    return [...base, 'write', 'delegate', 'configure']
  }
}
