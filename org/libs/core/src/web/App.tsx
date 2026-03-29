import { useState, useEffect, useRef } from 'react'
import { useReplSession } from './rpc-client'
import type { UIBlock } from '@lmthing/ui/components/thing/thing-web-view/types'
import type { ConversationTurn } from '@lmthing/repl'
import { ThingWebView } from '@lmthing/ui/components/thing/thing-web-view'

const WS_URL = (import.meta as any).env?.VITE_WS_URL ?? 'ws://localhost:3010'

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
  const { snapshot, blocks, connected, sendMessage } = session
  const isLiveView = conversationId === activeSessionId

  // Request conversations list on connect
  useEffect(() => {
    if (connected) session.requestConversations()
  }, [connected])

  // Auto-save on turn boundaries (executing -> idle/waiting/complete)
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

  // When embedded as an inner iframe: forward session state to the parent frame
  useEffect(() => {
    if (window === window.top) return
    window.parent.postMessage({
      type: 'lmthing:repl-update',
      connected,
      snapshot: { status: snapshot.status },
      blocks,
    }, '*')
  }, [connected, snapshot.status, blocks])

  useEffect(() => {
    if (window === window.top) return
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:repl-send') sendMessage(e.data.text)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [sendMessage])

  const handleSelectConversation = (id: string) => {
    window.location.hash = `#/chat/${id}`
  }

  const handleNewConversation = () => {
    window.location.hash = `#/chat/${activeSessionId}`
  }

  return (
    <ThingWebView
      session={session}
      conversationId={conversationId}
      liveSessionId={activeSessionId}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      historyBlocks={historyBlocks}
      isLiveView={isLiveView}
      wsUrl={WS_URL}
    />
  )
}
