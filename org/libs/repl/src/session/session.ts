import { EventEmitter } from 'node:events'
import type {
  SessionStatus,
  SessionEvent,
  SessionSnapshot,
  StopPayload,
  ErrorPayload,
  ScopeEntry,
  Hook,
  LineResult,
  CheckpointPlan,
  CheckpointState,
  SerializedJSX,
} from './types'
import type { SessionConfig } from './config'
import { createDefaultConfig, mergeConfig } from './config'
import { Sandbox } from '../sandbox/sandbox'
import { createGlobals } from '../sandbox/globals'
import { AsyncManager } from '../sandbox/async-manager'
import { StreamController } from '../stream/stream-controller'
import { HookRegistry } from '../hooks/hook-registry'
import { generateScopeTable } from '../context/scope-generator'
import { buildStopMessage, buildErrorMessage, buildInterventionMessage, buildCheckpointReminderMessage } from '../context/message-builder'

export interface SessionOptions {
  config?: Partial<SessionConfig>
  hooks?: Hook[]
  globals?: Record<string, unknown>
}

export class Session extends EventEmitter {
  private status: SessionStatus = 'idle'
  private config: SessionConfig
  private sandbox: Sandbox
  private asyncManager: AsyncManager
  private hookRegistry: HookRegistry
  private streamController: StreamController
  private globalsApi: ReturnType<typeof createGlobals>
  private blocks: Array<{ type: string; id: string; data: unknown }> = []
  private codeLines: string[] = []
  private messages: Array<{ role: string; content: string }> = []
  private activeFormId: string | null = null
  private stopCount = 0
  private checkpointReminderCount = 0

  constructor(options: SessionOptions = {}) {
    super()
    this.config = options.config
      ? mergeConfig(options.config)
      : createDefaultConfig()

    this.asyncManager = new AsyncManager(this.config.maxAsyncTasks)
    this.hookRegistry = new HookRegistry()
    if (options.hooks) {
      for (const hook of options.hooks) {
        this.hookRegistry.register(hook)
      }
    }

    // Create sandbox
    this.sandbox = new Sandbox({
      timeout: this.config.functionTimeout,
      globals: options.globals,
    })

    // Create stream controller
    this.streamController = new StreamController({
      onStatement: (source) => this.executeStatement(source),
      onStop: (payload, source) => this.handleStop(payload, source),
      onError: (error) => this.handleError(error),
      onEvent: (event) => this.emitEvent(event),
      onCodeLine: (line) => this.codeLines.push(line),
      hookRegistry: this.hookRegistry,
      hookContext: () => ({
        lineNumber: this.sandbox.getLineCount(),
        sessionId: `session_${Date.now()}`,
        scope: this.sandbox.getScope(),
      }),
    })

    // Create globals
    this.globalsApi = createGlobals({
      pauseController: this.streamController,
      renderSurface: {
        append: (id, element) => {
          this.emitEvent({ type: 'display', componentId: id, jsx: serializeReactElement(element) })
        },
        renderForm: async (formId, element) => {
          this.activeFormId = formId
          this.emitEvent({ type: 'ask_start', formId, jsx: { component: 'Form', props: {} } })
          return new Promise((resolve) => {
            this.once(`form:${formId}`, (data: Record<string, unknown>) => {
              this.activeFormId = null
              this.emitEvent({ type: 'ask_end', formId })
              resolve(data)
            })
          })
        },
        cancelForm: (formId) => {
          this.activeFormId = null
          this.emit(`form:${formId}`, { _cancelled: true })
        },
      },
      asyncManager: this.asyncManager,
      serializationLimits: this.config.serializationLimits,
      askTimeout: this.config.askTimeout,
      onStop: (payload, source) => this.handleStop(payload, source),
      onDisplay: (id) => {},
      onAsyncStart: (taskId, label) => {
        this.emitEvent({ type: 'async_start', taskId, label })
      },
      onCheckpointPlan: (tasklistId, plan) => {
        this.emitEvent({ type: 'checkpoint_plan', tasklistId, plan })
      },
      onCheckpointComplete: (tasklistId, id, output) => {
        this.emitEvent({ type: 'checkpoint_complete', tasklistId, id, output })
      },
    })

    // Inject globals into sandbox
    this.sandbox.inject('stop', this.globalsApi.stop)
    this.sandbox.inject('display', this.globalsApi.display)
    this.sandbox.inject('ask', this.globalsApi.ask)
    this.sandbox.inject('async', this.globalsApi.async)
    this.sandbox.inject('checkpoints', this.globalsApi.checkpoints)
    this.sandbox.inject('checkpoint', this.globalsApi.checkpoint)
  }

