import { useState, useEffect, useCallback, useRef } from 'react'
import { blocksReducer } from '@lmthing/ui/components/thing/thing-web-view/blocks'
import type { UIBlock } from '@lmthing/ui/components/thing/thing-web-view/types'

export interface ReplConnectionState {
  connected: boolean
  status: string
  blocks: UIBlock[]
  sendMessage: (text: string) => void
}

/**
 * Connects to a REPL server via SSE (/events) and POST (/send).
 * Returns connection state and a sendMessage function.
 */
export function useReplConnection(previewUrl: string | null): ReplConnectionState {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('idle')
  const [blocks, setBlocks] = useState<UIBlock[]>([])
  const abortRef = useRef(false)
  const baseRef = useRef('')

  useEffect(() => {
    if (!previewUrl) {
      setConnected(false)
      setStatus('idle')
      setBlocks([])
      return
    }

    const base = previewUrl.replace(/\/$/, '')
    baseRef.current = base
    abortRef.current = false
    let currentBlocks: UIBlock[] = []
    let currentStatus = 'idle'

    const connect = async () => {
      await new Promise(r => setTimeout(r, 200))
      if (abortRef.current) return

      try {
        const res = await fetch(`${base}/events`)
        if (!res.ok || !res.body) return

        setConnected(true)
        currentBlocks = []
        setBlocks([])

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
                currentStatus = event.data.status ?? 'idle'
                setStatus(currentStatus)
                currentBlocks = []
                setBlocks([])
              } else {
                if (event.type === 'status') {
                  currentStatus = event.status
                  setStatus(currentStatus)
                }
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

  return { connected, status, blocks, sendMessage }
}
