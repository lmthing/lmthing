import type { ReactElement } from 'react'

// ── Agent Spawn ──

export interface AgentSpawnOptions {
  context: "empty" | "branch";
}

export interface AgentSpawnConfig {
  spaceDir: string;
  spaceName: string;
  agentSlug: string;
  actionId: string;
  request: string;
  params: Record<string, any>;
  options: AgentSpawnOptions;
  /** Internal: links spawn to registry entry for Phase 1e child-to-parent questions. */
  _originPromise?: unknown;
}

export interface AgentSpawnResult {
  scope: Record<string, any>;
  result: any;
  keyFiles?: string[];
  issues?: string[];
}

// ── Serialization ──

export interface SerializedValue {
  value: unknown
  display: string
}

// ── Payloads ──

export interface StopPayload {
  [argNameOrExpression: string]: SerializedValue
}

export interface ErrorPayload {
  type: string
  message: string
  line: number
  source: string
}

export interface AsyncCancellation {
  cancelled: true
  message: string
}

export interface AskCancellation {
  _cancelled: true
}

// ── Class Discovery ──

export interface ClassMethodInfo {
  name: string
  description: string
  signature: string
}

// ── Tasklists ──

export interface TaskDefinition {
  id: string
  instructions: string
  outputSchema: Record<string, { type: string }>
  dependsOn?: string[]
  condition?: string
  optional?: boolean
}

export type TaskStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped'

export interface Tasklist {
  tasklistId: string
  description: string
  tasks: TaskDefinition[]
}

export interface TaskCompletion {
  output: Record<string, any>
  timestamp: number
  status: 'completed' | 'failed' | 'skipped'
  error?: string
  duration?: number
}

export interface TasklistState {
  plan: Tasklist
  completed: Map<string, TaskCompletion>
  readyTasks: Set<string>
  runningTasks: Set<string>
  outputs: Map<string, Record<string, any>>
  progressMessages: Map<string, { message: string; percent?: number }>
  retryCount: Map<string, number>
}

export interface TasklistsState {
  tasklists: Map<string, TasklistState>
}

// ── Agent Registry ──

export type AgentStatus = 'running' | 'waiting' | 'resolved' | 'failed'

export interface AgentPromiseEntry {
  varName: string
  label: string
  status: AgentStatus
  promise: Promise<unknown>
  childSession: import('../session/session').Session | null
  resolvedValue?: unknown
  error?: string
  registeredAt: number
  completedAt?: number
  registeredTurn: number
  pendingQuestion?: { message: string; schema: Record<string, unknown> } | null
}

export interface AgentSnapshot {
  varName: string
  label: string
  status: AgentStatus
  tasklistsState: TasklistsState | null
  pendingQuestion: { message: string; schema: Record<string, unknown> } | null
  error?: string
  valueIncluded?: boolean
}

// ── Scope ──

export interface ScopeEntry {
  name: string
  type: string
  value: string
}

// ── Hooks ──

export type ASTPattern =
  | { type: string; [property: string]: unknown }
  | { oneOf: ASTPattern[] }
  | { type: string; not: ASTPattern }

export interface HookMatch {
  node: unknown
  source: string
  captures: Record<string, unknown>
}

export interface HookContext {
  lineNumber: number
  sessionId: string
  scope: ScopeEntry[]
}

export type HookAction =
  | { type: 'continue' }
  | { type: 'side_effect'; fn: () => void | Promise<void> }
  | { type: 'transform'; newSource: string }
  | { type: 'interrupt'; message: string }
  | { type: 'skip'; reason?: string }

export interface Hook {
  id: string
  label: string
  pattern: ASTPattern
  phase: 'before' | 'after'
  handler: (match: HookMatch, ctx: HookContext) => HookAction | Promise<HookAction>
}

// ── Session Status ──

export type SessionStatus =
  | 'idle'
  | 'executing'
  | 'waiting_for_input'
  | 'paused'
  | 'complete'
  | 'error'

// ── Callback Interfaces (circular dependency breakers) ──

export interface StreamPauseController {
  pause(): void
  resume(): void
  isPaused(): boolean
}

export interface StatementExecutor {
  execute(code: string, lineNumber: number): Promise<LineResult>
  getScope(): ScopeEntry[]
  getScopeValue(name: string): unknown
}

export interface LineResult {
  ok: boolean
  result?: unknown
  error?: ErrorPayload
}

