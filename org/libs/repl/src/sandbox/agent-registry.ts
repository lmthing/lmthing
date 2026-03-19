import type { AgentPromiseEntry, AgentSnapshot, AgentStatus } from '../session/types'
import type { Session } from '../session/session'

export interface AgentRegistryConfig {
  onRegistered?: (varName: string, label: string) => void
  onResolved?: (varName: string) => void
  onFailed?: (varName: string, error: string) => void
  onQuestionAsked?: (varName: string, question: { message: string; schema: Record<string, unknown> }) => void
  onQuestionAnswered?: (varName: string) => void
}

export class AgentRegistry {
  private entries = new Map<string, AgentPromiseEntry>()
  private questionResolvers = new Map<string, (data: Record<string, unknown>) => void>()
  private currentTurn = 0
  private config: AgentRegistryConfig

  constructor(config: AgentRegistryConfig = {}) {
    this.config = config
  }

  register(
    varName: string,
    promise: Promise<unknown>,
    label: string,
    childSession: Session | null,
  ): void {
    const entry: AgentPromiseEntry = {
      varName,
      label,
      status: 'running',
      promise,
      childSession,
      registeredAt: Date.now(),
      registeredTurn: this.currentTurn,
      pendingQuestion: null,
    }
    this.entries.set(varName, entry)

    // Auto-resolve/fail when promise settles
    promise.then(
      (value) => this.resolve(varName, value),
      (err) => {
        const error = err instanceof Error ? err.message : String(err)
        this.fail(varName, error)
      },
    )

    this.config.onRegistered?.(varName, label)
  }

  resolve(varName: string, value: unknown): void {
    const entry = this.entries.get(varName)
    if (!entry) return
    entry.status = 'resolved'
    entry.resolvedValue = value
    entry.completedAt = Date.now()
    this.config.onResolved?.(varName)
  }

  fail(varName: string, error: string): void {
    const entry = this.entries.get(varName)
    if (!entry) return
    entry.status = 'failed'
    entry.error = error
    entry.completedAt = Date.now()
    this.config.onFailed?.(varName, error)
  }

  getAll(): AgentPromiseEntry[] {
    return [...this.entries.values()]
  }

  getPending(): AgentPromiseEntry[] {
    return [...this.entries.values()].filter(
      (e) => e.status === 'running' || e.status === 'waiting',
    )
  }

  getSnapshot(varName: string): AgentSnapshot | null {
    const entry = this.entries.get(varName)
    if (!entry) return null

    let tasklistsState = null
    if (entry.childSession) {
      try {
        tasklistsState = entry.childSession.snapshot().tasklistsState
      } catch {
        // Child session may be destroyed
      }
    }

    return {
      varName: entry.varName,
      label: entry.label,
      status: entry.status,
      tasklistsState,
      pendingQuestion: entry.pendingQuestion ?? null,
      error: entry.error,
    }
  }

  getAllSnapshots(): AgentSnapshot[] {
    return [...this.entries.keys()]
      .map((varName) => this.getSnapshot(varName)!)
      .filter(Boolean)
  }

  findByPromise(promise: unknown): AgentPromiseEntry | null {
    for (const entry of this.entries.values()) {
      if (entry.promise === promise) return entry
    }
    return null
  }

  advanceTurn(): void {
    this.currentTurn++
  }

  getCurrentTurn(): number {
    return this.currentTurn
  }

  hasEntries(): boolean {
    return this.entries.size > 0
  }

  hasVisibleEntries(): boolean {
    for (const entry of this.entries.values()) {
      if (entry.status === 'running' || entry.status === 'waiting') return true
      // Completed within 5 turns
      if (entry.completedAt != null) {
        const turnsSinceCompletion = this.currentTurn - entry.registeredTurn
        if (turnsSinceCompletion <= 5) return true
      }
    }
    return false
  }

  /**
   * Low-level setter — updates entry status and question fields.
   * Prefer askQuestion() for the full flow (sets question + returns Promise).
   */
  setPendingQuestion(
    varName: string,
    question: { message: string; schema: Record<string, unknown> },
  ): void {
    const entry = this.entries.get(varName)
    if (!entry) throw new Error(`setPendingQuestion: unknown agent "${varName}"`)
    entry.pendingQuestion = question
    entry.status = 'waiting'
  }

  /**
   * Ask a question on behalf of a child agent. Sets status to 'waiting',
   * stores the question, and returns a Promise that resolves when the
   * parent calls respond().
   */
  askQuestion(
    varName: string,
    question: { message: string; schema: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    const entry = this.entries.get(varName)
    if (!entry) throw new Error(`askQuestion: unknown agent "${varName}"`)
    entry.pendingQuestion = question
    entry.status = 'waiting'
    this.config.onQuestionAsked?.(varName, question)
    return new Promise<Record<string, unknown>>((resolve) => {
      this.questionResolvers.set(varName, resolve)
    })
  }

  /**
   * Deliver structured input to a child agent's pending askParent() call.
   * Resolves the Promise returned by askQuestion(), clears the pending
   * question, and sets the agent back to 'running'.
   */
  respond(varName: string, data: Record<string, unknown>): void {
    const entry = this.entries.get(varName)
    if (!entry) throw new Error(`respond: unknown agent "${varName}"`)
    if (entry.status !== 'waiting') {
      throw new Error(`respond: agent "${varName}" is not waiting for input (status: ${entry.status})`)
    }
    const resolver = this.questionResolvers.get(varName)
    if (!resolver) throw new Error(`respond: no pending question for agent "${varName}"`)
    entry.pendingQuestion = null
    entry.status = 'running'
    this.questionResolvers.delete(varName)
    resolver(data)
    this.config.onQuestionAnswered?.(varName)
  }

  destroy(): void {
    this.entries.clear()
    this.questionResolvers.clear()
  }
}
