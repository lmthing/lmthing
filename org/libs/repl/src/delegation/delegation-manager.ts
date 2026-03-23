import type {
  DelegationRequest,
  DelegationPlan,
  DelegationOutcome,
  DelegationResult,
  PeerInfo,
  JournalEntry,
} from './types'
import { CognitiveFrictionEngine } from './cognitive-friction'
import { LiabilityFirebreak } from './liability-firebreak'
import { DelegateeRouter } from './delegatee-router'
import { GraduatedAuthority } from './graduated-authority'
import { EscrowBondManager } from './escrow-bond'
import { OutcomeVerifier } from './outcome-verifier'
import { ConsensusVerifier } from './consensus-verifier'
import { ReputationStore } from './reputation-store'
import type { CognitiveFrictionConfig } from './types'
import type { FirebreakConfig } from './types'
import type { GraduatedAuthorityConfig } from './types'
import type { EscrowConfig } from './types'
import type { ConsensusConfig } from './types'
import type { ReputationConfig } from './types'

export interface DelegationManagerConfig {
  friction?: CognitiveFrictionConfig
  firebreak?: FirebreakConfig
  authority?: GraduatedAuthorityConfig
  escrow?: EscrowConfig
  consensus?: ConsensusConfig
  reputation?: ReputationConfig
  /** Called when a delegation needs user confirmation */
  onConfirmRequired?: (plan: DelegationPlan) => Promise<boolean>
  /** Called when a delegation requires mandatory human review */
  onHumanReviewRequired?: (plan: DelegationPlan) => Promise<boolean>
  /** Called to execute the actual delegation to a peer */
  executeDelegation?: (peerId: string, request: DelegationRequest) => Promise<DelegationResult>
}

/**
 * Delegation Manager
 *
 * Orchestrates the full intelligent delegation pipeline, composing all nine
 * components into a closed loop. Maps to all five pillars of the framework:
 *
 * 1. Dynamic Assessment → CognitiveFrictionEngine, DelegateeRouter
 * 2. Adaptive Execution → Re-delegation pipeline
 * 3. Structural Transparency → OutcomeVerifier, ConsensusVerifier, Journal
 * 4. Scalable Market Coordination → EscrowBondManager, ReputationStore
 * 5. Systemic Resilience → LiabilityFirebreak, GraduatedAuthority
 */
export class DelegationManager {
  readonly friction: CognitiveFrictionEngine
  readonly firebreak: LiabilityFirebreak
  readonly router: DelegateeRouter
  readonly authority: GraduatedAuthority
  readonly escrow: EscrowBondManager
  readonly outcomeVerifier: OutcomeVerifier
  readonly consensusVerifier: ConsensusVerifier
  readonly reputation: ReputationStore
  private journal: JournalEntry[] = []
  private config: DelegationManagerConfig

  constructor(config: DelegationManagerConfig = {}) {
    this.config = config
    this.friction = new CognitiveFrictionEngine(config.friction)
    this.firebreak = new LiabilityFirebreak(config.firebreak)
    this.router = new DelegateeRouter()
    this.authority = new GraduatedAuthority(config.authority)
    this.escrow = new EscrowBondManager(config.escrow)
    this.outcomeVerifier = new OutcomeVerifier()
    this.consensusVerifier = new ConsensusVerifier(config.consensus)
    this.reputation = new ReputationStore(config.reputation)
  }

