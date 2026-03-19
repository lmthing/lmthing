import { describe, it, expect, vi } from 'vitest'
import { createGlobals } from './globals'
import { AsyncManager } from './async-manager'
import type { StreamPauseController, RenderSurface, StopPayload } from '../session/types'

function createMockConfig() {
  let paused = false
  const pauseController: StreamPauseController = {
    pause: vi.fn(() => { paused = true }),
    resume: vi.fn(() => { paused = false }),
    isPaused: () => paused,
  }

  const renderSurface: RenderSurface = {
    append: vi.fn(),
    renderForm: vi.fn().mockResolvedValue({ name: 'Alice' }),
    cancelForm: vi.fn(),
  }

  const asyncManager = new AsyncManager()

  return { pauseController, renderSurface, asyncManager, paused }
}

describe('sandbox/globals', () => {
  describe('stop', () => {
    it('builds payload with argument names', async () => {
      const config = createMockConfig()
      let capturedPayload: StopPayload | undefined
      const globals = createGlobals({
        ...config,
        onStop: (payload) => {
          capturedPayload = payload
          // Simulate resume after stop
          globals.resolveStop()
        },
      })

      globals.setCurrentSource('await stop(x, y)')
      await globals.stop(42, 'hello')

      expect(capturedPayload).toBeDefined()
      expect(capturedPayload!['x'].value).toBe(42)
      expect(capturedPayload!['y'].value).toBe('hello')
    })

    it('uses fallback names for complex expressions', async () => {
      const config = createMockConfig()
      let capturedPayload: StopPayload | undefined
      const globals = createGlobals({
        ...config,
        onStop: (payload) => {
          capturedPayload = payload
          globals.resolveStop()
        },
      })

      globals.setCurrentSource('await stop(getX())')
      await globals.stop(99)

      expect(capturedPayload!['arg_0'].value).toBe(99)
    })

    it('resolves Promise arguments before building payload', async () => {
      const config = createMockConfig()
      let capturedPayload: StopPayload | undefined
      const globals = createGlobals({
        ...config,
        onStop: (payload) => {
          capturedPayload = payload
          globals.resolveStop()
        },
      })

      globals.setCurrentSource('await stop(data)')
      await globals.stop(Promise.resolve(42))

      expect(capturedPayload).toBeDefined()
      expect(capturedPayload!['data'].value).toBe(42)
    })

    it('resolves multiple mixed values (promises and plain)', async () => {
      const config = createMockConfig()
      let capturedPayload: StopPayload | undefined
      const globals = createGlobals({
        ...config,
        onStop: (payload) => {
          capturedPayload = payload
          globals.resolveStop()
        },
      })

      globals.setCurrentSource('await stop(a, b, c)')
      await globals.stop(1, Promise.resolve('hello'), true)

      expect(capturedPayload!['a'].value).toBe(1)
      expect(capturedPayload!['b'].value).toBe('hello')
      expect(capturedPayload!['c'].value).toBe(true)
    })

    it('handles rejected Promises with _error', async () => {
      const config = createMockConfig()
      let capturedPayload: StopPayload | undefined
      const globals = createGlobals({
        ...config,
        onStop: (payload) => {
          capturedPayload = payload
          globals.resolveStop()
        },
      })

      globals.setCurrentSource('await stop(result)')
      await globals.stop(Promise.reject(new Error('network failure')))

      expect(capturedPayload).toBeDefined()
      expect(capturedPayload!['result'].value).toEqual({ _error: 'network failure' })
    })

    it('handles rejected Promises with non-Error reason', async () => {
      const config = createMockConfig()
      let capturedPayload: StopPayload | undefined
      const globals = createGlobals({
        ...config,
        onStop: (payload) => {
          capturedPayload = payload
          globals.resolveStop()
        },
      })

      globals.setCurrentSource('await stop(result)')
      await globals.stop(Promise.reject('string rejection'))

      expect(capturedPayload!['result'].value).toEqual({ _error: 'string rejection' })
    })

    it('resolves all Promises concurrently', async () => {
      const config = createMockConfig()
      let capturedPayload: StopPayload | undefined
      const globals = createGlobals({
        ...config,
        onStop: (payload) => {
          capturedPayload = payload
          globals.resolveStop()
        },
      })

      const order: string[] = []
      const slow = new Promise(resolve => setTimeout(() => { order.push('slow'); resolve('slow-val') }, 50))
      const fast = new Promise(resolve => setTimeout(() => { order.push('fast'); resolve('fast-val') }, 10))

      globals.setCurrentSource('await stop(slow, fast)')
      await globals.stop(slow, fast)

      // Both resolved
      expect(capturedPayload!['slow'].value).toBe('slow-val')
      expect(capturedPayload!['fast'].value).toBe('fast-val')
      // Fast resolved before slow (concurrent, not sequential)
      expect(order[0]).toBe('fast')
    })

    it('leaves non-Promise values unchanged', async () => {
      const config = createMockConfig()
      let capturedPayload: StopPayload | undefined
      const globals = createGlobals({
        ...config,
        onStop: (payload) => {
          capturedPayload = payload
          globals.resolveStop()
        },
      })

      globals.setCurrentSource('await stop(num, str, obj)')
      const obj = { key: 'value' }
      await globals.stop(42, 'hello', obj)

      expect(capturedPayload!['num'].value).toBe(42)
      expect(capturedPayload!['str'].value).toBe('hello')
      expect(capturedPayload!['obj'].value).toBe(obj)
    })

    it('pauses the stream controller', async () => {
      const config = createMockConfig()
      const globals = createGlobals({
        ...config,
        onStop: () => { globals.resolveStop() },
      })

      globals.setCurrentSource('stop()')
      await globals.stop()
      expect(config.pauseController.pause).toHaveBeenCalled()
    })
  })

  describe('display', () => {
    it('appends to render surface', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.display({ type: 'div', props: {} } as any)
      expect(config.renderSurface.append).toHaveBeenCalledWith(
        expect.stringContaining('display_'),
        expect.any(Object),
      )
    })

    it('does not pause the stream', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.display({ type: 'div', props: {} } as any)
      expect(config.pauseController.pause).not.toHaveBeenCalled()
    })
  })

  describe('ask', () => {
    it('renders form and returns data', async () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      const result = await globals.ask({ type: 'Form', props: {} } as any)
      expect(result).toEqual({ name: 'Alice' })
      expect(config.renderSurface.renderForm).toHaveBeenCalled()
    })

    it('pauses and resumes', async () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      await globals.ask({} as any)
      expect(config.pauseController.pause).toHaveBeenCalled()
      expect(config.pauseController.resume).toHaveBeenCalled()
    })

    it('times out and returns _timeout', async () => {
      const config = createMockConfig()
      config.renderSurface.renderForm = vi.fn(() => new Promise(() => {})) // never resolves
      const globals = createGlobals({ ...config, askTimeout: 50 })

      const result = await globals.ask({} as any)
      expect(result).toEqual({ _timeout: true })
    })
  })

  describe('async', () => {
    it('registers a background task', () => {
      const config = createMockConfig()
      let taskId: string | undefined
      const globals = createGlobals({
        ...config,
        onAsyncStart: (id) => { taskId = id },
      })

      globals.async(async () => {})
      expect(taskId).toBe('async_0')
    })

    it('does not pause the stream', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.async(async () => {})
      expect(config.pauseController.pause).not.toHaveBeenCalled()
    })
  })

  describe('tasklist', () => {
    const validTasks = [
      { id: 'step1', instructions: 'Do step 1', outputSchema: { result: { type: 'string' } } },
      { id: 'step2', instructions: 'Do step 2', outputSchema: { count: { type: 'number' } } },
    ]

    it('registers a plan', () => {
      const config = createMockConfig()
      let capturedPlan: any
      const globals = createGlobals({
        ...config,
        onTasklistDeclared: (_tasklistId, plan) => { capturedPlan = plan },
      })

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(capturedPlan).toBeDefined()
      expect(capturedPlan.tasks).toHaveLength(2)
      expect(capturedPlan.tasklistId).toBe('tl1')
    })

    it('rejects duplicate tasklist id', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(() => globals.tasklist('tl1', 'Another task', validTasks)).toThrow('tasklist "tl1" already declared')
    })

    it('allows multiple tasklists with different ids', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'First task', validTasks)
      globals.tasklist('tl2', 'Second task', [
        { id: 'a', instructions: 'do a', outputSchema: { x: { type: 'string' } } },
      ])

      const state = globals.getTasklistsState()
      expect(state.tasklists.size).toBe(2)
    })

    it('rejects empty tasks', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.tasklist('tl1', 'empty', [])).toThrow(
        'requires a description and at least one task',
      )
    })

    it('rejects missing description', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.tasklist('tl1', '', validTasks)).toThrow(
        'requires a description and at least one task',
      )
    })

    it('rejects missing tasklistId', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.tasklist('', 'desc', validTasks)).toThrow(
        'requires a tasklistId',
      )
    })

    it('rejects duplicate task ids', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.tasklist('tl1', 'dup', [
        { id: 'a', instructions: 'do a', outputSchema: { x: { type: 'string' } } },
        { id: 'a', instructions: 'do a again', outputSchema: { x: { type: 'string' } } },
      ])).toThrow('Duplicate task id: a')
    })

    it('rejects tasks missing required fields', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.tasklist('tl1', 'bad', [
        { id: 'a', instructions: '', outputSchema: {} } as any,
      ])).toThrow('must have id, instructions, and outputSchema')
    })

    it('does not pause the stream', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(config.pauseController.pause).not.toHaveBeenCalled()
    })

    it('calls appendTasklistProgress on render surface', () => {
      const config = createMockConfig()
      config.renderSurface.appendTasklistProgress = vi.fn()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(config.renderSurface.appendTasklistProgress).toHaveBeenCalledWith('tl1', expect.any(Object))
    })
  })

  describe('completeTask', () => {
    const validTasks = [
      { id: 'step1', instructions: 'Do step 1', outputSchema: { result: { type: 'string' } } },
      { id: 'step2', instructions: 'Do step 2', outputSchema: { count: { type: 'number' } } },
    ]

    it('marks a task as complete', () => {
      const config = createMockConfig()
      let completedTasklistId: string | undefined
      let completedId: string | undefined
      let completedOutput: any
      const globals = createGlobals({
        ...config,
        onTaskComplete: (tasklistId, id, output) => { completedTasklistId = tasklistId; completedId = id; completedOutput = output },
      })

      globals.tasklist('tl1', 'Test task', validTasks)
      globals.completeTask('tl1', 'step1', { result: 'done' })

      expect(completedTasklistId).toBe('tl1')
      expect(completedId).toBe('step1')
      expect(completedOutput).toEqual({ result: 'done' })
    })

    it('throws if called with unknown tasklist', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.completeTask('unknown', 'step1', {})).toThrow('unknown tasklist "unknown"')
    })

    it('throws for unknown task id', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(() => globals.completeTask('tl1', 'nonexistent', {})).toThrow('Unknown task id')
    })

    it('throws for duplicate completion', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      globals.completeTask('tl1', 'step1', { result: 'done' })
      expect(() => globals.completeTask('tl1', 'step1', { result: 'again' })).toThrow('already completed')
    })

    it('enforces dependency ordering (sequential backward compat)', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(() => globals.completeTask('tl1', 'step2', { count: 5 })).toThrow('is not ready. Waiting on: step1')
    })

    it('validates output against schema — missing key', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(() => globals.completeTask('tl1', 'step1', {})).toThrow('missing required key: result')
    })

    it('validates output against schema — wrong type', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(() => globals.completeTask('tl1', 'step1', { result: 42 })).toThrow('expected string, got number')
    })

    it('validates array type correctly', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'array test', [
        { id: 's1', instructions: 'do it', outputSchema: { items: { type: 'array' } } },
      ])

      globals.completeTask('tl1', 's1', { items: [1, 2, 3] })
      const tl = globals.getTasklistsState().tasklists.get('tl1')!
      expect(tl.completed.size).toBe(1)
    })

    it('rejects object when array expected', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'array test', [
        { id: 's1', instructions: 'do it', outputSchema: { items: { type: 'array' } } },
      ])

      expect(() => globals.completeTask('tl1', 's1', { items: { key: 'val' } })).toThrow('expected array, got object')
    })

    it('allows completing all tasks in order', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      globals.completeTask('tl1', 'step1', { result: 'done' })
      globals.completeTask('tl1', 'step2', { count: 10 })

      const tl = globals.getTasklistsState().tasklists.get('tl1')!
      expect(tl.completed.size).toBe(2)
      expect(tl.readyTasks.size).toBe(0)
    })

    it('works across multiple tasklists', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'First', [
        { id: 'a', instructions: 'do a', outputSchema: { x: { type: 'string' } } },
      ])
      globals.tasklist('tl2', 'Second', [
        { id: 'b', instructions: 'do b', outputSchema: { y: { type: 'number' } } },
      ])

      globals.completeTask('tl1', 'a', { x: 'hello' })
      globals.completeTask('tl2', 'b', { y: 42 })

      const state = globals.getTasklistsState()
      expect(state.tasklists.get('tl1')!.completed.size).toBe(1)
      expect(state.tasklists.get('tl2')!.completed.size).toBe(1)
    })

    it('does not pause the stream', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      globals.completeTask('tl1', 'step1', { result: 'done' })
      expect(config.pauseController.pause).not.toHaveBeenCalled()
    })

    it('calls updateTasklistProgress on render surface', () => {
      const config = createMockConfig()
      config.renderSurface.updateTasklistProgress = vi.fn()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      globals.completeTask('tl1', 'step1', { result: 'done' })
      expect(config.renderSurface.updateTasklistProgress).toHaveBeenCalledWith('tl1', expect.any(Object))
    })
  })

  describe('DAG tasklists', () => {
    const dagTasks = [
      { id: 'fetch_a', instructions: 'Fetch A', outputSchema: { data: { type: 'string' } } },
      { id: 'fetch_b', instructions: 'Fetch B', outputSchema: { data: { type: 'string' } } },
      { id: 'merge', instructions: 'Merge', outputSchema: { result: { type: 'string' } }, dependsOn: ['fetch_a', 'fetch_b'] },
    ]

    it('computes initial readyTasks for tasks with no deps', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('dag1', 'DAG test', dagTasks)
      const tl = globals.getTasklistsState().tasklists.get('dag1')!
      expect(tl.readyTasks.has('fetch_a')).toBe(true)
      expect(tl.readyTasks.has('fetch_b')).toBe(true)
      expect(tl.readyTasks.has('merge')).toBe(false)
    })

    it('allows completing tasks in any valid DAG order', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('dag1', 'DAG test', dagTasks)

      // Complete fetch_b first (before fetch_a) — valid because no dependency between them
      globals.completeTask('dag1', 'fetch_b', { data: 'B' })
      globals.completeTask('dag1', 'fetch_a', { data: 'A' })

      // Now merge should be ready
      const tl = globals.getTasklistsState().tasklists.get('dag1')!
      expect(tl.readyTasks.has('merge')).toBe(true)

      globals.completeTask('dag1', 'merge', { result: 'merged' })
      expect(tl.completed.size).toBe(3)
    })

    it('rejects completing a blocked task', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('dag1', 'DAG test', dagTasks)
      expect(() => globals.completeTask('dag1', 'merge', { result: 'x' })).toThrow('is not ready')
    })

    it('detects cycles', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.tasklist('cycle', 'Cycle test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } }, dependsOn: ['b'] },
        { id: 'b', instructions: 'B', outputSchema: { x: { type: 'string' } }, dependsOn: ['a'] },
      ])).toThrow('Cycle detected')
    })

    it('validates dependsOn references exist', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.tasklist('bad', 'Bad deps', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } }, dependsOn: ['nonexistent'] },
      ])).toThrow('depends on unknown task "nonexistent"')
    })

    it('synthesizes sequential deps when no dependsOn present', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('seq', 'Sequential', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
        { id: 'b', instructions: 'B', outputSchema: { y: { type: 'number' } } },
      ])

      const tl = globals.getTasklistsState().tasklists.get('seq')!
      // Only 'a' should be ready (b depends on a)
      expect(tl.readyTasks.has('a')).toBe(true)
      expect(tl.readyTasks.has('b')).toBe(false)
    })
  })

  describe('conditional tasks', () => {
    it('auto-skips tasks with falsy conditions', () => {
      const config = createMockConfig()
      let skippedId: string | undefined
      const globals = createGlobals({
        ...config,
        onTaskSkipped: (_tl, id) => { skippedId = id },
      })

      globals.tasklist('cond', 'Conditional', [
        { id: 'check', instructions: 'Check', outputSchema: { exists: { type: 'boolean' } } },
        { id: 'create', instructions: 'Create', outputSchema: { url: { type: 'string' } },
          dependsOn: ['check'], condition: '!check.exists' },
      ])

      globals.completeTask('cond', 'check', { exists: true })

      // 'create' should be auto-skipped because !true === false
      expect(skippedId).toBe('create')
      const tl = globals.getTasklistsState().tasklists.get('cond')!
      expect(tl.completed.get('create')?.status).toBe('skipped')
    })

    it('runs tasks with truthy conditions', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('cond', 'Conditional', [
        { id: 'check', instructions: 'Check', outputSchema: { count: { type: 'number' } } },
        { id: 'process', instructions: 'Process', outputSchema: { done: { type: 'boolean' } },
          dependsOn: ['check'], condition: 'check.count > 0' },
      ])

      globals.completeTask('cond', 'check', { count: 5 })

      const tl = globals.getTasklistsState().tasklists.get('cond')!
      expect(tl.readyTasks.has('process')).toBe(true)
    })
  })

  describe('failTask', () => {
    it('marks a task as failed', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      globals.failTask('tl', 'a', 'network error')

      const tl = globals.getTasklistsState().tasklists.get('tl')!
      expect(tl.completed.get('a')?.status).toBe('failed')
      expect(tl.completed.get('a')?.error).toBe('network error')
    })

    it('unblocks dependents when optional task fails', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } }, optional: true },
        { id: 'b', instructions: 'B', outputSchema: { y: { type: 'string' } }, dependsOn: ['a'] },
      ])

      globals.failTask('tl', 'a', 'optional failure')

      const tl = globals.getTasklistsState().tasklists.get('tl')!
      expect(tl.readyTasks.has('b')).toBe(true)
    })

    it('blocks dependents when non-optional task fails', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
        { id: 'b', instructions: 'B', outputSchema: { y: { type: 'string' } }, dependsOn: ['a'] },
      ])

      globals.failTask('tl', 'a', 'required failure')

      const tl = globals.getTasklistsState().tasklists.get('tl')!
      expect(tl.readyTasks.has('b')).toBe(false)
    })
  })

  describe('retryTask', () => {
    it('resets a failed task to ready', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      globals.failTask('tl', 'a', 'error')
      globals.retryTask('tl', 'a')

      const tl = globals.getTasklistsState().tasklists.get('tl')!
      expect(tl.readyTasks.has('a')).toBe(true)
      expect(tl.completed.has('a')).toBe(false)
    })

    it('throws when max retries exceeded', () => {
      const config = createMockConfig()
      const globals = createGlobals({ ...config, maxTaskRetries: 1 })

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      globals.failTask('tl', 'a', 'error')
      globals.retryTask('tl', 'a')
      globals.failTask('tl', 'a', 'error again')
      expect(() => globals.retryTask('tl', 'a')).toThrow('exceeded maximum retries')
    })

    it('throws on non-failed task', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      expect(() => globals.retryTask('tl', 'a')).toThrow('can only retry failed tasks')
    })
  })

  describe('taskProgress', () => {
    it('updates progress on a ready task', () => {
      const config = createMockConfig()
      let progressMsg: string | undefined
      const globals = createGlobals({
        ...config,
        onTaskProgress: (_tl, _id, msg) => { progressMsg = msg },
      })

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      globals.taskProgress('tl', 'a', 'Loading...', 50)
      expect(progressMsg).toBe('Loading...')
    })

    it('throws for completed task', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      globals.completeTask('tl', 'a', { x: 'done' })
      expect(() => globals.taskProgress('tl', 'a', 'late update')).toThrow('not in ready or running state')
    })
  })

  describe('sleep', () => {
    it('resolves after delay', async () => {
      const config = createMockConfig()
      const globals = createGlobals({ ...config, sleepMaxSeconds: 1 })

      const start = Date.now()
      await globals.sleep(0.1)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(80)
    })

    it('caps at sleepMaxSeconds', async () => {
      const config = createMockConfig()
      const globals = createGlobals({ ...config, sleepMaxSeconds: 0.1 })

      const start = Date.now()
      await globals.sleep(999)
      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(500)
    })
  })

  describe('completeTaskAsync', () => {
    it('moves task from ready to running', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      globals.completeTaskAsync('tl', 'a', async () => ({ x: 'done' }))

      const tl = globals.getTasklistsState().tasklists.get('tl')!
      expect(tl.runningTasks.has('a')).toBe(true)
      expect(tl.readyTasks.has('a')).toBe(false)
    })

    it('records completion after async fn resolves', async () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      globals.completeTaskAsync('tl', 'a', async () => {
        return { x: 'async result' }
      })

      // Wait for the async fn to complete
      await new Promise(resolve => setTimeout(resolve, 50))

      const tl = globals.getTasklistsState().tasklists.get('tl')!
      expect(tl.completed.get('a')?.status).toBe('completed')
      expect(tl.completed.get('a')?.output).toEqual({ x: 'async result' })
    })

    it('records failure when async fn throws', async () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl', 'Test', [
        { id: 'a', instructions: 'A', outputSchema: { x: { type: 'string' } } },
      ])

      globals.completeTaskAsync('tl', 'a', async () => {
        throw new Error('async failure')
      })

      await new Promise(resolve => setTimeout(resolve, 50))

      const tl = globals.getTasklistsState().tasklists.get('tl')!
      expect(tl.completed.get('a')?.status).toBe('failed')
      expect(tl.completed.get('a')?.error).toBe('async failure')
    })
  })
})
