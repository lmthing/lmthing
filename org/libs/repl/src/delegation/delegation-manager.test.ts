import { describe, it, expect, vi } from 'vitest'
import { DelegationManager } from './delegation-manager'
import type { TaskProfile, PeerInfo, DelegationRequest, DelegationResult } from './types'

const makeTask = (overrides: Partial<TaskProfile> = {}): TaskProfile => ({
  id: 'task_1',
  description: 'Security audit',
  criticality: 'high',
  reversibility: 'low',
  verifiability: 'high',
  maxDuration: 30_000,
  maxCost: 10_000,
  ...overrides,
})

const makePeer = (overrides: Partial<PeerInfo> = {}): PeerInfo => ({
  id: 'peer_1',
  name: 'ReliablePeer',
  capabilities: ['security'],
  trustScore: 0.8,
  ...overrides,
})

const makeGoodResult = (peerId = 'peer_1'): DelegationResult => ({
  peerId,
  taskId: 'task_1',
  status: 'completed',
  output: { findings: ['XSS', 'SQLi'], score: 'A' },
  durationMs: 5_000,
  costTokens: 3_000,
  qualityScore: 0.85,
})

const makeBadResult = (peerId = 'peer_1'): DelegationResult => ({
  peerId,
  taskId: 'task_1',
  status: 'completed',
  output: { findings: [] },
  durationMs: 25_000,
  costTokens: 15_000,
  qualityScore: 0.1,
})

