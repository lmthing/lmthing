import type { ReplSession } from './interface'
import type { SessionEvent, SessionSnapshot, ConversationState } from '@lmthing/repl'
import { Session } from '@lmthing/repl'

/**
 * RPC server that exposes the Session to the browser via RPC.
 * Implements the ReplSession interface.
 */
export class ReplSessionServer implements ReplSession {
  private session: Session
  private listeners = new Set<(event: SessionEvent) => void>()

  constructor(session: Session) {
    this.session = session
    session.on('event', (event: SessionEvent) => {
      for (const listener of this.listeners) listener(event)
    })
  }

  async sendMessage(text: string): Promise<void> {
    await this.session.handleUserMessage(text)
  }

  async submitForm(formId: string, data: Record<string, unknown>): Promise<void> {
    this.session.resolveAsk(formId, data)
  }

  async cancelAsk(formId: string): Promise<void> {
    this.session.cancelAsk(formId)
  }

  async cancelTask(taskId: string, message = ''): Promise<void> {
    this.session.cancelAsyncTask(taskId, message)
  }

  async pause(): Promise<void> {
    this.session.pause()
  }

  async resume(): Promise<void> {
    this.session.resume()
  }

  async intervene(text: string): Promise<void> {
    this.session.handleIntervention(text)
  }

  async getSnapshot(): Promise<SessionSnapshot> {
    return this.session.snapshot()
  }

  async getConversationState(): Promise<ConversationState> {
    return this.session.getConversationState()
  }

  async *subscribe(): AsyncIterable<SessionEvent> {
    const queue: SessionEvent[] = []
    let resolve: (() => void) | null = null

    const listener = (event: SessionEvent) => {
      queue.push(event)
      resolve?.()
    }
    this.listeners.add(listener)

    try {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>(r => { resolve = r })
        }
        while (queue.length > 0) yield queue.shift()!
      }
    } finally {
      this.listeners.delete(listener)
    }
  }
}
