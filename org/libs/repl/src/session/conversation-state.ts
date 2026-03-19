import type {
  SessionStatus,
  SessionEvent,
  ScopeEntry,
  StopPayload,
  ErrorPayload,
  TasklistsState,
  TaskCompletion,
  Tasklist,
  TaskDefinition,
} from './types'

// ── Turn Boundary ──

export type TurnBoundary =
  | { type: 'stop'; payload: Record<string, { display: string; type: string }> }
  | { type: 'error'; error: { type: string; message: string; line: number; source: string } }
  | { type: 'intervention'; text: string }
  | { type: 'hook_interrupt'; hookId: string; message: string }
  | { type: 'tasklist_reminder'; tasklistId: string; ready: string[]; blocked: string[]; failed: string[] }
  | { type: 'completion' }

// ── Scope Delta ──

export interface ScopeDelta {
  added: ScopeEntry[]
  changed: Array<ScopeEntry & { previousValue: string; previousType: string }>
  removed: string[]
}

// ── Turn Events (slimmed-down SessionEvent subset) ──

export type TurnEvent =
  | { type: 'display'; componentId: string }
  | { type: 'ask_start'; formId: string }
  | { type: 'ask_end'; formId: string }
  | { type: 'async_start'; taskId: string; label: string }
  | { type: 'async_complete'; taskId: string }
  | { type: 'async_failed'; taskId: string; error: string }
  | { type: 'async_cancelled'; taskId: string }
  | { type: 'tasklist_declared'; tasklistId: string; description: string; taskCount: number }
  | { type: 'task_complete'; tasklistId: string; taskId: string }
  | { type: 'task_failed'; tasklistId: string; taskId: string; error: string }
  | { type: 'task_retried'; tasklistId: string; taskId: string }
  | { type: 'task_skipped'; tasklistId: string; taskId: string; reason: string }
  | { type: 'task_progress'; tasklistId: string; taskId: string; message: string; percent?: number }
  | { type: 'knowledge_loaded'; domains: string[] }
  | { type: 'class_loaded'; className: string; methods: string[] }
  | { type: 'hook'; hookId: string; action: string }

// ── Conversation Turn ──

export interface ConversationTurn {
  /** Monotonically increasing turn index (0-based) */
  index: number
  /** Timestamp when the turn started */
  startedAt: number
  /** Timestamp when the turn boundary was hit */
  endedAt: number
  /** Role of this turn */
  role: 'assistant' | 'user' | 'system'
  /** For assistant turns: the code lines written */
  code: string[] | null
  /** For user turns: the message text */
  message: string | null
  /** What caused this turn to end (null for user turns) */
  boundary: TurnBoundary | null
  /** Scope snapshot after this turn */
  scopeSnapshot: ScopeEntry[]
  /** Scope delta compared to the previous turn */
  scopeDelta: ScopeDelta | null
  /** Events that occurred during this turn */
  events: TurnEvent[]
}

// ── Serializable Tasklist State ──

export interface SerializedTaskCompletion {
  output: Record<string, any>
  timestamp: number
  status: 'completed' | 'failed' | 'skipped'
  error?: string
  duration?: number
}

export interface SerializedTasklistState {
  plan: {
    tasklistId: string
    description: string
    tasks: TaskDefinition[]
  }
  completed: Record<string, SerializedTaskCompletion>
  readyTasks: string[]
  runningTasks: string[]
  outputs: Record<string, Record<string, any>>
  progressMessages: Record<string, { message: string; percent?: number }>
  retryCount: Record<string, number>
}

export interface SerializedTasklistsState {
  tasklists: Record<string, SerializedTasklistState>
}

// ── Root Conversation State ──

export interface ConversationState {
  /** Session start timestamp */
  startedAt: number
  /** All turns in chronological order */
  turns: ConversationTurn[]
  /** Current tasklist state (serializable) */
  tasklists: SerializedTasklistsState
  /** Total stop calls so far */
  stopCount: number
  /** Current session status */
  status: SessionStatus
}

// ── Utilities ──

/**
 * Compute what changed in scope between two snapshots.
 */
