import { useRef, useState, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { useReplSession } from 'lmthing/web/rpc-client'
import type { UIBlock } from 'lmthing/web/rpc-client'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

import '@lmthing/css/components/thing/thing-panel/index.css'
import '@lmthing/css/components/thing/thing-chat/index.css'

// ── Types ─────────────────────────────────────────────────────────────

export interface ThingChatProps {
  wsUrl: string | null
}

// ── Booting state ─────────────────────────────────────────────────────

function ThingChatBooting() {
  return (
    <div className="thing-chat">
      <div className="thing-chat__header">
        <span className="thing-chat__header-title">
          <CozyThingText text="THING" />
        </span>
        <div className="thing-chat__status">
          <span className="thing-chat__status-label">Booting…</span>
          <span className="thing-panel__status-dot thing-panel__status-dot--warn" />
        </div>
      </div>
      <div className="thing-chat__booting">
        <span className="thing-chat__booting-label">Starting computer…</span>
      </div>
    </div>
  )
}

// ── Block renderer ────────────────────────────────────────────────────

function ReplBlock({ block }: { block: UIBlock }) {
  if (block.type === 'user') {
    return (
      <div className="thing-msg thing-msg--user">
        <div className="thing-msg__role">You</div>
        <div className="thing-msg__text">{block.text}</div>
      </div>
    )
  }

  if (block.type === 'code') {
    return (
      <div className="thing-code-block">
        <div className="thing-code-block__inner">
          {block.code}
          {block.streaming && <span className="thing-code-block__cursor">▋</span>}
        </div>
      </div>
    )
  }

  if (block.type === 'error') {
    return (
      <div className="thing-error-block">
        {block.error.message}
      </div>
    )
  }

  if (block.type === 'hook') {
    return (
      <div className="thing-hook-block">
        ⚑ {block.hookId}: {block.action} — {block.detail}
      </div>
    )
  }

  if (block.type === 'tasklist_declared') {
    const tasks = block.plan.tasks
    return (
      <div className="thing-tasklist-block">
        <div className="thing-tasklist-block__title">Plan: {block.plan.description}</div>
        {tasks.map((t) => (
          <div key={t.id} className="thing-tasklist-block__task">
            ○ {t.instructions.slice(0, 80)}{t.instructions.length > 80 ? '…' : ''}
          </div>
        ))}
      </div>
    )
  }

  if (block.type === 'task_complete') {
    return (
      <div className="thing-task-complete">
        ✓ {block.taskId}
      </div>
    )
  }

  // display / form: skip (requires JSX deserialisation)
  return null
}

// ── Connected session ─────────────────────────────────────────────────

function ThingChatSession({ wsUrl }: { wsUrl: string }) {
  const session = useReplSession(wsUrl)
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.blocks])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !session.connected) return
    session.sendMessage(text)
    setInput('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ;(e.currentTarget.form as HTMLFormElement | null)?.requestSubmit()
    }
  }

  const isExecuting = session.snapshot.status === 'executing'

  const dotClass = [
    'thing-panel__status-dot',
    !session.connected
      ? 'thing-panel__status-dot--warn'
      : isExecuting
        ? 'thing-panel__status-dot--working'
        : 'thing-panel__status-dot--ready',
  ].join(' ')

  const statusLabel = !session.connected
    ? 'Connecting…'
    : isExecuting
      ? 'Running'
      : 'Connected'

  return (
    <div className="thing-chat">
      <div className="thing-chat__header">
        <span className="thing-chat__header-title">
          <CozyThingText text="THING" />
        </span>
        <div className="thing-chat__status">
          <span className="thing-chat__status-label">{statusLabel}</span>
          <span className={dotClass} />
        </div>
      </div>

      <div className="thing-chat__messages">
        {session.blocks.map((block) => (
          <ReplBlock key={block.id} block={block} />
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="thing-chat__input-form">
        <textarea
          className="thing-chat__textarea"
          rows={2}
          placeholder={session.connected ? 'Message THING… (Enter to send)' : 'Waiting for connection…'}
          disabled={!session.connected}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="thing-chat__send-btn"
          disabled={!session.connected || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  )
}

// ── Public component ──────────────────────────────────────────────────

export function ThingChat({ wsUrl }: ThingChatProps) {
  if (!wsUrl) return <ThingChatBooting />
  return <ThingChatSession wsUrl={wsUrl} />
}
