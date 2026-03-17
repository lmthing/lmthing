import type {
  StreamPauseController,
  StopPayload,
  ErrorPayload,
  SessionEvent,
  HookContext,
  LineResult,
} from '../session/types'
import { createLineAccumulator, feed, flush, clear } from './line-accumulator'
import { detectGlobalCall } from '../parser/global-detector'
import { executeHooks } from '../hooks/hook-executor'
import { HookRegistry } from '../hooks/hook-registry'
import { buildStopMessage, buildErrorMessage, buildHookInterruptMessage } from '../context/message-builder'

export interface StreamControllerOptions {
  onStatement: (source: string) => Promise<LineResult>
  onStop: (payload: StopPayload, source: string) => void
  onError: (error: ErrorPayload) => void
  onEvent: (event: SessionEvent) => void
  onCodeLine: (line: string) => void
  hookRegistry: HookRegistry
  hookContext: () => HookContext
}

export class StreamController implements StreamPauseController {
  private accumulator = createLineAccumulator()
  private paused = false
  private pauseResolve: (() => void) | null = null
  private options: StreamControllerOptions
  private lineCount = 0
  private currentBlockId = ''

  constructor(options: StreamControllerOptions) {
    this.options = options
  }

  /**
   * Feed tokens from the LLM stream.
   */
  async feedToken(token: string): Promise<void> {
    if (this.paused) {
      await this.waitForResume()
    }

    const { statements } = feed(this.accumulator, token)

    // Emit code events for display
    if (token.length > 0) {
      this.options.onEvent({
        type: 'code',
        lines: token,
        blockId: this.currentBlockId || this.newBlockId(),
      })
    }

    for (const statement of statements) {
      await this.processStatement(statement)
      if (this.paused) {
        await this.waitForResume()
      }
    }
  }

  /**
   * Called when the LLM stream ends. Flush remaining buffer.
   */
  async finalize(): Promise<void> {
    const remaining = flush(this.accumulator)
    if (remaining) {
      await this.processStatement(remaining)
    }
  }

  private async processStatement(source: string): Promise<void> {
    this.lineCount++
    const ctx = this.options.hookContext()

    // Run before hooks
    const hookResult = await executeHooks(
      source,
      'before',
      this.options.hookRegistry,
      ctx,
    )

    // Fire side effects
    for (const fn of hookResult.sideEffects) {
      try { await fn() } catch { /* side effects never crash */ }
    }

    // Report hook matches
    for (const match of hookResult.matchedHooks) {
      this.options.onEvent({
        type: 'hook',
        hookId: match.hookId,
        action: match.action,
        detail: source,
        blockId: this.currentBlockId,
      })
    }

    if (hookResult.action === 'skip') {
      return
    }

    if (hookResult.action === 'interrupt') {
      this.options.onEvent({
        type: 'hook',
        hookId: hookResult.matchedHooks[hookResult.matchedHooks.length - 1]?.hookId ?? 'unknown',
        action: 'interrupt',
        detail: hookResult.interruptMessage ?? '',
        blockId: this.currentBlockId,
      })
      return
    }

    const finalSource = hookResult.source

    // Track code
    this.options.onCodeLine(finalSource)

    // Execute
    const result = await this.options.onStatement(finalSource)

    // Run after hooks
    await executeHooks(finalSource, 'after', this.options.hookRegistry, ctx)

    if (!result.ok && result.error) {
      this.options.onError(result.error)
      this.options.onEvent({
        type: 'error',
        error: result.error,
        blockId: this.currentBlockId,
      })
    }
  }

  // ── StreamPauseController interface ──

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
    if (this.pauseResolve) {
      const resolve = this.pauseResolve
      this.pauseResolve = null
      resolve()
    }
  }

  isPaused(): boolean {
    return this.paused
  }

  private waitForResume(): Promise<void> {
    if (!this.paused) return Promise.resolve()
    return new Promise(resolve => {
      this.pauseResolve = resolve
    })
  }

  /**
   * Clear the line accumulator (e.g., on intervention).
   */
  clearBuffer(): void {
    clear(this.accumulator)
  }

  /**
   * Set the current block ID for events.
   */
  setBlockId(id: string): void {
    this.currentBlockId = id
  }

  private newBlockId(): string {
    this.currentBlockId = `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    return this.currentBlockId
  }
}
