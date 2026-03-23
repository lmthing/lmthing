import type {
  TaskProfile,
  EscrowBond,
  EscrowConfig,
} from './types'

const DEFAULTS: Required<EscrowConfig> = {
  baseBondAmount: 100,
  criticalityMultiplier: 3,
}

/**
 * Escrow Bond Manager
 *
 * Paper basis: §4.8 (Scalable Market Coordination).
 *
 * Manages financial commitments that delegatees post before task execution.
 * Bonds are held in escrow and released on successful completion or slashed
 * on failure. This creates a credible commitment mechanism that aligns
 * incentives between principal and agent.
 */
export class EscrowBondManager {
  private bonds = new Map<string, EscrowBond>()
  private config: Required<EscrowConfig>
  private counter = 0

  constructor(config: EscrowConfig = {}) {
    this.config = { ...DEFAULTS, ...config }
  }

  /**
   * Create a bond for a peer undertaking a task.
   */
  create(peerId: string, task: TaskProfile): EscrowBond {
    const amount = this.computeBondAmount(task)
    const bond: EscrowBond = {
      id: `bond_${this.counter++}`,
      peerId,
      taskId: task.id,
      amount,
      status: 'held',
      createdAt: Date.now(),
    }
    this.bonds.set(bond.id, bond)
    return bond
  }

  /**
   * Release a bond (successful completion).
   */
  release(bondId: string): EscrowBond {
    const bond = this.bonds.get(bondId)
    if (!bond) throw new Error(`Bond not found: ${bondId}`)
    if (bond.status !== 'held') throw new Error(`Bond ${bondId} already resolved (${bond.status})`)
    bond.status = 'released'
    bond.resolvedAt = Date.now()
    return bond
  }

  /**
   * Slash a bond (task failure or SLO violation).
   */
  slash(bondId: string, reason: string): EscrowBond {
    const bond = this.bonds.get(bondId)
    if (!bond) throw new Error(`Bond not found: ${bondId}`)
    if (bond.status !== 'held') throw new Error(`Bond ${bondId} already resolved (${bond.status})`)
    bond.status = 'slashed'
    bond.resolvedAt = Date.now()
    bond.slashReason = reason
    return bond
  }

  /**
   * Get a bond by ID.
   */
  get(bondId: string): EscrowBond | undefined {
    return this.bonds.get(bondId)
  }

  /**
   * Get all bonds for a peer.
   */
  getByPeer(peerId: string): EscrowBond[] {
    return [...this.bonds.values()].filter(b => b.peerId === peerId)
  }

  /**
   * Get all bonds for a task.
   */
  getByTask(taskId: string): EscrowBond[] {
    return [...this.bonds.values()].filter(b => b.taskId === taskId)
  }

  /**
   * Compute bond amount based on task attributes.
   */
  computeBondAmount(task: TaskProfile): number {
    let amount = this.config.baseBondAmount
    if (task.criticality === 'high') {
      amount *= this.config.criticalityMultiplier
    } else if (task.criticality === 'medium') {
      amount *= (this.config.criticalityMultiplier + 1) / 2
    }
    return amount
  }

  /**
   * Get all bonds.
   */
  getAll(): EscrowBond[] {
    return [...this.bonds.values()]
  }

  /**
   * Clear all bonds.
   */
  clear(): void {
    this.bonds.clear()
    this.counter = 0
  }
}
