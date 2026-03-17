import type { ReactElement } from 'react'

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
  | { type: 'status'; status: SessionStatus }
  | { type: 'scope'; entries: ScopeEntry[] }

export interface SerializedJSX {
  component: string
  props: Record<string, unknown>
  children?: SerializedJSX[]
}

export interface SessionSnapshot {
  status: SessionStatus
  blocks: Array<{ type: string; id: string; data: unknown }>
  scope: ScopeEntry[]
  asyncTasks: Array<{ id: string; label: string; status: string; elapsed: number }>
  activeFormId: string | null
}
