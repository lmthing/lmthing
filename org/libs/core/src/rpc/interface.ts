import type { SessionEvent, SessionSnapshot, ScopeEntry, SerializedJSX, ConversationState } from '@lmthing/repl'

/** Exposed by CLI (backend) → consumed by browser (frontend) */
export interface ReplSession {
  /** Send a user message to the agent */
  sendMessage(text: string): Promise<void>

  /** Submit form data for a pending ask() */
  submitForm(formId: string, data: Record<string, unknown>): Promise<void>

  /** Cancel a pending ask() */
  cancelAsk(formId: string): Promise<void>

  /** Cancel a background async task */
  cancelTask(taskId: string, message?: string): Promise<void>

  /** Pause the agent */
  pause(): Promise<void>

  /** Resume the agent */
  resume(): Promise<void>

  /** User intervention — inject a message while agent is running */
  intervene(text: string): Promise<void>

  /** Get current session snapshot (for reconnection) */
  getSnapshot(): Promise<SessionSnapshot>

  /** Get full serializable conversation state */
  getConversationState(): Promise<ConversationState>

  /** Subscribe to session events */
  subscribe(): AsyncIterable<SessionEvent>
}

// Re-export types for consumer convenience
export type { SessionEvent, SessionSnapshot, ScopeEntry, SerializedJSX, ConversationState }
