import { useState, useEffect, useRef } from 'react'
import { useReplSession } from './rpc-client'
import type { UIBlock } from './rpc-client'
import type { ConversationTurn } from '../session/conversation-state'
import { ChatView } from './components/ChatView'
import { InputBar } from './components/InputBar'
import { Sidebar } from './components/Sidebar'
import { ConversationSidebar } from './components/ConversationSidebar'
import './App.css'

const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:3100'

function useConversationId(defaultId: string): string {
  const [id, setId] = useState(() => {
    const match = window.location.hash.match(/^#\/chat\/(.+)$/)
    if (match) return match[1]
    window.location.hash = `#/chat/${defaultId}`
    return defaultId
  })

  useEffect(() => {
    const handler = () => {
      const match = window.location.hash.match(/^#\/chat\/(.+)$/)
      if (match) setId(match[1])
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return id
}

function turnsToBlocks(turns: ConversationTurn[]): UIBlock[] {
  const blocks: UIBlock[] = []
  for (const turn of turns) {
    if (turn.role === 'user' && turn.message) {
      blocks.push({ type: 'user', id: `turn_${turn.index}_user`, text: turn.message })
    }
    if (turn.role === 'assistant' && turn.code && turn.code.length > 0) {
      const code = turn.code.join('\n')
      blocks.push({
        type: 'code',
        id: `turn_${turn.index}_code`,
        code,
        streaming: false,
        lineCount: turn.code.length,
      })
    }
    if (turn.boundary?.type === 'stop') {
      blocks.push({ type: 'read', id: `turn_${turn.index}_read`, payload: turn.boundary.payload })
    }
    if (turn.boundary?.type === 'error') {
      blocks.push({ type: 'error', id: `turn_${turn.index}_error`, error: turn.boundary.error })
    }
  }
  return blocks
}

export function App() {
  const [activeSessionId] = useState(() => crypto.randomUUID())
  const conversationId = useConversationId(activeSessionId)
  const session = useReplSession(WS_URL)
  const { snapshot, blocks, connected } = session
  const isExecuting = snapshot.status === 'executing'
  const isPaused = snapshot.status === 'paused'
  const hasAsyncTasks = snapshot.asyncTasks.length > 0
  const isLiveView = conversationId === activeSessionId

  // Request conversations list on connect
  useEffect(() => {
    if (connected) session.requestConversations()
  }, [connected])

  // Auto-save on turn boundaries (executing → idle/waiting/complete)
  const prevStatusRef = useRef(snapshot.status)
  useEffect(() => {
    const prev = prevStatusRef.current
    const curr = snapshot.status
    prevStatusRef.current = curr
    if (connected && prev === 'executing' && (curr === 'idle' || curr === 'waiting_for_input' || curr === 'complete')) {
      session.saveConversation(activeSessionId)
    }
  }, [snapshot.status, connected, activeSessionId])

  // Load conversation when viewing history
  useEffect(() => {
    if (!isLiveView && connected) {
      session.loadConversation(conversationId)
    }
  }, [conversationId, isLiveView, connected])

  const historyBlocks = session.loadedConversation?.id === conversationId
    ? turnsToBlocks(session.loadedConversation.state.turns)
    : []

  const handleSelectConversation = (id: string) => {
    window.location.hash = `#/chat/${id}`
  }

  const handleNewConversation = () => {
    window.location.hash = `#/chat/${activeSessionId}`
  }

  const displayBlocks = isLiveView ? blocks : historyBlocks

  return (
    <div className="app-layout">
      <ConversationSidebar
        conversations={session.conversations}
        activeId={conversationId}
        liveSessionId={activeSessionId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
      />
      <div className="main-column">
        {!connected && (
          <div className="connection-bar">
            Disconnected — waiting for server at {WS_URL}
          </div>
        )}
        {!isLiveView && (
          <div className="history-banner">
            Viewing saved conversation
            <button className="history-banner__back" onClick={handleNewConversation}>
              Back to live session
            </button>
          </div>
        )}
        <ChatView
          blocks={displayBlocks}
          status={isLiveView ? snapshot.status : 'idle'}
          activeFormId={isLiveView ? snapshot.activeFormId : null}
          onSubmitForm={session.submitForm}
          onCancelAsk={session.cancelAsk}
        />
        {isLiveView && (
          <InputBar
            onSend={isExecuting || isPaused ? session.intervene : session.sendMessage}
            onPause={session.pause}
            onResume={session.resume}
            status={snapshot.status}
            disabled={!connected}
            actions={session.actions}
          />
        )}
      </div>
      <Sidebar
        tasks={snapshot.asyncTasks}
        onCancel={session.cancelTask}
        collapsed={!hasAsyncTasks}
      />
    </div>
  )
}