export function computeScopeDelta(
  previous: ScopeEntry[],
  current: ScopeEntry[],
): ScopeDelta {
  const prevMap = new Map<string, ScopeEntry>()
  for (const entry of previous) prevMap.set(entry.name, entry)

  const currMap = new Map<string, ScopeEntry>()
  for (const entry of current) currMap.set(entry.name, entry)

  const added: ScopeEntry[] = []
  const changed: Array<ScopeEntry & { previousValue: string; previousType: string }> = []

  for (const entry of current) {
    const prev = prevMap.get(entry.name)
    if (!prev) {
      added.push(entry)
    } else if (prev.type !== entry.type || prev.value !== entry.value) {
      changed.push({
        ...entry,
        previousValue: prev.value,
        previousType: prev.type,
      })
    }
  }

  const removed: string[] = []
  for (const entry of previous) {
    if (!currMap.has(entry.name)) {
      removed.push(entry.name)
    }
  }

  return { added, changed, removed }
}

/**
 * Convert TasklistsState (Map/Set) to a plain JSON-serializable object.
 */
export function serializeTasklistsState(state: TasklistsState): SerializedTasklistsState {
  const tasklists: Record<string, SerializedTasklistState> = {}
  for (const [id, tl] of state.tasklists) {
    tasklists[id] = {
      plan: {
        tasklistId: tl.plan.tasklistId,
        description: tl.plan.description,
        tasks: tl.plan.tasks,
      },
      completed: Object.fromEntries(tl.completed),
      readyTasks: [...tl.readyTasks],
      runningTasks: [...tl.runningTasks],
      outputs: Object.fromEntries(tl.outputs),
      progressMessages: Object.fromEntries(tl.progressMessages),
      retryCount: Object.fromEntries(tl.retryCount),
    }
  }
  return { tasklists }
}

// ── Conversation Recorder ──

/**
 * Builds a serializable ConversationState incrementally at each turn boundary.
 */
export class ConversationRecorder {
  private state: ConversationState
  private previousScope: ScopeEntry[] = []
  private pendingEvents: TurnEvent[] = []
  private currentTurnStartedAt: number

  constructor() {
    const now = Date.now()
    this.state = {
      startedAt: now,
      turns: [],
      tasklists: { tasklists: {} },
      stopCount: 0,
      status: 'idle',
    }
    this.currentTurnStartedAt = now
  }

  /** Record an assistant turn ending at a stop boundary. */
  recordStop(
    code: string[],
    payload: StopPayload,
    scope: ScopeEntry[],
    tasklists: TasklistsState,
  ): void {
    const stopPayload: Record<string, { display: string; type: string }> = {}
    for (const [key, sv] of Object.entries(payload)) {
      stopPayload[key] = { display: sv.display, type: typeof sv.value }
    }

    this.state.stopCount++
    this.pushTurn({
      role: 'assistant',
      code,
      message: null,
      boundary: { type: 'stop', payload: stopPayload },
      scope,
    })
    this.state.tasklists = serializeTasklistsState(tasklists)
  }

  /** Record an assistant turn ending at an error boundary. */
  recordError(
    code: string[],
    error: ErrorPayload,
    scope: ScopeEntry[],
  ): void {
    this.pushTurn({
      role: 'assistant',
      code,
      message: null,
      boundary: {
        type: 'error',
        error: {
          type: error.type,
          message: error.message,
          line: error.line,
          source: error.source,
        },
      },
      scope,
    })
  }

  /** Record an assistant turn ending at an intervention boundary. */
  recordIntervention(
    code: string[],
    text: string,
    scope: ScopeEntry[],
  ): void {
    this.pushTurn({
      role: 'assistant',
      code,
      message: null,
      boundary: { type: 'intervention', text },
      scope,
    })
  }

  /** Record an assistant turn ending at a tasklist reminder boundary. */
  recordTasklistReminder(
    code: string[],
    tasklistId: string,
    ready: string[],
    blocked: string[],
    failed: string[],
    scope: ScopeEntry[],
    tasklists: TasklistsState,
  ): void {
    this.pushTurn({
      role: 'assistant',
      code,
      message: null,
      boundary: { type: 'tasklist_reminder', tasklistId, ready, blocked, failed },
      scope,
    })
    this.state.tasklists = serializeTasklistsState(tasklists)
  }

