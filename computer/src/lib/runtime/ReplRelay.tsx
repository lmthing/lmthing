import { useEffect } from 'react'
import { useIdeStore } from '../store'
import { useReplConnection } from './use-repl-connection'

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
// lmthing.chat sends lmthing:repl-send -> this component POSTs to /send endpoint.

function ReplRelayInner({ previewUrl }: { previewUrl: string }) {
  const { connected, status, blocks, sendMessage } = useReplConnection(previewUrl)

  // Forward state to parent frame
  useEffect(() => {
    window.parent.postMessage({
      type: 'lmthing:repl-update',
      connected,
      snapshot: { status },
      blocks,
    }, '*')
  }, [connected, status, blocks])

  // Forward send messages from chat -> lmthing server
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== 'lmthing:repl-send') return
      sendMessage(e.data.text)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sendMessage])

  return null
}

export function ReplRelay() {
  const previewUrl = useIdeStore(s => s.previewUrl)

  // Only relay when embedded as an iframe, and not on the /chat route
  // (the /chat route manages its own REPL connection via ThingWebView)
  if (window === window.top) return null
  if (window.location.pathname === '/chat') return null
  if (!previewUrl) return null

  return <ReplRelayInner previewUrl={previewUrl} />
}
