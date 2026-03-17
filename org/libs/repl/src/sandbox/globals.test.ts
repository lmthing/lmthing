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

    it('enforces sequential ordering', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.tasklist('tl1', 'Test task', validTasks)
      expect(() => globals.completeTask('tl1', 'step2', { count: 5 })).toThrow('out of order. Expected: "step1"')
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
      expect(tl.currentIndex).toBe(2)
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
})
