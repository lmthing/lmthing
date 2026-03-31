import { useEffect } from 'react'
import { useReplBridge } from './use-repl-bridge'

// The relay works in two layers:
//
// 1. This component (runs in the lmthing.computer iframe embedded in lmthing.chat)
//    subscribes to the WebContainer process I/O bridge (repl-bridge.ts) which
//    pipes SSE events from the REPL server via stdin/stdout instead of HTTP fetch.
//    This is necessary because WebContainer preview URLs require StackBlitz's
//    CloudFront relay and don't work on custom local domains.
//
// 2. Session state (connected, snapshot, blocks) is forwarded to lmthing.chat via
//    window.parent.postMessage as lmthing:repl-update messages.
//
// lmthing.chat sends lmthing:repl-send -> this component writes to bridge stdin.

function ReplRelayInner() {
  const { connected, snapshot, blocks, sendMessage } = useReplBridge()

  // Forward state to parent frame
  useEffect(() => {
    window.parent.postMessage({
      type: 'lmthing:repl-update',
      connected,
      snapshot,
      blocks,
    }, '*')
  }, [connected, snapshot, blocks])

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
  // Only relay when embedded as an iframe, and not on the /chat route
  // (the /chat route manages its own REPL connection via ThingWebView)
  if (window === window.top) return null
  if (window.location.pathname === '/chat') return null

  return <ReplRelayInner />
}
