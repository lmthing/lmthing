import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { ThingWebView } from '@lmthing/ui/components/thing/thing-web-view'
import type { ThingWebViewSession } from '@lmthing/ui/components/thing/thing-web-view'
import { useReplConnection } from '@/lib/runtime/use-repl-connection'
import { useIdeStore } from '@/lib/store'

export const Route = createFileRoute('/chat')({
  component: ChatRoute,
})

function ChatRoute() {
  const previewUrl = useIdeStore(s => s.previewUrl)
  const repl = useReplConnection(previewUrl)

  const session = useMemo<ThingWebViewSession>(() => ({
    connected: repl.connected,
    snapshot: {
      status: repl.status as any,
      blocks: [],
      scope: [],
      asyncTasks: [],
      activeFormId: null,
      tasklistsState: { tasklists: new Map() },
      agentEntries: [],
    },
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
  }), [repl.connected, repl.status, repl.blocks, repl.sendMessage])

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <ThingWebView session={session} />
    </div>
  )
}
