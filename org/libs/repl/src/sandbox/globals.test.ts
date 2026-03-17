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

  describe('checkpoints', () => {
    const validPlan = {
      description: 'Test task',
      tasks: [
        { id: 'step1', instructions: 'Do step 1', outputSchema: { result: { type: 'string' } } },
        { id: 'step2', instructions: 'Do step 2', outputSchema: { count: { type: 'number' } } },
      ],
    }

    it('registers a plan', () => {
      const config = createMockConfig()
      let capturedPlan: any
      const globals = createGlobals({
        ...config,
        onCheckpointPlan: (plan) => { capturedPlan = plan },
      })

      globals.checkpoints(validPlan)
      expect(capturedPlan).toBeDefined()
      expect(capturedPlan.tasks).toHaveLength(2)
    })

    it('can only be called once', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      expect(() => globals.checkpoints(validPlan)).toThrow('can only be called once')
    })

    it('rejects empty tasks', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.checkpoints({ description: 'empty', tasks: [] })).toThrow(
        'requires a description and at least one task',
      )
    })

    it('rejects missing description', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.checkpoints({ description: '', tasks: validPlan.tasks })).toThrow(
        'requires a description and at least one task',
      )
    })

    it('rejects duplicate task ids', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.checkpoints({
        description: 'dup',
        tasks: [
          { id: 'a', instructions: 'do a', outputSchema: { x: { type: 'string' } } },
          { id: 'a', instructions: 'do a again', outputSchema: { x: { type: 'string' } } },
        ],
      })).toThrow('Duplicate checkpoint id: a')
    })

    it('rejects tasks missing required fields', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.checkpoints({
        description: 'bad',
        tasks: [{ id: 'a', instructions: '', outputSchema: {} } as any],
      })).toThrow('must have id, instructions, and outputSchema')
    })

    it('does not pause the stream', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      expect(config.pauseController.pause).not.toHaveBeenCalled()
    })

    it('calls appendCheckpointProgress on render surface', () => {
      const config = createMockConfig()
      config.renderSurface.appendCheckpointProgress = vi.fn()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      expect(config.renderSurface.appendCheckpointProgress).toHaveBeenCalled()
    })
  })

  describe('checkpoint', () => {
    const validPlan = {
      description: 'Test task',
      tasks: [
        { id: 'step1', instructions: 'Do step 1', outputSchema: { result: { type: 'string' } } },
        { id: 'step2', instructions: 'Do step 2', outputSchema: { count: { type: 'number' } } },
      ],
    }

    it('marks a checkpoint as complete', () => {
      const config = createMockConfig()
      let completedId: string | undefined
      let completedOutput: any
      const globals = createGlobals({
        ...config,
        onCheckpointComplete: (id, output) => { completedId = id; completedOutput = output },
      })

      globals.checkpoints(validPlan)
      globals.checkpoint('step1', { result: 'done' })

      expect(completedId).toBe('step1')
      expect(completedOutput).toEqual({ result: 'done' })
    })

    it('throws if called before checkpoints()', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      expect(() => globals.checkpoint('step1', {})).toThrow('declare a plan first')
    })

    it('throws for unknown checkpoint id', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      expect(() => globals.checkpoint('nonexistent', {})).toThrow('Unknown checkpoint id')
    })

    it('throws for duplicate completion', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      globals.checkpoint('step1', { result: 'done' })
      expect(() => globals.checkpoint('step1', { result: 'again' })).toThrow('already completed')
    })

    it('enforces sequential ordering', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      expect(() => globals.checkpoint('step2', { count: 5 })).toThrow('out of order. Expected: "step1"')
    })

    it('validates output against schema — missing key', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      expect(() => globals.checkpoint('step1', {})).toThrow('missing required key: result')
    })

    it('validates output against schema — wrong type', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      expect(() => globals.checkpoint('step1', { result: 42 })).toThrow('expected string, got number')
    })

    it('validates array type correctly', () => {
      const config = createMockConfig()
      const globals = createGlobals({
        ...config,
      })

      globals.checkpoints({
        description: 'array test',
        tasks: [
          { id: 's1', instructions: 'do it', outputSchema: { items: { type: 'array' } } },
        ],
      })

      // Array should pass
      globals.checkpoint('s1', { items: [1, 2, 3] })
      expect(globals.getCheckpointState().completed.size).toBe(1)
    })

    it('rejects object when array expected', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints({
        description: 'array test',
        tasks: [
          { id: 's1', instructions: 'do it', outputSchema: { items: { type: 'array' } } },
        ],
      })

      expect(() => globals.checkpoint('s1', { items: { key: 'val' } })).toThrow('expected array, got object')
    })

    it('allows completing all checkpoints in order', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      globals.checkpoint('step1', { result: 'done' })
      globals.checkpoint('step2', { count: 10 })

      const state = globals.getCheckpointState()
      expect(state.completed.size).toBe(2)
      expect(state.currentIndex).toBe(2)
    })

    it('does not pause the stream', () => {
      const config = createMockConfig()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      globals.checkpoint('step1', { result: 'done' })
      expect(config.pauseController.pause).not.toHaveBeenCalled()
    })

    it('calls updateCheckpointProgress on render surface', () => {
      const config = createMockConfig()
      config.renderSurface.updateCheckpointProgress = vi.fn()
      const globals = createGlobals(config)

      globals.checkpoints(validPlan)
      globals.checkpoint('step1', { result: 'done' })
      expect(config.renderSurface.updateCheckpointProgress).toHaveBeenCalled()
    })
  })
})