  /** Record session completion. */
  recordCompletion(
    code: string[],
    scope: ScopeEntry[],
    tasklists: TasklistsState,
    status: SessionStatus,
  ): void {
    this.pushTurn({
      role: 'assistant',
      code,
      message: null,
      boundary: { type: 'completion' },
      scope,
    })
    this.state.tasklists = serializeTasklistsState(tasklists)
    this.state.status = status
  }

  /** Record a user message turn. */
  recordUserMessage(text: string, scope: ScopeEntry[]): void {
    this.pushTurn({
      role: 'user',
      code: null,
      message: text,
      boundary: null,
      scope,
    })
  }

  /** Accumulate a session event (filtered to TurnEvent subset). */
  recordEvent(event: SessionEvent): void {
    const turnEvent = toTurnEvent(event)
    if (turnEvent) this.pendingEvents.push(turnEvent)
    if (event.type === 'status') {
      this.state.status = event.status
    }
  }

  /** Update session status. */
  updateStatus(status: SessionStatus): void {
    this.state.status = status
  }

  /** Get the current full conversation state (returns a shallow copy). */
  getState(): ConversationState {
    return {
      ...this.state,
      turns: [...this.state.turns],
    }
  }

  private pushTurn(opts: {
    role: 'assistant' | 'user' | 'system'
    code: string[] | null
    message: string | null
    boundary: TurnBoundary | null
    scope: ScopeEntry[]
  }): void {
    const now = Date.now()
    const scopeSnapshot = [...opts.scope]
    const scopeDelta = this.state.turns.length > 0
      ? computeScopeDelta(this.previousScope, opts.scope)
      : opts.scope.length > 0
        ? { added: [...opts.scope], changed: [], removed: [] }
        : null

    this.state.turns.push({
      index: this.state.turns.length,
      startedAt: this.currentTurnStartedAt,
      endedAt: now,
      role: opts.role,
      code: opts.code ? [...opts.code] : null,
      message: opts.message,
      boundary: opts.boundary,
      scopeSnapshot,
      scopeDelta,
      events: this.pendingEvents.splice(0),
    })

    this.previousScope = scopeSnapshot
    this.currentTurnStartedAt = now
  }
}

// ── Event Conversion ──

function toTurnEvent(event: SessionEvent): TurnEvent | null {
  switch (event.type) {
    case 'display':
      return { type: 'display', componentId: event.componentId }
    case 'ask_start':
      return { type: 'ask_start', formId: event.formId }
    case 'ask_end':
      return { type: 'ask_end', formId: event.formId }
    case 'async_start':
      return { type: 'async_start', taskId: event.taskId, label: event.label }
    case 'async_complete':
      return { type: 'async_complete', taskId: event.taskId }
    case 'async_failed':
      return { type: 'async_failed', taskId: event.taskId, error: event.error }
    case 'async_cancelled':
      return { type: 'async_cancelled', taskId: event.taskId }
    case 'tasklist_declared':
      return {
        type: 'tasklist_declared',
        tasklistId: event.tasklistId,
        description: event.plan.description,
        taskCount: event.plan.tasks.length,
      }
    case 'task_complete':
      return { type: 'task_complete', tasklistId: event.tasklistId, taskId: event.id }
    case 'task_failed':
      return { type: 'task_failed', tasklistId: event.tasklistId, taskId: event.id, error: event.error }
    case 'task_retried':
      return { type: 'task_retried', tasklistId: event.tasklistId, taskId: event.id }
    case 'task_skipped':
      return { type: 'task_skipped', tasklistId: event.tasklistId, taskId: event.id, reason: event.reason }
    case 'task_progress':
      return { type: 'task_progress', tasklistId: event.tasklistId, taskId: event.id, message: event.message, percent: event.percent }
    case 'knowledge_loaded':
      return { type: 'knowledge_loaded', domains: event.domains }
    case 'class_loaded':
      return { type: 'class_loaded', className: event.className, methods: event.methods }
    case 'hook':
      return { type: 'hook', hookId: event.hookId, action: event.action }
    default:
      return null
  }
}
