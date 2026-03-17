import { describe, it, expect, vi } from 'vitest'
import { AsyncManager } from './async-manager'

describe('sandbox/async-manager', () => {
  it('registers a task', () => {
    const mgr = new AsyncManager()
    const id = mgr.register(async () => {}, 'test-task')
    expect(id).toBe('async_0')
    expect(mgr.getTask(id)?.label).toBe('test-task')
    expect(mgr.getTask(id)?.status).toBe('running')
  })

  it('auto-increments task IDs', () => {
    const mgr = new AsyncManager()
    const id1 = mgr.register(async () => {})
    const id2 = mgr.register(async () => {})
    expect(id1).toBe('async_0')
    expect(id2).toBe('async_1')
  })

  it('cancels a task', () => {
    const mgr = new AsyncManager()
    const id = mgr.register(async (signal) => {
      await new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })

    const cancelled = mgr.cancel(id, 'user cancelled')
    expect(cancelled).toBe(true)
    expect(mgr.getTask(id)?.status).toBe('cancelled')
  })

  it('cancel returns false for non-running task', () => {
    const mgr = new AsyncManager()
    expect(mgr.cancel('nonexistent')).toBe(false)
  })

  it('stores and drains results', () => {
    const mgr = new AsyncManager()
    mgr.register(async () => {}, 'task1')
    mgr.setResult('async_0', { data: 42 })

    const results = mgr.drainResults()
    expect(results.get('async_0')).toEqual({ data: 42 })

    // Second drain should be empty
    expect(mgr.drainResults().size).toBe(0)
  })

  it('enforces max tasks', () => {
    const mgr = new AsyncManager(2)
    mgr.register(async () => new Promise(() => {})) // never resolves
    mgr.register(async () => new Promise(() => {}))
    expect(() => mgr.register(async () => {})).toThrow('Maximum async tasks')
  })

  it('getRunningCount tracks running tasks', async () => {
    const mgr = new AsyncManager()
    mgr.register(async () => {})
    // Task completes immediately, but async
    await new Promise(r => setTimeout(r, 10))
    expect(mgr.getRunningCount()).toBe(0) // completed
  })

  it('getAllTasks returns all tasks', () => {
    const mgr = new AsyncManager()
    mgr.register(async () => {}, 'a')
    mgr.register(async () => {}, 'b')
    expect(mgr.getAllTasks()).toHaveLength(2)
  })

  it('buildStopPayload includes pending and results', () => {
    const mgr = new AsyncManager()
    mgr.register(async () => new Promise(() => {}), 'slow-task') // never resolves
    mgr.register(async () => {}, 'fast-task')
    mgr.setResult('async_1', { done: true })

    const payload = mgr.buildStopPayload()
    expect(payload['slow-task']).toBe('pending')
    expect(payload['fast-task']).toEqual({ done: true })
  })

  it('cancelAll cancels all running tasks', () => {
    const mgr = new AsyncManager()
    mgr.register(async () => new Promise(() => {}))
    mgr.register(async () => new Promise(() => {}))
    mgr.cancelAll()

    for (const task of mgr.getAllTasks()) {
      expect(task.status).toBe('cancelled')
    }
  })

  it('drain waits for tasks to complete', async () => {
    const mgr = new AsyncManager()
    let resolved = false
    mgr.register(async () => {
      await new Promise(r => setTimeout(r, 10))
      resolved = true
    })
    await mgr.drain()
    expect(resolved).toBe(true)
  })

  it('marks failed tasks', async () => {
    const mgr = new AsyncManager()
    const id = mgr.register(async () => {
      throw new Error('task failed')
    }, 'failing-task')
    await new Promise(r => setTimeout(r, 10))
    expect(mgr.getTask(id)?.status).toBe('failed')
    expect(mgr.getTask(id)?.error).toBe('task failed')
  })
})
