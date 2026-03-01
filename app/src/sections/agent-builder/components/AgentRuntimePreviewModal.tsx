import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { Agent, Conversation, Message } from '@/../product/sections/agent-runtime/types'
import { AgentRuntimeView } from '../../agent-runtime/components'

interface RuntimeFieldSummary {
  id: string
  label: string
  domain: string
  fieldType?: 'text' | 'textarea' | 'select' | 'multiselect' | 'toggle'
  placeholder?: string
  options?: string[]
}

interface AgentRuntimePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  enabledFilePaths: string[]
  generatedPrompt: string
  runtimeFields: RuntimeFieldSummary[]
  onSaveConversation?: (conversation: Conversation) => void
  canSaveConversation?: boolean
}

export function AgentRuntimePreviewModal({
  isOpen,
  onClose,
  enabledFilePaths,
  generatedPrompt,
  runtimeFields,
  onSaveConversation,
  canSaveConversation = false,
}: AgentRuntimePreviewModalProps) {
  const toRuntimeValue = useCallback((field: RuntimeFieldSummary): string | string[] | boolean => {
    switch (field.fieldType) {
      case 'multiselect':
        return []
      case 'toggle':
        return false
      case 'select':
      case 'textarea':
      case 'text':
      default:
        return ''
    }
  }, [])

  const timeoutRef = useRef<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [conversation, setConversation] = useState<Conversation>({
    id: 'preview-conversation',
    agentId: 'preview-agent',
    agentName: 'Runtime Preview Agent',
    messages: [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content: 'Runtime preview ready. Try sending a message to test how this agent would respond in chat.',
        timestamp: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  const previewAgent = useMemo<Agent>(
    () => ({
      id: 'preview-agent',
      name: 'Runtime Preview Agent',
      description: 'Simulated runtime conversation using current builder configuration.',
      domains: [...new Set(runtimeFields.map((field) => field.domain))],
      formValues: {},
      runtimeFields: runtimeFields.map((field) => ({
        id: field.id,
        label: field.label,
        type: field.fieldType || 'text',
        placeholder: field.placeholder,
        options: field.options,
        value: toRuntimeValue(field),
        domain: field.domain,
      })),
      enabledTools: [],
      systemPrompt: generatedPrompt,
      slashActions: [],
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      status: 'ready',
    }),
    [runtimeFields, generatedPrompt, toRuntimeValue]
  )

  const handleClose = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsLoading(false)
    onClose()
  }, [onClose])

  const handleSendMessage = useCallback((content: string) => {
    const now = new Date().toISOString()
    const userMessage: Message = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: now,
    }

    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      updatedAt: now,
    }))

    setIsLoading(true)

    timeoutRef.current = window.setTimeout(() => {
      const runtimeHint = runtimeFields.length
        ? `Still waiting on ${runtimeFields.length} runtime field${runtimeFields.length === 1 ? '' : 's'} from the user.`
        : 'All fields are currently prefilled.'

      const assistantMessage: Message = {
        id: `msg-assistant-${Date.now()}`,
        role: 'assistant',
        content: `Preview response: I would use your assembled prompt and enabled files to answer this request. ${runtimeHint}`,
        timestamp: new Date().toISOString(),
      }

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        updatedAt: assistantMessage.timestamp,
      }))

      setIsLoading(false)
    }, 700)
  }, [runtimeFields])

  const handleSaveConversation = useCallback(() => {
    if (!onSaveConversation) return
    onSaveConversation(conversation)
  }, [onSaveConversation, conversation])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  // Support both array and object format for runtime fields
  let runtimeFieldList: RuntimeFieldSummary[] = []
  if (Array.isArray(runtimeFields)) {
    runtimeFieldList = runtimeFields as RuntimeFieldSummary[]
  } else if (typeof runtimeFields === 'object' && runtimeFields !== null) {
    // If runtimeFields is an object (from mock data), convert to array
    runtimeFieldList = Object.values(runtimeFields)
  }

  // Group runtime fields by domain (file path)
  const fieldsByDomain: Record<string, RuntimeFieldSummary[]> = {}
  runtimeFieldList.forEach((field) => {
    if (!fieldsByDomain[field.domain]) fieldsByDomain[field.domain] = []
    fieldsByDomain[field.domain].push(field)
  })

  // Find runtime fields not associated with any enabled file path

  // Replace modal content with AgentRuntimeView
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
      />
      <div
        className="relative flex h-[80vh] max-h-[80vh] w-full max-w-5xl min-w-[340px] flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Runtime Conversation Preview</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Inspect prompt inputs and test a simulated runtime chat.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 min-h-0 flex">
          <AgentRuntimeView
            agent={previewAgent}
            conversations={[conversation]}
            activeConversationId={conversation.id}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onSaveConversation={handleSaveConversation}
            canSaveConversation={canSaveConversation}
            hideTopNav={true}
            onBackToList={handleClose}
          />
        </div>
      </div>
    </div>
  )
}
