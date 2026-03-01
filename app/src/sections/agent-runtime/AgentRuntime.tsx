import { useState, useCallback } from 'react'
import { useRuntimeAgents, useAgents } from '@/lib/workspaceContext'
import type { Conversation } from '@/../product/sections/agent-runtime/types'
import { AgentList } from './components/AgentList'
import { AgentRuntimeView } from './components/AgentRuntimeView'

export default function AgentRuntimePreview() {
  // Use runtime-mapped agents (full shape with enabledTools, runtimeFields, etc.)
  const agents = useRuntimeAgents()
  const { agents: agentsMap, isLoading, error } = useAgents()

  const [view, setView] = useState<'list' | 'runtime'>('list')
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])

  // Handle agent selection
  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId)

    // Load conversations for this agent from the agents map
    const agent = agentsMap[agentId]
    const agentConversations: Conversation[] = (agent?.conversations || [])
      .map(conv => ({
        id: conv.id,
        agentId: conv.agentId,
        agentName: conv.agentName,
        messages: conv.messages
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp,
            slashAction: (msg as any).slashAction,
            structuredOutput: (msg as any).structuredOutput,
          })),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }))
    setConversations(agentConversations)

    // Set active conversation to the most recently updated one
    if (agentConversations.length > 0) {
      const sorted = [...agentConversations].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      setActiveConversationId(sorted[0].id)
    } else {
      setActiveConversationId(null)
    }

    setView('runtime')
  }, [agentsMap])

  // Handle back to list
  const handleBackToList = useCallback(() => {
    setView('list')
    setSelectedAgentId(null)
    setActiveConversationId(null)
  }, [])

  // Handle runtime field change
  const handleRuntimeFieldChange = useCallback((fieldId: string, value: string | string[] | boolean) => {
    console.log('Field changed:', fieldId, value)
  }, [])

  // Handle send message
  const handleSendMessage = useCallback((content: string) => {
    setIsSending(true)
    console.log('Send message:', content)
    // Simulate response
    setTimeout(() => {
      setIsSending(false)
    }, 1000)
  }, [])

  // Handle select conversation
  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId)
    console.log('Select conversation:', conversationId)
  }, [])

  // Handle create conversation
  const handleCreateConversation = useCallback(() => {
    if (!selectedAgentId) return

    const selectedAgent = agents.find((a) => a.id === selectedAgentId)
    if (!selectedAgent) return

    const newConversation: Conversation = {
      id: `conv_${Date.now()}`,
      agentId: selectedAgentId,
      agentName: selectedAgent.name,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setConversations((prev) => [newConversation, ...prev])
    setActiveConversationId(newConversation.id)
    console.log('Create new conversation')
  }, [selectedAgentId, agents])

  // Handle delete conversation
  const handleDeleteConversation = useCallback((conversationId: string) => {
    setConversations((prev: Conversation[]) => {
      const filtered = prev.filter((c: Conversation) => c.id !== conversationId)
      // If we deleted the active conversation, switch to another one or null
      if (activeConversationId === conversationId) {
        if (filtered.length > 0) {
          setActiveConversationId(filtered[0].id)
        } else {
          setActiveConversationId(null)
        }
      }
      return filtered
    })
    console.log('Delete conversation:', conversationId)
  }, [activeConversationId])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }
  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error loading data: {error}</div>
  }

  // Show list view or runtime view
  if (view === 'list') {
    return (
      <AgentList
        agents={agents}
        selectedAgentId={selectedAgentId}
        isLoading={false}
        onSelectAgent={handleSelectAgent}
      />
    )
  }

  // Runtime view
  return (
    <AgentRuntimeView
      agent={agents.find((a) => a.id === selectedAgentId) || null}
      conversations={conversations}
      activeConversationId={activeConversationId}
      isLoading={isSending}
      onBackToList={handleBackToList}
      onRuntimeFieldChange={handleRuntimeFieldChange}
      onSendMessage={handleSendMessage}
      onSelectConversation={handleSelectConversation}
      onCreateConversation={handleCreateConversation}
      onDeleteConversation={handleDeleteConversation}
    />
  )
}
