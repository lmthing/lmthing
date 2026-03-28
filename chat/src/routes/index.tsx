import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@lmthing/auth'
import { ThingChat } from '@lmthing/ui/components/thing/thing-chat'

const COMPUTER_URL = import.meta.env.VITE_COMPUTER_URL
  ?? (import.meta.env.DEV ? 'http://computer.local' : 'https://lmthing.computer')

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { session } = useAuth()

  function sendSession() {
    if (session && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'lmthing:session', session }, '*')
    }
  }

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:server-ready') {
        const ws = (e.data.url as string).replace(/^http/, 'ws')
        setWsUrl(ws)
      }
      if (e.data?.type === 'lmthing:auth-needed') {
        sendSession()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [session])

  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative' }}>
      {/* iframe always in DOM so WebContainer keeps running */}
      <iframe
        ref={iframeRef}
        src={COMPUTER_URL}
        allow="cross-origin-isolated"
        title="lmthing computer"
        onLoad={sendSession}
        style={expanded ? {
          position: 'fixed', inset: 0, width: '100%', height: '100%',
          border: 'none', zIndex: 40,
        } : {
          position: 'absolute', left: '-10000px',
          width: '1280px', height: '800px', border: 'none',
        }}
      />

      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            position: 'fixed', top: '1rem', right: '1rem', zIndex: 50,
            background: 'var(--background)', border: '1px solid var(--border)',
            borderRadius: '0.375rem', padding: '0.375rem 0.75rem',
            fontSize: '0.875rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.375rem',
          }}
        >
          ✕ Close
        </button>
      )}

      <div style={{ height: '100%', position: 'relative', zIndex: 1 }}>
        <ThingChat
          wsUrl={wsUrl}
          computerStatus={wsUrl ? 'ready' : 'booting'}
          onShowComputer={() => setExpanded(true)}
        />
      </div>
    </div>
  )
}
