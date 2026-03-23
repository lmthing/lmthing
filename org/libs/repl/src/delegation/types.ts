// ── Delegation Framework Types ──
// Based on Tomasev, Franklin & Osindero, "Intelligent AI Delegation" (2026)
// Five pillars: Dynamic Assessment, Adaptive Execution, Structural Transparency,
// Scalable Market Coordination, Systemic Resilience

// ── Task Profile ──

export type Criticality = 'low' | 'medium' | 'high'
export type Reversibility = 'low' | 'medium' | 'high'
export type Verifiability = 'low' | 'medium' | 'high'

export interface TaskProfile {
  id: string
  description: string
  criticality: Criticality
  reversibility: Reversibility
  verifiability: Verifiability
  /** Estimated cost in tokens */
  estimatedCost?: number
  /** Maximum allowed cost in tokens */
  maxCost?: number
  /** Maximum allowed duration in ms */
  maxDuration?: number
}

// ── Peer Identity ──

export interface PeerInfo {
  id: string
  name: string
  capabilities: string[]
  /** Current trust score 0-1 */
  trustScore: number
}

// ── Cognitive Friction (§2.3, §5.1) ──

export type FrictionLevel = 'none' | 'info' | 'confirm' | 'mandatory_human'

export interface CognitiveFrictionResult {
  level: FrictionLevel
  compositeScore: number
  factors: {
    criticality: number
    irreversibility: number
    uncertainty: number
    depthRatio: number
    trustDeficit: number
  }
  /** Whether this was downgraded due to alarm fatigue */
  downgraded: boolean
}

export interface CognitiveFrictionConfig {
  weights?: {
    criticality?: number
    irreversibility?: number
    uncertainty?: number
    depthRatio?: number
    trustDeficit?: number
  }
  thresholds?: {
    info?: number
    confirm?: number
    mandatoryHuman?: number
  }
  /** Max escalations in the fatigue window before downgrading */
  alarmFatigueMaxEscalations?: number
  /** Rolling window in ms for alarm fatigue tracking */
  alarmFatigueWindowMs?: number
}

// ── Liability Firebreaks (§5.2, §4.5) ──

export type FirebreakAction = 'allow' | 'halt' | 'request_authority'

export interface FirebreakResult {
  action: FirebreakAction
  effectiveMaxDepth: number
  currentDepth: number
  reason: string
}

export interface FirebreakConfig {
  baseMaxDepth?: number
  criticalityReduction?: number
  reversibilityReduction?: number
  minDepth?: number
  /** 'strict' blocks outright, 'permissive' allows with authority */
  mode?: 'strict' | 'permissive'
}

// ── Delegatee Router (§4.1, §4.2) ──

export type RoutingTarget = 'human' | 'ai' | 'any'

export interface RoutingDecision {
  target: RoutingTarget
  confidence: number
  reason: string
  rule: string
}

// ── Graduated Authority (§2.3, §4.6, §4.7) ──

export type AuthorityLevel = 'restricted' | 'standard' | 'elevated' | 'autonomous'

export interface SLORequirements {
  maxDurationMs: number
  maxCostTokens: number
  minQualityScore: number
  monitoringInterval: 'continuous' | 'periodic' | 'minimal'
}

export interface AuthorityGrant {
  level: AuthorityLevel
  slo: SLORequirements
  permissions: string[]
  requiresApproval: boolean
}

export interface GraduatedAuthorityConfig {
  /** Trust thresholds for authority level transitions */
  thresholds?: {
    standard?: number
    elevated?: number
    autonomous?: number
  }
}

// ── Escrow Bond (§4.8) ──

export interface EscrowBond {
  id: string
  peerId: string
  taskId: string
  amount: number
  status: 'held' | 'released' | 'slashed'
  createdAt: number
  resolvedAt?: number
  slashReason?: string
}

export interface EscrowConfig {
  /** Base bond amount (in abstract units) */
  baseBondAmount?: number
  /** Multiplier for high criticality tasks */
  criticalityMultiplier?: number
}

// ── Outcome Verifier (§4.4) ──

