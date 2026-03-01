import type {
  Agent,
  AgentRuntimeCallbacks,
  Conversation,
  Message
} from '@/../product/sections/agent-runtime/types'

export interface AgentRuntimeProps extends Partial<AgentRuntimeCallbacks> {
  /** List of all available agents */
  agents: Agent[]
  /** Currently selected agent (null if none selected) */
  selectedAgentId: string | null
  /** Active conversation for the selected agent (null if none) */
  conversation: Conversation | null
  /** Whether the system prompt panel is expanded */
  isPromptPanelExpanded: boolean
  /** Whether a new message is currently being sent */
  isLoading: boolean
}

// Format timestamp for display
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Status indicator component
interface StatusBadgeProps {
  status: Agent['status']
}

function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    ready: { color: 'bg-emerald-500', label: 'Ready' },
    starting: { color: 'bg-amber-500', label: 'Starting...' },
    stopping: { color: 'bg-amber-500', label: 'Stopping...' },
    error: { color: 'bg-rose-500', label: 'Error' }
  }[status] || { color: 'bg-slate-400', label: status }

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${config.color}`} />
      <span className="text-xs text-slate-500 dark:text-slate-400">{config.label}</span>
    </div>
  )
}

// Agent list item component
interface AgentListItemProps {
  agent: Agent
  isSelected: boolean
  onClick: () => void
}

function AgentListItem({ agent, isSelected, onClick }: AgentListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-xl transition-all duration-200
        ${isSelected
          ? 'bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 shadow-sm'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
        }
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className={`font-semibold truncate ${
            isSelected
              ? 'text-violet-900 dark:text-violet-100'
              : 'text-slate-900 dark:text-slate-100'
          }`}>
            {agent.name}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 truncate mt-0.5">
            {agent.description}
          </p>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs">
        {/* First domain badge */}
        {agent.domains.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md
            bg-violet-100 dark:bg-violet-900/70 text-violet-800 dark:text-violet-200
            border border-violet-200 dark:border-violet-700">
            {agent.domains[0]}
            {agent.domains.length > 1 && (
              <span className="text-violet-600/70 dark:text-violet-300/70">
                +{agent.domains.length - 1}
              </span>
            )}
          </span>
        )}
        <span className="text-slate-500 dark:text-slate-400">
          {agent.lastUsedAt ? formatTimestamp(agent.lastUsedAt) : 'not used'}
        </span>
      </div>
    </button>
  )
}

// Message bubble component
interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`
        max-w-[85%] rounded-2xl px-4 py-3
        ${isUser
          ? 'bg-violet-600 text-white rounded-br-md'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
        }
      `}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <span className={`text-[10px] mt-1 block ${
          isUser ? 'text-violet-200' : 'text-slate-400 dark:text-slate-500'
        }`}>
          {new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
          })}
        </span>
      </div>
    </div>
  )
}

// Empty state when no agent is selected
function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-amber-100
        dark:from-violet-900/30 dark:to-amber-900/30 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Select an Agent
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        Choose an agent from the list to start a test conversation and view its system prompt.
      </p>
    </div>
  )
}

// Main Agent Runtime component
export function AgentRuntime({
  agents,
  selectedAgentId,
  conversation,
  isPromptPanelExpanded,
  isLoading,
  onSelectAgent,
  onSendMessage,
  onTogglePromptPanel,
  onClearConversation
}: AgentRuntimeProps) {

  // Find selected agent
  const selectedAgent = agents.find(a => a.id === selectedAgentId) || null

  // Handle message send
  const handleSendMessage = (content: string) => {
    if (content.trim() && onSendMessage) {
      onSendMessage(content)
    }
  }

  return (
    <div className="h-screen flex bg-white dark:bg-slate-950 overflow-hidden">
      {/* Left Panel - Agent List */}
      <div className="w-80 lg:w-96 flex-shrink-0 border-r border-slate-200 dark:border-slate-800
        flex flex-col bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
        {/* List Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Agents
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {agents.length} total
            </span>
          </div>
        </div>

        {/* Agent List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {agents.map(agent => (
            <AgentListItem
              key={agent.id}
              agent={agent}
              isSelected={selectedAgentId === agent.id}
              onClick={() => onSelectAgent?.(agent.id)}
            />
          ))}
        </div>
      </div>

      {/* Right Panel - Detail / Conversation */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedAgent ? (
          <EmptyState />
        ) : (
          <>
            {/* Detail Header */}
            <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
              <div className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                      {selectedAgent.name}
                      <StatusBadge status={selectedAgent.status} />
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {selectedAgent.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onTogglePromptPanel?.()}
                      className={`
                        px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                        ${isPromptPanelExpanded
                          ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        System Prompt
                      </span>
                    </button>
                    <button
                      onClick={() => onClearConversation?.()}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium
                        bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400
                        hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Clear Chat
                    </button>
                  </div>
                </div>

                {/* Source Info */}
                <div className="flex items-center gap-4 mt-3 text-xs text-slate-400 dark:text-slate-500">
                  <span>Created {formatTimestamp(selectedAgent.createdAt)}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span className="inline-flex items-center gap-1.5">
                    {selectedAgent.domains.length > 0 ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        {selectedAgent.domains.join(', ')}
                      </>
                    ) : (
                      'No knowledge'
                    )}
                  </span>
                </div>
              </div>

              {/* Collapsible System Prompt Panel */}
              {isPromptPanelExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-800">
                  <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Generated System Prompt
                      </h3>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {selectedAgent.systemPrompt.split(' ').length} words
                      </span>
                    </div>
                    <div className="bg-white dark:bg-slate-950 rounded-lg p-4
                      border border-slate-200 dark:border-slate-800
                      max-h-48 overflow-y-auto">
                      <pre className="text-xs text-slate-600 dark:text-slate-400
                        whitespace-pre-wrap font-mono leading-relaxed">
                        {selectedAgent.systemPrompt}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Conversation Area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {!conversation || conversation.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-100 to-amber-100
                      dark:from-violet-900/30 dark:to-amber-900/30 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Start a conversation with {selectedAgent.name}
                    </p>
                  </div>
                ) : (
                  <>
                    {conversation.messages.map((message, idx) => (
                      <div key={message.id} className={idx === 0 ? '' : 'mt-4'}>
                        <MessageBubble message={message} />
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Message Input */}
              <MessageInput
                agentName={selectedAgent.name}
                onSend={handleSendMessage}
                isLoading={isLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Message input component (extracted for better layout control)
interface MessageInputProps {
  agentName: string
  onSend: (content: string) => void
  isLoading?: boolean
}

function MessageInput({ agentName, onSend, isLoading }: MessageInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const target = e.currentTarget
      if (target.value.trim() && !isLoading) {
        onSend(target.value)
        target.value = ''
      }
    }
  }

  return (
    <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 px-6 py-4 bg-white dark:bg-slate-950">
      <div className="flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            placeholder={`Message ${agentName}...`}
            rows={1}
            className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700
              bg-slate-50 dark:bg-slate-900 px-4 py-3 pr-12
              text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
              transition-all"
            disabled={isLoading}
            onKeyDown={handleKeyDown}
          />
          <button
            className="absolute right-2 bottom-2 p-1.5 rounded-lg
              bg-violet-600 hover:bg-violet-700 text-white
              transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  )
}
