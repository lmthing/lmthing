import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@lmthing/auth'
import {
  useReplSession,
  ReplRpcClient,
  DisplayBlock,
  AskBlock,
  VariablesBlock,
} from '@lmthing/agent-ui'

const COMPUTER_BASE_URL =
  import.meta.env.VITE_COMPUTER_BASE_URL ??
  (import.meta.env.DEV ? 'https://computer.test' : 'https://lmthing.computer')

const CLOUD_BASE_URL =
  import.meta.env.VITE_CLOUD_URL ??
  (import.meta.env.DEV ? 'https://cloud.test' : 'https://cloud.lmthing.cloud')

/** Ensure the user's compute pod is running before opening a session. */
async function ensurePod(cloudBaseUrl: string, accessToken: string): Promise<void> {
  const res = await fetch(`${cloudBaseUrl}/api/compute/ensure`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`compute/ensure failed: ${res.status}`)
  }
}

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  const { session } = useAuth()

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [podError, setPodError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const initRef = useRef(false)
  const blocksEndRef = useRef<HTMLDivElement>(null)

  // Start a THING chat session (no specific agentSlug — uses the default THING agent)
  useEffect(() => {
    if (!session?.accessToken || initRef.current) return
    initRef.current = true

    async function init() {
      try {
        await ensurePod(CLOUD_BASE_URL, session!.accessToken)
        const client = await ReplRpcClient.createSession(
          COMPUTER_BASE_URL,
          {},
          session!.accessToken,
        )
        setSessionId(client.sessionId!)
      } catch (err) {
        setPodError(err instanceof Error ? err.message : String(err))
      }
    }

    void init()
  }, [session])

  const { blocks, sendMessage, submitForm, cancelAsk, isConnected, isDone } = useReplSession(
    sessionId
      ? { baseUrl: COMPUTER_BASE_URL, sessionId, accessToken: session?.accessToken }
      : { baseUrl: COMPUTER_BASE_URL, sessionId: '', accessToken: session?.accessToken },
  )

  // Auto-scroll to bottom when new blocks arrive
  useEffect(() => {
    blocksEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [blocks])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || !isConnected) return
    sendMessage(text)
    setInputValue('')
  }, [inputValue, isConnected, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRetry = () => {
    initRef.current = false
    setPodError(null)
    setSessionId(null)
  }

  if (!session) {
    return <div style={styles.center}>Signing in…</div>
  }

  if (podError) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#c00' }}>Failed to start compute pod: {podError}</p>
        <button onClick={handleRetry}>Retry</button>
      </div>
    )
  }

  if (!sessionId) {
    return <div style={styles.center}>Starting THING…</div>
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>THING</span>
        <span style={{ color: isConnected ? '#22c55e' : '#ef4444', fontSize: 12 }}>
          {isConnected ? '● Connected' : '○ Connecting…'}
        </span>
        {isDone && <span style={{ color: '#6b7280', fontSize: 12 }}>Done</span>}
      </div>

      {/* Block stream */}
      <div style={styles.blocks}>
        {blocks.length === 0 && isConnected && (
          <p style={styles.emptyHint}>Send a message to start a conversation with THING.</p>
        )}
        {blocks.map((block) => {
          if (block.type === 'display') {
            return <DisplayBlock key={block.id} descriptor={block.data} />
          }
          if (block.type === 'ask') {
            return (
              <AskBlock
                key={block.id}
                id={block.id}
                descriptor={block.data}
                onSubmit={submitForm}
                onCancel={cancelAsk}
              />
            )
          }
          if (block.type === 'variables') {
            return <VariablesBlock key={block.id} vars={block.data as Record<string, unknown>} />
          }
          if (block.type === 'error') {
            return (
              <div key={block.id} style={styles.errorBlock}>
                {String(block.data)}
              </div>
            )
          }
          return null
        })}
        <div ref={blocksEndRef} />
      </div>

      {/* Message input */}
      <div style={styles.inputRow}>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message THING… (Enter to send, Shift+Enter for newline)"
          disabled={!isConnected}
          style={styles.textarea}
          rows={2}
        />
        <button
          onClick={handleSend}
          disabled={!isConnected || !inputValue.trim()}
          style={styles.sendButton}
        >
          Send
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    overflow: 'hidden',
    background: '#fff',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#6b7280',
    flexDirection: 'column' as const,
    gap: 12,
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  } as React.CSSProperties,
  title: {
    fontWeight: 600,
    fontSize: 15,
    flex: 1,
  } as React.CSSProperties,
  blocks: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  emptyHint: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center' as const,
    marginTop: 40,
  },
  errorBlock: {
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: 4,
    padding: '8px 12px',
    color: '#dc2626',
    fontFamily: 'monospace',
    fontSize: 13,
  } as React.CSSProperties,
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '10px 16px',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  } as React.CSSProperties,
  textarea: {
    flex: 1,
    resize: 'none' as const,
    padding: '8px',
    borderRadius: 4,
    border: '1px solid #d1d5db',
    fontSize: 14,
    fontFamily: 'inherit',
  },
  sendButton: {
    padding: '0 16px',
    borderRadius: 4,
    border: 'none',
    background: '#3b82f6',
    color: '#fff',
    fontWeight: 500,
    cursor: 'pointer',
    alignSelf: 'flex-end',
  } as React.CSSProperties,
}
