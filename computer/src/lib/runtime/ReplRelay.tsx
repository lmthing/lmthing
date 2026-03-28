import { useEffect } from 'react'
import { useReplSession } from 'lmthing/web/rpc-client'
import { useIdeStore } from '../store'

// Connects to the lmthing WebSocket server (locally, within the WebContainer
// service-worker scope) and relays the session state to the parent frame via
// postMessage.  Only active when embedded as an iframe.

function ReplRelayActive({ wsUrl }: { wsUrl: string }) {
  const session = useReplSession(wsUrl)

  useEffect(() => {
    window.parent.postMessage({
      type: 'lmthing:repl-update',
      connected: session.connected,
      snapshot: session.snapshot,
      blocks: session.blocks,
    }, '*')
  }, [session.connected, session.snapshot, session.blocks])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:repl-send') {
        session.sendMessage(e.data.text)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [session.sendMessage])

  return null
}

export function ReplRelay() {
  const previewUrl = useIdeStore(s => s.previewUrl)

  if (window === window.top) return null
  if (!previewUrl) return null

  const wsUrl = previewUrl.replace(/^http/, 'ws')
  return <ReplRelayActive wsUrl={wsUrl} />
}
