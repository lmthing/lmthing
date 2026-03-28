import { useEffect } from 'react'
import { useIdeStore } from '../store'
import { blocksReducer } from 'lmthing/web/rpc-client'
import type { UIBlock } from 'lmthing/web/rpc-client'

// The relay works in two layers:
//
// 1. This component (runs in the lmthing.computer iframe embedded in lmthing.chat)
//    connects directly to the lmthing server's SSE endpoint (/events) using fetch.
//    Because lmthing.computer is a controlled client of the WebContainer service worker,
//    this cross-origin fetch to the local-corp URL is properly intercepted and routed
//    to the Node.js server running inside WebContainer.
//
// 2. Session state (connected, snapshot, blocks) is forwarded to lmthing.chat via
//    window.parent.postMessage as lmthing:repl-update messages.
//
// lmthing.chat sends lmthing:repl-send → this component POSTs to /send endpoint.

function ReplRelayInner({ previewUrl }: { previewUrl: string }) {
  useEffect(() => {
    const base = previewUrl.replace(/\/$/, '')
    let blocks: UIBlock[] = []
    let status = 'idle'
    let connected = false
    let aborted = false

    const notify = () => {
      window.parent.postMessage({
        type: 'lmthing:repl-update',
        connected,
        snapshot: { status },
        blocks,
      }, '*')
    }

    const connect = async () => {
      // Brief delay to let the server finish starting up
      await new Promise(r => setTimeout(r, 200))
      if (aborted) return

      try {
        const res = await fetch(`${base}/events`)
        if (!res.ok || !res.body) return

        connected = true
        blocks = []
        notify()

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (!aborted) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // SSE format: "data: {...}\n\n"
          const msgs = buffer.split('\n\n')
          buffer = msgs.pop() ?? ''

          for (const msg of msgs) {
            const dataLine = msg.split('\n').find(l => l.startsWith('data: '))
            if (!dataLine) continue
            try {
              const event = JSON.parse(dataLine.slice(6))
              if (event.type === 'snapshot') {
                status = event.data.status ?? 'idle'
                blocks = []
                notify()
              } else {
                if (event.type === 'status') status = event.status
                blocks = blocksReducer(blocks, { type: 'event', event })
                notify()
              }
            } catch {
              // skip malformed events
            }
          }
        }
      } catch {
        // fetch failed — server not ready yet or connection dropped
      }

      connected = false
      if (!aborted) notify()
    }

    connect()

    // Forward send messages from chat → lmthing server
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'lmthing:repl-send') return
      fetch(`${base}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sendMessage', text: e.data.text }),
      }).catch(() => {})
    }
    window.addEventListener('message', onMessage)

    return () => {
      aborted = true
      window.removeEventListener('message', onMessage)
    }
  }, [previewUrl])

  return null
}

export function ReplRelay() {
  const previewUrl = useIdeStore(s => s.previewUrl)

  if (window === window.top) return null
  if (!previewUrl) return null

  return <ReplRelayInner previewUrl={previewUrl} />
}