  /**
   * Plan a delegation without executing it.
   * Runs all pre-delegation checks and returns the plan.
   */
  plan(request: DelegationRequest): DelegationPlan {
    const { task, availablePeers, currentDepth, maxDepth } = request

    // 1. Firebreak check
    const firebreakResult = this.firebreak.check(task, currentDepth)
    this.log({ type: 'firebreak_checked', taskId: task.id, result: firebreakResult, timestamp: Date.now() })

    if (firebreakResult.action === 'halt') {
      return {
        approved: false,
        task,
        routing: { target: 'any', confidence: 0, reason: '', rule: '' },
        friction: { level: 'none', compositeScore: 0, factors: { criticality: 0, irreversibility: 0, uncertainty: 0, depthRatio: 0, trustDeficit: 0 }, downgraded: false },
        firebreak: firebreakResult,
        selectedPeer: null,
        authority: null,
        bond: null,
        reason: firebreakResult.reason,
      }
    }

    // 2. Routing decision
    const routing = this.router.route(task)
    this.log({ type: 'routing_decided', taskId: task.id, decision: routing, timestamp: Date.now() })

    // Filter peers based on routing
    const eligiblePeers = this.router.filterPeers(availablePeers, routing)
    if (eligiblePeers.length === 0) {
      return {
        approved: false,
        task,
        routing,
        friction: { level: 'none', compositeScore: 0, factors: { criticality: 0, irreversibility: 0, uncertainty: 0, depthRatio: 0, trustDeficit: 0 }, downgraded: false },
        firebreak: firebreakResult,
        selectedPeer: null,
        authority: null,
        bond: null,
        reason: routing.target === 'human'
          ? 'Task requires human delegation; no AI peers eligible'
          : 'No eligible peers available',
      }
    }

    // 3. Select best peer by trust score (from reputation store)
    const selectedPeer = this.selectBestPeer(eligiblePeers)

    // 4. Cognitive friction assessment
    const frictionResult = this.friction.assess(task, selectedPeer, currentDepth, maxDepth)
    this.log({ type: 'friction_assessed', taskId: task.id, result: frictionResult, timestamp: Date.now() })

    // 5. Graduated authority
    const authorityGrant = this.authority.computeGrant(task, selectedPeer)
    this.log({ type: 'authority_granted', taskId: task.id, peerId: selectedPeer.id, grant: authorityGrant, timestamp: Date.now() })

    // Determine if approved based on friction level
    const approved = frictionResult.level === 'none' || frictionResult.level === 'info'

    return {
      approved,
      task,
      routing,
      friction: frictionResult,
      firebreak: firebreakResult,
      selectedPeer,
      authority: authorityGrant,
      bond: null, // Bond created at execution time
      reason: approved
        ? `Delegation approved to ${selectedPeer.name} (trust: ${selectedPeer.trustScore.toFixed(2)})`
        : `Delegation requires ${frictionResult.level} before proceeding`,
    }
  }

