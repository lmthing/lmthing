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
  Tasklist,
  TasklistsState,
  SerializedJSX,
  AgentSpawnConfig,
  AgentSpawnResult,
  AgentStatus,
} from './types'
import type { KnowledgeSelector, KnowledgeContent } from '../knowledge/types'
import type { SessionConfig } from './config'
import { createDefaultConfig, mergeConfig } from './config'
import { Sandbox } from '../sandbox/sandbox'
import { createGlobals } from '../sandbox/globals'
import { AsyncManager } from '../sandbox/async-manager'
import { StreamController } from '../stream/stream-controller'
import { HookRegistry } from '../hooks/hook-registry'
import { generateScopeTable } from '../context/scope-generator'
import { buildStopMessage, buildErrorMessage, buildInterventionMessage, buildTasklistReminderMessage, generateTasksBlock } from '../context/message-builder'
import { AgentRegistry } from '../sandbox/agent-registry'
import { generateAgentsBlock } from '../context/agents-block'
import { ConversationRecorder } from './conversation-state'
import type { ConversationState } from './conversation-state'
import { createReadLedger, type ReadLedger } from '../sandbox/read-ledger'
import { applyFileWrite, applyFileDiff } from '../stream/file-block-applier'

export interface SessionOptions {
  config?: Partial<SessionConfig>
  hooks?: Hook[]
  globals?: Record<string, unknown>
  knowledgeLoader?: (selector: KnowledgeSelector) => KnowledgeContent
  /** Return class info without side effects (validation only). */
  getClassInfo?: (className: string) => { methods: import('./types').ClassMethodInfo[] } | null
  /** Load a class: instantiate, bind methods, inject into sandbox. */
  loadClass?: (className: string, session: Session) => void
  /** Agent namespace globals to inject into the sandbox. */
  agentNamespaces?: Record<string, unknown>
  /** Spawn a child agent session. Used by agent namespace globals. */
  onSpawn?: (config: AgentSpawnConfig) => Promise<AgentSpawnResult>
  /** Route child agent's askParent() to parent. Set for tracked child sessions. */
  onAskParent?: (question: { message: string; schema: Record<string, unknown> }) => Promise<Record<string, unknown>>
  /** Whether this is a fire-and-forget child (untracked). askParent resolves immediately. */
  isFireAndForget?: boolean
  /** Knowledge namespace global (built-in, always available if configured). */
  knowledgeNamespace?: Record<string, unknown>
  /**
   * Working directory for file block operations (4-backtick write/diff blocks).
   * Defaults to process.cwd(). Paths are validated to stay within this directory.
   */
  fileWorkingDir?: string
  /** Callback to get context budget snapshot for the agent. */
  onContextBudget?: () => import('../sandbox/globals').ContextBudgetSnapshot
  /** Callback to execute a reflection LLM call. */
  onReflect?: (request: import('../sandbox/globals').ReflectRequest) => Promise<import('../sandbox/globals').ReflectResult>
  /** Callback to compress data via LLM. */
  onCompress?: (data: string, options: import('../sandbox/globals').CompressOptions) => Promise<string>
  /** Callback to fork a lightweight child agent. */
  onFork?: (request: import('../sandbox/globals').ForkRequest) => Promise<import('../sandbox/globals').ForkResult>
  /** Callback to get execution profiling data. */
  onTrace?: () => import('../sandbox/globals').TraceSnapshot
  /** Callback for LLM-powered task planning. */
  onPlan?: (goal: string, constraints?: string[]) => Promise<Array<{ id: string; instructions: string; dependsOn?: string[] }>>
  /** Callback for LLM-powered output critique. */
  onCritique?: (output: string, criteria: string[], context?: string) => Promise<import('../sandbox/globals').CritiqueResult>
  /** Callback to persist a learning to cross-session memory. */
  onLearn?: (topic: string, insight: string, tags?: string[]) => Promise<void>
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
  private tasklistReminderCount = 0
  private agentRegistry: AgentRegistry
  private recorder: ConversationRecorder
  private turnCodeStart = 0
  private onSpawn?: (config: any) => Promise<any>
  private readLedger: ReadLedger
  private fileWorkingDir: string

