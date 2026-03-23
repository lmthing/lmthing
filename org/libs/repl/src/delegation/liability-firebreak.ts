import type {
  TaskProfile,
  FirebreakResult,
  FirebreakConfig,
  FirebreakAction,
} from './types'

const DEFAULTS: Required<FirebreakConfig> = {
  baseMaxDepth: 3,
  criticalityReduction: 1,
  reversibilityReduction: 1,
  minDepth: 1,
  mode: 'strict',
}

/**
 * Liability Firebreaks
 *
 * Paper basis: §5.2 (Accountability in Long Delegation Chains) and §4.5 (Transitive Monitoring).
 *
 * Prevents unbounded transitive delegation chains by enforcing depth limits
 * that tighten based on task risk. High-criticality, low-reversibility tasks
 * get a much shorter chain allowance.
 *
 * Two modes:
 * - strict: returns 'halt' — delegation blocked outright
 * - permissive: returns 'request_authority' — proceeds only with explicit approval
 */
export class LiabilityFirebreak {
  private config: Required<FirebreakConfig>

  constructor(config: FirebreakConfig = {}) {
    this.config = { ...DEFAULTS, ...config }
  }

  /**
   * Check whether a delegation at the given depth is permitted.
   */
  check(task: TaskProfile, currentDepth: number): FirebreakResult {
    const effectiveMaxDepth = this.computeEffectiveMaxDepth(task)

    if (currentDepth < effectiveMaxDepth) {
      return {
        action: 'allow',
        effectiveMaxDepth,
        currentDepth,
        reason: `Depth ${currentDepth} within limit ${effectiveMaxDepth}`,
      }
    }

    const action: FirebreakAction =
      this.config.mode === 'strict' ? 'halt' : 'request_authority'

    return {
      action,
      effectiveMaxDepth,
      currentDepth,
      reason: `Depth ${currentDepth} exceeds effective limit ${effectiveMaxDepth} for ${task.criticality}-criticality, ${task.reversibility}-reversibility task`,
    }
  }

  /**
   * Compute effective max depth based on task attributes.
   */
  computeEffectiveMaxDepth(task: TaskProfile): number {
    let depth = this.config.baseMaxDepth

    if (task.criticality === 'high') {
      depth -= this.config.criticalityReduction
    }
    if (task.reversibility === 'low') {
      depth -= this.config.reversibilityReduction
    }

    return Math.max(depth, this.config.minDepth)
  }
}
