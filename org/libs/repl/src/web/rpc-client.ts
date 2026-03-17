import { useState, useEffect, useCallback, useRef } from 'react'
import type { SessionEvent, SessionSnapshot } from '../session/types'

export interface UseReplSessionResult {
  snapshot: SessionSnapshot | null
  connected: boolean
  sendMessage: (text: string) => void
  submitForm: (formId: string, data: Record<string, unknown>) => void
  cancelAsk: (formId: string) => void
  cancelTask: (taskId: string, message?: string) => void
  pause: () => void
  resume: () => void
  intervene: (text: string) => void
}

/**
 * React hook for connecting to the REPL backend via WebSocket.
 */
export function useReplSession(url = 'ws://localhost:3100'): UseReplSessionResult {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      ws.send(JSON.stringify({ type: 'getSnapshot' }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'snapshot') {
        setSnapshot(data.data)
      } else {
        setSnapshot(prev => prev ? applyEvent(prev, data) : prev)
      }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => {
      ws.close()
    }
  }, [url])

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return {
    snapshot,
    connected,
    sendMessage: (text: string) => send({ type: 'sendMessage', text }),
    submitForm: (formId: string, data: Record<string, unknown>) => send({ type: 'submitForm', formId, data }),
    cancelAsk: (formId: string) => send({ type: 'cancelAsk', formId }),
    cancelTask: (taskId: string, message?: string) => send({ type: 'cancelTask', taskId, message }),
    pause: () => send({ type: 'pause' }),
    resume: () => send({ type: 'resume' }),
    intervene: (text: string) => send({ type: 'intervene', text }),
  }
}

function applyEvent(prev: SessionSnapshot, event: SessionEvent): SessionSnapshot {
  switch (event.type) {
    case 'status':
      return { ...prev, status: event.status }
    case 'scope':
      return { ...prev, scope: event.entries }
    case 'async_start':
      return {
        ...prev,
        asyncTasks: [...prev.asyncTasks, { id: event.taskId, label: event.label, status: 'running', elapsed: 0 }],
      }
    case 'async_complete':
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map(t =>
          t.id === event.taskId ? { ...t, status: 'completed', elapsed: event.elapsed } : t,
        ),
      }
    case 'async_failed':
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map(t =>
          t.id === event.taskId ? { ...t, status: 'failed' } : t,
        ),
      }
    case 'async_cancelled':
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map(t =>
          t.id === event.taskId ? { ...t, status: 'cancelled' } : t,
        ),
      }
    case 'ask_start':
      return { ...prev, activeFormId: event.formId }
    case 'ask_end':
      return { ...prev, activeFormId: null }
    default:
      return prev
  }
}
