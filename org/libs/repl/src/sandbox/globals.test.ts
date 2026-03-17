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
})
