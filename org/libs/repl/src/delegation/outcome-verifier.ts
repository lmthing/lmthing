import type {
  SLORequirements,
  DelegationResult,
  OutcomeVerification,
  OutcomeViolation,
} from './types'

/**
 * Outcome Verifier
 *
 * Paper basis: §4.4 (Adaptive Execution — performance monitoring).
 *
 * Verifies delegation results against SLO requirements. Checks duration,
 * cost, and quality against thresholds and produces a structured verification
 * report with typed violations.
 */
export class OutcomeVerifier {
  /**
   * Verify a delegation result against SLO requirements.
   */
  verify(result: DelegationResult, slo: SLORequirements): OutcomeVerification {
    const violations: OutcomeViolation[] = []

    // Duration check
    if (result.durationMs > slo.maxDurationMs) {
      const severity = result.durationMs > slo.maxDurationMs * 2 ? 'failure' : 'warning'
      violations.push({
        type: 'duration',
        expected: slo.maxDurationMs,
        actual: result.durationMs,
        severity,
      })
    }

    // Cost check
    if (result.costTokens > slo.maxCostTokens) {
      const severity = result.costTokens > slo.maxCostTokens * 2 ? 'failure' : 'warning'
      violations.push({
        type: 'cost',
        expected: slo.maxCostTokens,
        actual: result.costTokens,
        severity,
      })
    }

    // Quality check
    if (result.qualityScore < slo.minQualityScore) {
      const severity = result.qualityScore < slo.minQualityScore * 0.5 ? 'failure' : 'warning'
      violations.push({
        type: 'quality',
        expected: slo.minQualityScore,
        actual: result.qualityScore,
        severity,
      })
    }

    // Completeness check (failed or timeout status)
    if (result.status !== 'completed') {
      violations.push({
        type: 'completeness',
        expected: 1,
        actual: 0,
        severity: 'failure',
      })
    }

    const hasFailure = violations.some(v => v.severity === 'failure')
    const score = this.computeScore(result, slo, violations)

    return {
      passed: !hasFailure,
      score,
      violations,
      durationMs: result.durationMs,
      costTokens: result.costTokens,
    }
  }

  /**
   * Compute a composite verification score (0-1).
   */
  private computeScore(
    result: DelegationResult,
    slo: SLORequirements,
    violations: OutcomeViolation[],
  ): number {
    if (result.status !== 'completed') return 0

    // Start at 1.0 and penalize for violations
    let score = 1.0

    for (const v of violations) {
      if (v.severity === 'failure') {
        score -= 0.3
      } else {
        score -= 0.1
      }
    }

    // Bonus for being well under SLO limits
    const durationRatio = result.durationMs / slo.maxDurationMs
    const costRatio = result.costTokens / slo.maxCostTokens
    if (durationRatio < 0.5) score += 0.05
    if (costRatio < 0.5) score += 0.05

    return Math.max(0, Math.min(1, score))
  }
}
