import { useEffect, useReducer, useRef, useState, useCallback } from 'react'
import { blocksReducer } from 'lmthing/web/rpc-client'
import { useIdeStore } from '../store'

// Connects to the lmthing HTTP server (inside WebContainer) via SSE + POST fetch,
// which goes through WebContainer's service worker — unlike WebSocket which bypasses it.
// Relays session state to the parent frame via postMessage.

function useHttpReplSession(baseUrl: string) {
  const [status, setStatus] = useState('idle')
  const [connected, setConnected] = useState(false)
  const [blocks, dispatchBlock] = useReducer(blocksReducer, [])
  const msgCounterRef = useRef(0)
  const baseRef = useRef(baseUrl)
  baseRef.current = baseUrl

  useEffect(() => {
    // Reset state when baseUrl changes
    setConnected(false)
    setStatus('idle')
    dispatchBlock({ type: 'reset' })

    const eventsUrl = baseUrl.replace(/\/?$/, '/events')
    let aborted = false
    const controller = new AbortController()

    ;(async () => {
      try {
        const res = await fetch(eventsUrl, {
          signal: controller.signal,
          headers: { Accept: 'text/event-stream' },
        })
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`)

        setConnected(true)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line
            if (!trimmed.startsWith('data: ')) continue
            try {
              const data = JSON.parse(trimmed.slice(6))
              if (data.type === 'snapshot') {
                setStatus(data.data?.status ?? 'idle')
              } else {
                if (data.type === 'status') setStatus(data.status)
                dispatchBlock({ type: 'event', event: data })
              }
            } catch { /* skip malformed lines */ }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('[ReplRelay] SSE error:', err)
        }
      }
      if (!aborted) setConnected(false)
    })()

    return () => {
      aborted = true
      controller.abort()
    }
  }, [baseUrl])

  const sendMessage = useCallback((text: string) => {
    const id = `user_${++msgCounterRef.current}`
    dispatchBlock({ type: 'add_user_message', id, text })
    const sendUrl = baseRef.current.replace(/\/?$/, '/send')
    fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sendMessage', text }),
    }).catch(err => console.error('[ReplRelay] send error:', err))
  }, [])

  return { status, connected, blocks, sendMessage }
}

function ReplRelayInner({ baseUrl }: { baseUrl: string }) {
  const { status, connected, blocks, sendMessage } = useHttpReplSession(baseUrl)

  useEffect(() => {
    window.parent.postMessage({
      type: 'lmthing:repl-update',
      connected,
      snapshot: { status },
      blocks,
    }, '*')
  }, [connected, status, blocks])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:repl-send') {
        sendMessage(e.data.text)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sendMessage])

  return null
}

export function ReplRelay() {
  const previewUrl = useIdeStore(s => s.previewUrl)

  if (window === window.top) return null
  if (!previewUrl) return null

  return <ReplRelayInner baseUrl={previewUrl} />
}
