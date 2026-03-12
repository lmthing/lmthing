import React, { useRef, useEffect, useMemo } from 'react'
import { useUIState, useToggle } from '@lmthing/state'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Panel, PanelHeader, PanelBody } from '@lmthing/ui/elements/content/panel'
import { CardFooter } from '@lmthing/ui/elements/content/card'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Label } from '@lmthing/ui/elements/typography/label'
import { StructuredOutputDisplay } from '@lmthing/ui/components/assistant/runtime/structured-output-display'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  slashAction?: {
    action: string
    parameters?: Record<string, string>
  }
  structuredOutput?: Record<string, unknown>
}

export interface ChatConversation {
  id: string
  messages: ChatMessage[]
}

interface ChatAssistant {
  id: string
  name: string
  slashActions: Array<{ name: string; description: string; actionId: string }>
}

interface ChatPanelProps {
  assistant: ChatAssistant
  activeConversation?: ChatConversation | null
  isLoading?: boolean
  isStreaming?: boolean
  onSendMessage?: (content: string) => void
  onSaveConversation?: () => void
  canSaveConversation?: boolean
  onViewSystemPrompt?: () => void
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function MessageBubble({ message, isStreaming = false }: { message: ChatMessage; isStreaming?: boolean }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div className="card" style={{
        maxWidth: '85%',
        borderRadius: '1rem',
        padding: '0.75rem 1rem',
        background: isUser ? '#7c3aed' : undefined,
        color: isUser ? 'white' : undefined,
      }}>
        {isUser && message.slashAction && (
          <div style={{ marginBottom: '0.5rem' }}>
            <span style={{
              display: 'inline-block',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              backgroundColor: 'color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent)',
              color: 'var(--color-warning, #f59e0b)',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}>
              /{message.slashAction.action}
              {message.slashAction.parameters && Object.keys(message.slashAction.parameters).length > 0 && (
                <span style={{ fontWeight: 400, marginLeft: '0.5rem', opacity: 0.8 }}>
                  {Object.entries(message.slashAction.parameters).map(([k, v]) => `${k}=${v}`).join(' ')}
                </span>
              )}
            </span>
          </div>
        )}
        {(!isUser || !message.slashAction) && (
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.content}
            {isStreaming && <span style={{ display: 'inline-block', width: '4px', height: '1rem', background: '#a78bfa', marginLeft: '4px', animation: 'pulse 1s infinite' }} />}
          </p>
        )}
        {!isUser && message.structuredOutput && (
          <div style={{ marginTop: '0.75rem' }}>
            <StructuredOutputDisplay data={message.structuredOutput} />
          </div>
        )}
        {!isStreaming && (
          <Caption style={{ marginTop: '0.25rem', display: 'block', opacity: 0.6, fontSize: '0.625rem' }}>
            {formatTime(message.timestamp)}
          </Caption>
        )}
      </div>
    </div>
  )
}

function MessageInput({ assistantName, onSend, isLoading = false, slashActions = [] }: {
  assistantName: string
  onSend: (content: string) => void
  isLoading?: boolean
  slashActions?: Array<{ name: string; description: string; actionId: string }>
}) {
  const [value, setValue] = useUIState('chat-panel.value', '')
  const [showAutocomplete, , setShowAutocomplete] = useToggle('chat-panel.show-autocomplete', false)
  const [selectedIndex, setSelectedIndex] = useUIState('chat-panel.selected-index', 0)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const filteredActions = useMemo(() => {
    if (!value.startsWith('/')) return []
    const command = value.slice(1).toLowerCase()
    if (command === '') return slashActions
    return slashActions.filter(action =>
      action.name.toLowerCase().includes(command) || action.description.toLowerCase().includes(command)
    )
  }, [value, slashActions])

  useEffect(() => {
    setShowAutocomplete(value.startsWith('/') && filteredActions.length > 0)
    setSelectedIndex(0)
  }, [value, filteredActions.length])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(prev => (prev + 1) % filteredActions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        const selected = filteredActions[selectedIndex]
        if (selected) { setValue(`/${selected.name}`); setShowAutocomplete(false); inputRef.current?.focus() }
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); setShowAutocomplete(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !isLoading) { onSend(value); setValue('') }
    }
  }

  return (
    <CardFooter>
      <Stack row gap="sm" style={{ alignItems: 'flex-end' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {showAutocomplete && (
            <div className="dropdown__content" style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '0.5rem', maxHeight: '15rem', overflowY: 'auto' }}>
              {filteredActions.map((action, index) => (
                <button
                  key={action.name}
                  onClick={() => { setValue(`/${action.name}`); setShowAutocomplete(false); inputRef.current?.focus() }}
                  className={`dropdown__item ${index === selectedIndex ? 'list-item--selected' : ''}`}
                  style={{ width: '100%', textAlign: 'left' }}
                >
                  <Label>/{action.name}</Label>
                  <Caption muted>{action.description}</Caption>
                </button>
              ))}
            </div>
          )}
          <Textarea
            ref={inputRef}
            compact
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Message ${assistantName}...${slashActions.length > 0 ? ' (Type / for commands)' : ''}`}
            rows={1}
            disabled={isLoading}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          onClick={() => { if (value.trim() && !isLoading) { onSend(value); setValue('') } }}
          variant="primary"
          size="sm"
          disabled={isLoading || !value.trim()}
        >
          Send
        </Button>
      </Stack>
      <Caption muted style={{ marginTop: '0.5rem' }}>
        Press Enter to send, Shift+Enter for new line{slashActions.length > 0 ? ', / for commands' : ''}
      </Caption>
    </CardFooter>
  )
}

export function ChatPanel({
  assistant,
  activeConversation,
  isLoading = false,
  isStreaming = false,
  onSendMessage,
  onSaveConversation,
  canSaveConversation = false,
  onViewSystemPrompt,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation?.messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <Panel style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PanelHeader>
        <Stack row gap="sm" style={{ justifyContent: 'flex-end' }}>
          <Button onClick={() => onViewSystemPrompt?.()} variant="ghost" size="sm">System Prompt</Button>
          <Button onClick={() => onSaveConversation?.()} disabled={!canSaveConversation} variant="ghost" size="sm">Save</Button>
        </Stack>
      </PanelHeader>

      <PanelBody style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
        {messages.length === 0 ? (
          <Stack style={{ alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💬</div>
            <Heading level={3}>Start a conversation</Heading>
            <Caption muted>Send a message to <strong>{assistant.name}</strong> to begin testing.</Caption>
          </Stack>
        ) : (
          <Stack gap="md">
            {messages.map((message, idx) => (
              <MessageBubble key={message.id} message={message} isStreaming={isStreaming && idx === messages.length - 1} />
            ))}
            {isLoading && !isStreaming && (
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', background: '#94a3b8', animation: 'bounce 1s infinite' }} />
                <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', background: '#94a3b8', animation: 'bounce 1s infinite 150ms' }} />
                <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '9999px', background: '#94a3b8', animation: 'bounce 1s infinite 300ms' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </Stack>
        )}
      </PanelBody>

      <MessageInput
        assistantName={assistant.name}
        onSend={(content) => onSendMessage?.(content)}
        isLoading={isLoading}
        slashActions={assistant.slashActions}
      />
    </Panel>
  )
}
