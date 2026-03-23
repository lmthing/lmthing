import type {
  DelegationResult,
  ConsensusResult,
  ConsensusConfig,
} from './types'

const DEFAULTS: Required<ConsensusConfig> = {
  minPeers: 2,
  agreementThreshold: 0.6,
}

/**
 * Consensus Verifier
 *
 * Paper basis: §4.5 (Monitoring — multi-party verification).
 *
 * When a task is delegated to multiple peers, the consensus verifier
 * compares their results to detect byzantine behavior or degraded outputs.
 * Uses quality-weighted agreement scoring to select the canonical result.
 */
export class ConsensusVerifier {
  private config: Required<ConsensusConfig>

  constructor(config: ConsensusConfig = {}) {
    this.config = { ...DEFAULTS, ...config }
  }

  /**
   * Verify consensus across multiple delegation results.
   */
  verify(results: DelegationResult[]): ConsensusResult {
    if (results.length < this.config.minPeers) {
      return {
        reached: false,
        agreementScore: 0,
        results,
        selectedResult: results.length === 1 ? results[0] : null,
        outliers: [],
      }
    }

    // Filter to completed results
    const completed = results.filter(r => r.status === 'completed')
    if (completed.length < this.config.minPeers) {
      return {
        reached: false,
        agreementScore: 0,
        results,
        selectedResult: null,
        outliers: results.filter(r => r.status !== 'completed').map(r => r.peerId),
      }
    }

    // Non-completed results are always outliers
    const nonCompleted = results.filter(r => r.status !== 'completed')

    // Compute pairwise agreement scores among completed results
    const { agreementScore, outliers, inliers } = this.computeAgreement(completed)

    const reached = agreementScore >= this.config.agreementThreshold

    // Select the best result from inliers (highest quality)
    const selectedResult = inliers.length > 0
      ? inliers.reduce((best, r) => r.qualityScore > best.qualityScore ? r : best)
      : null

    return {
      reached,
      agreementScore,
      results,
      selectedResult,
      outliers: [
        ...nonCompleted.map(r => r.peerId),
        ...outliers.map(r => r.peerId),
      ],
    }
  }

  /**
   * Compute agreement score across results.
   *
   * Uses quality-weighted scoring: results with similar quality scores
   * are considered to "agree". Outliers are results whose quality
   * deviates significantly from the median.
   */
  private computeAgreement(results: DelegationResult[]): {
    agreementScore: number
    outliers: DelegationResult[]
    inliers: DelegationResult[]
  } {
    if (results.length <= 1) {
      return { agreementScore: 1, outliers: [], inliers: results }
    }

    const qualities = results.map(r => r.qualityScore).sort((a, b) => a - b)
    const median = qualities[Math.floor(qualities.length / 2)]

    // Compute deviation threshold (25% of range, minimum 0.15)
    const range = qualities[qualities.length - 1] - qualities[0]
    const deviationThreshold = Math.max(range * 0.25, 0.15)

    const outliers: DelegationResult[] = []
    const inliers: DelegationResult[] = []

    for (const result of results) {
      if (Math.abs(result.qualityScore - median) > deviationThreshold) {
        outliers.push(result)
      } else {
        inliers.push(result)
      }
    }

    // Agreement score = ratio of inliers to total
    const agreementScore = inliers.length / results.length

    return { agreementScore, outliers, inliers }
  }
}
