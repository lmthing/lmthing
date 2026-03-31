import type { StreamPauseController, RenderSurface, StopPayload, SerializedValue, Tasklist, TasklistsState, TasklistState, ClassMethodInfo, AgentSpawnConfig, AgentSpawnResult } from '../session/types'
import { serialize } from '../stream/serializer'
import { recoverArgumentNames } from '../parser/ast-utils'
import { AsyncManager } from './async-manager'
import type { KnowledgeSelector, KnowledgeContent } from '../knowledge/types'
import { tagAsKnowledge } from '../context/knowledge-decay'

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
  onTasklistDeclared?: (tasklistId: string, plan: Tasklist) => void
  onTaskComplete?: (tasklistId: string, id: string, output: Record<string, any>) => void
  onTaskFailed?: (tasklistId: string, id: string, error: string) => void
  onTaskRetried?: (tasklistId: string, id: string) => void
  onTaskSkipped?: (tasklistId: string, id: string, reason: string) => void
  onTaskProgress?: (tasklistId: string, id: string, message: string, percent?: number) => void
  onTaskAsyncStart?: (tasklistId: string, id: string) => void
  onTaskAsyncComplete?: (tasklistId: string, id: string, output: Record<string, any>) => void
  onTaskAsyncFailed?: (tasklistId: string, id: string, error: string) => void
  onTaskOrderViolation?: (tasklistId: string, attemptedTaskId: string, readyTasks: Array<{ id: string; instructions: string; outputSchema: Record<string, { type: string }> }>) => void
  onTaskCompleteContinue?: (tasklistId: string, completedTaskId: string, readyTasks: Array<{ id: string; instructions: string; outputSchema: Record<string, { type: string }> }>) => void
  maxTaskRetries?: number
  maxTasksPerTasklist?: number
  sleepMaxSeconds?: number
  onLoadKnowledge?: (selector: KnowledgeSelector) => KnowledgeContent
  /** Validate a class name and return its methods (no side effects). */
  getClassInfo?: (className: string) => { methods: ClassMethodInfo[] } | null
  /** Signal that loadClass was called — emits events, injects bindings. Called after pause. */
  onLoadClass?: (className: string) => void
  /** Spawn a child agent session. Used by agent namespace globals. */
  onSpawn?: (config: AgentSpawnConfig) => Promise<AgentSpawnResult>
  /** Route child agent's askParent() to parent. Set only for tracked child sessions. */
  onAskParent?: (question: { message: string; schema: Record<string, unknown> }) => Promise<Record<string, unknown>>
  /** Whether this is a fire-and-forget child (untracked). askParent resolves immediately. */
  isFireAndForget?: boolean
  /** Deliver structured input to a child agent's pending askParent(). */
  onRespond?: (promise: unknown, data: Record<string, unknown>) => void
  /** Return a context budget snapshot for the agent. */
  onContextBudget?: () => ContextBudgetSnapshot
  /** Execute a reflection LLM call and return the assessment. */
  onReflect?: (request: ReflectRequest) => Promise<ReflectResult>
  /** Execute speculative branches in parallel sandboxes. */
  onSpeculate?: (branches: SpeculateBranch[], timeout: number) => Promise<SpeculateResult>
  /** Compress data via an LLM call. */
  onCompress?: (data: string, options: CompressOptions) => Promise<string>
  /** Fork a lightweight child agent for sub-reasoning. */
  onFork?: (request: ForkRequest) => Promise<ForkResult>
  /** Return execution profiling data. */
  onTrace?: () => TraceSnapshot
  /** Generate a task plan from a natural language goal via LLM. */
  onPlan?: (goal: string, constraints?: string[]) => Promise<Array<{ id: string; instructions: string; dependsOn?: string[] }>>
  /** Critique output quality via LLM. */
  onCritique?: (output: string, criteria: string[], context?: string) => Promise<CritiqueResult>
  /** Persist a learning to the knowledge base for cross-session memory. */
  onLearn?: (topic: string, insight: string, tags?: string[]) => Promise<void>
  /** Snapshot current sandbox scope for checkpoint(). */
  onCheckpoint?: () => { values: Map<string, unknown>; declaredNames: Set<string> }
  /** Restore sandbox scope from a checkpoint. */
  onRollback?: (snapshot: { values: Map<string, unknown>; declaredNames: Set<string> }) => void
}

export interface TraceSnapshot {
  turns: number
  llmCalls: number
  llmTokens: { input: number; output: number; total: number }
  estimatedCost: string
  asyncTasks: { completed: number; failed: number; running: number }
  scopeSize: number
  pinnedCount: number
  memoCount: number
  sessionDurationMs: number
}

export interface CritiqueResult {
  pass: boolean
  overallScore: number
  scores: Record<string, number>
  issues: string[]
  suggestions: string[]
}

export interface CheckpointData {
  id: string
  timestamp: number
  scopeSnapshot: Map<string, unknown>
  declaredNames: Set<string>
}

