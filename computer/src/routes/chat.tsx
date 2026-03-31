import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ThingWebView } from '@lmthing/ui/components/thing/thing-web-view'
import type { ThingWebViewSession } from '@lmthing/ui/components/thing/thing-web-view'
import { useReplBridge } from '@/lib/runtime/use-repl-bridge'

export const Route = createFileRoute('/chat')({
  component: ChatRoute,
})

function ChatRoute() {
  const repl = useReplBridge()

  const session = useMemo<ThingWebViewSession>(() => ({
    connected: repl.connected,
    snapshot: repl.snapshot,
    blocks: repl.blocks,
    actions: [],
    conversations: [],
    loadedConversation: null,
    sendMessage: repl.sendMessage,
    intervene: repl.sendMessage,
    submitForm: () => {},
    cancelAsk: () => {},
    cancelTask: () => {},
    pause: () => {},
    resume: () => {},
    saveConversation: () => {},
    requestConversations: () => {},
    loadConversation: () => {},
  }), [repl.connected, repl.snapshot, repl.blocks, repl.sendMessage])

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <ThingWebView session={session} />
    </div>
  )
}
