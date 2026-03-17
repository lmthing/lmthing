import type { StreamPauseController, RenderSurface, StopPayload, SerializedValue, Tasklist, TasklistsState, TasklistState, ClassMethodInfo } from '../session/types'
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
  onLoadKnowledge?: (selector: KnowledgeSelector) => KnowledgeContent
  /** Validate a class name and return its methods (no side effects). */
  getClassInfo?: (className: string) => { methods: ClassMethodInfo[] } | null
  /** Signal that loadClass was called — emits events, injects bindings. Called after pause. */
  onLoadClass?: (className: string) => void
}

/**
 * Create the six global functions: stop, display, ask, async, tasklist, completeTask.
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

    const plan: Tasklist = { tasklistId, description, tasks }
    const tasklistState: TasklistState = {
      plan,
      completed: new Map(),
      currentIndex: 0,
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

    const taskIndex = tasklist.plan.tasks.findIndex(t => t.id === id)
    if (taskIndex === -1) {
      throw new Error(`Unknown task id: ${id} in tasklist "${tasklistId}"`)
    }

    if (tasklist.completed.has(id)) {
      throw new Error(`Task "${id}" in tasklist "${tasklistId}" already completed`)
    }

    if (taskIndex !== tasklist.currentIndex) {
      const expected = tasklist.plan.tasks[tasklist.currentIndex]
      throw new Error(
        `Task "${id}" in tasklist "${tasklistId}" called out of order. Expected: "${expected.id}"`
      )
    }

    // Validate output against schema
    const task = tasklist.plan.tasks[taskIndex]
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

    tasklist.completed.set(id, {
      output,
      timestamp: Date.now(),
    })
    tasklist.currentIndex++

    renderSurface.updateTasklistProgress?.(tasklistId, tasklist)
    config.onTaskComplete?.(tasklistId, id, output)
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

  return {
    stop: stopFn,
    display: displayFn,
    ask: askFn,
    async: asyncFn,
    tasklist: tasklistFn,
    completeTask: completeTaskFn,
    loadKnowledge: loadKnowledgeFn,
    loadClass: loadClassFn,
    setCurrentSource,
    resolveStop,
    getTasklistsState: () => tasklistsState,
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
