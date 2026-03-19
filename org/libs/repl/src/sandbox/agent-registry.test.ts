import { describe, it, expect, vi } from 'vitest'
import { AgentRegistry } from './agent-registry'

function createDeferred<T = unknown>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('sandbox/agent-registry', () => {
  describe('register', () => {
    it('creates entry with status running and correct turn', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('mealplan', promise, 'cooking.general_advisor.mealplan', null)

      const all = registry.getAll()
      expect(all).toHaveLength(1)
      expect(all[0].varName).toBe('mealplan')
      expect(all[0].label).toBe('cooking.general_advisor.mealplan')
      expect(all[0].status).toBe('running')
      expect(all[0].registeredTurn).toBe(0)
      expect(all[0].registeredAt).toBeGreaterThan(0)
    })

    it('stores the promise reference', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)

      expect(registry.getAll()[0].promise).toBe(promise)
    })

    it('stores the child session reference', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()
      const fakeSession = { snapshot: () => ({ tasklistsState: { tasklists: new Map() } }) } as any

      registry.register('task', promise, 'label', fakeSession)

      expect(registry.getAll()[0].childSession).toBe(fakeSession)
    })
  })

  describe('auto-resolution', () => {
    it('resolves when promise fulfills', async () => {
      const registry = new AgentRegistry()
      const { promise, resolve } = createDeferred()

      registry.register('task', promise, 'label', null)
      resolve('result-value')
      await promise

      const entry = registry.getAll()[0]
      expect(entry.status).toBe('resolved')
      expect(entry.resolvedValue).toBe('result-value')
      expect(entry.completedAt).toBeGreaterThan(0)
    })

    it('fails when promise rejects with Error', async () => {
      const registry = new AgentRegistry()
      const { promise, reject } = createDeferred()

      registry.register('task', promise, 'label', null)
      reject(new Error('something broke'))

      try { await promise } catch {}

      const entry = registry.getAll()[0]
      expect(entry.status).toBe('failed')
      expect(entry.error).toBe('something broke')
      expect(entry.completedAt).toBeGreaterThan(0)
    })

    it('fails when promise rejects with string', async () => {
      const registry = new AgentRegistry()
      const { promise, reject } = createDeferred()

      registry.register('task', promise, 'label', null)
      reject('string error')

      try { await promise } catch {}

      const entry = registry.getAll()[0]
      expect(entry.status).toBe('failed')
      expect(entry.error).toBe('string error')
    })
  })

  describe('callbacks', () => {
    it('calls onRegistered when agent is registered', () => {
      const onRegistered = vi.fn()
      const registry = new AgentRegistry({ onRegistered })
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)

      expect(onRegistered).toHaveBeenCalledWith('task', 'label')
    })

    it('calls onResolved when agent resolves', async () => {
      const onResolved = vi.fn()
      const registry = new AgentRegistry({ onResolved })
      const { promise, resolve } = createDeferred()

      registry.register('task', promise, 'label', null)
      resolve('value')
      await promise

      expect(onResolved).toHaveBeenCalledWith('task')
    })

    it('calls onFailed when agent fails', async () => {
      const onFailed = vi.fn()
      const registry = new AgentRegistry({ onFailed })
      const { promise, reject } = createDeferred()

      registry.register('task', promise, 'label', null)
      reject(new Error('oops'))

      try { await promise } catch {}

      expect(onFailed).toHaveBeenCalledWith('task', 'oops')
    })
  })

  describe('getAll / getPending', () => {
    it('getAll returns all entries', () => {
      const registry = new AgentRegistry()
      const d1 = createDeferred()
      const d2 = createDeferred()

      registry.register('a', d1.promise, 'label-a', null)
      registry.register('b', d2.promise, 'label-b', null)

      expect(registry.getAll()).toHaveLength(2)
    })

    it('getPending returns only running/waiting entries', async () => {
      const registry = new AgentRegistry()
      const d1 = createDeferred()
      const d2 = createDeferred()

      registry.register('a', d1.promise, 'label-a', null)
      registry.register('b', d2.promise, 'label-b', null)

      d1.resolve('done')
      await d1.promise

      const pending = registry.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].varName).toBe('b')
    })

    it('getPending includes waiting entries', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      registry.setPendingQuestion('task', { message: 'pick one', schema: {} })

      const pending = registry.getPending()
      expect(pending).toHaveLength(1)
      expect(pending[0].status).toBe('waiting')
    })
  })

  describe('getSnapshot', () => {
    it('returns null for unknown varName', () => {
      const registry = new AgentRegistry()
      expect(registry.getSnapshot('nonexistent')).toBeNull()
    })

    it('returns snapshot with basic fields', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)

      const snapshot = registry.getSnapshot('task')
      expect(snapshot).toBeDefined()
      expect(snapshot!.varName).toBe('task')
      expect(snapshot!.label).toBe('label')
      expect(snapshot!.status).toBe('running')
      expect(snapshot!.tasklistsState).toBeNull()
      expect(snapshot!.pendingQuestion).toBeNull()
    })

    it('reads child session tasklist state', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()
      const tasklistsState = {
        tasklists: new Map([['tl1', { plan: { tasklistId: 'tl1', description: 'test', tasks: [] }, completed: new Map(), readyTasks: new Set(), runningTasks: new Set(), outputs: new Map(), progressMessages: new Map(), retryCount: new Map() }]]),
      }
      const fakeSession = { snapshot: () => ({ tasklistsState }) } as any

      registry.register('task', promise, 'label', fakeSession)

      const snapshot = registry.getSnapshot('task')
      expect(snapshot!.tasklistsState).toBe(tasklistsState)
    })

    it('handles destroyed child session gracefully', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()
      const fakeSession = {
        snapshot: () => { throw new Error('session destroyed') },
      } as any

      registry.register('task', promise, 'label', fakeSession)

      const snapshot = registry.getSnapshot('task')
      expect(snapshot!.tasklistsState).toBeNull()
    })
  })

  describe('getAllSnapshots', () => {
    it('returns snapshots for all entries', () => {
      const registry = new AgentRegistry()
      registry.register('a', createDeferred().promise, 'label-a', null)
      registry.register('b', createDeferred().promise, 'label-b', null)

      const snapshots = registry.getAllSnapshots()
      expect(snapshots).toHaveLength(2)
      expect(snapshots.map(s => s.varName)).toEqual(['a', 'b'])
    })
  })

  describe('findByPromise', () => {
    it('finds entry by promise reference', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)

      const found = registry.findByPromise(promise)
      expect(found).toBeDefined()
      expect(found!.varName).toBe('task')
    })

    it('returns null for unknown promise', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)

      const found = registry.findByPromise(Promise.resolve())
      expect(found).toBeNull()
    })

    it('returns null for non-promise value', () => {
      const registry = new AgentRegistry()
      expect(registry.findByPromise(42)).toBeNull()
    })
  })

  describe('advanceTurn', () => {
    it('increments the turn counter', () => {
      const registry = new AgentRegistry()
      expect(registry.getCurrentTurn()).toBe(0)

      registry.advanceTurn()
      expect(registry.getCurrentTurn()).toBe(1)

      registry.advanceTurn()
      expect(registry.getCurrentTurn()).toBe(2)
    })
  })

  describe('hasEntries', () => {
    it('returns false when empty', () => {
      const registry = new AgentRegistry()
      expect(registry.hasEntries()).toBe(false)
    })

    it('returns true when entries exist', () => {
      const registry = new AgentRegistry()
      registry.register('task', createDeferred().promise, 'label', null)
      expect(registry.hasEntries()).toBe(true)
    })
  })

  describe('hasVisibleEntries', () => {
    it('returns true for running entries', () => {
      const registry = new AgentRegistry()
      registry.register('task', createDeferred().promise, 'label', null)
      expect(registry.hasVisibleEntries()).toBe(true)
    })

    it('returns true for waiting entries', () => {
      const registry = new AgentRegistry()
      registry.register('task', createDeferred().promise, 'label', null)
      registry.setPendingQuestion('task', { message: 'q', schema: {} })
      expect(registry.hasVisibleEntries()).toBe(true)
    })

    it('returns true for recently resolved entries (within 5 turns)', async () => {
      const registry = new AgentRegistry()
      const { promise, resolve } = createDeferred()

      registry.register('task', promise, 'label', null)
      resolve('done')
      await promise

      // 3 turns after
      registry.advanceTurn()
      registry.advanceTurn()
      registry.advanceTurn()

      expect(registry.hasVisibleEntries()).toBe(true)
    })

    it('returns false when all entries have decayed (6+ turns)', async () => {
      const registry = new AgentRegistry()
      const { promise, resolve } = createDeferred()

      registry.register('task', promise, 'label', null)
      resolve('done')
      await promise

      // 7 turns after
      for (let i = 0; i < 7; i++) registry.advanceTurn()

      expect(registry.hasVisibleEntries()).toBe(false)
    })

    it('returns false when empty', () => {
      const registry = new AgentRegistry()
      expect(registry.hasVisibleEntries()).toBe(false)
    })
  })

  describe('setPendingQuestion', () => {
    it('sets pending question and changes status to waiting', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      registry.setPendingQuestion('task', { message: 'Pick an option', schema: { option: { type: 'string' } } })

      const entry = registry.getAll()[0]
      expect(entry.status).toBe('waiting')
      expect(entry.pendingQuestion).toEqual({
        message: 'Pick an option',
        schema: { option: { type: 'string' } },
      })
    })

    it('throws for unknown agent', () => {
      const registry = new AgentRegistry()
      expect(() =>
        registry.setPendingQuestion('unknown', { message: 'q', schema: {} }),
      ).toThrow('unknown agent "unknown"')
    })
  })

  describe('askQuestion', () => {
    it('sets status to waiting and stores question', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      registry.askQuestion('task', { message: 'Pick one', schema: { choice: { type: 'string' } } })

      const entry = registry.getAll()[0]
      expect(entry.status).toBe('waiting')
      expect(entry.pendingQuestion).toEqual({
        message: 'Pick one',
        schema: { choice: { type: 'string' } },
      })
    })

    it('returns a Promise that resolves when respond is called', async () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      const questionPromise = registry.askQuestion('task', { message: 'Pick one', schema: {} })

      // Respond in next microtask
      setTimeout(() => registry.respond('task', { choice: 'a' }), 0)

      const data = await questionPromise
      expect(data).toEqual({ choice: 'a' })
    })

    it('throws for unknown agent', () => {
      const registry = new AgentRegistry()
      expect(() =>
        registry.askQuestion('unknown', { message: 'q', schema: {} }),
      ).toThrow('unknown agent "unknown"')
    })

    it('fires onQuestionAsked callback', () => {
      const onQuestionAsked = vi.fn()
      const registry = new AgentRegistry({ onQuestionAsked })
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      const question = { message: 'Pick one', schema: { x: { type: 'number' } } }
      registry.askQuestion('task', question)

      expect(onQuestionAsked).toHaveBeenCalledWith('task', question)
    })
  })

  describe('respond', () => {
    it('resolves the askQuestion Promise and sets status back to running', async () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      const questionPromise = registry.askQuestion('task', { message: 'q', schema: {} })

      registry.respond('task', { answer: 42 })

      const data = await questionPromise
      expect(data).toEqual({ answer: 42 })

      const entry = registry.getAll()[0]
      expect(entry.status).toBe('running')
      expect(entry.pendingQuestion).toBeNull()
    })

    it('throws for unknown agent', () => {
      const registry = new AgentRegistry()
      expect(() => registry.respond('unknown', {})).toThrow('unknown agent "unknown"')
    })

    it('throws when agent is not waiting', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)

      expect(() => registry.respond('task', {})).toThrow('not waiting for input (status: running)')
    })

    it('fires onQuestionAnswered callback', async () => {
      const onQuestionAnswered = vi.fn()
      const registry = new AgentRegistry({ onQuestionAnswered })
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      registry.askQuestion('task', { message: 'q', schema: {} })
      registry.respond('task', { data: 1 })

      expect(onQuestionAnswered).toHaveBeenCalledWith('task')
    })

    it('supports multiple concurrent questions', async () => {
      const registry = new AgentRegistry()
      const d1 = createDeferred()
      const d2 = createDeferred()

      registry.register('agent1', d1.promise, 'label-1', null)
      registry.register('agent2', d2.promise, 'label-2', null)

      const q1 = registry.askQuestion('agent1', { message: 'q1', schema: {} })
      const q2 = registry.askQuestion('agent2', { message: 'q2', schema: {} })

      registry.respond('agent2', { answer: 'b' })
      registry.respond('agent1', { answer: 'a' })

      expect(await q1).toEqual({ answer: 'a' })
      expect(await q2).toEqual({ answer: 'b' })
    })
  })

  describe('destroy', () => {
    it('clears all entries', () => {
      const registry = new AgentRegistry()
      registry.register('a', createDeferred().promise, 'label-a', null)
      registry.register('b', createDeferred().promise, 'label-b', null)

      registry.destroy()

      expect(registry.getAll()).toHaveLength(0)
      expect(registry.hasEntries()).toBe(false)
    })

    it('clears pending question resolvers', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      registry.askQuestion('task', { message: 'q', schema: {} })

      registry.destroy()

      // After destroy, respond should throw (unknown agent)
      expect(() => registry.respond('task', {})).toThrow('unknown agent')
    })
  })

  describe('resolve / fail manual', () => {
    it('resolve sets status and value', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      registry.resolve('task', { data: 42 })

      const entry = registry.getAll()[0]
      expect(entry.status).toBe('resolved')
      expect(entry.resolvedValue).toEqual({ data: 42 })
    })

    it('fail sets status and error', () => {
      const registry = new AgentRegistry()
      const { promise } = createDeferred()

      registry.register('task', promise, 'label', null)
      registry.fail('task', 'manual failure')

      const entry = registry.getAll()[0]
      expect(entry.status).toBe('failed')
      expect(entry.error).toBe('manual failure')
    })

    it('resolve is no-op for unknown varName', () => {
      const registry = new AgentRegistry()
      // Should not throw
      registry.resolve('unknown', 'value')
    })

    it('fail is no-op for unknown varName', () => {
      const registry = new AgentRegistry()
      // Should not throw
      registry.fail('unknown', 'error')
    })
  })
})