describe('delegation/delegation-manager', () => {
  describe('plan()', () => {
    it('rejects delegation when firebreak blocks', () => {
      const mgr = new DelegationManager({ firebreak: { baseMaxDepth: 1 } })
      const plan = mgr.plan({
        task: makeTask({ criticality: 'high', reversibility: 'low' }),
        availablePeers: [makePeer()],
        currentDepth: 1,
        maxDepth: 3,
      })
      expect(plan.approved).toBe(false)
      expect(plan.firebreak.action).toBe('halt')
    })

    it('rejects when routing requires human and no human available', () => {
      const mgr = new DelegationManager()
      const plan = mgr.plan({
        task: makeTask({ criticality: 'high', reversibility: 'low' }),
        availablePeers: [makePeer()],
        currentDepth: 0,
        maxDepth: 3,
      })
      // high criticality + low reversibility → human routing → no AI peers eligible
      expect(plan.approved).toBe(false)
      expect(plan.routing.target).toBe('human')
    })

    it('approves low-risk delegation to trusted peer', () => {
      const mgr = new DelegationManager()
      const plan = mgr.plan({
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [makePeer({ trustScore: 0.9 })],
        currentDepth: 0,
        maxDepth: 5,
      })
      expect(plan.approved).toBe(true)
      expect(plan.selectedPeer?.id).toBe('peer_1')
      expect(plan.authority).toBeDefined()
    })

    it('selects peer with highest trust', () => {
      const mgr = new DelegationManager({
        reputation: { initialTrustScore: 0.3 },
      })
      // Seed reputation for peer_2
      mgr.reputation.recordSuccess('peer_2', 'prev_task', 0.9, 1000)
      mgr.reputation.recordSuccess('peer_2', 'prev_task2', 0.9, 1000)

      const plan = mgr.plan({
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [
          makePeer({ id: 'peer_1', trustScore: 0.3 }),
          makePeer({ id: 'peer_2', trustScore: 0.5 }),
        ],
        currentDepth: 0,
        maxDepth: 5,
      })
      expect(plan.selectedPeer?.id).toBe('peer_2')
    })

    it('logs journal entries during planning', () => {
      const mgr = new DelegationManager()
      mgr.plan({
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [makePeer({ trustScore: 0.9 })],
        currentDepth: 0,
        maxDepth: 5,
      })
      const journal = mgr.getJournal()
      expect(journal.length).toBeGreaterThan(0)
      expect(journal.some(e => e.type === 'firebreak_checked')).toBe(true)
      expect(journal.some(e => e.type === 'routing_decided')).toBe(true)
    })
  })

  describe('execute()', () => {
    it('executes successful delegation end-to-end', async () => {
      const executeFn = vi.fn().mockResolvedValue(makeGoodResult())
      const mgr = new DelegationManager({ executeDelegation: executeFn })

      const request: DelegationRequest = {
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [makePeer({ trustScore: 0.9 })],
        currentDepth: 0,
        maxDepth: 5,
      }

      const outcome = await mgr.execute(request)

      expect(outcome.plan.approved).toBe(true)
      expect(outcome.verification?.passed).toBe(true)
      expect(outcome.reDelegated).toBe(false)
      expect(outcome.finalResult?.qualityScore).toBe(0.85)
      expect(outcome.reputationUpdates).toHaveLength(1)
      expect(outcome.reputationUpdates[0].newScore).toBeGreaterThan(outcome.reputationUpdates[0].oldScore)

      // Bond should be released
      const bond = outcome.plan.bond!
      expect(mgr.escrow.get(bond.id)?.status).toBe('released')
    })

    it('slashes bond and re-delegates on SLO failure', async () => {
      const executeFn = vi.fn()
        .mockResolvedValueOnce(makeBadResult('peer_1'))
        .mockResolvedValueOnce(makeGoodResult('peer_2'))

      const mgr = new DelegationManager({ executeDelegation: executeFn })

      const request: DelegationRequest = {
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [
          makePeer({ id: 'peer_1', trustScore: 0.8 }),
          makePeer({ id: 'peer_2', name: 'BackupPeer', trustScore: 0.7 }),
        ],
        currentDepth: 0,
        maxDepth: 5,
      }

      const outcome = await mgr.execute(request)

      expect(outcome.reDelegated).toBe(true)
      expect(outcome.verification?.passed).toBe(true)
      expect(outcome.finalResult?.peerId).toBe('peer_2')

      // Original bond slashed
      const bond = outcome.plan.bond!
      expect(mgr.escrow.get(bond.id)?.status).toBe('slashed')

      // Peer 1 reputation decreased, peer 2 increased
      const p1Update = outcome.reputationUpdates.find(u => u.peerId === 'peer_1')
      expect(p1Update!.newScore).toBeLessThan(p1Update!.oldScore)

      const p2Update = outcome.reputationUpdates.find(u => u.peerId === 'peer_2')
      expect(p2Update!.newScore).toBeGreaterThan(p2Update!.oldScore)
    })

    it('handles confirm friction with user approval', async () => {
      const onConfirm = vi.fn().mockResolvedValue(true)
      const executeFn = vi.fn().mockResolvedValue(makeGoodResult())

      // high criticality + medium reversibility → routes to 'any' (not 'human')
      // low trust (0.1) and depth 1/3 → friction composite triggers 'confirm'
      // firebreak: high crit reduces max depth to 2, depth 1 < 2 → allow
      const mgr = new DelegationManager({
        executeDelegation: executeFn,
        onConfirmRequired: onConfirm,
      })

      const request: DelegationRequest = {
        task: makeTask({ criticality: 'high', reversibility: 'medium', verifiability: 'medium' }),
        availablePeers: [makePeer({ trustScore: 0.1 })],
        currentDepth: 1,
        maxDepth: 3,
      }

      const outcome = await mgr.execute(request)

      expect(outcome.plan.firebreak.action).toBe('allow')
      expect(outcome.plan.friction.level).toBe('confirm')
      expect(onConfirm).toHaveBeenCalled()
      expect(outcome.plan.approved).toBe(true)
      expect(outcome.finalResult).toBeDefined()
    })

    it('returns unapproved outcome when user denies confirmation', async () => {
      const onConfirm = vi.fn().mockResolvedValue(false)

      const mgr = new DelegationManager({
        executeDelegation: vi.fn(),
        onConfirmRequired: onConfirm,
      })

      const request: DelegationRequest = {
        task: makeTask({ criticality: 'high', reversibility: 'medium', verifiability: 'medium' }),
        availablePeers: [makePeer({ trustScore: 0.1 })],
        currentDepth: 1,
        maxDepth: 3,
      }

      const outcome = await mgr.execute(request)

      expect(outcome.plan.firebreak.action).toBe('allow')
      expect(outcome.plan.friction.level).toBe('confirm')
      expect(onConfirm).toHaveBeenCalled()
      expect(outcome.plan.approved).toBe(false)
      expect(outcome.finalResult).toBeNull()
    })

    it('executes consensus delegation with multiple peers', async () => {
      const executeFn = vi.fn()
        .mockResolvedValueOnce(makeGoodResult('peer_1'))
        .mockResolvedValueOnce({ ...makeGoodResult('peer_2'), qualityScore: 0.82 })
        .mockResolvedValueOnce({ ...makeGoodResult('peer_3'), qualityScore: 0.78 })

      const mgr = new DelegationManager({ executeDelegation: executeFn })

      const request: DelegationRequest = {
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [
          makePeer({ id: 'peer_1', trustScore: 0.9 }),
          makePeer({ id: 'peer_2', trustScore: 0.85 }),
          makePeer({ id: 'peer_3', trustScore: 0.8 }),
        ],
        currentDepth: 0,
        maxDepth: 5,
        consensusPeers: 3,
      }

      const outcome = await mgr.execute(request)

      expect(executeFn).toHaveBeenCalledTimes(3)
      expect(outcome.consensus).toBeDefined()
      expect(outcome.consensus!.reached).toBe(true)
      expect(outcome.finalResult).toBeDefined()
    })

    it('throws when no executeDelegation handler configured', async () => {
      const mgr = new DelegationManager()
      const request: DelegationRequest = {
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [makePeer({ trustScore: 0.9 })],
        currentDepth: 0,
        maxDepth: 5,
      }

      await expect(mgr.execute(request)).rejects.toThrow('No executeDelegation handler')
    })

    it('returns unapproved when no peers available', async () => {
      const mgr = new DelegationManager({ executeDelegation: vi.fn() })
      const request: DelegationRequest = {
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [],
        currentDepth: 0,
        maxDepth: 5,
      }

      const outcome = await mgr.execute(request)
      expect(outcome.plan.approved).toBe(false)
      expect(outcome.finalResult).toBeNull()
    })
  })

  describe('journal', () => {
    it('records full delegation lifecycle in journal', async () => {
      const executeFn = vi.fn().mockResolvedValue(makeGoodResult())
      const mgr = new DelegationManager({ executeDelegation: executeFn })

      await mgr.execute({
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [makePeer({ trustScore: 0.9 })],
        currentDepth: 0,
        maxDepth: 5,
      })

      const journal = mgr.getJournal()
      const types = journal.map(e => e.type)

      expect(types).toContain('firebreak_checked')
      expect(types).toContain('routing_decided')
      expect(types).toContain('friction_assessed')
      expect(types).toContain('authority_granted')
      expect(types).toContain('bond_created')
      expect(types).toContain('delegation_started')
      expect(types).toContain('outcome_verified')
      expect(types).toContain('delegation_completed')
      expect(types).toContain('reputation_updated')
    })

    it('records re-delegation in journal', async () => {
      const executeFn = vi.fn()
        .mockResolvedValueOnce(makeBadResult('peer_1'))
        .mockResolvedValueOnce(makeGoodResult('peer_2'))

      const mgr = new DelegationManager({ executeDelegation: executeFn })

      await mgr.execute({
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [
          makePeer({ id: 'peer_1', trustScore: 0.8 }),
          makePeer({ id: 'peer_2', trustScore: 0.7 }),
        ],
        currentDepth: 0,
        maxDepth: 5,
      })

      const journal = mgr.getJournal()
      const types = journal.map(e => e.type)

      expect(types).toContain('delegation_failed')
      expect(types).toContain('redelegation')
    })

    it('clearJournal empties the log', () => {
      const mgr = new DelegationManager()
      mgr.plan({
        task: makeTask({ criticality: 'low', reversibility: 'high', verifiability: 'high' }),
        availablePeers: [makePeer({ trustScore: 0.9 })],
        currentDepth: 0,
        maxDepth: 5,
      })
      expect(mgr.getJournal().length).toBeGreaterThan(0)
      mgr.clearJournal()
      expect(mgr.getJournal()).toHaveLength(0)
    })
  })

  describe('component access', () => {
    it('exposes all sub-components for direct use', () => {
      const mgr = new DelegationManager()
      expect(mgr.friction).toBeInstanceOf(Object)
      expect(mgr.firebreak).toBeInstanceOf(Object)
      expect(mgr.router).toBeInstanceOf(Object)
      expect(mgr.authority).toBeInstanceOf(Object)
      expect(mgr.escrow).toBeInstanceOf(Object)
      expect(mgr.outcomeVerifier).toBeInstanceOf(Object)
      expect(mgr.consensusVerifier).toBeInstanceOf(Object)
      expect(mgr.reputation).toBeInstanceOf(Object)
    })
  })
})
