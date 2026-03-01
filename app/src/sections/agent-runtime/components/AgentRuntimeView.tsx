import { useState, useCallback } from 'react'
import type { Agent, Conversation } from '@/../product/sections/agent-runtime/types'
import { RuntimePanel } from './RuntimePanel'
import { ChatPanel } from './ChatPanel'

export interface AgentRuntimeViewProps {
  /** The agent being configured/run */
  agent: Agent | null
  /** All conversations for the selected agent */
  conversations: Conversation[]
  /** Currently active conversation ID */
  activeConversationId: string | null
  /** Whether a message is being sent */
  isLoading?: boolean
  /** Whether streaming a response */
  isStreaming?: boolean
  /** Callback when returning to agent list */
  onBackToList?: () => void
  /** Callback when runtime field value changes */
  onRuntimeFieldChange?: (fieldId: string, value: string | string[] | boolean) => void
  /** Callback when sending a message */
  onSendMessage?: (content: string) => void
  /** Callback when switching to a different conversation */
  onSelectConversation?: (conversationId: string) => void
  /** Callback when creating a new conversation */
  onCreateConversation?: () => void
  /** Callback when deleting a conversation */
  onDeleteConversation?: (conversationId: string) => void
  /** Callback when saving the current conversation */
  onSaveConversation?: () => void
  /** Whether saving conversation is allowed */
  canSaveConversation?: boolean
  /** Whether to hide the top navigation bar */
  hideTopNav?: boolean
}

export function AgentRuntimeView({
  agent,
  conversations,
  activeConversationId,
  isLoading = false,
  isStreaming = false,
  onBackToList,
  onRuntimeFieldChange,
  onSendMessage,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onSaveConversation,
  canSaveConversation = false,
  hideTopNav = false,
}: AgentRuntimeViewProps) {
  const [runtimeFieldValues, setRuntimeFieldValues] = useState<Record<string, string | string[] | boolean>>({})
  const [isToolsExpanded, setIsToolsExpanded] = useState(false)

  // Find active conversation
  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null

  // Handle runtime field value change
  const handleFieldChange = useCallback((fieldId: string, value: string | string[] | boolean) => {
    setRuntimeFieldValues((prev) => ({ ...prev, [fieldId]: value }))
    onRuntimeFieldChange?.(fieldId, value)
  }, [onRuntimeFieldChange])

  // Handle send message
  const handleSendMessage = useCallback((content: string) => {
    onSendMessage?.(content)
  }, [onSendMessage])

  // Handle conversation selection
  const handleSelectConversation = useCallback((conversationId: string) => {
    onSelectConversation?.(conversationId)
  }, [onSelectConversation])

  // Handle create conversation
  const handleCreateConversation = useCallback(() => {
    onCreateConversation?.()
  }, [onCreateConversation])

  // Handle delete conversation
  const handleDeleteConversation = useCallback((conversationId: string) => {
    onDeleteConversation?.(conversationId)
  }, [onDeleteConversation])

  // Handle back to list
  const handleBackToList = useCallback(() => {
    onBackToList?.()
  }, [onBackToList])

  if (!agent) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-amber-100
            dark:from-violet-900/30 dark:to-amber-900/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
            No agent selected
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Select an agent to configure and run conversations
          </p>
          <button
            onClick={handleBackToList}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
          >
            Back to Agent List
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex bg-white dark:bg-slate-950 overflow-hidden">
      {/* Left Panel - Runtime Fields + Tools (35-40%) */}
      <div className="w-[380px] min-h-0 flex-shrink-0 border-r border-slate-200 dark:border-slate-800">
        <RuntimePanel
          agent={agent}
          runtimeFieldValues={runtimeFieldValues}
          isToolsExpanded={isToolsExpanded}
          onRuntimeFieldChange={handleFieldChange}
        />
      </div>

      {/* Right Panel - Chat Interface (60-65%) */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        {/* Top navigation bar */}
        {!hideTopNav && (
          <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
            <button
              onClick={handleBackToList}
              className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400
                hover:text-slate-900 dark:hover:text-slate-100 transition-colors group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Agents
            </button>
          </div>
        )}

        {/* Chat Panel */}
        <ChatPanel
          agent={agent}
          conversations={conversations}
          activeConversation={activeConversation}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={handleCreateConversation}
          onDeleteConversation={handleDeleteConversation}
          onSaveConversation={onSaveConversation}
          canSaveConversation={canSaveConversation}
        />
      </div>
    </div>
  )
}
