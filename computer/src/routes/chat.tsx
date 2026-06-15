import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  useReplSession,
  DisplayBlock,
  AskBlock,
  ReplRpcClient,
  type ReplClientConfig,
} from '@lmthing/agent-ui'

const COMPUTER_BASE_URL = import.meta.env.VITE_COMPUTER_BASE_URL
  ?? (import.meta.env.DEV ? `${window.location.protocol}//computer.test` : 'https://lmthing.computer')

export const Route = createFileRoute('/chat')({
  component: ChatRoute,
})

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('lmthing-cloud-auth')
    if (!raw) return null
    const { accessToken } = JSON.parse(raw) as { accessToken: string }
    return accessToken ?? null
  } catch {
    return null
  }
}

function AgentChat({ sessionConfig }: { sessionConfig: ReplClientConfig }) {
  const { blocks, sendMessage, submitForm, cancelAsk, isConnected } = useReplSession(sessionConfig)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [blocks])

  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    sendMessage(text)
  }, [input, sendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f0f', color: '#e5e5e5' }}>
      {/* Connection status */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #333', fontSize: '12px', color: isConnected ? '#4ade80' : '#f87171' }}>
        {isConnected ? 'Connected' : 'Connecting…'}
      </div>

      {/* Blocks */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {blocks.map((block) => {
          if (block.type === 'display') return <DisplayBlock key={block.id} descriptor={block.data} />
          if (block.type === 'ask') return (
            <AskBlock
              key={block.id}
              id={block.id}
              descriptor={block.data}
              onSubmit={(id, value) => submitForm(id, value)}
              onCancel={(id) => cancelAsk(id)}
            />
          )
          return null
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #333', display: 'flex', gap: '8px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message…"
          rows={2}
          style={{
            flex: 1,
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '6px',
            color: '#e5e5e5',
            padding: '8px 12px',
            resize: 'none',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            background: '#3b82f6',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            padding: '0 16px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

function ChatRoute() {
  const [sessionConfig, setSessionConfig] = useState<ReplClientConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const accessToken = getAccessToken()

    ReplRpcClient.createSession(
      COMPUTER_BASE_URL,
      {},
      accessToken ?? undefined,
    ).then((client) => {
      if (cancelled || client.sessionId == null) return
      setSessionConfig({
        baseUrl: COMPUTER_BASE_URL,
        sessionId: client.sessionId,
        accessToken: accessToken ?? undefined,
      })
    }).catch((err) => {
      if (!cancelled) setError(String(err))
    })

    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', background: '#0f0f0f' }}>
        Failed to create session: {error}
      </div>
    )
  }

  if (!sessionConfig) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', background: '#0f0f0f' }}>
        Starting session…
      </div>
    )
  }

  return <AgentChat sessionConfig={sessionConfig} />
}