  constructor(options: SessionOptions = {}) {
    super()
    this.config = options.config
      ? mergeConfig(options.config)
      : createDefaultConfig()

    this.readLedger = createReadLedger()
    this.fileWorkingDir = options.fileWorkingDir ?? process.cwd()

    this.asyncManager = new AsyncManager(this.config.maxAsyncTasks)
    this.hookRegistry = new HookRegistry()
    this.agentRegistry = new AgentRegistry({
      onRegistered: (varName, label) => {
        this.emitEvent({ type: 'agent_registered', varName, label })
      },
      onResolved: (varName) => {
        this.emitEvent({ type: 'agent_resolved', varName })
      },
      onFailed: (varName, error) => {
        this.emitEvent({ type: 'agent_failed', varName, error })
      },
      onQuestionAsked: (varName, question) => {
        this.emitEvent({ type: 'agent_question_asked', varName, question })
      },
      onQuestionAnswered: (varName) => {
        this.emitEvent({ type: 'agent_question_answered', varName })
      },
    })
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
      onFileBlock: (stmt) => this.handleFileBlock(stmt),
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
          this.emitEvent({ type: 'ask_start', formId, jsx: serializeReactElement(element) })
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
      onTasklistDeclared: (tasklistId, plan) => {
        this.emitEvent({ type: 'tasklist_declared', tasklistId, plan })
      },
      onTaskComplete: (tasklistId, id, output) => {
        this.emitEvent({ type: 'task_complete', tasklistId, id, output })
      },
      onTaskFailed: (tasklistId, id, error) => {
        this.emitEvent({ type: 'task_failed', tasklistId, id, error })
      },
      onTaskRetried: (tasklistId, id) => {
        this.emitEvent({ type: 'task_retried', tasklistId, id })
      },
      onTaskSkipped: (tasklistId, id, reason) => {
        this.emitEvent({ type: 'task_skipped', tasklistId, id, reason })
      },
      onTaskProgress: (tasklistId, id, message, percent) => {
        this.emitEvent({ type: 'task_progress', tasklistId, id, message, percent })
      },
      onTaskAsyncStart: (tasklistId, id) => {
        this.emitEvent({ type: 'task_async_start', tasklistId, id })
      },
      onTaskAsyncComplete: (tasklistId, id, output) => {
        this.emitEvent({ type: 'task_async_complete', tasklistId, id, output })
      },
      onTaskAsyncFailed: (tasklistId, id, error) => {
        this.emitEvent({ type: 'task_async_failed', tasklistId, id, error })
      },
      onTaskOrderViolation: (tasklistId, attemptedTaskId, readyTasks) => {
        this.emitEvent({ type: 'task_order_violation', tasklistId, attemptedTaskId, readyTasks })
      },
      onTaskCompleteContinue: (tasklistId, completedTaskId, readyTasks) => {
        this.emitEvent({ type: 'task_complete_continue', tasklistId, completedTaskId, readyTasks })
      },
      maxTaskRetries: this.config.maxTaskRetries,
      maxTasksPerTasklist: this.config.maxTasksPerTasklist,
      sleepMaxSeconds: this.config.sleepMaxSeconds,
      onLoadKnowledge: options.knowledgeLoader
        ? (selector) => {
            const content = options.knowledgeLoader!(selector)
            const domains = Object.keys(content)
            this.emitEvent({ type: 'knowledge_loaded', domains })
            return content
          }
        : undefined,
      getClassInfo: options.getClassInfo ?? undefined,
      onLoadClass: options.loadClass
        ? (className) => {
            const info = options.getClassInfo?.(className)
            const methodNames = info?.methods.map(m => m.name) ?? []
            options.loadClass!(className, this)
            this.emitEvent({ type: 'class_loaded', className, methods: methodNames })
          }
        : undefined,
      onAskParent: options.onAskParent,
      isFireAndForget: options.isFireAndForget,
      onContextBudget: options.onContextBudget,
      onReflect: options.onReflect,
      onCompress: options.onCompress,
      onFork: options.onFork,
      onTrace: options.onTrace,
      onPlan: options.onPlan,
      onCritique: options.onCritique,
      onLearn: options.onLearn,
      onCheckpoint: () => this.sandbox.snapshotScope(),
      onRollback: (snapshot) => this.sandbox.restoreScope(snapshot),
      onRespond: (promise, data) => {
        const entry = this.agentRegistry.findByPromise(promise)
        if (!entry) throw new Error('respond: unknown agent — pass the agent variable as the first argument')
        this.agentRegistry.respond(entry.varName, data)
      },
    })

    // Inject globals into sandbox
    this.sandbox.inject('stop', this.globalsApi.stop)
    this.sandbox.inject('display', this.globalsApi.display)
    this.sandbox.inject('ask', this.globalsApi.ask)
    this.sandbox.inject('async', this.globalsApi.async)
    this.sandbox.inject('tasklist', this.globalsApi.tasklist)
    this.sandbox.inject('completeTask', this.globalsApi.completeTask)
    this.sandbox.inject('completeTaskAsync', this.globalsApi.completeTaskAsync)
    this.sandbox.inject('taskProgress', this.globalsApi.taskProgress)
    this.sandbox.inject('failTask', this.globalsApi.failTask)
    this.sandbox.inject('retryTask', this.globalsApi.retryTask)
    this.sandbox.inject('sleep', this.globalsApi.sleep)
    this.sandbox.inject('loadKnowledge', this.globalsApi.loadKnowledge)
    this.sandbox.inject('loadClass', this.globalsApi.loadClass)
    this.sandbox.inject('askParent', this.globalsApi.askParent)
    this.sandbox.inject('respond', this.globalsApi.respond)
    this.sandbox.inject('contextBudget', this.globalsApi.contextBudget)
    this.sandbox.inject('pin', this.globalsApi.pin)
    this.sandbox.inject('unpin', this.globalsApi.unpin)
    this.sandbox.inject('memo', this.globalsApi.memo)
    this.sandbox.inject('reflect', this.globalsApi.reflect)
    this.sandbox.inject('speculate', this.globalsApi.speculate)
    this.sandbox.inject('compress', this.globalsApi.compress)
    this.sandbox.inject('fork', this.globalsApi.fork)
    this.sandbox.inject('focus', this.globalsApi.focus)
    this.sandbox.inject('guard', this.globalsApi.guard)
    this.sandbox.inject('trace', this.globalsApi.trace)
    this.sandbox.inject('checkpoint', this.globalsApi.checkpoint)
    this.sandbox.inject('rollback', this.globalsApi.rollback)
    this.sandbox.inject('parallel', this.globalsApi.parallel)
    this.sandbox.inject('plan', this.globalsApi.plan)
    this.sandbox.inject('critique', this.globalsApi.critique)
    this.sandbox.inject('learn', this.globalsApi.learn)
    this.sandbox.inject('delegate', this.globalsApi.delegate)
    this.sandbox.inject('schema', this.globalsApi.schema)
    this.sandbox.inject('validate', this.globalsApi.validate)
    this.sandbox.inject('broadcast', this.globalsApi.broadcast)
    this.sandbox.inject('listen', this.globalsApi.listen)

    // Inject agent namespace globals
    if (options.agentNamespaces) {
      for (const [name, ns] of Object.entries(options.agentNamespaces)) {
        this.sandbox.inject(name, ns)
      }
    }

    // Inject built-in knowledge namespace
    if (options.knowledgeNamespace) {
      this.sandbox.inject('knowledge', options.knowledgeNamespace)
    }

    // Conversation state recorder
    this.recorder = new ConversationRecorder()
    this.on('event', (event: SessionEvent) => this.recorder.recordEvent(event))

    // Spawn callback with event emission
    this.onSpawn = options.onSpawn
      ? async (config: AgentSpawnConfig) => {
          this.emitEvent({
            type: 'agent_spawn_start',
            spaceName: config.spaceName,
            agentSlug: config.agentSlug,
            actionId: config.actionId,
          })
          try {
            const result = await options.onSpawn!(config)
            this.emitEvent({
              type: 'agent_spawn_complete',
              spaceName: config.spaceName,
              agentSlug: config.agentSlug,
              actionId: config.actionId,
              result,
            })
            return result
          } catch (err: any) {
            this.emitEvent({
              type: 'agent_spawn_failed',
              spaceName: config.spaceName,
              agentSlug: config.agentSlug,
              actionId: config.actionId,
              error: err?.message ?? String(err),
            })
            throw err
          }
        }
      : undefined
  }

  private async executeStatement(source: string): Promise<LineResult> {
    this.globalsApi.setCurrentSource(source)
    return this.sandbox.execute(source)
  }

  private handleStop(payload: StopPayload, source: string): void {
    this.stopCount++
    this.agentRegistry.advanceTurn()

    const cpState = this.globalsApi.getTasklistsState()
    const tasksBlock = generateTasksBlock(cpState)

    // Determine which agents resolved in this stop
    const resolvedInThisStop = new Set<string>()
    for (const [, sv] of Object.entries(payload)) {
      const entry = this.agentRegistry.findByPromise(sv.value)
      if (entry?.status === 'resolved') resolvedInThisStop.add(entry.varName)
    }
    const agentsBlock = generateAgentsBlock(this.agentRegistry, resolvedInThisStop)

    const baseMsg = buildStopMessage(payload)
    let msg = baseMsg
    if (tasksBlock) msg += `\n\n${tasksBlock}`
    if (agentsBlock) msg += `\n\n${agentsBlock}`
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

    const turnCode = this.codeLines.slice(this.turnCodeStart)
    this.recorder.recordStop(turnCode, payload, this.sandbox.getScope(), cpState)
    this.turnCodeStart = this.codeLines.length
  }

  private handleError(error: ErrorPayload): void {
    const msg = buildErrorMessage(error)
    this.messages.push({ role: 'assistant', content: this.codeLines.join('\n') })
    this.messages.push({ role: 'user', content: msg })
    this.emitEvent({ type: 'scope', entries: this.sandbox.getScope() })

    const turnCode = this.codeLines.slice(this.turnCodeStart)
    this.recorder.recordError(turnCode, error, this.sandbox.getScope())
    this.turnCodeStart = this.codeLines.length
  }

  private async handleFileBlock(stmt: import('../stream/line-accumulator').FileBlockStatement): Promise<void> {
    const blockId = `file_${Date.now()}`
    let result: import('../stream/file-block-applier').ApplyResult

    if (stmt.type === 'file_write') {
      result = await applyFileWrite(stmt.path, stmt.content, this.fileWorkingDir, this.readLedger)
      if (result.ok) {
        this.emitEvent({ type: 'file_write', path: stmt.path, blockId })
      }
    } else {
      result = await applyFileDiff(stmt.path, stmt.diff, this.fileWorkingDir, this.readLedger)
      if (result.ok) {
        this.emitEvent({ type: 'file_diff', path: stmt.path, blockId })
      }
    }

    if (!result.ok) {
      this.emitEvent({ type: 'file_error', path: stmt.path, error: result.error, blockId })
      // Inject the error as a user message so the agent sees it on the next turn
      const msg = `← error [FileError] ${result.error}`
      this.messages.push({ role: 'assistant', content: this.codeLines.join('\n') })
      this.messages.push({ role: 'user', content: msg })
    }
  }

  /**
   * Get the read ledger for this session.
   * Pass to setReadLedger() in the fs catalog module to track readFile() calls.
   */
  getReadLedger(): ReadLedger {
    return this.readLedger
  }

  /**
   * Handle a user message.
   */
  async handleUserMessage(text: string): Promise<void> {
    this.setStatus('executing')
    this.messages.push({ role: 'user', content: text })
    this.recorder.recordUserMessage(text, this.sandbox.getScope())
  }

  /**
   * Feed tokens from the LLM stream.
   */
  async feedToken(token: string): Promise<void> {
    await this.streamController.feedToken(token)
  }

  /**
   * Finalize the LLM stream.
   * Returns 'complete' if done, or 'tasklist_incomplete' if tasks remain.
   */
  async finalize(): Promise<'complete' | 'tasklist_incomplete'> {
    await this.streamController.finalize()

    // Check for incomplete tasks across all tasklists
    const cpState = this.globalsApi.getTasklistsState()
    for (const [tasklistId, tasklist] of cpState.tasklists) {
      // Check if there are incomplete non-optional tasks
      const hasRequiredIncomplete = tasklist.plan.tasks.some(t => {
        const completion = tasklist.completed.get(t.id)
        const isIncomplete = !completion || (completion.status !== 'completed' && completion.status !== 'skipped')
        return isIncomplete && !t.optional
      })
      if (!hasRequiredIncomplete) continue

      // Wait for running async tasks before nudging
      if (tasklist.runningTasks.size > 0) {
        await Promise.race([
          Promise.allSettled(
            [...tasklist.runningTasks].map(id =>
              new Promise<void>(resolve => {
                const check = () => {
                  if (!tasklist.runningTasks.has(id)) { resolve(); return }
                  setTimeout(check, 100)
                }
                check()
              })
            )
          ),
          new Promise(resolve => setTimeout(resolve, this.config.taskAsyncTimeout)),
        ])
      }

      if (this.tasklistReminderCount < this.config.maxTasklistReminders) {
        this.tasklistReminderCount++

        const ready = [...tasklist.readyTasks]
        const blocked = tasklist.plan.tasks
          .filter(t => !tasklist.readyTasks.has(t.id) && !tasklist.completed.has(t.id) && !tasklist.runningTasks.has(t.id))
          .map(t => `${t.id} (waiting on ${(t.dependsOn ?? []).join(', ')})`)
        const failed = [...tasklist.completed.entries()]
          .filter(([_, c]) => c.status === 'failed')
          .map(([id]) => id)

        const msg = buildTasklistReminderMessage(tasklistId, ready, blocked, failed)
        const tasksBlock = generateTasksBlock(cpState)
        const fullMsg = tasksBlock ? `${msg}\n\n${tasksBlock}` : msg

        this.messages.push({ role: 'assistant', content: this.codeLines.join('\n') })
        this.messages.push({ role: 'user', content: fullMsg })

        const blockedIds = blocked.map(b => b.split(' ')[0])
        this.recorder.recordTasklistReminder(
          [...this.codeLines], tasklistId, ready, blockedIds, failed,
          this.sandbox.getScope(), cpState,
        )

        this.codeLines = []
        this.turnCodeStart = 0
        this.emitEvent({ type: 'tasklist_reminder', tasklistId, ready, blocked: blockedIds, failed })
        this.emitEvent({ type: 'scope', entries: this.sandbox.getScope() })
        return 'tasklist_incomplete'
      }
    }

    await this.asyncManager.drain(5000)

    const turnCode = this.codeLines.slice(this.turnCodeStart)
    this.recorder.recordCompletion(turnCode, this.sandbox.getScope(), this.globalsApi.getTasklistsState(), 'complete')
    this.turnCodeStart = this.codeLines.length

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
   * Inject a value into the sandbox as a global.
   * Used to inject class namespace objects after loadClass().
   */
  injectGlobal(name: string, value: unknown): void {
    this.sandbox.inject(name, value)
  }

  /**
   * Resolve a pending ask() form.
   */
  resolveAsk(formId: string, data: Record<string, unknown>): void {
    const hasListener = this.listenerCount(`form:${formId}`) > 0
    console.log(`\x1b[90m  [session] resolveAsk ${formId} hasListener=${hasListener} activeFormId=${this.activeFormId}\x1b[0m`)
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
    // If a form is pending, cancel it so the sandbox unblocks
    if (this.activeFormId) {
      this.cancelAsk(this.activeFormId)
    }

    this.streamController.pause()
    const msg = buildInterventionMessage(text)
    this.messages.push({ role: 'assistant', content: this.codeLines.join('\n') })
    this.messages.push({ role: 'user', content: msg })

    this.recorder.recordIntervention([...this.codeLines], text, this.sandbox.getScope())

    this.codeLines = []
    this.turnCodeStart = 0
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
      tasklistsState: this.globalsApi.getTasklistsState(),
      agentEntries: this.agentRegistry.getAll().map(e => ({
        varName: e.varName,
        label: e.label,
        status: e.status,
        error: e.error,
      })),
    }
  }

  /**
   * Get the full serializable conversation state.
   */
  getConversationState(): ConversationState {
    return this.recorder.getState()
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
   * Get the public globals object (for passing to setup functions).
   */
  getGlobals(): Record<string, Function> {
    return {
      stop: this.globalsApi.stop,
      display: this.globalsApi.display,
      ask: this.globalsApi.ask,
      async: this.globalsApi.async,
      tasklist: this.globalsApi.tasklist,
      completeTask: this.globalsApi.completeTask,
      completeTaskAsync: this.globalsApi.completeTaskAsync,
      taskProgress: this.globalsApi.taskProgress,
      failTask: this.globalsApi.failTask,
      retryTask: this.globalsApi.retryTask,
      sleep: this.globalsApi.sleep,
      loadKnowledge: this.globalsApi.loadKnowledge,
      loadClass: this.globalsApi.loadClass,
      askParent: this.globalsApi.askParent,
      respond: this.globalsApi.respond,
    }
  }

  /**
   * Get the agent registry.
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry
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

  getPinnedMemory(): Map<string, { value: unknown; display: string; turn: number }> {
    return this.globalsApi.getPinnedMemory()
  }

  getMemoMemory(): Map<string, string> {
    return this.globalsApi.getMemoMemory()
  }

  getFocusSections(): Set<string> | null {
    return this.globalsApi.getFocusSections()
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
    this.agentRegistry.destroy()
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
// Components that should be serialized by name (not expanded server-side)
// because the web UI renders them with client-side state (hooks).
const CLIENT_COMPONENTS = new Set([
  'TextInput', 'TextArea', 'NumberInput', 'Slider',
  'Checkbox', 'Select', 'MultiSelect', 'DatePicker', 'FileUpload',
])

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
    const name = (el.type as Function).name || ''

    // Client-rendered components — serialize by name so the web UI handles them
    if (CLIENT_COMPONENTS.has(name)) {
      component = name
    } else {
      // Try to expand pure (hook-free) components server-side.
      // Components using hooks will throw — fall back to name + props.
      const _consoleError = console.error
      try {
        console.error = () => {} // suppress React hook warnings during probe
        const rendered = (el.type as Function)(el.props)
        return serializeReactElement(rendered, depth + 1)
      } catch {
        component = name || 'div'
      } finally {
        console.error = _consoleError
      }
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
