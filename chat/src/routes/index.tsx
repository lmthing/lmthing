import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useReplSession } from 'lmthing'

const COMPUTER_URL = import.meta.env.VITE_COMPUTER_URL ?? 'http://computer.local'

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'lmthing:server-ready') {
        const ws = (e.data.url as string).replace(/^http/, 'ws')
        setWsUrl(ws)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const session = useReplSession(wsUrl ?? '')

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.blocks])

  function handleSend() {
    const text = input.trim()
    if (!text || !session.connected) return
    session.sendMessage(text)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const statusLabel = !wsUrl
    ? 'Booting…'
    : session.connected
      ? 'Connected'
      : 'Connecting…'

  const statusColor = !wsUrl
    ? 'text-yellow-500'
    : session.connected
      ? 'text-green-500'
      : 'text-yellow-500'

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Computer iframe */}
      <iframe
        src={COMPUTER_URL}
        className="h-full flex-[3] border-0 border-r border-border"
        allow="cross-origin-isolated"
        title="lmthing computer"
      />

      {/* Chat panel */}
      <div className="flex h-full flex-1 flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          <span className="text-sm font-medium">THING</span>
          <span className={`text-xs ${statusColor}`}>{statusLabel}</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {session.blocks.map((block) => {
            if (block.type === 'user') {
              return (
                <div key={block.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                    {block.text}
                  </div>
                </div>
              )
            }
            if (block.type === 'code') {
              return (
                <div key={block.id} className="rounded-md bg-muted px-3 py-2">
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">
                    {block.code}
                    {block.streaming && <span className="animate-pulse">▋</span>}
                  </pre>
                </div>
              )
            }
            if (block.type === 'error') {
              return (
                <div key={block.id} className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {block.error.message}
                </div>
              )
            }
            return null
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              rows={2}
              placeholder={wsUrl ? 'Message THING…' : 'Waiting for computer to boot…'}
              disabled={!session.connected}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="self-end rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
              disabled={!session.connected || !input.trim()}
              onClick={handleSend}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
