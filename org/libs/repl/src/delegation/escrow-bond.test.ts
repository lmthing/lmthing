import { describe, it, expect } from 'vitest'
import { EscrowBondManager } from './escrow-bond'
import type { TaskProfile } from './types'

const makeTask = (overrides: Partial<TaskProfile> = {}): TaskProfile => ({
  id: 'task_1',
  description: 'test task',
  criticality: 'medium',
  reversibility: 'medium',
  verifiability: 'medium',
  ...overrides,
})

describe('delegation/escrow-bond', () => {
  it('creates a bond in held status', () => {
    const mgr = new EscrowBondManager()
    const bond = mgr.create('peer_1', makeTask())
    expect(bond.id).toBe('bond_0')
    expect(bond.peerId).toBe('peer_1')
    expect(bond.status).toBe('held')
    expect(bond.amount).toBeGreaterThan(0)
  })

  it('auto-increments bond IDs', () => {
    const mgr = new EscrowBondManager()
    const b1 = mgr.create('p1', makeTask())
    const b2 = mgr.create('p2', makeTask())
    expect(b1.id).toBe('bond_0')
    expect(b2.id).toBe('bond_1')
  })

  it('releases a held bond', () => {
    const mgr = new EscrowBondManager()
    const bond = mgr.create('peer_1', makeTask())
    const released = mgr.release(bond.id)
    expect(released.status).toBe('released')
    expect(released.resolvedAt).toBeDefined()
  })

  it('slashes a held bond', () => {
    const mgr = new EscrowBondManager()
    const bond = mgr.create('peer_1', makeTask())
    const slashed = mgr.slash(bond.id, 'SLO violation')
    expect(slashed.status).toBe('slashed')
    expect(slashed.slashReason).toBe('SLO violation')
    expect(slashed.resolvedAt).toBeDefined()
  })

  it('throws when releasing non-existent bond', () => {
    const mgr = new EscrowBondManager()
    expect(() => mgr.release('bond_999')).toThrow('Bond not found')
  })

  it('throws when releasing already resolved bond', () => {
    const mgr = new EscrowBondManager()
    const bond = mgr.create('peer_1', makeTask())
    mgr.release(bond.id)
    expect(() => mgr.release(bond.id)).toThrow('already resolved')
  })

  it('throws when slashing already resolved bond', () => {
    const mgr = new EscrowBondManager()
    const bond = mgr.create('peer_1', makeTask())
    mgr.release(bond.id)
    expect(() => mgr.slash(bond.id, 'reason')).toThrow('already resolved')
  })

  it('computes higher bond for high criticality tasks', () => {
    const mgr = new EscrowBondManager({ baseBondAmount: 100, criticalityMultiplier: 3 })
    expect(mgr.computeBondAmount(makeTask({ criticality: 'low' }))).toBe(100)
    expect(mgr.computeBondAmount(makeTask({ criticality: 'medium' }))).toBe(200) // (3+1)/2 * 100
    expect(mgr.computeBondAmount(makeTask({ criticality: 'high' }))).toBe(300) // 3 * 100
  })

  it('gets bonds by peer', () => {
    const mgr = new EscrowBondManager()
    mgr.create('peer_1', makeTask({ id: 't1' }))
    mgr.create('peer_2', makeTask({ id: 't2' }))
    mgr.create('peer_1', makeTask({ id: 't3' }))
    expect(mgr.getByPeer('peer_1')).toHaveLength(2)
    expect(mgr.getByPeer('peer_2')).toHaveLength(1)
  })

  it('gets bonds by task', () => {
    const mgr = new EscrowBondManager()
    mgr.create('peer_1', makeTask({ id: 't1' }))
    mgr.create('peer_2', makeTask({ id: 't1' }))
    expect(mgr.getByTask('t1')).toHaveLength(2)
  })

  it('clear removes all bonds', () => {
    const mgr = new EscrowBondManager()
    mgr.create('peer_1', makeTask())
    mgr.create('peer_2', makeTask())
    mgr.clear()
    expect(mgr.getAll()).toHaveLength(0)
  })

  it('get returns bond by ID', () => {
    const mgr = new EscrowBondManager()
    const bond = mgr.create('peer_1', makeTask())
    expect(mgr.get(bond.id)).toBe(bond)
    expect(mgr.get('nonexistent')).toBeUndefined()
  })
})
