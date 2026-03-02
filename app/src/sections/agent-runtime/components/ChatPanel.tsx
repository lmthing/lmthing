import type { Message, ChatPanelProps } from '@/../product/sections/agent-runtime/types'
import React, { useState, useRef, useEffect, useMemo } from 'react'

// Format timestamp for display
function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Slash action badge for user messages
function SlashActionBadge({ action, parameters }: { action: string; parameters?: Record<string, string> }) {
  return (
    <div className="mb-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          /{action}
        </span>
      </div>
      {parameters && Object.keys(parameters).length > 0 && (
        <div className="flex flex-col gap-1 ml-5">
          {Object.entries(parameters).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-400">{key}:</span>
              <span className="font-mono text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                {value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Beautified YAML-like display for structured output
function StructuredOutputDisplay({ output }: { output: Record<string, unknown> }) {
  const [isExpanded, setIsExpanded] = useState(true)

  // Recursively render a value with appropriate styling
  function renderValue(value: unknown, depth = 0): React.ReactNode {
    const indent = depth * 16

    if (value === null) {
      return <span className="text-slate-400 dark:text-slate-500">null</span>
    }

    if (typeof value === 'boolean') {
      return <span className="text-violet-600 dark:text-violet-400">{String(value)}</span>
    }

    if (typeof value === 'number') {
      return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>
    }

    if (typeof value === 'string') {
      return <span className="text-green-600 dark:text-green-400">"{value}"</span>
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-slate-400 dark:text-slate-500">[]</span>
      }
      return (
        <div className="text-slate-600 dark:text-slate-400">
          [
          {value.map((item, i) => (
            <div key={i} style={{ paddingLeft: `${indent + 12}px` }} className="py-0.5">
              <span className="text-slate-400 dark:text-slate-500">-</span>
              {' '}
              {renderValue(item, depth + 1)}
              {i < value.length - 1 && ','}
            </div>
          ))}
          <div style={{ paddingLeft: `${indent}px` }}>]</div>
        </div>
      )
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) {
        return <span className="text-slate-400 dark:text-slate-500">
          {'{}'}
        </span>
      }
      return (
        <div>
          <div className="text-slate-600 dark:text-slate-400">
            {'{'}
          </div>
          {entries.map(([key, val], i) => (
            <div key={key} style={{ paddingLeft: `${indent + 12}px` }} className="py-0.5">
              <span className="text-cyan-600 dark:text-cyan-400">{key}</span>
              <span className="text-slate-400 dark:text-slate-500">: </span>
              {renderValue(val, depth + 1)}
              {i < entries.length - 1 && <span className="text-slate-400 dark:text-slate-500">,</span>}
            </div>
          ))}
          <div style={{ paddingLeft: `${indent}px` }}>
            {'}'}
          </div>
        </div>
      )
    }

    return <span className="text-slate-500">{String(value)}</span>
  }

  // Extract display info from output
  const type = output.type as string | undefined
  const version = output.version as string | undefined

  return (
    <div className="mt-3 rounded-xl border border-violet-200 dark:border-violet-800 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-50 to-amber-50 dark:from-violet-950/50 dark:to-amber-950/50
          hover:from-violet-100 hover:to-amber-100 dark:hover:from-violet-900/50 dark:hover:to-amber-900/50
          transition-colors"
      >
        <svg className="w-4 h-4 text-violet-500 dark:text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium text-violet-700 dark:text-violet-300 capitalize">
          {type?.replace(/([A-Z])/g, ' $1').trim() || 'Structured Output'}
        </span>
        {version && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            v{version}
          </span>
        )}
        <svg
          className={`w-4 h-4 text-slate-400 dark:text-slate-500 ml-auto transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-4 bg-white dark:bg-slate-900 max-h-96 overflow-auto animate-in slide-in-from-top-2 duration-200">
          <pre className="text-xs font-mono leading-relaxed">
            {renderValue(output)}
          </pre>
        </div>
      )}
    </div>
  )
}

// Message bubble component
interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div className={`
        max-w-[85%] rounded-2xl px-4 py-3
        ${isUser
          ? 'bg-violet-600 text-white rounded-br-md'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
        }
      `}>
        {/* Slash action indicator for user messages */}
        {isUser && message.slashAction && (
          <SlashActionBadge
            action={message.slashAction.action}
            parameters={message.slashAction.parameters}
          />
        )}

        {/* Message content - hide if slash action (shown in badge instead) */}
        {(!isUser || !message.slashAction) && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-1 h-4 bg-violet-400 ml-1 animate-pulse" />
            )}
          </p>
        )}

        {/* Structured output for assistant messages */}
        {!isUser && message.structuredOutput && (
          <StructuredOutputDisplay output={message.structuredOutput as Record<string, unknown>} />
        )}

        {/* Timestamp */}
        {!isStreaming && (
          <span className={`text-[10px] mt-1 block ${
            isUser ? 'text-violet-200' : 'text-slate-400 dark:text-slate-500'
          }`}>
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  )
}

// Loading indicator for agent response
function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// Empty state when no conversation
function EmptyConversationState({ agentName }: { agentName: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-amber-100
        dark:from-violet-900/30 dark:to-amber-900/30 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Start a conversation
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        Send a message to <span className="font-medium text-violet-600 dark:text-violet-400">{agentName}</span> to begin testing.
      </p>
    </div>
  )
}

// Message input component
interface MessageInputProps {
  agentName: string
  onSend: (content: string) => void
  isLoading?: boolean
  slashActions?: Array<{ name: string; description: string; flowId: string; actionId: string }>
}

function MessageInput({ agentName, onSend, isLoading = false, slashActions = [] }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  // Filter slash actions based on current input
  const filteredActions = useMemo(() => {
    if (!value.startsWith('/')) return []
    const command = value.slice(1).toLowerCase()
    if (command === '') return slashActions
    return slashActions.filter(action => 
      action.name.toLowerCase().includes(command) ||
      action.description.toLowerCase().includes(command)
    )
  }, [value, slashActions])

  // Show autocomplete when typing slash commands
  useEffect(() => {
    setShowAutocomplete(value.startsWith('/') && filteredActions.length > 0)
    setSelectedIndex(0)
  }, [value, filteredActions.length])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle autocomplete navigation
    if (showAutocomplete) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredActions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length)
        return
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        const selected = filteredActions[selectedIndex]
        if (selected) {
          setValue(`/${selected.name}`)
          setShowAutocomplete(false)
          inputRef.current?.focus()
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowAutocomplete(false)
        return
      }
    }

    // Handle normal send
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !isLoading) {
        onSend(value)
        setValue('')
      }
    }
  }

  const handleSendClick = () => {
    if (value.trim() && !isLoading) {
      onSend(value)
      setValue('')
    }
  }

  const handleSelectAction = (action: { name: string; description: string }) => {
    setValue(`/${action.name}`)
    setShowAutocomplete(false)
    inputRef.current?.focus()
  }

  return (
    <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-950">
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          {/* Autocomplete dropdown */}
          {showAutocomplete && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg max-h-60 overflow-y-auto z-10">
              {filteredActions.map((action, index) => (
                <button
                  key={action.name}
                  onClick={() => handleSelectAction(action)}
                  className={`w-full text-left px-4 py-2.5 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                    index === selectedIndex
                      ? 'bg-violet-50 dark:bg-violet-900/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-violet-500 dark:text-violet-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        /{action.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {action.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Message ${agentName}...${slashActions.length > 0 ? ' (Type / for commands)' : ''}`}
            rows={1}
            className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700
              bg-slate-50 dark:bg-slate-900 px-4 py-3 pr-12
              text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
              transition-all"
            disabled={isLoading}
            onKeyDown={handleKeyDown}
          />
          <div className="absolute right-2 bottom-2">
            <button
              onClick={handleSendClick}
              className="p-1.5 rounded-lg
                bg-violet-600 hover:bg-violet-700 text-white
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !value.trim()}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        Press Enter to send, Shift+Enter for new line{slashActions.length > 0 ? ', / for commands' : ''}
      </p>
    </div>
  )
}

// Main Chat Panel component
export function ChatPanel({
  agent,
  activeConversation,
  isLoading = false,
  isStreaming = false,
  onSendMessage,
  onSaveConversation,
  canSaveConversation = false,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation?.messages])
  const hasMessages = messages.length > 0

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSendMessage = (content: string) => {
    onSendMessage?.(content)
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950 overflow-hidden relative">
      {/* Chat Actions */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 px-6 py-3 bg-slate-50 dark:bg-slate-900/30">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onViewSystemPrompt?.()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="View system prompt"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            System Prompt
          </button>
          <button
            onClick={() => onSaveConversation?.()}
            disabled={!canSaveConversation}
            className="inline-flex items-center gap-2 rounded-lg border border-violet-300 dark:border-violet-700 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={canSaveConversation ? 'Save conversation to workspace' : 'Save is available for saved agents only'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!hasMessages ? (
          <EmptyConversationState agentName={agent.name} />
        ) : (
          <div className="space-y-4">
            {messages.map((message, idx) => (
              <MessageBubble
                key={message.id}
                message={message}
                isStreaming={isStreaming && idx === messages.length - 1}
              />
            ))}
            {isLoading && !isStreaming && <LoadingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <MessageInput
        agentName={agent.name}
        onSend={handleSendMessage}
        isLoading={isLoading}
        slashActions={agent.slashActions}
      />
    </div>
  )
}
