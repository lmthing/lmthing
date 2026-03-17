import type { StreamPauseController, RenderSurface, StopPayload, SerializedValue } from '../session/types'
import { serialize } from '../stream/serializer'
import { recoverArgumentNames } from '../parser/ast-utils'
import { AsyncManager } from './async-manager'

export interface GlobalsConfig {
  pauseController: StreamPauseController
  renderSurface: RenderSurface
  asyncManager: AsyncManager
  serializationLimits?: {
    maxStringLength?: number
    maxArrayElements?: number
    maxObjectKeys?: number
    maxDepth?: number
  }
  askTimeout?: number
  onStop?: (payload: StopPayload, source: string) => void
  onDisplay?: (id: string) => void
  onAsyncStart?: (taskId: string, label: string) => void
}

/**
 * Create the four global functions: stop, display, ask, async.
 * These use callback interfaces, never importing stream-controller or session directly.
 */
export function createGlobals(config: GlobalsConfig) {
  const {
    pauseController,
    renderSurface,
    asyncManager,
    askTimeout = 300_000,
  } = config

  let currentSource = ''

  /**
   * Set the current source line being executed (for argument name recovery).
   */
  function setCurrentSource(source: string): void {
    currentSource = source
  }

  let stopResolve: (() => void) | null = null

  /**
   * stop(...values) — Pause execution, serialize args, inject as user message.
   */
  async function stopFn(...values: unknown[]): Promise<void> {
    // Recover argument names from the source
    const argNames = recoverArgumentNames(currentSource)

    // Build payload
    const payload: StopPayload = {}
    for (let i = 0; i < values.length; i++) {
      const key = argNames[i] ?? `arg_${i}`
      const value = values[i]
      payload[key] = {
        value,
        display: serialize(value, config.serializationLimits),
      }
    }

    // Merge in async task results
    const asyncPayload = asyncManager.buildStopPayload()
    for (const [key, val] of Object.entries(asyncPayload)) {
      payload[key] = {
        value: val,
        display: serialize(val, config.serializationLimits),
      }
    }

    // Pause and wait for resume via promise
    const promise = new Promise<void>((resolve) => {
      stopResolve = resolve
    })
    pauseController.pause()

    // Signal the stream controller (may call resolveStop synchronously)
    config.onStop?.(payload, currentSource)

    return promise
  }

  /**
   * Resolve a pending stop() call, allowing sandbox execution to continue.
   */
  function resolveStop(): void {
    if (stopResolve) {
      const resolve = stopResolve
      stopResolve = null
      resolve()
    }
  }

  /**
   * display(jsx) — Non-blocking render of React component.
   */
  function displayFn(element: unknown): void {
    const id = `display_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    renderSurface.append(id, element as any)
    config.onDisplay?.(id)
  }

  /**
   * ask(jsx) — Blocking form render. Returns form data on submit.
   */
  async function askFn(element: unknown): Promise<Record<string, unknown>> {
    const formId = `form_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    pauseController.pause()

    try {
      const result = await Promise.race([
        renderSurface.renderForm(formId, element as any),
        new Promise<Record<string, unknown>>((resolve) =>
          setTimeout(() => resolve({ _timeout: true }), askTimeout),
        ),
      ])
      return result
    } finally {
      // Resume silently — no message injected
      pauseController.resume()
    }
  }

  /**
   * async(fn) — Fire-and-forget background task.
   */
  function asyncFn(fn: () => Promise<void>, label?: string): void {
    const derivedLabel = label ?? deriveLabel(currentSource)
    const taskId = asyncManager.register(
      (signal) => fn(),
      derivedLabel,
    )
    config.onAsyncStart?.(taskId, derivedLabel)
  }

  return {
    stop: stopFn,
    display: displayFn,
    ask: askFn,
    async: asyncFn,
    setCurrentSource,
    resolveStop,
  }
}

function deriveLabel(source: string): string {
  // Try to extract a comment label: async(() => { // fetch data  → "fetch data"
  const commentMatch = source.match(/\/\/\s*(.+)$/)
  if (commentMatch) return commentMatch[1].trim()

  // Try to extract first function call: async(() => fetchData())  → "fetchData"
  const callMatch = source.match(/=>\s*(?:\{[^}]*)?(\w+)\s*\(/)
  if (callMatch) return callMatch[1]

  return 'background task'
}
