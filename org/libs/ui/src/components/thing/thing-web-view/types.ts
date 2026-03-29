import type {
  SessionSnapshot,
  SessionStatus,
  SerializedJSX,
  ErrorPayload,
  Tasklist,
  ConversationState,
} from '@lmthing/repl'

export type { SessionSnapshot, SessionStatus, SerializedJSX, ErrorPayload, Tasklist, ConversationState }

// ── Conversation Summary ──

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  turnCount: number
}

// ── UI Block Model ──

export type UIBlock =
  | { type: 'user'; id: string; text: string }
  | { type: 'code'; id: string; code: string; streaming: boolean; lineCount: number }
  | { type: 'read'; id: string; payload: Record<string, unknown> }
  | { type: 'error'; id: string; error: ErrorPayload }
  | { type: 'hook'; id: string; hookId: string; action: string; detail: string }
  | { type: 'display'; id: string; jsx: SerializedJSX }
  | { type: 'form'; id: string; jsx: SerializedJSX; status: 'active' | 'submitted' | 'timeout' }
  | { type: 'tasklist_declared'; id: string; tasklistId: string; plan: Tasklist }
  | {
      type: 'task_complete'
      id: string
      tasklistId: string
      taskId: string
      output: Record<string, any>
    }

export type BlockAction =
  | { type: 'event'; event: import('@lmthing/repl').SessionEvent }
  | { type: 'add_user_message'; id: string; text: string }
  | { type: 'reset' }

// ── Agent Action ──

export interface AgentAction {
  id: string
  label: string
  description: string
}

// ── Session Interface ──

export interface ThingWebViewSession {
  connected: boolean
  snapshot: SessionSnapshot
  blocks: UIBlock[]
  actions: AgentAction[]
  conversations: ConversationSummary[]
  loadedConversation: { id: string; state: ConversationState } | null
  sendMessage: (text: string) => void
  intervene: (text: string) => void
  submitForm: (formId: string, data: Record<string, unknown>) => void
  cancelAsk: (formId: string) => void
  cancelTask: (taskId: string, message?: string) => void
  pause: () => void
  resume: () => void
  saveConversation: (id: string) => void
  requestConversations: () => void
  loadConversation: (id: string) => void
}
