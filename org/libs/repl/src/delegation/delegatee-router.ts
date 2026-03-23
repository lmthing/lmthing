import type { TaskProfile, RoutingDecision, RoutingTarget } from './types'

const LEVEL_MAP: Record<string, number> = {
  low: 0.2,
  medium: 0.5,
  high: 0.9,
}

/**
 * Delegatee Router
 *
 * Paper basis: §4.1 (Task Decomposition — human vs. AI routing) and §4.2 (Task Assignment).
 *
 * Decides whether a subtask should be delegated to an AI peer, a human, or either.
 * Evaluates five routing factors and applies prioritized rules.
 */
export class DelegateeRouter {
  /**
   * Route a task to the appropriate delegatee type.
   */
  route(task: TaskProfile): RoutingDecision {
    const criticality = LEVEL_MAP[task.criticality] ?? 0.5
    const reversibility = LEVEL_MAP[task.reversibility] ?? 0.5
    const verifiability = LEVEL_MAP[task.verifiability] ?? 0.5

    // Rule 1: High criticality + Low reversibility → human
    if (criticality >= 0.9 && reversibility <= 0.2) {
      return {
        target: 'human',
        confidence: 0.90,
        reason: 'Irreversible high-stakes decision requires human judgment',
        rule: 'high_criticality_low_reversibility',
      }
    }

    // Rule 2: Low verifiability → human
    if (verifiability <= 0.2) {
      return {
        target: 'human',
        confidence: 0.80,
        reason: 'Outcome cannot be objectively verified; human must assess quality',
        rule: 'low_verifiability',
      }
    }

    // Rule 3: High subjectivity (inverse of verifiability) → human
    const subjectivity = 1 - verifiability
    if (subjectivity >= 0.8) {
      return {
        target: 'human',
        confidence: 0.75,
        reason: 'Subjective task benefits from human evaluation',
        rule: 'high_subjectivity',
      }
    }

    // Rule 4: High verifiability + Low criticality → ai
    if (verifiability >= 0.9 && criticality <= 0.2) {
      return {
        target: 'ai',
        confidence: 0.90,
        reason: 'Objectively measurable, low-stakes task safe to automate',
        rule: 'high_verifiability_low_criticality',
      }
    }

    // Default: any
    return {
      target: 'any',
      confidence: 0.60,
      reason: 'No strong routing signal; either delegation type acceptable',
      rule: 'default',
    }
  }

  /**
   * Filter peers based on routing decision.
   * If target is 'human', returns empty (no AI peers suitable).
   * If target is 'ai' or 'any', returns all peers.
   */
  filterPeers<T extends { id: string }>(
    peers: T[],
    decision: RoutingDecision,
  ): T[] {
    if (decision.target === 'human') return []
    return peers
  }
}
