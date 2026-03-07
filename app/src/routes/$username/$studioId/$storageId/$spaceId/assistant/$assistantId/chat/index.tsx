import { useState, useCallback, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAssistant } from '@/hooks/useAssistant'
import { useFieldSchema } from '@/hooks/useFieldSchema'
import { ChatPanel } from '@/components/assistant/runtime/chat-panel'
import type { ChatConversation } from '@/components/assistant/runtime/chat-panel'
import { RuntimeFieldsSidebar } from '@/components/assistant/runtime/runtime-fields-sidebar'
import type { RuntimeValues } from '@/components/assistant/runtime/runtime-fields-sidebar'
import type { AgentConfig } from '@lmthing/state'

function AssistantChatPage() {
  const { assistantId } = Route.useParams()
  const assistant = useAssistant(assistantId)

  const config = assistant.config as AgentConfig & { domains?: string[]; flows?: string[]; askAtRuntime?: string[] } | null
  const askAtRuntimeIds = config?.askAtRuntime || []
  const selectedFieldIds = config?.domains || []

  const fieldSchemas = useFieldSchema(selectedFieldIds)

  // Runtime field values — initialized from saved agent values, overridden by user at runtime
  const [runtimeValues, setRuntimeValues] = useState<RuntimeValues>(() => {
    const saved = (assistant.values || {}) as RuntimeValues
    const initial: RuntimeValues = {}
    for (const id of askAtRuntimeIds) {
      if (saved[id] !== undefined) initial[id] = saved[id]
    }
    return initial
  })

  const handleRuntimeValueChange = useCallback((fieldId: string, value: string | string[] | boolean) => {
    setRuntimeValues(prev => ({ ...prev, [fieldId]: value }))
  }, [])

  const [conversation, setConversation] = useState<ChatConversation | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const chatAssistant = useMemo(() => ({
    id: assistantId,
    name: assistant.instruct?.name || assistantId,
    slashActions: (config?.flows || []).map((flowId: string) => ({
      name: flowId,
      description: '',
      actionId: flowId,
    })),
  }), [assistantId, assistant.instruct?.name, config?.flows])

  const handleSendMessage = useCallback((content: string) => {
    const newMessage = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    }
    setConversation(prev => ({
      id: prev?.id || `conv_${Date.now()}`,
      messages: [...(prev?.messages || []), newMessage],
    }))
    setIsLoading(true)
    // Simulated response — real implementation would call the LLM with runtime values in the prompt
    setTimeout(() => {
      setConversation(prev => ({
        id: prev?.id || `conv_${Date.now()}`,
        messages: [
          ...(prev?.messages || []),
          {
            id: `msg_${Date.now()}`,
            role: 'assistant' as const,
            content: 'This is a placeholder response. The actual LLM call would include runtime field values in the system prompt.',
            timestamp: new Date().toISOString(),
          },
        ],
      }))
      setIsLoading(false)
    }, 1000)
  }, [])

  const hasRuntimeFields = askAtRuntimeIds.length > 0 && fieldSchemas.length > 0

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChatPanel
          assistant={chatAssistant}
          activeConversation={conversation}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
        />
      </div>
      {hasRuntimeFields && (
        <RuntimeFieldsSidebar
          schemas={fieldSchemas}
          askAtRuntimeIds={askAtRuntimeIds}
          values={runtimeValues}
          onValueChange={handleRuntimeValueChange}
        />
      )}
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/assistant/$assistantId/chat/',
)({
  component: AssistantChatPage,
})
