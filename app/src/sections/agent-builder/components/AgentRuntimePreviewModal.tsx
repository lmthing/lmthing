import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { Agent, Conversation, Message } from '@/../product/sections/agent-runtime/types'
import { AgentRuntimeView } from '../../agent-runtime/components'
import { runPrompt } from 'lmthing'
import { buildKnowledgeXml } from '@/lib/buildKnowledgeXml'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import type { FormFieldValue, SchemaField } from '@/../product/sections/agent-builder/types'

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
  formValues: Record<string, FormFieldValue>
  selectedDomainFields: Array<{ field: SchemaField; domainName: string }>
  onSaveConversation?: (conversation: Conversation) => void
  canSaveConversation?: boolean
}

export function AgentRuntimePreviewModal({
  isOpen,
  onClose,
  enabledFilePaths: _initialEnabledFilePaths,
  generatedPrompt,
  runtimeFields,
  formValues,
  selectedDomainFields,
  onSaveConversation,
  canSaveConversation = false,
}: AgentRuntimePreviewModalProps) {
  const { knowledge } = useWorkspaceData()
  const [runtimeFieldValues, setRuntimeFieldValues] = useState<Record<string, FormFieldValue>>({})
  
  // Helper to get form field value from nested or flat structure
  const getFormFieldValue = useCallback((values: Record<string, FormFieldValue>, id: string, variableName: string): FormFieldValue | undefined => {
    if (!values) return undefined
    if (Object.prototype.hasOwnProperty.call(values, id)) return values[id]
    if (Object.prototype.hasOwnProperty.call(values, variableName)) return values[variableName]
    const parts = id.split('/')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = values
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        return undefined
      }
    }
    return (current !== values ? current : undefined) as FormFieldValue | undefined
  }, [])

  // Helper to resolve file paths from field options
  const resolveFieldOptionFilePaths = useCallback((field: SchemaField, values: Record<string, FormFieldValue>): string[] => {
    const value = getFormFieldValue(values, field.id, field.variableName)
    if (typeof value === 'boolean' || value === undefined || value === '') {
      return []
    }
    const selectedValues = Array.isArray(value) ? value : [value]
    return selectedValues
      .flatMap((selectedValue) =>
        field.options
          .filter(
            (option) =>
              option.id === selectedValue ||
              option.value === selectedValue ||
              option.label === selectedValue
          )
          .map((option) => option.filePath)
      )
      .filter(Boolean)
  }, [getFormFieldValue])

  // Merge static and runtime field values, then compute enabled file paths
  const enabledFilePaths = useMemo(() => {
    const mergedValues = { ...formValues, ...runtimeFieldValues }
    const paths = selectedDomainFields.flatMap(({ field }) =>
      resolveFieldOptionFilePaths(field, mergedValues)
    )
    return [...new Set(paths)].sort((a, b) => a.localeCompare(b))
  }, [formValues, runtimeFieldValues, selectedDomainFields, resolveFieldOptionFilePaths])
  
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
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
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

  // Compute system prompt directly - no memoization to ensure it's always fresh
  const fullSystemPrompt = (() => {
    const knowledgeXml = buildKnowledgeXml(knowledge, enabledFilePaths)
    let prompt = `<instructions>\n${generatedPrompt}\n</instructions>`
    if (knowledgeXml) {
      prompt += `\n\n${knowledgeXml}`
    }
    return prompt
  })()

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

  const handleRuntimeFieldChange = useCallback((fieldId: string, value: FormFieldValue) => {
    setRuntimeFieldValues(prev => ({ ...prev, [fieldId]: value }))
  }, [])

  const handleClose = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsLoading(false)
    onClose()
  }, [onClose])

  const handleSendMessage = useCallback(async (content: string) => {
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

    // Build knowledge XML from enabled file paths
    const knowledgeXml = buildKnowledgeXml(knowledge, enabledFilePaths)

    // Create assistant message placeholder for streaming
    const assistantMessageId = `msg-assistant-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    }

    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, assistantMessage],
      updatedAt: assistantMessage.timestamp,
    }))

    try {
      // Get conversation history (excluding the new assistant placeholder)
      const conversationHistory = conversation.messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }))

      // Use runPrompt to generate response
      const { result } = await runPrompt(
        async ({ defSystem, $ }) => {
          // Add the generated prompt as system instructions
          defSystem('instructions', generatedPrompt)

          // Add knowledge XML if available
          if (knowledgeXml) {
            defSystem('knowledge', knowledgeXml)
          }

          // Add conversation history
          for (const msg of conversationHistory) {
            if (msg.role === 'user') {
              void $`${msg.content}`
            }
          }

          // Add the new user message
          void $`${content}`
        },
        {
          model: ('zai:glm-4.5-air') as string,
          options: {
            temperature: 0.7,
          },
        }
      )

      // Stream the response
      let fullContent = ''
      for await (const chunk of result.textStream) {
        fullContent += chunk
        setConversation((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullContent }
              : msg
          ),
        }))
      }

      setIsLoading(false)
    } catch (error) {
      console.error('Failed to generate response:', error)
      
      // Update with error message
      setConversation((prev) => ({
        ...prev,
        messages: prev.messages.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `Error: Failed to generate response. ${error instanceof Error ? error.message : 'Unknown error'}`,
              }
            : msg
        ),
      }))
      
      setIsLoading(false)
    }
  }, [knowledge, enabledFilePaths, generatedPrompt, conversation.messages])

  const handleSaveConversation = useCallback(() => {
    if (!onSaveConversation) return
    onSaveConversation(conversation)
  }, [onSaveConversation, conversation])

  const handleReset = useCallback(() => {
    setConversation({
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
  }, [])

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
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5"
              title="Reset conversation"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset
            </button>
            <button
              onClick={() => setShowSystemPrompt(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5"
              title="View full system prompt"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              System Prompt
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
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
            onRuntimeFieldChange={handleRuntimeFieldChange}
          />
        </div>
      </div>

      {/* System Prompt Modal */}
      {showSystemPrompt && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/40">
          <div className="relative w-full max-w-4xl max-h-[80vh] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Full System Prompt</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Instructions + Knowledge XML sent to the LLM</p>
              </div>
              <button
                onClick={() => setShowSystemPrompt(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-5">
              <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-950 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                {fullSystemPrompt}
              </pre>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(fullSystemPrompt)
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowSystemPrompt(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
