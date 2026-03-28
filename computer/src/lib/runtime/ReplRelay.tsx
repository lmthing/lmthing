import { useEffect, useRef } from 'react'
import { useIdeStore } from '../store'

// The relay works in two layers:
//
// 1. This component (runs in the lmthing.computer iframe embedded in lmthing.chat)
//    loads the lmthing server's own web UI in a hidden inner iframe. That inner
//    iframe lives at the local-corp.webcontainer-api.io URL — inside WebContainer's
//    service-worker scope — where ws://localhost:3010 actually works.
//
// 2. The lmthing web UI (App.tsx) detects it is embedded and sends its session
//    state to window.parent (this component) via lmthing:repl-update postMessages.
//    This component forwards those messages to window.parent (lmthing.chat).
//
// lmthing.chat sends lmthing:repl-send → this component forwards to inner iframe
// → inner iframe calls session.sendMessage(text) over its WebSocket.

function ReplRelayInner({ previewUrl }: { previewUrl: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:repl-update') {
        // Inner iframe → parent chat
        window.parent.postMessage(e.data, '*')
      } else if (e.data?.type === 'lmthing:repl-send') {
        // Parent chat → inner iframe
        iframeRef.current?.contentWindow?.postMessage(e.data, '*')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      src={previewUrl}
      title="lmthing relay"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        border: 'none',
      }}
    />
  )
}

export function ReplRelay() {
  const previewUrl = useIdeStore(s => s.previewUrl)

  if (window === window.top) return null
  if (!previewUrl) return null

  return <ReplRelayInner previewUrl={previewUrl} />
}