  /**
   * Execute a full delegation lifecycle.
   * Plans, creates bond, delegates, verifies, and updates reputation.
   */
  async execute(request: DelegationRequest): Promise<DelegationOutcome> {
    const plan = this.plan(request)

    if (!plan.approved) {
      // Check if we can get approval
      if (plan.friction.level === 'confirm' && this.config.onConfirmRequired) {
        const confirmed = await this.config.onConfirmRequired(plan)
        if (confirmed) {
          plan.approved = true
          plan.reason = `Delegation confirmed by user to ${plan.selectedPeer?.name}`
        }
      } else if (plan.friction.level === 'mandatory_human' && this.config.onHumanReviewRequired) {
        const reviewed = await this.config.onHumanReviewRequired(plan)
        if (reviewed) {
          plan.approved = true
          plan.reason = `Delegation approved by human reviewer to ${plan.selectedPeer?.name}`
        }
      }
    }

    if (!plan.approved || !plan.selectedPeer || !plan.authority) {
      return {
        plan,
        verification: null,
        consensus: null,
        reputationUpdates: [],
        reDelegated: false,
        finalResult: null,
      }
    }

    // Create escrow bond
    const bond = this.escrow.create(plan.selectedPeer.id, request.task)
    plan.bond = bond
    this.log({ type: 'bond_created', taskId: request.task.id, bond, timestamp: Date.now() })

    // Execute delegation
    this.log({ type: 'delegation_started', taskId: request.task.id, peerId: plan.selectedPeer.id, timestamp: Date.now() })

    const executeFn = this.config.executeDelegation
    if (!executeFn) {
      throw new Error('No executeDelegation handler configured')
    }

    let results: DelegationResult[]

    if (request.consensusPeers && request.consensusPeers > 1) {
      // Multi-peer consensus mode
      const peers = this.selectTopPeers(request.availablePeers, request.consensusPeers)
      results = await Promise.all(
        peers.map(peer => executeFn(peer.id, request)),
      )
    } else {
      results = [await executeFn(plan.selectedPeer.id, request)]
    }

    // Verify outcome
    const primaryResult = results[0]
    const verification = this.outcomeVerifier.verify(primaryResult, plan.authority.slo)
    this.log({ type: 'outcome_verified', taskId: request.task.id, verification, timestamp: Date.now() })

    // Consensus (if multiple results)
    let consensus = null
    if (results.length > 1) {
      consensus = this.consensusVerifier.verify(results)
      this.log({ type: 'consensus_reached', taskId: request.task.id, result: consensus, timestamp: Date.now() })
    }

    // Update reputation and resolve bond
    const reputationUpdates: Array<{ peerId: string; oldScore: number; newScore: number }> = []

    if (verification.passed) {
      // Success path
      this.escrow.release(bond.id)
      this.log({ type: 'bond_resolved', taskId: request.task.id, bond: this.escrow.get(bond.id)!, timestamp: Date.now() })

      for (const result of results) {
        const oldScore = this.reputation.getTrustScore(result.peerId)
        this.reputation.recordSuccess(result.peerId, request.task.id, result.qualityScore, result.durationMs)
        const newScore = this.reputation.getTrustScore(result.peerId)
        reputationUpdates.push({ peerId: result.peerId, oldScore, newScore })
        this.log({ type: 'reputation_updated', peerId: result.peerId, oldScore, newScore, timestamp: Date.now() })
      }

      this.log({ type: 'delegation_completed', taskId: request.task.id, peerId: plan.selectedPeer.id, timestamp: Date.now() })

      const finalResult = consensus?.selectedResult ?? primaryResult

      return {
        plan,
        verification,
        consensus,
        reputationUpdates,
        reDelegated: false,
        finalResult,
      }
    }

    // Failure path — slash bond, penalize reputation, attempt re-delegation
    this.escrow.slash(bond.id, `SLO violation: ${verification.violations.map(v => v.type).join(', ')}`)
    this.log({ type: 'bond_resolved', taskId: request.task.id, bond: this.escrow.get(bond.id)!, timestamp: Date.now() })

    const oldScore = this.reputation.getTrustScore(plan.selectedPeer.id)
    this.reputation.recordFailure(plan.selectedPeer.id, request.task.id, 'SLO violation')
    this.reputation.recordSlash(plan.selectedPeer.id, request.task.id, 'Bond slashed for SLO violation')
    const newScore = this.reputation.getTrustScore(plan.selectedPeer.id)
    reputationUpdates.push({ peerId: plan.selectedPeer.id, oldScore, newScore })
    this.log({ type: 'reputation_updated', peerId: plan.selectedPeer.id, oldScore, newScore, timestamp: Date.now() })
    this.log({ type: 'delegation_failed', taskId: request.task.id, peerId: plan.selectedPeer.id, reason: 'SLO violation', timestamp: Date.now() })

    // Attempt re-delegation to next best peer
    const remainingPeers = request.availablePeers.filter(p => p.id !== plan.selectedPeer!.id)
    if (remainingPeers.length > 0) {
      const nextPeer = this.selectBestPeer(remainingPeers)
      this.log({
        type: 'redelegation',
        taskId: request.task.id,
        fromPeerId: plan.selectedPeer.id,
        toPeerId: nextPeer.id,
        reason: 'Primary delegation failed SLO verification',
        timestamp: Date.now(),
      })

      const reDelegationResult = await executeFn(nextPeer.id, request)
      const reVerification = this.outcomeVerifier.verify(reDelegationResult, plan.authority.slo)

      if (reVerification.passed) {
        const rOld = this.reputation.getTrustScore(nextPeer.id)
        this.reputation.recordSuccess(nextPeer.id, request.task.id, reDelegationResult.qualityScore, reDelegationResult.durationMs)
        const rNew = this.reputation.getTrustScore(nextPeer.id)
        reputationUpdates.push({ peerId: nextPeer.id, oldScore: rOld, newScore: rNew })
      } else {
        const rOld = this.reputation.getTrustScore(nextPeer.id)
        this.reputation.recordFailure(nextPeer.id, request.task.id, 'Re-delegation also failed SLO')
        const rNew = this.reputation.getTrustScore(nextPeer.id)
        reputationUpdates.push({ peerId: nextPeer.id, oldScore: rOld, newScore: rNew })
      }

      return {
        plan,
        verification: reVerification,
        consensus: null,
        reputationUpdates,
        reDelegated: true,
        finalResult: reDelegationResult,
      }
    }

    // No peers left for re-delegation
    return {
      plan,
      verification,
      consensus,
      reputationUpdates,
      reDelegated: false,
      finalResult: primaryResult,
    }
  }

  /**
   * Select the best peer by trust score.
   */
  private selectBestPeer(peers: PeerInfo[]): PeerInfo {
    return peers.reduce((best, peer) => {
      const bestTrust = this.reputation.getTrustScore(best.id)
      const peerTrust = this.reputation.getTrustScore(peer.id)
      return peerTrust > bestTrust ? peer : best
    })
  }

  /**
   * Select top N peers by trust score.
   */
  private selectTopPeers(peers: PeerInfo[], count: number): PeerInfo[] {
    return [...peers]
      .sort((a, b) => this.reputation.getTrustScore(b.id) - this.reputation.getTrustScore(a.id))
      .slice(0, count)
  }

  /**
   * Get the full audit journal.
   */
  getJournal(): JournalEntry[] {
    return [...this.journal]
  }

  /**
   * Clear the journal.
   */
  clearJournal(): void {
    this.journal = []
  }

  private log(entry: JournalEntry): void {
    this.journal.push(entry)
  }
}
