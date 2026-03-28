import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ThingChat } from '@lmthing/ui/components/thing/thing-chat'

const COMPUTER_URL = import.meta.env.VITE_COMPUTER_URL
  ?? (import.meta.env.DEV ? 'http://computer.local' : 'https://lmthing.computer')

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  const [wsUrl, setWsUrl] = useState<string | null>(null)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:server-ready') {
        const ws = (e.data.url as string).replace(/^http/, 'ws')
        setWsUrl(ws)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <iframe
        src={COMPUTER_URL}
        style={{ flex: 3, height: '100%', border: 'none', borderRight: '1px solid var(--border)' }}
        allow="cross-origin-isolated"
        title="lmthing computer"
      />
      <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <ThingChat wsUrl={wsUrl} />
      </div>
    </div>
  )
}