  private async executeStatement(source: string): Promise<LineResult> {
    this.globalsApi.setCurrentSource(source)
    return this.sandbox.execute(source)
  }

  private handleStop(payload: StopPayload, source: string): void {
    this.stopCount++
    const msg = buildStopMessage(payload)
    this.messages.push({ role: 'assistant', content: this.codeLines.join('\n') })
    this.messages.push({ role: 'user', content: msg })
    this.emitEvent({
      type: 'read',
      payload: Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, v.value]),
      ),
      blockId: `stop_${this.stopCount}`,
    })
    this.emitEvent({ type: 'scope', entries: this.sandbox.getScope() })
  }

  private handleError(error: ErrorPayload): void {
    const msg = buildErrorMessage(error)
    this.messages.push({ role: 'assistant', content: this.codeLines.join('\n') })
    this.messages.push({ role: 'user', content: msg })
    this.emitEvent({ type: 'scope', entries: this.sandbox.getScope() })
  }

  /**
   * Handle a user message.
   */
  async handleUserMessage(text: string): Promise<void> {
    this.setStatus('executing')
    this.messages.push({ role: 'user', content: text })
  }

  /**
   * Feed tokens from the LLM stream.
   */
  async feedToken(token: string): Promise<void> {
    await this.streamController.feedToken(token)
  }

  /**
   * Finalize the LLM stream.
   * Returns 'complete' if done, or 'checkpoint_incomplete' if checkpoints remain.
   */
  async finalize(): Promise<'complete' | 'checkpoint_incomplete'> {
    await this.streamController.finalize()

    // Check for incomplete checkpoints across all tasklists
    const cpState = this.globalsApi.getCheckpointState()
    for (const [tasklistId, tasklist] of cpState.tasklists) {
      if (tasklist.currentIndex < tasklist.plan.tasks.length) {
        if (this.checkpointReminderCount < this.config.maxCheckpointReminders) {
          this.checkpointReminderCount++
          const remaining = tasklist.plan.tasks.slice(tasklist.currentIndex).map(t => t.id)
          const msg = buildCheckpointReminderMessage(tasklistId, remaining)
          this.messages.push({ role: 'assistant', content: this.codeLines.join('\n') })
          this.messages.push({ role: 'user', content: msg })
          this.codeLines = []
          this.emitEvent({ type: 'checkpoint_reminder', tasklistId, remaining })
          this.emitEvent({ type: 'scope', entries: this.sandbox.getScope() })
          return 'checkpoint_incomplete'
        }
      }
    }

    await this.asyncManager.drain(5000)
    this.setStatus('complete')
    return 'complete'
  }

  /**
   * Resolve a pending stop() call, allowing sandbox to continue.
   * Called by the runner after injecting the stop payload as a user message.
   */
  resolveStop(): void {
    this.globalsApi.resolveStop()
    this.streamController.resume()
  }

  /**
   * Resolve a pending ask() form.
   */
  resolveAsk(formId: string, data: Record<string, unknown>): void {
    this.emit(`form:${formId}`, data)
  }

  /**
   * Cancel a pending ask() form.
   */
  cancelAsk(formId: string): void {
    this.emit(`form:${formId}`, { _cancelled: true })
  }

  /**
   * Cancel an async task.
   */
  cancelAsyncTask(taskId: string, message = ''): void {
    this.asyncManager.cancel(taskId, message)
    this.emitEvent({ type: 'async_cancelled', taskId })
  }

  /**
   * Pause the session.
   */
  pause(): void {
    this.streamController.pause()
    this.setStatus('paused')
  }

  /**
   * Resume the session.
   */
  resume(): void {
    this.streamController.resume()
    this.setStatus('executing')
  }

  /**
   * Handle user intervention (message while agent is running).
   */
  handleIntervention(text: string): void {
    this.streamController.pause()
    const msg = buildInterventionMessage(text)
    this.messages.push({ role: 'assistant', content: this.codeLines.join('\n') })
    this.messages.push({ role: 'user', content: msg })
    this.codeLines = []
    this.emitEvent({ type: 'scope', entries: this.sandbox.getScope() })
    this.streamController.resume()
  }

  /**
   * Get a snapshot of the current session state.
   */
  snapshot(): SessionSnapshot {
    return {
      status: this.status,
      blocks: [...this.blocks],
      scope: this.sandbox.getScope(),
      asyncTasks: this.asyncManager.getAllTasks().map(t => ({
        id: t.id,
        label: t.label,
        status: t.status,
        elapsed: Date.now() - t.startTime,
      })),
      activeFormId: this.activeFormId,
      checkpointState: this.globalsApi.getCheckpointState(),
    }
  }

  /**
   * Get the current status.
   */
  getStatus(): SessionStatus {
    return this.status
  }

  /**
   * Get messages for context.
   */
  getMessages(): Array<{ role: string; content: string }> {
    return this.messages
  }

  /**
   * Get scope table as string.
   */
  getScopeTable(): string {
    return generateScopeTable(this.sandbox.getScope(), {
      maxVariables: this.config.workspace.maxScopeVariables,
      maxValueWidth: this.config.workspace.maxScopeValueWidth,
    })
  }

  private setStatus(status: SessionStatus): void {
    this.status = status
    this.emitEvent({ type: 'status', status })
  }

  private emitEvent(event: SessionEvent): void {
    this.emit('event', event)
  }

  /**
   * Destroy the session and clean up resources.
   */
  destroy(): void {
    this.asyncManager.cancelAll()
    this.sandbox.destroy()
    this.hookRegistry.clear()
    this.removeAllListeners()
  }
}

