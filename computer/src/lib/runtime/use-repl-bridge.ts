import { useState, useEffect, useCallback, useRef } from 'react'
import { blocksReducer } from '@lmthing/ui/components/thing/thing-web-view/blocks'
import type { UIBlock, SessionSnapshot } from '@lmthing/ui/components/thing/thing-web-view/types'
import { subscribeToReplOutput, sendToRepl } from './repl-bridge'
import type { ReplConnectionState } from './use-repl-connection'

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

/**
 * Connects to the REPL server via the WebContainer process I/O bridge.
 * Same interface as useReplConnection, but uses repl-bridge.ts instead of HTTP fetch.
 *
 * The bridge process (BRIDGE_SCRIPT) pipes SSE events from the REPL server stdout
 * and emits BRIDGE_CONNECTED / BRIDGE_DISCONNECTED sentinel lines.
 */
export function useReplBridge(): ReplConnectionState {
  const [connected, setConnected] = useState(false)
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(EMPTY_SNAPSHOT)
  const [blocks, setBlocks] = useState<UIBlock[]>([])

  const blocksRef = useRef<UIBlock[]>([])
  const snapshotRef = useRef<SessionSnapshot>(EMPTY_SNAPSHOT)
  const bufferRef = useRef('')

  useEffect(() => {
    const unsubscribe = subscribeToReplOutput((chunk: string) => {
      // Accumulate all output into a raw buffer first
      bufferRef.current += chunk

      // Process the buffer: sentinels appear as full lines mixed with SSE data.
      // Extract and handle sentinels, then parse the rest as SSE.
      let buf = bufferRef.current

      // Strip sentinels (handle both \n and \r\n line endings from WebContainer)
      const connMatch = buf.match(/BRIDGE_CONNECTED\r?\n/)
      if (connMatch && connMatch.index !== undefined) {
        setConnected(true)
        blocksRef.current = []
        snapshotRef.current = EMPTY_SNAPSHOT
        setBlocks([])
        setSnapshot(EMPTY_SNAPSHOT)
        buf = buf.slice(connMatch.index + connMatch[0].length)
      }

      const disconnMatch = buf.match(/BRIDGE_DISCONNECTED\r?\n/)
      if (disconnMatch && disconnMatch.index !== undefined) {
        setConnected(false)
        buf = buf.slice(disconnMatch.index + disconnMatch[0].length)
      }

      // Parse SSE messages: WebContainer outputs CRLF so split on \r\n\r\n or \n\n
      const msgs = buf.split(/\r?\n\r?\n/)
      bufferRef.current = msgs.pop() ?? ''

      for (const msg of msgs) {
        const dataLine = msg.split(/\r?\n/).find(l => l.startsWith('data: '))
        if (!dataLine) continue
        try {
          const event = JSON.parse(dataLine.slice(6)) as ReplEvent
          if (event.type === 'snapshot') {
            snapshotRef.current = {
              ...EMPTY_SNAPSHOT,
              ...(event.data as Partial<SessionSnapshot> ?? {}),
              tasklistsState: { tasklists: new Map() },
            }
            setSnapshot({ ...snapshotRef.current })
            blocksRef.current = []
            setBlocks([])
          } else {
            snapshotRef.current = applyEvent(snapshotRef.current, event)
            setSnapshot({ ...snapshotRef.current })
            blocksRef.current = blocksReducer(blocksRef.current, { type: 'event', event })
            setBlocks([...blocksRef.current])
          }
        } catch {
          // skip malformed events
        }
      }
    })

    return unsubscribe
  }, [])

  const sendMessage = useCallback((text: string) => {
    sendToRepl(JSON.stringify({ type: 'sendMessage', text }))
  }, [])

  return { connected, snapshot, blocks, sendMessage }
}