export interface RenderSurface {
  append(id: string, element: ReactElement): void
  renderForm(id: string, element: ReactElement): Promise<Record<string, unknown>>
  cancelForm(id: string): void
  appendTasklistProgress?(tasklistId: string, state: TasklistState): void
  updateTasklistProgress?(tasklistId: string, state: TasklistState): void
  updateTaskProgress?(tasklistId: string, taskId: string, message: string, percent?: number): void
}

// ── Session Events ──

export type SessionEvent =
  | { type: 'code'; lines: string; blockId: string }
  | { type: 'code_complete'; blockId: string; lineCount: number }
  | { type: 'read'; payload: Record<string, unknown>; blockId: string }
  | { type: 'error'; error: ErrorPayload; blockId: string }
  | { type: 'hook'; hookId: string; action: string; detail: string; blockId: string }
  | { type: 'display'; componentId: string; jsx: SerializedJSX }
  | { type: 'ask_start'; formId: string; jsx: SerializedJSX }
  | { type: 'ask_end'; formId: string }
  | { type: 'async_start'; taskId: string; label: string }
  | { type: 'async_progress'; taskId: string; elapsed: number }
  | { type: 'async_complete'; taskId: string; elapsed: number }
  | { type: 'async_failed'; taskId: string; error: string }
  | { type: 'async_cancelled'; taskId: string }
  | { type: 'tasklist_declared'; tasklistId: string; plan: Tasklist }
  | { type: 'task_complete'; tasklistId: string; id: string; output: Record<string, any> }
  | { type: 'task_complete_continue'; tasklistId: string; completedTaskId: string; readyTasks: Array<{ id: string; instructions: string; outputSchema: Record<string, { type: string }> }> }
  | { type: 'tasklist_reminder'; tasklistId: string; ready: string[]; blocked: string[]; failed: string[] }
  | { type: 'task_failed'; tasklistId: string; id: string; error: string }
  | { type: 'task_retried'; tasklistId: string; id: string }
  | { type: 'task_skipped'; tasklistId: string; id: string; reason: string }
  | { type: 'task_progress'; tasklistId: string; id: string; message: string; percent?: number }
  | { type: 'task_async_start'; tasklistId: string; id: string }
  | { type: 'task_async_complete'; tasklistId: string; id: string; output: Record<string, any> }
  | { type: 'task_async_failed'; tasklistId: string; id: string; error: string }
  | { type: 'task_order_violation'; tasklistId: string; attemptedTaskId: string; readyTasks: Array<{ id: string; instructions: string; outputSchema: Record<string, { type: string }> }> }
  | { type: 'knowledge_loaded'; domains: string[] }
  | { type: 'class_loaded'; className: string; methods: string[] }
  | { type: 'spawn_start'; childId: string; context: string; directive: string }
  | { type: 'spawn_complete'; childId: string; turns: number; duration: number }
  | { type: 'spawn_error'; childId: string; error: string }
  | { type: 'agent_spawn_start'; spaceName: string; agentSlug: string; actionId: string }
  | { type: 'agent_spawn_complete'; spaceName: string; agentSlug: string; actionId: string; result: AgentSpawnResult }
  | { type: 'agent_spawn_failed'; spaceName: string; agentSlug: string; actionId: string; error: string }
  | { type: 'agent_registered'; varName: string; label: string }
  | { type: 'agent_resolved'; varName: string }
  | { type: 'agent_failed'; varName: string; error: string }
  | { type: 'agent_question_asked'; varName: string; question: { message: string; schema: Record<string, unknown> } }
  | { type: 'agent_question_answered'; varName: string }
  | { type: 'knowledge_saved'; domain: string; field: string; option: string }
  | { type: 'knowledge_removed'; domain: string; field: string; option: string }
  | { type: 'file_write'; path: string; blockId: string }
  | { type: 'file_diff'; path: string; blockId: string }
  | { type: 'file_error'; path: string; error: string; blockId: string }
  | { type: 'status'; status: SessionStatus }
  | { type: 'scope'; entries: ScopeEntry[] }

export interface SerializedJSX {
  component: string
  props: Record<string, unknown>
  children?: (SerializedJSX | string)[]
}

export interface SessionSnapshot {
  status: SessionStatus
  blocks: Array<{ type: string; id: string; data: unknown }>
  scope: ScopeEntry[]
  asyncTasks: Array<{ id: string; label: string; status: string; elapsed: number }>
  activeFormId: string | null
  tasklistsState: TasklistsState
  agentEntries: Array<{ varName: string; label: string; status: AgentStatus; error?: string }>
}
