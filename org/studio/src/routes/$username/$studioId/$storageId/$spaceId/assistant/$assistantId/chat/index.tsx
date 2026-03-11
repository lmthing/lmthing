import { useCallback, useMemo } from 'react'
import { useUIState, useToggle, useGlobRead, useSpaceFS, P, parseFrontmatter } from '../../../../../../../../../../org/state/src'
import { createFileRoute } from '@tanstack/react-router'
import { runPrompt } from '../../../../../../../../../../org/core/dist'
import { useAssistant } from '@/hooks/useAssistant'
import { useFieldSchema } from '@/hooks/useFieldSchema'
import { buildKnowledgeXml } from '@/lib/buildKnowledgeXml'
import type { KnowledgeNode } from '@/types/workspace-data'
import { ChatPanel } from '@/components/assistant/runtime/chat-panel'
import type { ChatConversation } from '@/components/assistant/runtime/chat-panel'
import { RuntimeFieldsSidebar } from '@/components/assistant/runtime/runtime-fields-sidebar'
import type { RuntimeValues } from '@/components/assistant/runtime/runtime-fields-sidebar'
import type { AgentConfig } from '../../../../../../../../../../org/state/src'

const TOOL_EVENT_OPEN = '[[THING_TOOL_EVENT]]'
const TOOL_EVENT_CLOSE = '[[/THING_TOOL_EVENT]]'

const resolvedModel = 'anthropic:claude-sonnet-4-20250514'

function buildKnowledgeNodesFromFlat(
  files: Record<string, string>,
): KnowledgeNode[] {
  const nodes: KnowledgeNode[] = []
  const dirMap = new Map<string, KnowledgeNode>()

  // Build directory nodes for knowledge/*/
  const topDirs = new Set<string>()
  for (const path of Object.keys(files)) {
    if (!path.startsWith('knowledge/')) continue
    const parts = path.split('/')
    if (parts.length >= 2) topDirs.add(parts[1])
  }

  for (const dir of topDirs) {
    const dirPath = `knowledge/${dir}`
    let config: Record<string, unknown> | undefined
    const configContent = files[`${dirPath}/config.json`]
    if (configContent) {
      try { config = JSON.parse(configContent) } catch { /* ignore */ }
    }

    const dirNode: KnowledgeNode = {
      path: dirPath,
      type: 'directory',
      config: config as KnowledgeNode['config'],
      children: [],
    }

    // Add file children
    for (const [filePath, content] of Object.entries(files)) {
      if (!filePath.startsWith(`${dirPath}/`) || filePath.endsWith('/config.json')) continue

      // Check subdirectories
      const remainder = filePath.slice(dirPath.length + 1)
      const subParts = remainder.split('/')

      if (subParts.length === 1 && filePath.endsWith('.md')) {
        // Direct child file
        let frontmatter: Record<string, unknown> | undefined
        try {
          const fm = parseFrontmatter(content)
          frontmatter = fm.frontmatter as Record<string, unknown>
        } catch { /* ignore */ }

        dirNode.children!.push({
          path: filePath,
          type: 'file',
          content,
          frontmatter: frontmatter as KnowledgeNode['frontmatter'],
        })
      } else if (subParts.length >= 2) {
        // Nested subdirectory — find or create subdir node
        const subDirPath = `${dirPath}/${subParts[0]}`
        let subDir = dirNode.children!.find(c => c.path === subDirPath)
        if (!subDir) {
          let subConfig: Record<string, unknown> | undefined
          const subConfigContent = files[`${subDirPath}/config.json`]
          if (subConfigContent) {
            try { subConfig = JSON.parse(subConfigContent) } catch { /* ignore */ }
          }
          subDir = {
            path: subDirPath,
            type: 'directory',
            config: subConfig as KnowledgeNode['config'],
            children: [],
          }
          dirNode.children!.push(subDir)
        }

        if (filePath.endsWith('.md')) {
          let frontmatter: Record<string, unknown> | undefined
          try {
            const fm = parseFrontmatter(content)
            frontmatter = fm.frontmatter as Record<string, unknown>
          } catch { /* ignore */ }

          subDir.children!.push({
            path: filePath,
            type: 'file',
            content,
            frontmatter: frontmatter as KnowledgeNode['frontmatter'],
          })
        }
      }
    }

    if (dirNode.children!.length > 0) {
      nodes.push(dirNode)
    }
    dirMap.set(dirPath, dirNode)
  }

  return nodes
}

