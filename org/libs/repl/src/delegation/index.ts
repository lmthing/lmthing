// Delegation Framework — Intelligent AI Delegation (Tomasev et al., 2026)

export { CognitiveFrictionEngine } from './cognitive-friction'
export { LiabilityFirebreak } from './liability-firebreak'
export { DelegateeRouter } from './delegatee-router'
export { GraduatedAuthority } from './graduated-authority'
export { EscrowBondManager } from './escrow-bond'
export { OutcomeVerifier } from './outcome-verifier'
export { ConsensusVerifier } from './consensus-verifier'
export { ReputationStore } from './reputation-store'
export { DelegationManager } from './delegation-manager'
export type { DelegationManagerConfig } from './delegation-manager'

export type {
  // Task
  Criticality,
  Reversibility,
  Verifiability,
  TaskProfile,
  PeerInfo,

  // Cognitive Friction
  FrictionLevel,
  CognitiveFrictionResult,
  CognitiveFrictionConfig,

  // Liability Firebreaks
  FirebreakAction,
  FirebreakResult,
  FirebreakConfig,

  // Delegatee Router
  RoutingTarget,
  RoutingDecision,

  // Graduated Authority
  AuthorityLevel,
  SLORequirements,
  AuthorityGrant,
  GraduatedAuthorityConfig,

  // Escrow
  EscrowBond,
  EscrowConfig,

  // Outcome Verification
  OutcomeVerification,
  OutcomeViolation,
  DelegationResult,

  // Consensus
  ConsensusResult,
  ConsensusConfig,

  // Reputation
  ReputationRecord,
  ReputationEvent,
  ReputationConfig,

  // Manager
  DelegationRequest,
  DelegationPlan,
  DelegationOutcome,

  // Journal
  JournalEntry,
} from './types'
