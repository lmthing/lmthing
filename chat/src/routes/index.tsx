import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef } from 'react'

const COMPUTER_URL = import.meta.env.VITE_COMPUTER_URL
  ?? (import.meta.env.DEV ? 'https://computer.test' : 'https://lmthing.computer')

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  const [showingComputer, setShowingComputer] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  function viewComputer() {
    iframeRef.current?.contentWindow?.postMessage({ type: 'lmthing:navigate', path: '/' }, '*')
    setShowingComputer(true)
  }

  function viewChat() {
    iframeRef.current?.contentWindow?.postMessage({ type: 'lmthing:navigate', path: '/chat' }, '*')
    setShowingComputer(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <iframe
        ref={iframeRef}
        src={`${COMPUTER_URL}/chat`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
        allow="cross-origin-isolated"
        title="lmthing"
      />

      {showingComputer ? (
        <button onClick={viewChat} style={backBtnStyle}>
          ← Chat
        </button>
      ) : (
        <button onClick={viewComputer} style={computerBtnStyle}>
          Computer
        </button>
      )}
    </div>
  )
}

const base: React.CSSProperties = {
  position: 'fixed',
  zIndex: 50,
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
  padding: '6px 12px',
  lineHeight: 1,
}

const computerBtnStyle: React.CSSProperties = {
  ...base,
  bottom: '1rem',
  right: '1rem',
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  backdropFilter: 'blur(4px)',
}

const backBtnStyle: React.CSSProperties = {
  ...base,
  top: '1rem',
  right: '1rem',
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  backdropFilter: 'blur(4px)',
}