export interface ForkRequest {
  task: string
  context?: Record<string, unknown>
  outputSchema?: Record<string, { type: string }>
  maxTurns?: number
}

export interface ForkResult {
  output: Record<string, unknown>
  turns: number
  success: boolean
  error?: string
}

export interface CompressOptions {
  preserveKeys?: string[]
  maxTokens?: number
  format?: 'structured' | 'prose'
}

export interface SpeculateBranch {
  label: string
  fn: () => unknown
}

export interface SpeculateBranchResult {
  label: string
  ok: boolean
  result?: unknown
  error?: string
  durationMs: number
}

export interface SpeculateResult {
  results: SpeculateBranchResult[]
}

export interface ReflectRequest {
  question: string
  context?: Record<string, unknown>
  criteria?: string[]
}

export interface ReflectResult {
  assessment: string
  scores: Record<string, number>
  suggestions: string[]
  shouldPivot: boolean
}

export interface ContextBudgetSnapshot {
  totalTokens: number
  usedTokens: number
  remainingTokens: number
  systemPromptTokens: number
  messageHistoryTokens: number
  turnNumber: number
  decayLevel: { stops: string; knowledge: string }
  recommendation: 'nominal' | 'conserve' | 'critical'
}

/**
 * Create the twelve global functions: stop, display, ask, async, tasklist, completeTask, completeTaskAsync, taskProgress, failTask, retryTask, sleep, loadKnowledge.
 * These use callback interfaces, never importing stream-controller or session directly.
 */