function AssistantChatPage() {
  const { assistantId } = Route.useParams()
  const assistant = useAssistant(assistantId)
  const spaceFS = useSpaceFS()

  const config = assistant.config as AgentConfig & { domains?: string[]; flows?: string[]; askAtRuntime?: string[] } | null
  const askAtRuntimeIds = config?.askAtRuntime || []
  const selectedFieldIds = config?.domains || []

  const fieldSchemas = useFieldSchema(selectedFieldIds)

  // Read all knowledge files
  const allKnowledgeFiles = useGlobRead(P.globs.allKnowledge)

  // Runtime field values — initialized from saved agent values, overridden by user at runtime
  const [runtimeValues, setRuntimeValues] = useUIState<RuntimeValues>('chat-page.runtime-values', () => {
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

  const [conversation, setConversation] = useUIState<ChatConversation | null>('chat-page.conversation', null)
  const [isLoading, , setIsLoading] = useToggle('chat-page.is-loading', false)
  const [isStreaming, , setIsStreaming] = useToggle('chat-page.is-streaming', false)

  // Merge static values with runtime values
  const mergedValues = useMemo(() => {
    const staticValues = (assistant.values || {}) as Record<string, string | string[] | boolean>
    return { ...staticValues, ...runtimeValues }
  }, [assistant.values, runtimeValues])

  // Compute enabled file paths from merged values
  const enabledFilePaths = useMemo(() => {
    const paths: string[] = []
    for (const schema of fieldSchemas) {
      for (const field of schema.sections) {
        if (askAtRuntimeIds.includes(field.id)) {
          // Use runtime value
          const value = mergedValues[field.id] ?? field.default
          if (!value) continue
          if (field.fieldType === 'select' && typeof value === 'string' && value)
            paths.push(`knowledge/${field.id}/${value}.md`)
          else if (field.fieldType === 'multiselect' && Array.isArray(value))
            value.forEach(v => paths.push(`knowledge/${field.id}/${v}.md`))
        } else {
          // Use static value
          const value = mergedValues[field.id] ?? field.default
          if (!value) continue
          if (field.fieldType === 'select' && typeof value === 'string' && value)
            paths.push(`knowledge/${field.id}/${value}.md`)
          else if (field.fieldType === 'multiselect' && Array.isArray(value))
            value.forEach(v => paths.push(`knowledge/${field.id}/${v}.md`))
        }
      }
    }
    return paths
  }, [fieldSchemas, mergedValues, askAtRuntimeIds])

  // Build knowledge XML
  const knowledgeXml = useMemo(() => {
    if (enabledFilePaths.length === 0 || !allKnowledgeFiles) return ''
    const nodes = buildKnowledgeNodesFromFlat(allKnowledgeFiles)
    return buildKnowledgeXml(nodes, enabledFilePaths)
  }, [allKnowledgeFiles, enabledFilePaths])

  // Build runtime values section for system prompt
  const runtimeValuesPrompt = useMemo(() => {
    if (askAtRuntimeIds.length === 0) return ''
    const lines: string[] = ['<runtime-values>']
    for (const schema of fieldSchemas) {
      for (const field of schema.sections) {
        if (!askAtRuntimeIds.includes(field.id)) continue
        const value = mergedValues[field.id] ?? field.default
        if (value !== undefined && value !== '') {
          const displayValue = Array.isArray(value) ? value.join(', ') : String(value)
          lines.push(`  <${field.variableName || field.id.split('/').pop() || field.id}>${displayValue}</${field.variableName || field.id.split('/').pop() || field.id}>`)
        }
      }
    }
    lines.push('</runtime-values>')
    return lines.length > 2 ? lines.join('\n') : ''
  }, [fieldSchemas, mergedValues, askAtRuntimeIds])

  // Build system prompt
  const systemPrompt = useMemo(() => {
    const parts: string[] = []
    if (assistant.instruct?.instructions) {
      parts.push(assistant.instruct.instructions)
    }
    if (runtimeValuesPrompt) {
      parts.push('\n' + runtimeValuesPrompt)
    }
    return parts.join('\n') || 'You are a helpful assistant.'
  }, [assistant.instruct?.instructions, runtimeValuesPrompt])

  const chatAssistant = useMemo(() => ({
    id: assistantId,
    name: assistant.instruct?.name || assistantId,
    slashActions: (config?.flows || []).map((flowId: string) => ({
      name: flowId,
      description: '',
      actionId: flowId,
    })),
  }), [assistantId, assistant.instruct?.name, config?.flows])

  const handleSendMessage = useCallback(async (content: string) => {
    const userMsg = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    }
    const asstId = `msg_${Date.now() + 1}`

    setConversation(prev => ({
      id: prev?.id || `conv_${Date.now()}`,
      messages: [
        ...(prev?.messages || []),
        userMsg,
        { id: asstId, role: 'assistant' as const, content: '', timestamp: new Date().toISOString() },
      ],
    }))
    setIsLoading(true)
    setIsStreaming(true)

    try {
      const history = [...(conversation?.messages || []), userMsg]

      const { result } = await runPrompt(async (prompt) => {
        prompt.defSystem('instructions', systemPrompt)
        if (knowledgeXml) {
          prompt.defSystem('knowledge', knowledgeXml)
        }
        for (const msg of history) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            prompt.defMessage(msg.role, msg.content)
          }
        }
      }, {
        model: resolvedModel,
        options: {
          temperature: 0.7,
          onStepFinish: (stepResult) => {
            const r = stepResult as {
              finishReason?: string
              toolCalls?: Array<{ toolName?: string; input?: unknown }>
              toolResults?: Array<{ toolName?: string; input?: unknown; output?: unknown }>
            }

            if (r.finishReason !== 'tool-calls') return

            const toolResults = r.toolResults || []
            if (toolResults.length > 0) {
              const lines = toolResults.map(tr => {
                const name = tr.toolName || 'unknown'
                return `${TOOL_EVENT_OPEN}\n🔧 ${name}\n⤷ result: ${JSON.stringify(tr.output, null, 2)}\n${TOOL_EVENT_CLOSE}`
              })
              const toolText = '\n\n' + lines.join('\n\n') + '\n'
              setConversation(prev => {
                if (!prev) return prev
                return {
                  ...prev,
                  messages: prev.messages.map(m =>
                    m.id === asstId ? { ...m, content: (m.content || '') + toolText } : m
                  ),
                }
              })
            }
          },
        },
      })

      // Stream text
      const textStream = (result as { textStream?: unknown }).textStream
      if (textStream && typeof textStream === 'object' && Symbol.asyncIterator in textStream) {
        for await (const delta of textStream as AsyncIterable<string>) {
          setConversation(prev => {
            if (!prev) return prev
            return {
              ...prev,
              messages: prev.messages.map(m =>
                m.id === asstId ? { ...m, content: (m.content || '') + delta } : m
              ),
            }
          })
        }
      }

      // Fallback to full text if streaming produced nothing
      const fullText = await result.text
      setConversation(prev => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.map(m =>
            m.id === asstId && !m.content?.trim()
              ? { ...m, content: fullText?.trim() || 'No response.' }
              : m
          ),
        }
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setConversation(prev => {
        if (!prev) return prev
        return {
          ...prev,
          messages: prev.messages.map(m =>
            m.id === asstId
              ? { ...m, content: `Error: ${errorMsg}\n\nMake sure environment variables with API keys are configured.` }
              : m
          ),
        }
      })
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }, [conversation, systemPrompt, knowledgeXml])

  // Conversation persistence
  const handleSaveConversation = useCallback(() => {
    if (!spaceFS || !conversation || conversation.messages.length === 0) return
    const convId = conversation.id
    const now = new Date().toISOString()
    spaceFS.writeFile(
      P.conversation(assistantId, convId),
      JSON.stringify({
        metadata: {
          id: convId,
          agentId: assistantId,
          createdAt: now,
          updatedAt: now,
          messageCount: conversation.messages.length,
        },
        messages: conversation.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      }, null, 2)
    )
  }, [spaceFS, conversation, assistantId])

  const canSaveConversation = Boolean(conversation && conversation.messages.length > 0 && spaceFS)

  const hasRuntimeFields = askAtRuntimeIds.length > 0 && fieldSchemas.length > 0

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ChatPanel
          assistant={chatAssistant}
          activeConversation={conversation}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onSendMessage={handleSendMessage}
          onSaveConversation={handleSaveConversation}
          canSaveConversation={canSaveConversation}
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
