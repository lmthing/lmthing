import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useAuth } from '@lmthing/auth'
import { useGlobRead, useSpaceFS } from '@lmthing/state'
import { ThingWebView } from '@lmthing/ui/components/thing/thing-web-view'
import type { ThingWebViewSession, UIBlock, SessionSnapshot } from '@lmthing/ui/components/thing/thing-web-view'

const COMPUTER_URL = import.meta.env.VITE_COMPUTER_URL
  ?? (import.meta.env.DEV ? 'https://computer.local' : 'https://lmthing.computer')

const EMPTY_SNAPSHOT: SessionSnapshot = {
  status: 'idle',
  blocks: [],
  scope: [],
  asyncTasks: [],
  activeFormId: null,
  tasklistsState: { tasklists: new Map() },
  agentEntries: [],
}

function useReplRelay(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
): ThingWebViewSession {
  const [state, setState] = useState<{
    connected: boolean
    snapshot: SessionSnapshot
    blocks: UIBlock[]
  }>({
    connected: false,
    snapshot: EMPTY_SNAPSHOT,
    blocks: [],
  })

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:repl-update') {
        setState({
          connected: e.data.connected,
          snapshot: e.data.snapshot ?? EMPTY_SNAPSHOT,
          blocks: e.data.blocks ?? [],
        })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return useMemo<ThingWebViewSession>(() => ({
    ...state,
    actions: [],
    conversations: [],
    loadedConversation: null,
    sendMessage: (text) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'lmthing:repl-send', text }, '*')
    },
    intervene: (text) => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'lmthing:repl-send', text }, '*')
    },
    submitForm: () => {},
    cancelAsk: () => {},
    cancelTask: () => {},
    pause: () => {},
    resume: () => {},
    saveConversation: () => {},
    requestConversations: () => {},
    loadConversation: () => {},
  }), [state, iframeRef])
}

function AgentChatPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { session } = useAuth()
  const spaceFiles = useGlobRead('**')
  const spaceFS = useSpaceFS()

  // Tracks what the computer currently has — used to push only diffs (studio→computer)
  // and to avoid re-pushing files that just arrived from the computer (computer→studio).
  const computerFilesRef = useRef<Map<string, string>>(new Map())

  const replSession = useReplRelay(iframeRef)

  const sendSession = () => {
    if (session && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'lmthing:session', session }, '*')
    }
  }

  // ── Computer → Studio: apply FS changes from the computer ──
  useEffect(() => {
    if (!spaceFS) return

    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:auth-needed') {
        sendSession()
        return
      }
      if (e.data?.type !== 'lmthing:fs-change') return

      const { path, content } = e.data as { path: string; content: string | null }
      if (content === null) {
        computerFilesRef.current.delete(path)
        spaceFS.deleteFile(path)
      } else {
        computerFilesRef.current.set(path, content)
        spaceFS.writeFile(path, content)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [spaceFS, session])

  // ── Studio → Computer: push only files that differ from what computer has ──
  useEffect(() => {
    if (!spaceFiles || Object.keys(spaceFiles).length === 0) return

    function pushChanges() {
      if (!iframeRef.current?.contentWindow) return

      const toSend: Record<string, string> = {}
      for (const [path, content] of Object.entries(spaceFiles)) {
        if (computerFilesRef.current.get(path) !== content) {
          toSend[path] = content
        }
      }
      if (Object.keys(toSend).length === 0) return

      // Optimistically mark these as "computer now has this" to prevent echo loops
      for (const [path, content] of Object.entries(toSend)) {
        computerFilesRef.current.set(path, content)
      }
      iframeRef.current.contentWindow.postMessage({
        type: 'lmthing:fs-write-batch',
        files: toSend,
      }, '*')
    }

    // Try immediately (container may already be ready)
    pushChanges()

    // Also push when WebContainer becomes ready after this effect runs
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:fs-ready') pushChanges()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [spaceFiles])

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Computer iframe always in DOM — keeps WebContainer running */}
      <iframe
        ref={iframeRef}
        src={`${COMPUTER_URL}/chat`}
        allow="cross-origin-isolated"
        title="lmthing computer"
        onLoad={sendSession}
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1280px',
          height: '800px',
          border: 'none',
        }}
      />
      <ThingWebView session={replSession} />
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/agent/$agentId/chat/',
)({
  component: AgentChatPage,
})
