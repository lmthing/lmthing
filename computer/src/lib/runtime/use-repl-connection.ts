import { useState, useEffect, useCallback, useRef } from 'react'
import { blocksReducer } from '@lmthing/ui/components/thing/thing-web-view/blocks'
import type { UIBlock, SessionSnapshot } from '@lmthing/ui/components/thing/thing-web-view/types'

// Minimal event shape for snapshot updates (matches @lmthing/repl SessionEvent)
type ReplEvent = Record<string, unknown> & { type: string }

const EMPTY_SNAPSHOT: SessionSnapshot = {
  status: 'idle',
  blocks: [],
  scope: [],
  asyncTasks: [],
  activeFormId: null,
  tasklistsState: { tasklists: new Map() },
  agentEntries: [],
}

function applyEvent(prev: SessionSnapshot, event: ReplEvent): SessionSnapshot {
  switch (event.type) {
    case 'status':
      return { ...prev, status: event.status as SessionSnapshot['status'] }
    case 'scope':
      return { ...prev, scope: event.entries as SessionSnapshot['scope'] }
    case 'async_start':
      return {
        ...prev,
        asyncTasks: [
          ...prev.asyncTasks,
          { id: event.taskId as string, label: event.label as string, status: 'running', elapsed: 0 },
        ],
      }
    case 'async_progress':
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map(t =>
          t.id === event.taskId ? { ...t, elapsed: event.elapsed as number } : t,
        ),
      }
    case 'async_complete':
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map(t =>
          t.id === event.taskId ? { ...t, status: 'completed', elapsed: event.elapsed as number } : t,
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
      return { ...prev, activeFormId: event.formId as string }
    case 'ask_end':
      return { ...prev, activeFormId: null }
    default:
      return prev
  }
}

export interface ReplConnectionState {
  connected: boolean
  snapshot: SessionSnapshot
  blocks: UIBlock[]
  sendMessage: (text: string) => void
}

/**
 * Connects to a REPL server via SSE (/events) and POST (/send).
 * Returns connection state and a sendMessage function.
 */
export function useReplConnection(previewUrl: string | null): ReplConnectionState {
  const [connected, setConnected] = useState(false)
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(EMPTY_SNAPSHOT)
  const [blocks, setBlocks] = useState<UIBlock[]>([])
  const abortRef = useRef(false)
  const baseRef = useRef('')

  useEffect(() => {
    if (!previewUrl) {
      setConnected(false)
      setSnapshot(EMPTY_SNAPSHOT)
      setBlocks([])
      return
    }

    const base = previewUrl.replace(/\/$/, '')
    baseRef.current = base
    abortRef.current = false
    let currentBlocks: UIBlock[] = []
    let currentSnapshot: SessionSnapshot = EMPTY_SNAPSHOT

    const connect = async () => {
      await new Promise(r => setTimeout(r, 200))
      if (abortRef.current) return

      try {
        const res = await fetch(`${base}/events`)
        if (!res.ok || !res.body) return

        setConnected(true)
        currentBlocks = []
        currentSnapshot = EMPTY_SNAPSHOT
        setBlocks([])
        setSnapshot(EMPTY_SNAPSHOT)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!abortRef.current) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const msgs = buffer.split('\n\n')
          buffer = msgs.pop() ?? ''

          for (const msg of msgs) {
            const dataLine = msg.split('\n').find(l => l.startsWith('data: '))
            if (!dataLine) continue
            try {
              const event = JSON.parse(dataLine.slice(6))
              if (event.type === 'snapshot') {
                currentSnapshot = { ...EMPTY_SNAPSHOT, ...(event.data ?? {}), tasklistsState: { tasklists: new Map() } }
                setSnapshot({ ...currentSnapshot })
                currentBlocks = []
                setBlocks([])
              } else {
                currentSnapshot = applyEvent(currentSnapshot, event)
                setSnapshot({ ...currentSnapshot })
                currentBlocks = blocksReducer(currentBlocks, { type: 'event', event })
                setBlocks([...currentBlocks])
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch {
        // fetch failed — server not ready yet or connection dropped
      }

      if (!abortRef.current) {
        setConnected(false)
      }
    }

    connect()

    return () => {
      abortRef.current = true
    }
  }, [previewUrl])

  const sendMessage = useCallback((text: string) => {
    if (!baseRef.current) return
    fetch(`${baseRef.current}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sendMessage', text }),
    }).catch(() => {})
  }, [])

  return { connected, snapshot, blocks, sendMessage }
}
