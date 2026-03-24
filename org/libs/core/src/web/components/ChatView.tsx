import { useEffect, useRef } from 'react'
import type { UIBlock } from '../rpc-client'
import type { SessionStatus } from '@lmthing/repl'
import { BlockRenderer } from './BlockRenderer'
import { ActivityIndicator } from './ActivityIndicator'

interface ChatViewProps {
  blocks: UIBlock[]
  status: SessionStatus
  activeFormId: string | null
  onSubmitForm: (formId: string, data: Record<string, unknown>) => void
  onCancelAsk: (formId: string) => void
}

export function ChatView({ blocks, status, activeFormId, onSubmitForm, onCancelAsk }: ChatViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      stickToBottomRef.current = atBottom
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    if (stickToBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [blocks])

  const isActive = status === 'executing'
  const isPaused = status === 'paused'

  return (
    <div className="chat-area" ref={scrollRef}>
      {blocks.length === 0 && (
        <div className="empty-state">
          <div className="logo">@lmthing/repl</div>
          <div>Send a message to start</div>
        </div>
      )}

      {blocks.map(block => (
        <BlockRenderer
          key={block.id}
          block={block}
          activeFormId={activeFormId}
          onSubmitForm={onSubmitForm}
          onCancelAsk={onCancelAsk}
        />
      ))}

      {isPaused && <div className="paused-badge">&#x23F8; Paused</div>}
      {isActive && <ActivityIndicator />}
    </div>
  )
}
