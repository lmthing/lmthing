import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@lmthing/auth'
import { useGlobRead } from '@lmthing/state'
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
  (import.meta.env.DEV ? 'https://cloud.test' : 'https://lmthing.cloud')

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

/** Files that belong to the editor but not the runnable space spec. */
function isRunnableSpaceFile(path: string): boolean {
  if (path.includes('/conversations/')) return false
  const base = path.split('/').pop() ?? ''
  if (base.startsWith('.env')) return false
  return true
}

type RunPhase = 'idle' | 'provisioning' | 'syncing' | 'starting' | 'ready'

function AgentChatPage() {
  const { agentId, spaceId } = Route.useParams()
  const { session } = useAuth()

  // The current space's files, straight from the VFS in canonical on-disk
  // layout (agents/<slug>/instruct.md, tasklists/…, knowledge/…, functions/…).
  const spaceFiles = useGlobRead('**/*')
  const fileMap = useMemo(() => {
    const out: Record<string, string> = {}
    for (const [path, content] of Object.entries(spaceFiles)) {
      if (isRunnableSpaceFile(path)) out[path] = content
    }
    return out
  }, [spaceFiles])

  // A pod-unique, single-segment name for this space (the sync endpoint rejects
  // path separators), stable for this space within the user's pod.
  const spaceName = useMemo(
    () => String(spaceId).replace(/[^a-zA-Z0-9._-]/g, '-'),
    [spaceId],
  )

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [phase, setPhase] = useState<RunPhase>('idle')
  const [podError, setPodError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const runningRef = useRef(false)
  const startedOnceRef = useRef(false)

  // Sync the current (possibly unsaved) space into the pod, then open a fresh
  // session against it. Re-runnable so edits can be pushed without a reload.
  const startSession = useCallback(async () => {
    if (!session?.accessToken || runningRef.current) return
    runningRef.current = true
    setPodError(null)
    setSessionId(null)
    try {
      setPhase('provisioning')
      await ensurePod(CLOUD_BASE_URL, session.accessToken)

      setPhase('syncing')
      const { spaceDir } = await ReplRpcClient.syncSpace(
        COMPUTER_BASE_URL,
        spaceName,
        fileMap,
        session.accessToken,
      )

      setPhase('starting')
      const client = await ReplRpcClient.createSession(
        COMPUTER_BASE_URL,
        { spaceDir, agentSlug: agentId },
        session.accessToken,
      )
      setSessionId(client.sessionId!)
      setPhase('ready')
    } catch (err) {
      setPodError(err instanceof Error ? err.message : String(err))
      setPhase('idle')
    } finally {
      runningRef.current = false
    }
  }, [session, agentId, spaceName, fileMap])

  // Auto-start once the VFS has hydrated. useGlobRead populates asynchronously,
  // so starting on bare mount would sync an EMPTY space (race). Wait until the
  // space actually has files before the first run.
  useEffect(() => {
    if (startedOnceRef.current || !session?.accessToken) return
    if (Object.keys(fileMap).length === 0) return
    startedOnceRef.current = true
    void startSession()
  }, [session, startSession, fileMap])

  const { blocks, sendMessage, submitForm, cancelAsk, isConnected, isDone } = useReplSession(
    sessionId
      ? { baseUrl: COMPUTER_BASE_URL, sessionId, accessToken: session?.accessToken }
      : // Pass a dummy config that won't connect until sessionId is set
        { baseUrl: COMPUTER_BASE_URL, sessionId: '', accessToken: session?.accessToken },
  )

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

  if (!session) {
    return <div style={styles.center}>Signing in…</div>
  }

  if (podError) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#c00' }}>Failed to run space: {podError}</p>
        <button onClick={() => void startSession()}>Retry</button>
      </div>
    )
  }

  if (!sessionId) {
    return <div style={styles.center}>{PHASE_LABEL[phase] ?? 'Starting agent session…'}</div>
  }

  return (
    <div style={styles.container}>
      {/* Connection status + re-sync control */}
      <div style={styles.statusBar}>
        <span style={{ color: isConnected ? '#22c55e' : '#ef4444' }}>
          {isConnected ? '● Connected' : '○ Connecting…'}
        </span>
        {isDone && <span style={{ marginLeft: 12, color: '#6b7280' }}>Done</span>}
        <button
          onClick={() => void startSession()}
          disabled={runningRef.current || phase !== 'ready'}
          style={styles.resyncButton}
          title="Push the latest edits to your pod and restart the agent"
        >
          ↻ Re-sync &amp; restart
        </button>
      </div>

      {/* Block stream */}
      <div style={styles.blocks}>
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
      </div>

      {/* Message input */}
      <div style={styles.inputRow}>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message agent… (Enter to send, Shift+Enter for newline)"
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

const PHASE_LABEL: Record<RunPhase, string> = {
  idle: 'Starting agent session…',
  provisioning: 'Provisioning compute pod…',
  syncing: 'Syncing space to your pod…',
  starting: 'Starting agent session…',
  ready: 'Ready',
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    overflow: 'hidden',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6b7280',
  } as React.CSSProperties,
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: 12,
    flexShrink: 0,
  } as React.CSSProperties,
  resyncButton: {
    marginLeft: 'auto',
    padding: '2px 10px',
    borderRadius: 4,
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,
  blocks: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
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
    padding: '8px 12px',
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

export const Route = createFileRoute('/$projectId/$spaceId/agent/$agentId/chat/')({
  component: AgentChatPage,
})