export function createGlobals(config: GlobalsConfig) {
  const {
    pauseController,
    renderSurface,
    asyncManager,
    askTimeout = 300_000,
  } = config

  // ── Tasklist state ──
  const tasklistsState: TasklistsState = {
    tasklists: new Map(),
  }

  // ── Focus state (dynamic prompt sectioning) ──
  let focusSections: Set<string> | null = null // null = all expanded

  // ── Checkpoint storage ──
  const checkpoints = new Map<string, CheckpointData>()

  // ── Pinned memory ──
  const pinnedMemory = new Map<string, { value: unknown; display: string; turn: number }>()
  // ── Memo memory (agent-authored compressed notes) ──
  const memoMemory = new Map<string, string>()
  let pinTurnCounter = 0

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

    // Await any Promise values concurrently
    const resolved = await Promise.allSettled(
      values.map((v) => (v instanceof Promise ? v : Promise.resolve(v))),
    )

    // Build payload from resolved values
    const payload: StopPayload = {}
    for (let i = 0; i < resolved.length; i++) {
      const key = argNames[i] ?? `arg_${i}`
      const settlement = resolved[i]
      const value =
        settlement.status === 'fulfilled'
          ? settlement.value
          : {
              _error:
                settlement.reason instanceof Error
                  ? settlement.reason.message
                  : String(settlement.reason),
            }
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

  /**
   * tasklist(tasklistId, description, tasks) — Declare a task plan with milestones.
   * Can be called multiple times per session with different tasklist IDs.
   */
  function tasklistFn(tasklistId: string, description: string, tasks: Tasklist['tasks']): void {
    if (tasklistsState.tasklists.has(tasklistId)) {
      throw new Error(`tasklist() tasklist "${tasklistId}" already declared`)
    }
    if (!tasklistId) {
      throw new Error('tasklist() requires a tasklistId')
    }
    if (!description || !Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('tasklist() requires a description and at least one task')
    }

    const maxTasks = config.maxTasksPerTasklist ?? 20
    if (tasks.length > maxTasks) {
      throw new Error(`tasklist() exceeds maximum of ${maxTasks} tasks per tasklist`)
    }

    const ids = new Set<string>()
    for (const task of tasks) {
      if (!task.id || !task.instructions || !task.outputSchema) {
        throw new Error('Each task must have id, instructions, and outputSchema')
      }
      if (ids.has(task.id)) {
        throw new Error(`Duplicate task id: ${task.id}`)
      }
      ids.add(task.id)
    }

    // Validate dependsOn references
    for (const task of tasks) {
      if (task.dependsOn) {
        for (const dep of task.dependsOn) {
          if (!ids.has(dep)) {
            throw new Error(`Task "${task.id}" depends on unknown task "${dep}" in tasklist "${tasklistId}"`)
          }
          if (dep === task.id) {
            throw new Error(`Task "${task.id}" cannot depend on itself`)
          }
        }
      }
    }

    // Check if any task has dependsOn
    const hasDependsOn = tasks.some(t => t.dependsOn && t.dependsOn.length > 0)

    // If no task has dependsOn, synthesize implicit sequential deps
    if (!hasDependsOn) {
      for (let i = 1; i < tasks.length; i++) {
        tasks[i] = { ...tasks[i], dependsOn: [tasks[i - 1].id] }
      }
    }

    // Validate DAG — topological sort with cycle detection
    const visited = new Set<string>()
    const visiting = new Set<string>()
    const taskMap = new Map(tasks.map(t => [t.id, t]))

    function visit(id: string): void {
      if (visited.has(id)) return
      if (visiting.has(id)) {
        throw new Error(`Cycle detected in tasklist "${tasklistId}" involving task "${id}"`)
      }
      visiting.add(id)
      const task = taskMap.get(id)!
      if (task.dependsOn) {
        for (const dep of task.dependsOn) {
          visit(dep)
        }
      }
      visiting.delete(id)
      visited.add(id)
    }
    for (const task of tasks) {
      visit(task.id)
    }

    // Compute initial readyTasks — tasks with no dependencies
    const readyTasks = new Set<string>()
    for (const task of tasks) {
      if (!task.dependsOn || task.dependsOn.length === 0) {
        readyTasks.add(task.id)
      }
    }

    const plan: Tasklist = { tasklistId, description, tasks }
    const tasklistState: TasklistState = {
      plan,
      completed: new Map(),
      readyTasks,
      runningTasks: new Set(),
      outputs: new Map(),
      progressMessages: new Map(),
      retryCount: new Map(),
    }
    tasklistsState.tasklists.set(tasklistId, tasklistState)
    renderSurface.appendTasklistProgress?.(tasklistId, tasklistState)
    config.onTasklistDeclared?.(tasklistId, plan)
  }

  /**
   * completeTask(tasklistId, id, output) — Mark a milestone as complete.
   */
  function completeTaskFn(tasklistId: string, id: string, output: Record<string, any>): void {
    const tasklist = tasklistsState.tasklists.get(tasklistId)
    if (!tasklist) {
      throw new Error(`completeTask() called with unknown tasklist "${tasklistId}" — declare it with tasklist() first`)
    }

    const task = tasklist.plan.tasks.find(t => t.id === id)
    if (!task) {
      throw new Error(`Unknown task id: ${id} in tasklist "${tasklistId}"`)
    }

    if (tasklist.completed.has(id)) {
      throw new Error(`Task "${id}" in tasklist "${tasklistId}" already completed`)
    }

    // Must be in readyTasks (not running via completeTaskAsync)
    if (!tasklist.readyTasks.has(id)) {
      const isRunning = tasklist.runningTasks.has(id)
      if (isRunning) {
        throw new Error(`Task "${id}" in tasklist "${tasklistId}" is already running via completeTaskAsync()`)
      }
      // Find which deps are missing
      const pendingDeps = (task.dependsOn ?? []).filter(dep => {
        const c = tasklist.completed.get(dep)
        return !c || c.status !== 'completed'
      })
      // Notify the host about the order violation with ready task details
      const readyTaskDetails = [...tasklist.readyTasks].map(readyId => {
        const readyTask = tasklist.plan.tasks.find(t => t.id === readyId)!
        return { id: readyId, instructions: readyTask.instructions, outputSchema: readyTask.outputSchema }
      })
      config.onTaskOrderViolation?.(tasklistId, id, readyTaskDetails)
      throw new Error(
        `Task "${id}" in tasklist "${tasklistId}" is not ready. Waiting on: ${pendingDeps.join(', ')}`
      )
    }

    // Validate output against schema
    for (const [key, schema] of Object.entries(task.outputSchema)) {
      if (!(key in output)) {
        throw new Error(`Task "${id}" output missing required key: ${key}`)
      }
      const expectedType = (schema as any).type
      const value = output[key]
      const actual = Array.isArray(value) ? 'array' : typeof value
      if (actual !== expectedType) {
        throw new Error(
          `Task "${id}" output key "${key}": expected ${expectedType}, got ${actual}`
        )
      }
    }

    // Record completion
    tasklist.completed.set(id, {
      output,
      timestamp: Date.now(),
      status: 'completed',
    })
    tasklist.readyTasks.delete(id)
    tasklist.outputs.set(id, output)

    // Recompute readyTasks and evaluate conditions
    recomputeReadyTasks(tasklist)

    renderSurface.updateTasklistProgress?.(tasklistId, tasklist)
    config.onTaskComplete?.(tasklistId, id, output)

    // If there are remaining incomplete tasks, notify the host to guide the agent
    const hasRemainingTasks = tasklist.plan.tasks.some(t => {
      const c = tasklist.completed.get(t.id)
      return (!c || (c.status !== 'completed' && c.status !== 'skipped')) && !t.optional
    })
    if (hasRemainingTasks && tasklist.readyTasks.size > 0) {
      const readyTaskDetails = [...tasklist.readyTasks].map(readyId => {
        const readyTask = tasklist.plan.tasks.find(t => t.id === readyId)!
        return { id: readyId, instructions: readyTask.instructions, outputSchema: readyTask.outputSchema }
      })
      config.onTaskCompleteContinue?.(tasklistId, id, readyTaskDetails)
    }
  }

  function recomputeReadyTasks(tasklist: TasklistState): void {
    for (const task of tasklist.plan.tasks) {
      // Skip already processed tasks
      if (tasklist.completed.has(task.id) || tasklist.readyTasks.has(task.id) || tasklist.runningTasks.has(task.id)) {
        continue
      }

      // Check if all deps are satisfied (completed or skipped)
      const deps = task.dependsOn ?? []
      const allDepsSatisfied = deps.every(dep => {
        const c = tasklist.completed.get(dep)
        return c && (c.status === 'completed' || c.status === 'skipped' || (c.status === 'failed' && tasklist.plan.tasks.find(t => t.id === dep)?.optional))
      })

      if (allDepsSatisfied) {
        // Evaluate condition if present
        if (task.condition) {
          const conditionMet = evaluateCondition(task.condition, tasklist.outputs)
          if (!conditionMet) {
            // Auto-skip
            tasklist.completed.set(task.id, {
              output: {},
              timestamp: Date.now(),
              status: 'skipped',
            })
            config.onTaskSkipped?.(tasklist.plan.tasklistId, task.id, 'condition was falsy')
            // Recurse to check dependents of this skipped task
            recomputeReadyTasks(tasklist)
            return
          }
        }
        tasklist.readyTasks.add(task.id)
      }
    }
  }

  function evaluateCondition(condition: string, outputs: Map<string, Record<string, any>>): boolean {
    try {
      const ctx = Object.fromEntries(outputs)
      const paramNames = Object.keys(ctx)
      const paramValues = Object.values(ctx)
      const fn = new Function(...paramNames, `return !!(${condition})`)
      return fn(...paramValues)
    } catch {
      return false
    }
  }

  /**
   * completeTaskAsync(tasklistId, taskId, fn) — Start async task completion.
   * Moves task from ready to running, executes fn in background.
   */
  function completeTaskAsyncFn(
    tasklistId: string,
    taskId: string,
    fn: () => Promise<Record<string, any>>,
  ): void {
    const tasklist = tasklistsState.tasklists.get(tasklistId)
    if (!tasklist) {
      throw new Error(`completeTaskAsync() called with unknown tasklist "${tasklistId}"`)
    }

    const task = tasklist.plan.tasks.find(t => t.id === taskId)
    if (!task) {
      throw new Error(`Unknown task id: ${taskId} in tasklist "${tasklistId}"`)
    }

    if (tasklist.completed.has(taskId)) {
      throw new Error(`Task "${taskId}" in tasklist "${tasklistId}" already completed`)
    }

    if (!tasklist.readyTasks.has(taskId)) {
      // Notify the host about the order violation with ready task details
      const readyTaskDetails = [...tasklist.readyTasks].map(readyId => {
        const readyTask = tasklist.plan.tasks.find(t => t.id === readyId)!
        return { id: readyId, instructions: readyTask.instructions, outputSchema: readyTask.outputSchema }
      })
      config.onTaskOrderViolation?.(tasklistId, taskId, readyTaskDetails)
      throw new Error(`Task "${taskId}" in tasklist "${tasklistId}" is not ready`)
    }

    // Move from ready to running
    tasklist.readyTasks.delete(taskId)
    tasklist.runningTasks.add(taskId)
    config.onTaskAsyncStart?.(tasklistId, taskId)

    const startTime = Date.now()

    // Spawn async work
    const promise = fn()
      .then((output) => {
        // Validate output against schema
        for (const [key, schema] of Object.entries(task.outputSchema)) {
          if (!(key in output)) {
            throw new Error(`Task "${taskId}" output missing required key: ${key}`)
          }
          const expectedType = (schema as any).type
          const value = output[key]
          const actual = Array.isArray(value) ? 'array' : typeof value
          if (actual !== expectedType) {
            throw new Error(
              `Task "${taskId}" output key "${key}": expected ${expectedType}, got ${actual}`
            )
          }
        }

        // Record completion
        tasklist.runningTasks.delete(taskId)
        tasklist.completed.set(taskId, {
          output,
          timestamp: Date.now(),
          status: 'completed',
          duration: Date.now() - startTime,
        })
        tasklist.outputs.set(taskId, output)

        // Store result for delivery via stop()
        asyncManager.setResult(`task:${taskId}`, output)

        recomputeReadyTasks(tasklist)
        renderSurface.updateTasklistProgress?.(tasklistId, tasklist)
        config.onTaskAsyncComplete?.(tasklistId, taskId, output)
      })
      .catch((err) => {
        const error = err instanceof Error ? err.message : String(err)
        tasklist.runningTasks.delete(taskId)
        tasklist.completed.set(taskId, {
          output: {},
          timestamp: Date.now(),
          status: 'failed',
          error,
          duration: Date.now() - startTime,
        })

        // Store error for delivery via stop()
        asyncManager.setResult(`task:${taskId}`, { error })

        // If optional, unblock dependents
        if (task.optional) {
          recomputeReadyTasks(tasklist)
        }

        renderSurface.updateTasklistProgress?.(tasklistId, tasklist)
        config.onTaskAsyncFailed?.(tasklistId, taskId, error)
      })

    // Don't block — fire and forget
  }

  /**
   * taskProgress(tasklistId, taskId, message, percent?) — Report progress on a task.
   */
  function taskProgressFn(
    tasklistId: string,
    taskId: string,
    message: string,
    percent?: number,
  ): void {
    const tasklist = tasklistsState.tasklists.get(tasklistId)
    if (!tasklist) {
      throw new Error(`taskProgress() called with unknown tasklist "${tasklistId}"`)
    }

    const task = tasklist.plan.tasks.find(t => t.id === taskId)
    if (!task) {
      throw new Error(`Unknown task id: ${taskId} in tasklist "${tasklistId}"`)
    }

    if (!tasklist.readyTasks.has(taskId) && !tasklist.runningTasks.has(taskId)) {
      throw new Error(`Task "${taskId}" in tasklist "${tasklistId}" is not in ready or running state`)
    }

    tasklist.progressMessages.set(taskId, { message, percent })
    renderSurface.updateTaskProgress?.(tasklistId, taskId, message, percent)
    config.onTaskProgress?.(tasklistId, taskId, message, percent)
  }

  /**
   * failTask(tasklistId, taskId, error) — Explicitly fail a task.
   */
  function failTaskFn(tasklistId: string, taskId: string, error: string): void {
    const tasklist = tasklistsState.tasklists.get(tasklistId)
    if (!tasklist) {
      throw new Error(`failTask() called with unknown tasklist "${tasklistId}"`)
    }

    const task = tasklist.plan.tasks.find(t => t.id === taskId)
    if (!task) {
      throw new Error(`Unknown task id: ${taskId} in tasklist "${tasklistId}"`)
    }

    // Can only fail tasks that are ready or running
    if (!tasklist.readyTasks.has(taskId) && !tasklist.runningTasks.has(taskId)) {
      throw new Error(`Task "${taskId}" in tasklist "${tasklistId}" is not in ready or running state`)
    }

    tasklist.readyTasks.delete(taskId)
    tasklist.runningTasks.delete(taskId)
    tasklist.completed.set(taskId, {
      output: {},
      timestamp: Date.now(),
      status: 'failed',
      error,
    })

    // If optional, unblock dependents
    if (task.optional) {
      recomputeReadyTasks(tasklist)
    }

    renderSurface.updateTasklistProgress?.(tasklistId, tasklist)
    config.onTaskFailed?.(tasklistId, taskId, error)
  }

  /**
   * retryTask(tasklistId, taskId) — Retry a failed task.
   */
  function retryTaskFn(tasklistId: string, taskId: string): void {
    const tasklist = tasklistsState.tasklists.get(tasklistId)
    if (!tasklist) {
      throw new Error(`retryTask() called with unknown tasklist "${tasklistId}"`)
    }

    const task = tasklist.plan.tasks.find(t => t.id === taskId)
    if (!task) {
      throw new Error(`Unknown task id: ${taskId} in tasklist "${tasklistId}"`)
    }

    const completion = tasklist.completed.get(taskId)
    if (!completion || completion.status !== 'failed') {
      throw new Error(`retryTask() can only retry failed tasks. Task "${taskId}" status: ${completion?.status ?? 'not completed'}`)
    }

    const maxRetries = config.maxTaskRetries ?? 3
    const currentRetries = tasklist.retryCount.get(taskId) ?? 0
    if (currentRetries >= maxRetries) {
      throw new Error(`Task "${taskId}" has exceeded maximum retries (${maxRetries})`)
    }

    tasklist.retryCount.set(taskId, currentRetries + 1)
    tasklist.completed.delete(taskId)
    tasklist.outputs.delete(taskId)
    tasklist.readyTasks.add(taskId)
    tasklist.progressMessages.delete(taskId)

    renderSurface.updateTasklistProgress?.(tasklistId, tasklist)
    config.onTaskRetried?.(tasklistId, taskId)
  }

  /**
   * sleep(seconds) — Pause execution for a duration (capped).
   */
  async function sleepFn(seconds: number): Promise<void> {
    const maxSeconds = config.sleepMaxSeconds ?? 30
    const capped = Math.min(Math.max(0, seconds), maxSeconds)
    await new Promise<void>(resolve => setTimeout(resolve, capped * 1000))
  }

  /**
   * loadKnowledge(selector) — Load knowledge files from the space's knowledge base.
   * The selector mirrors the file tree: { domain: { field: { option: true } } }
   * Returns the same structure with markdown content as values.
   */
  function loadKnowledgeFn(selector: KnowledgeSelector): KnowledgeContent {
    if (!selector || typeof selector !== 'object') {
      throw new Error('loadKnowledge() requires a selector object: { spaceName: { domain: { field: { option: true } } } }')
    }
    if (!config.onLoadKnowledge) {
      throw new Error('loadKnowledge() is not available — no space loaded')
    }
    return tagAsKnowledge(config.onLoadKnowledge(selector))
  }

  // ── loadClass state ──
  const loadedClasses = new Set<string>()

  /**
   * loadClass(className) — Synchronously load a class's methods into the sandbox.
   * Non-blocking. Call stop() afterwards to see the expanded methods in the prompt.
   * No-op if the class is already loaded.
   */
  function loadClassFn(className: string): void {
    if (typeof className !== 'string' || !className) {
      throw new Error('loadClass() requires a class name string')
    }

    // Already loaded — no-op
    if (loadedClasses.has(className)) return

    if (!config.getClassInfo) {
      throw new Error('loadClass() is not available — no classes exported')
    }

    // Validate class exists
    const result = config.getClassInfo(className)
    if (!result) {
      throw new Error(`Unknown class: "${className}"`)
    }

    loadedClasses.add(className)

    // Instantiate, bind, inject into sandbox
    config.onLoadClass?.(className)
  }

  /**
   * askParent(message, schema) — Ask the parent agent for structured input.
   * Only available to child agents spawned via agent namespaces.
   * Fire-and-forget agents (not tracked) get { _noParent: true }.
   */
  async function askParentFn(
    message: string,
    schema: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    if (typeof message !== 'string' || !message) {
      throw new Error('askParent() requires a message string as first argument')
    }
    if (config.isFireAndForget || !config.onAskParent) {
      return { _noParent: true }
    }
    pauseController.pause()
    try {
      const result = await Promise.race([
        config.onAskParent({ message, schema }),
        new Promise<Record<string, unknown>>((resolve) =>
          setTimeout(() => resolve({ _timeout: true }), askTimeout),
        ),
      ])
      return result
    } finally {
      pauseController.resume()
    }
  }

  /**
   * respond(agentPromise, data) — Answer a child agent's pending askParent() call.
   * The first argument is the variable holding the agent promise.
   */
  function respondFn(promise: unknown, data: Record<string, unknown>): void {
    if (!config.onRespond) throw new Error('respond() is not available')
    if (!data || typeof data !== 'object') {
      throw new Error('respond() requires a data object as second argument')
    }
    config.onRespond(promise, data)
  }

  /**
   * trace() — Returns execution profiling snapshot.
   */
  function traceFn(): TraceSnapshot {
    if (!config.onTrace) {
      return {
        turns: 0, llmCalls: 0, llmTokens: { input: 0, output: 0, total: 0 },
        estimatedCost: '$0.00', asyncTasks: { completed: 0, failed: 0, running: 0 },
        scopeSize: 0, pinnedCount: pinnedMemory.size, memoCount: memoMemory.size,
        sessionDurationMs: 0,
      }
    }
    return config.onTrace()
  }

  /**
   * learn(topic, insight, tags?) — Persist a learning for cross-session memory.
   * Writes to the knowledge base's memory domain so it's available in future sessions.
   */
  async function learnFn(topic: string, insight: string, tags?: string[]): Promise<void> {
    if (!config.onLearn) {
      throw new Error('learn: knowledge persistence not available')
    }
    return config.onLearn(topic, insight, tags)
  }

  /**
   * critique(output, criteria, context?) — Quality gate via LLM evaluation.
   * Returns pass/fail, scores per criterion, issues, and suggestions.
   */
  async function critiqueFn(
    output: string,
    criteria: string[],
    context?: string,
  ): Promise<CritiqueResult> {
    if (!config.onCritique) {
      throw new Error('critique: LLM critique not available')
    }
    return config.onCritique(output, criteria, context)
  }

  /**
   * plan(goal, constraints?) — LLM-powered task decomposition.
   * Returns a structured task plan from a natural language goal.
   */
  async function planFn(
    goal: string,
    constraints?: string[],
  ): Promise<Array<{ id: string; instructions: string; dependsOn?: string[] }>> {
    if (!config.onPlan) {
      throw new Error('plan: LLM planning not available')
    }
    return config.onPlan(goal, constraints)
  }

  /**
   * parallel(tasks, options?) — Run multiple async functions concurrently with fan-out/fan-in.
   * Returns an array of { label, ok, result?, error?, durationMs } for each task.
   * Max 10 concurrent tasks, default 30s timeout per task.
   */
  async function parallelFn(
    tasks: Array<{ label: string; fn: () => unknown }>,
    options?: { timeout?: number; failFast?: boolean },
  ): Promise<Array<{ label: string; ok: boolean; result?: unknown; error?: string; durationMs: number }>> {
    if (tasks.length === 0) return []
    if (tasks.length > 10) throw new Error('parallel: max 10 concurrent tasks')
    const timeout = Math.min(options?.timeout ?? 30000, 60000)
    const failFast = options?.failFast ?? false

    const controller = failFast ? new AbortController() : null

    const results = await Promise.allSettled(
      tasks.map(async (task) => {
        const start = Date.now()
        try {
          const result = await Promise.race([
            Promise.resolve(task.fn()),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), timeout)
            ),
            ...(controller ? [new Promise((_, reject) => {
              controller.signal.addEventListener('abort', () => reject(new Error('fail-fast abort')))
            })] : []),
          ])
          return { label: task.label, ok: true as const, result, durationMs: Date.now() - start }
        } catch (err: any) {
          if (failFast && controller && !controller.signal.aborted) {
            controller.abort()
          }
          return { label: task.label, ok: false as const, error: err?.message ?? String(err), durationMs: Date.now() - start }
        }
      }),
    )

    return results.map((r) =>
      r.status === 'fulfilled' ? r.value : { label: '?', ok: false, error: r.reason?.message ?? 'unknown', durationMs: 0 },
    )
  }

  /**
   * checkpoint(id) — Save a named snapshot of the current sandbox scope.
   * Max 5 checkpoints. Returns the checkpoint ID.
   */
  function checkpointFn(id: string): string {
    if (checkpoints.size >= 5) {
      // Evict the oldest checkpoint
      const oldestKey = checkpoints.keys().next().value!
      checkpoints.delete(oldestKey)
    }
    if (!config.onCheckpoint) {
      throw new Error('checkpoint: sandbox snapshotting not available')
    }
    const snap = config.onCheckpoint()
    checkpoints.set(id, {
      id,
      timestamp: Date.now(),
      scopeSnapshot: snap.values,
      declaredNames: snap.declaredNames,
    })
    return id
  }

  /**
   * rollback(id) — Restore the sandbox scope from a named checkpoint.
   * The checkpoint is preserved (can be rolled back to again).
   */
  function rollbackFn(id: string): void {
    const cp = checkpoints.get(id)
    if (!cp) {
      throw new Error(`rollback: no checkpoint named "${id}" — available: [${[...checkpoints.keys()].join(', ')}]`)
    }
    if (!config.onRollback) {
      throw new Error('rollback: sandbox restoration not available')
    }
    config.onRollback({
      values: cp.scopeSnapshot,
      declaredNames: cp.declaredNames,
    })
  }

  /**
   * guard(condition, message) — Runtime assertion. Throws GuardError if condition is false.
   */
  function guardFn(condition: unknown, message: string): void {
    if (!condition) {
      const err = new Error(message)
      err.name = 'GuardError'
      throw err
    }
  }

  /**
   * focus(...sections) — Control which system prompt sections are expanded.
   * Sections: 'functions', 'knowledge', 'components', 'classes', 'agents'.
   * Call focus('all') to reset to full expansion.
   * Collapsed sections show a one-line summary instead of full content.
   */
  function focusFn(...sections: string[]): void {
    if (sections.length === 0 || (sections.length === 1 && sections[0] === 'all')) {
      focusSections = null
      return
    }
    const valid = new Set(['functions', 'knowledge', 'components', 'classes', 'agents'])
    for (const s of sections) {
      if (!valid.has(s)) {
        throw new Error(`focus() unknown section: "${s}". Valid: ${[...valid].join(', ')}, or 'all'`)
      }
    }
    focusSections = new Set(sections)
  }

  /**
   * fork({ task, context?, outputSchema?, maxTurns? }) — Lightweight sub-agent.
   * Runs a focused sub-reasoning task in an isolated context. Only the final
   * output enters your context — the child's full reasoning stays separate.
   */
  async function forkFn(request: ForkRequest): Promise<ForkResult> {
    if (!request || typeof request !== 'object' || !request.task) {
      throw new Error('fork() requires { task: string, context?: object, outputSchema?: object, maxTurns?: number }')
    }
    if (!config.onFork) {
      throw new Error('fork() is not available — no fork handler configured')
    }
    return config.onFork(request)
  }

  /**
   * compress(data, options?) — Compress large data via an LLM call.
   * Returns a token-efficient summary preserving specified keys.
   */
  async function compressFn(
    data: unknown,
    options?: CompressOptions,
  ): Promise<string> {
    const dataStr = typeof data === 'string'
      ? data
      : JSON.stringify(data, null, 2)
    if (!dataStr || dataStr.length < 100) {
      return dataStr // Too small to compress
    }
    if (!config.onCompress) {
      // Fallback: simple truncation
      const maxLen = (options?.maxTokens ?? 200) * 4
      if (dataStr.length <= maxLen) return dataStr
      return dataStr.slice(0, maxLen) + '\n...(truncated)'
    }
    return config.onCompress(dataStr, options ?? {})
  }

  /**
   * speculate(branches, options?) — Run multiple approaches in parallel.
   * Each branch runs its function concurrently. Returns all results so
   * the agent can pick the winner. Branches that throw are captured as errors.
   */
  async function speculateFn(
    branches: Array<{ label: string; fn: () => unknown }>,
    options?: { timeout?: number },
  ): Promise<SpeculateResult> {
    if (!Array.isArray(branches) || branches.length === 0) {
      throw new Error('speculate() requires a non-empty array of branches')
    }
    if (branches.length > 5) {
      throw new Error('speculate() supports max 5 branches')
    }
    const timeout = options?.timeout ?? 10_000

    // If no external handler, run branches in-process concurrently
    if (config.onSpeculate) {
      return config.onSpeculate(branches, timeout)
    }

    // Default: run all branches concurrently with timeout
    const results: SpeculateBranchResult[] = await Promise.all(
      branches.map(async (branch) => {
        const start = Date.now()
        try {
          const result = await Promise.race([
            Promise.resolve().then(() => branch.fn()),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Branch timed out')), timeout)
            ),
          ])
          return {
            label: branch.label,
            ok: true,
            result,
            durationMs: Date.now() - start,
          }
        } catch (err: any) {
          return {
            label: branch.label,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - start,
          }
        }
      }),
    )

    return { results }
  }

  /**
   * reflect(request) — Trigger a separate LLM call for self-evaluation.
   * Returns an assessment, scores per criterion, suggestions, and a shouldPivot flag.
   */
  async function reflectFn(request: ReflectRequest): Promise<ReflectResult> {
    if (!request || typeof request !== 'object' || !request.question) {
      throw new Error('reflect() requires { question: string, context?: object, criteria?: string[] }')
    }
    if (!config.onReflect) {
      throw new Error('reflect() is not available — no reflection model configured')
    }
    return config.onReflect(request)
  }

  /**
   * pin(key, value) — Pin a value to persistent memory that survives decay.
   * Pinned values appear in a {{PINNED}} block in the system prompt.
   * Max 10 pins, total budget ~2000 tokens.
   */
  function pinFn(key: string, value: unknown): void {
    if (typeof key !== 'string' || !key) {
      throw new Error('pin() requires a non-empty string key as first argument')
    }
    if (pinnedMemory.size >= 10 && !pinnedMemory.has(key)) {
      throw new Error('pin() limit reached (max 10 pins). Unpin an existing key first.')
    }
    const display = serialize(value, {
      maxStringLength: 500,
      maxArrayElements: 20,
      maxObjectKeys: 10,
      maxDepth: 3,
    })
    pinnedMemory.set(key, { value, display, turn: pinTurnCounter })
  }

  /**
   * unpin(key) — Remove a pinned value from persistent memory.
   */
  function unpinFn(key: string): void {
    if (typeof key !== 'string' || !key) {
      throw new Error('unpin() requires a non-empty string key')
    }
    pinnedMemory.delete(key)
  }

  /**
   * memo(key) — Read a memo. memo(key, text) — Write a memo. memo(key, null) — Delete.
   * Memos are agent-authored compressed notes (max 500 chars each, max 20 memos).
   * They appear in a {{MEMO}} block in the system prompt.
   */
  function memoFn(key: string, value?: string | null): string | undefined {
    if (typeof key !== 'string' || !key) {
      throw new Error('memo() requires a non-empty string key')
    }
    // Read mode
    if (arguments.length === 1) {
      return memoMemory.get(key)
    }
    // Delete mode
    if (value === null) {
      memoMemory.delete(key)
      return undefined
    }
    // Write mode
    if (typeof value !== 'string') {
      throw new Error('memo() value must be a string or null')
    }
    if (value.length > 500) {
      throw new Error(`memo() value exceeds 500 char limit (got ${value.length}). Compress further.`)
    }
    if (memoMemory.size >= 20 && !memoMemory.has(key)) {
      throw new Error('memo() limit reached (max 20 memos). Delete an existing memo first.')
    }
    memoMemory.set(key, value)
    return value
  }

  /**
   * contextBudget() — Returns a snapshot of the agent's context window budget.
   * Lets the agent make informed decisions about knowledge loading, memo usage, etc.
   */
  function contextBudgetFn(): ContextBudgetSnapshot {
    if (!config.onContextBudget) {
      return {
        totalTokens: 100_000,
        usedTokens: 0,
        remainingTokens: 100_000,
        systemPromptTokens: 0,
        messageHistoryTokens: 0,
        turnNumber: 0,
        decayLevel: { stops: 'full', knowledge: 'full' },
        recommendation: 'nominal',
      }
    }
    return config.onContextBudget()
  }

  return {
    stop: stopFn,
    display: displayFn,
    ask: askFn,
    async: asyncFn,
    tasklist: tasklistFn,
    completeTask: completeTaskFn,
    completeTaskAsync: completeTaskAsyncFn,
    taskProgress: taskProgressFn,
    failTask: failTaskFn,
    retryTask: retryTaskFn,
    sleep: sleepFn,
    loadKnowledge: loadKnowledgeFn,
    loadClass: loadClassFn,
    askParent: askParentFn,
    respond: respondFn,
    contextBudget: contextBudgetFn,
    pin: pinFn,
    unpin: unpinFn,
    memo: memoFn,
    reflect: reflectFn,
    speculate: speculateFn,
    compress: compressFn,
    fork: forkFn,
    focus: focusFn,
    guard: guardFn,
    trace: traceFn,
    checkpoint: checkpointFn,
    rollback: rollbackFn,
    parallel: parallelFn,
    plan: planFn,
    critique: critiqueFn,
    learn: learnFn,
    setCurrentSource,
    resolveStop,
    getTasklistsState: () => tasklistsState,
    getPinnedMemory: () => pinnedMemory,
    getMemoMemory: () => memoMemory,
    getFocusSections: () => focusSections,
    setPinTurn: (turn: number) => { pinTurnCounter = turn },
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
