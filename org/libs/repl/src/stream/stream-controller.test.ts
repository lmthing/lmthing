import { describe, it, expect, vi } from 'vitest'
import { StreamController } from './stream-controller'
import { HookRegistry } from '../hooks/hook-registry'
import type { LineResult, SessionEvent, HookContext, ErrorPayload, StopPayload } from '../session/types'

function createController(overrides: Partial<{
  onStatement: (source: string) => Promise<LineResult>
  onStop: (payload: StopPayload, source: string) => void
  onError: (error: ErrorPayload) => void
  onEvent: (event: SessionEvent) => void
  onCodeLine: (line: string) => void
}> = {}) {
  const events: SessionEvent[] = []
  const codeLines: string[] = []

  const controller = new StreamController({
    onStatement: overrides.onStatement ?? (async () => ({ ok: true, result: undefined })),
    onStop: overrides.onStop ?? (() => {}),
    onError: overrides.onError ?? (() => {}),
    onEvent: overrides.onEvent ?? ((e) => events.push(e)),
    onCodeLine: overrides.onCodeLine ?? ((l) => codeLines.push(l)),
    hookRegistry: new HookRegistry(),
    hookContext: () => ({ lineNumber: 1, sessionId: 'test', scope: [] }),
  })

  return { controller, events, codeLines }
}

describe('stream/stream-controller', () => {
  it('accumulates tokens and dispatches statements', async () => {
    const statements: string[] = []
    const { controller } = createController({
      onStatement: async (source) => {
        statements.push(source)
        return { ok: true, result: undefined }
      },
    })

    await controller.feedToken('const x = 1\n')
    expect(statements).toEqual(['const x = 1'])
  })

  it('handles multi-token statements', async () => {
    const statements: string[] = []
    const { controller } = createController({
      onStatement: async (source) => {
        statements.push(source)
        return { ok: true, result: undefined }
      },
    })

    await controller.feedToken('const ')
    await controller.feedToken('x = 1\n')
    expect(statements).toEqual(['const x = 1'])
  })

  it('finalize flushes remaining buffer', async () => {
    const statements: string[] = []
    const { controller } = createController({
      onStatement: async (source) => {
        statements.push(source)
        return { ok: true, result: undefined }
      },
    })

    await controller.feedToken('const x = 1')
    expect(statements).toHaveLength(0)
    await controller.finalize()
    expect(statements).toEqual(['const x = 1'])
  })

  it('emits error events on execution failure', async () => {
    const errors: ErrorPayload[] = []
    const { controller, events } = createController({
      onStatement: async () => ({
        ok: false,
        error: { type: 'TypeError', message: 'oops', line: 1, source: 'x()' },
      }),
      onError: (e) => errors.push(e),
    })

    await controller.feedToken('x()\n')
    expect(errors).toHaveLength(1)
    expect(errors[0].type).toBe('TypeError')
    expect(events.some(e => e.type === 'error')).toBe(true)
  })

  it('implements StreamPauseController interface', () => {
    const { controller } = createController()
    expect(controller.isPaused()).toBe(false)
    controller.pause()
    expect(controller.isPaused()).toBe(true)
    controller.resume()
    expect(controller.isPaused()).toBe(false)
  })

  it('pauses when paused and resumes when resumed', async () => {
    const statements: string[] = []
    const { controller } = createController({
      onStatement: async (source) => {
        statements.push(source)
        return { ok: true, result: undefined }
      },
    })

    controller.pause()

    // Feed in background — it should wait
    const feedPromise = controller.feedToken('const x = 1\n')

    // Wait a bit, should not have executed yet
    await new Promise(r => setTimeout(r, 50))
    expect(statements).toHaveLength(0)

    controller.resume()
    await feedPromise
    expect(statements).toEqual(['const x = 1'])
  })

  it('emits code events', async () => {
    const { controller, events } = createController()
    await controller.feedToken('const x = 1\n')
    expect(events.some(e => e.type === 'code')).toBe(true)
  })

  it('tracks code lines', async () => {
    const { controller, codeLines } = createController()
    await controller.feedToken('const x = 1\n')
    expect(codeLines).toContain('const x = 1')
  })

  it('clearBuffer empties the accumulator', async () => {
    const statements: string[] = []
    const { controller } = createController({
      onStatement: async (source) => {
        statements.push(source)
        return { ok: true, result: undefined }
      },
    })

    await controller.feedToken('const x')
    controller.clearBuffer()
    await controller.finalize()
    expect(statements).toHaveLength(0)
  })
})
