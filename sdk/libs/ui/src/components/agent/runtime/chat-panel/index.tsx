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
import { StructuredOutputDisplay } from '@lmthing/ui/components/agent/runtime/structured-output-display'
import { cn } from '../../../../lib/utils'

import '@lmthing/css/components/chat/chat-panel/index.css'

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

interface ChatAgent {
  id: string
  name: string
  slashActions: Array<{ name: string; description: string; actionId: string }>
}

interface ChatPanelProps {
  agent: ChatAgent
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
    <div className={cn('chat-bubble', isUser ? 'chat-bubble--user' : 'chat-bubble--assistant')}>
      <div className={cn('card chat-bubble__content', isUser && 'chat-bubble__content--user')}>
        {isUser && message.slashAction && (
          <div className="chat-bubble__slash-action">
            <span className="chat-bubble__slash-tag">
              /{message.slashAction.action}
              {message.slashAction.parameters && Object.keys(message.slashAction.parameters).length > 0 && (
                <span className="chat-bubble__slash-params">
                  {Object.entries(message.slashAction.parameters).map(([k, v]) => `${k}=${v}`).join(' ')}
                </span>
              )}
            </span>
          </div>
        )}
        {(!isUser || !message.slashAction) && (
          <p className="chat-bubble__text">
            {message.content}
            {isStreaming && <span className="chat-bubble__cursor" />}
          </p>
        )}
        {!isUser && message.structuredOutput && (
          <div className="chat-bubble__structured-output">
            <StructuredOutputDisplay data={message.structuredOutput} />
          </div>
        )}
        {!isStreaming && (
          <Caption className="chat-bubble__timestamp">
            {formatTime(message.timestamp)}
          </Caption>
        )}
      </div>
    </div>
  )
}

function MessageInput({ agentName, onSend, isLoading = false, slashActions = [] }: {
  agentName: string
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
      <Stack row gap="sm">
        <div className="chat-input__wrapper">
          {showAutocomplete && (
            <div className="dropdown__content chat-input__autocomplete">
              {filteredActions.map((action, index) => (
                <button
                  key={action.name}
                  onClick={() => { setValue(`/${action.name}`); setShowAutocomplete(false); inputRef.current?.focus() }}
                  className={cn('dropdown__item chat-input__autocomplete-item', index === selectedIndex && 'list-item--selected')}
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
            placeholder={`Message ${agentName}...${slashActions.length > 0 ? ' (Type / for commands)' : ''}`}
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
      <Caption muted className="chat-input__hint">
        Press Enter to send, Shift+Enter for new line{slashActions.length > 0 ? ', / for commands' : ''}
      </Caption>
    </CardFooter>
  )
}

export function ChatPanel({
  agent,
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
    <Panel className="chat-panel">
      <PanelHeader>
        <Stack row gap="sm" className="chat-panel__header">
          <Button onClick={() => onViewSystemPrompt?.()} variant="ghost" size="sm">System Prompt</Button>
          {onSaveConversation && <Button onClick={() => onSaveConversation()} disabled={!canSaveConversation} variant="ghost" size="sm">Save</Button>}
        </Stack>
      </PanelHeader>

      <PanelBody className="chat-panel__messages">
        {messages.length === 0 ? (
          <div className="chat-panel__empty">
            <div className="chat-panel__empty-icon">💬</div>
            <Heading level={3}>Start a conversation</Heading>
            <Caption muted>Send a message to <strong>{agent.name}</strong> to begin testing.</Caption>
          </div>
        ) : (
          <Stack gap="md">
            {messages.map((message, idx) => (
              <MessageBubble key={message.id} message={message} isStreaming={isStreaming && idx === messages.length - 1} />
            ))}
            {isLoading && !isStreaming && (
              <div className="chat-loading-dots">
                <span className="chat-loading-dot" />
                <span className="chat-loading-dot" />
                <span className="chat-loading-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </Stack>
        )}
      </PanelBody>

      <MessageInput
        agentName={agent.name}
        onSend={(content) => onSendMessage?.(content)}
        isLoading={isLoading}
        slashActions={agent.slashActions}
      />
    </Panel>
  )
}