export interface OutcomeVerification {
  passed: boolean
  score: number
  violations: OutcomeViolation[]
  durationMs: number
  costTokens: number
}

export interface OutcomeViolation {
  type: 'duration' | 'cost' | 'quality' | 'completeness'
  expected: number
  actual: number
  severity: 'warning' | 'failure'
}

export interface DelegationResult {
  peerId: string
  taskId: string
  status: 'completed' | 'failed' | 'timeout'
  output: unknown
  durationMs: number
  costTokens: number
  /** 0-1 quality score based on output analysis */
  qualityScore: number
}

// ── Consensus Verifier (§4.5) ──

export interface ConsensusResult {
  reached: boolean
  agreementScore: number
  results: DelegationResult[]
  /** The result selected as canonical */
  selectedResult: DelegationResult | null
  /** Outlier peer IDs that disagreed with consensus */
  outliers: string[]
}

export interface ConsensusConfig {
  /** Minimum peers required for consensus */
  minPeers?: number
  /** Agreement threshold 0-1 */
  agreementThreshold?: number
}

// ── Reputation Store (§4.6) ──

export interface ReputationRecord {
  peerId: string
  trustScore: number
  totalDelegations: number
  successfulDelegations: number
  failedDelegations: number
  averageQuality: number
  averageDuration: number
  lastUpdated: number
  history: ReputationEvent[]
}

export interface ReputationEvent {
  type: 'success' | 'failure' | 'slash' | 'bonus'
  taskId: string
  delta: number
  timestamp: number
  reason: string
}

export interface ReputationConfig {
  /** Initial trust score for new peers */
  initialTrustScore?: number
  /** How much a success increases trust */
  successBonus?: number
  /** How much a failure decreases trust */
  failurePenalty?: number
  /** How much a slash decreases trust */
  slashPenalty?: number
  /** Maximum history events to retain per peer */
  maxHistorySize?: number
}

// ── Delegation Manager (orchestrator) ──

export interface DelegationRequest {
  task: TaskProfile
  availablePeers: PeerInfo[]
  currentDepth: number
  maxDepth: number
  /** Optional: request multiple peers for consensus */
  consensusPeers?: number
}

export interface DelegationPlan {
  approved: boolean
  task: TaskProfile
  routing: RoutingDecision
  friction: CognitiveFrictionResult
  firebreak: FirebreakResult
  selectedPeer: PeerInfo | null
  authority: AuthorityGrant | null
  bond: EscrowBond | null
  reason: string
}

export interface DelegationOutcome {
  plan: DelegationPlan
  verification: OutcomeVerification | null
  consensus: ConsensusResult | null
  reputationUpdates: Array<{ peerId: string; oldScore: number; newScore: number }>
  reDelegated: boolean
  finalResult: DelegationResult | null
}

// ── Journal Events ──

export type JournalEntry =
  | { type: 'friction_assessed'; taskId: string; result: CognitiveFrictionResult; timestamp: number }
  | { type: 'firebreak_checked'; taskId: string; result: FirebreakResult; timestamp: number }
  | { type: 'routing_decided'; taskId: string; decision: RoutingDecision; timestamp: number }
  | { type: 'authority_granted'; taskId: string; peerId: string; grant: AuthorityGrant; timestamp: number }
  | { type: 'bond_created'; taskId: string; bond: EscrowBond; timestamp: number }
  | { type: 'bond_resolved'; taskId: string; bond: EscrowBond; timestamp: number }
  | { type: 'outcome_verified'; taskId: string; verification: OutcomeVerification; timestamp: number }
  | { type: 'consensus_reached'; taskId: string; result: ConsensusResult; timestamp: number }
  | { type: 'reputation_updated'; peerId: string; oldScore: number; newScore: number; timestamp: number }
  | { type: 'delegation_started'; taskId: string; peerId: string; timestamp: number }
  | { type: 'delegation_completed'; taskId: string; peerId: string; timestamp: number }
  | { type: 'delegation_failed'; taskId: string; peerId: string; reason: string; timestamp: number }
  | { type: 'redelegation'; taskId: string; fromPeerId: string; toPeerId: string; reason: string; timestamp: number }
