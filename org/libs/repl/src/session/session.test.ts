import { describe, it, expect, vi } from 'vitest'
import { Session } from './session'
import type { SessionEvent } from './types'

describe('session/session', () => {
  it('starts in idle status', () => {
    const session = new Session()
    expect(session.getStatus()).toBe('idle')
    session.destroy()
  })

  it('transitions to executing on user message', async () => {
    const session = new Session()
    await session.handleUserMessage('Hello')
    expect(session.getStatus()).toBe('executing')
    session.destroy()
  })

  it('executes code via feedToken', async () => {
    const session = new Session()
    const events: SessionEvent[] = []
    session.on('event', (e) => events.push(e))

    await session.handleUserMessage('test')
    await session.feedToken('var x = 42\n')

    // Should have emitted code event
    expect(events.some(e => e.type === 'code')).toBe(true)
    session.destroy()
  })

  it('transitions to complete on finalize', async () => {
    const session = new Session()
    await session.handleUserMessage('test')
    await session.feedToken('var x = 1\n')
    await session.finalize()
    expect(session.getStatus()).toBe('complete')
    session.destroy()
  })

  it('pause and resume', () => {
    const session = new Session()
    session.pause()
    expect(session.getStatus()).toBe('paused')
    session.resume()
    expect(session.getStatus()).toBe('executing')
    session.destroy()
  })

  it('snapshot returns current state', () => {
    const session = new Session()
    const snap = session.snapshot()
    expect(snap.status).toBe('idle')
    expect(snap.scope).toEqual([])
    expect(snap.asyncTasks).toEqual([])
    expect(snap.activeFormId).toBeNull()
    expect(snap.tasklistsState).toBeDefined()
    expect(snap.tasklistsState.tasklists.size).toBe(0)
    session.destroy()
  })

  it('emits status events', async () => {
    const session = new Session()
    const statuses: string[] = []
    session.on('event', (e: SessionEvent) => {
      if (e.type === 'status') statuses.push(e.status)
    })

    await session.handleUserMessage('test')
    session.pause()
    session.resume()

    expect(statuses).toContain('executing')
    expect(statuses).toContain('paused')
    session.destroy()
  })

  it('cancelAsyncTask emits event', () => {
    const session = new Session()
    const events: SessionEvent[] = []
    session.on('event', (e) => events.push(e))

    session.cancelAsyncTask('async_0', 'done')
    expect(events.some(e => e.type === 'async_cancelled')).toBe(true)
    session.destroy()
  })

  it('getScopeTable returns formatted table', async () => {
    const session = new Session()
    await session.feedToken('var greeting = "hello"\n')
    const table = session.getScopeTable()
    expect(table).toContain('greeting')
    session.destroy()
  })

  it('destroy cleans up', () => {
    const session = new Session()
    session.destroy()
    expect(session.getStatus()).toBe('idle')
  })

  it('accepts custom globals', async () => {
    const myFunc = vi.fn(() => 99)
    const session = new Session({
      globals: { myFunc },
    })

    await session.feedToken('var result = myFunc()\n')
    expect(myFunc).toHaveBeenCalled()
    session.destroy()
  })

  it('handles intervention', async () => {
    const session = new Session()
    const events: SessionEvent[] = []
    session.on('event', (e) => events.push(e))

    session.handleIntervention('Please try differently')
    expect(events.some(e => e.type === 'scope')).toBe(true)
    session.destroy()
  })

  it('executes tasklist() and completeTask() globals', async () => {
    const session = new Session()
    const events: SessionEvent[] = []
    session.on('event', (e) => events.push(e))

    await session.feedToken('tasklist("tl1", "test", [{ id: "s1", instructions: "do s1", outputSchema: { x: { type: "number" } } }])\n')
    await session.feedToken('completeTask("tl1", "s1", { x: 42 })\n')

    expect(events.some(e => e.type === 'tasklist_declared')).toBe(true)
    expect(events.some(e => e.type === 'task_complete')).toBe(true)
    session.destroy()
  })

  it('finalize returns tasklist_incomplete when tasks remain', async () => {
    const session = new Session()
    const events: SessionEvent[] = []
    session.on('event', (e) => events.push(e))

    await session.feedToken('tasklist("tl1", "test", [{ id: "s1", instructions: "do s1", outputSchema: { x: { type: "number" } } }, { id: "s2", instructions: "do s2", outputSchema: { y: { type: "string" } } }])\n')
    await session.feedToken('completeTask("tl1", "s1", { x: 42 })\n')

    const result = await session.finalize()
    expect(result).toBe('tasklist_incomplete')
    expect(events.some(e => e.type === 'tasklist_reminder')).toBe(true)
    session.destroy()
  })

  it('finalize returns complete when all tasks done', async () => {
    const session = new Session()

    await session.feedToken('tasklist("tl1", "test", [{ id: "s1", instructions: "do s1", outputSchema: { x: { type: "number" } } }])\n')
    await session.feedToken('completeTask("tl1", "s1", { x: 42 })\n')

    const result = await session.finalize()
    expect(result).toBe('complete')
    session.destroy()
  })

  it('finalize returns complete when no tasklist declared', async () => {
    const session = new Session()
    await session.feedToken('var x = 1\n')
    const result = await session.finalize()
    expect(result).toBe('complete')
    session.destroy()
  })

  it('limits tasklist reminders to maxTasklistReminders', async () => {
    const session = new Session({ config: { maxTasklistReminders: 2 } })
    const reminders: string[][] = []
    session.on('event', (e: SessionEvent) => {
      if (e.type === 'tasklist_reminder') reminders.push(e.remaining)
    })

    await session.feedToken('tasklist("tl1", "test", [{ id: "s1", instructions: "do s1", outputSchema: { x: { type: "number" } } }])\n')

    // First finalize — should return incomplete
    const r1 = await session.finalize()
    expect(r1).toBe('tasklist_incomplete')

    // Second finalize — should return incomplete
    const r2 = await session.finalize()
    expect(r2).toBe('tasklist_incomplete')

    // Third finalize — max reached, should complete
    const r3 = await session.finalize()
    expect(r3).toBe('complete')

    expect(reminders).toHaveLength(2)
    session.destroy()
  })

  it('resolveAsk sends form data', async () => {
    const session = new Session()
    // Simulate form resolution
    const formPromise = new Promise<void>(resolve => {
      session.once('form:test-form', () => resolve())
    })
    session.resolveAsk('test-form', { name: 'Alice' })
    await formPromise
    session.destroy()
  })
})