/**
 * Convert a React element (from the sandbox) into a SerializedJSX tree
 * that can be sent over the wire and reconstructed by the web UI.
 */
function serializeReactElement(element: unknown, depth = 0): SerializedJSX {
  if (depth > 20) return { component: 'div', props: {}, children: ['[max depth]'] }

  // Not a React element — wrap as text
  if (!element || typeof element !== 'object' || !('type' in element)) {
    return { component: 'span', props: {}, children: [String(element ?? '')] }
  }

  const el = element as { type: unknown; props: Record<string, unknown> }
  const { children, ...restProps } = el.props ?? {}

  // Resolve component type to a string tag name
  let component: string
  if (typeof el.type === 'string') {
    component = el.type
  } else if (typeof el.type === 'function') {
    // Custom component — call it to get the rendered output
    try {
      const rendered = (el.type as Function)(el.props)
      return serializeReactElement(rendered, depth + 1)
    } catch {
      component = (el.type as Function).name || 'div'
    }
  } else {
    component = 'div'
  }

  // Serialize props — only keep JSON-serializable values
  const safeProps: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(restProps)) {
    if (typeof value === 'function') continue
    if (typeof value === 'symbol') continue
    safeProps[key] = value
  }

  // Serialize children
  const serializedChildren = serializeChildren(children, depth)

  return { component, props: safeProps, children: serializedChildren.length > 0 ? serializedChildren : undefined }
}

function serializeChildren(children: unknown, depth: number): (SerializedJSX | string)[] {
  if (children == null) return []
  if (typeof children === 'string') return [children]
  if (typeof children === 'number' || typeof children === 'boolean') return [String(children)]
  if (Array.isArray(children)) {
    return children.flatMap(child => serializeChildren(child, depth))
  }
  if (typeof children === 'object' && 'type' in children) {
    return [serializeReactElement(children, depth + 1)]
  }
  return [String(children)]
}
