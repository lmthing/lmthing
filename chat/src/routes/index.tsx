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
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        src={COMPUTER_URL}
        style={{ flex: 3, height: '100%', border: 'none', borderRight: '1px solid var(--border)' }}
        allow="cross-origin-isolated"
        title="lmthing computer"
        onLoad={sendSession}
      />
      <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ThingChat wsUrl={wsUrl} />
      </div>
    </div>
  )
}
