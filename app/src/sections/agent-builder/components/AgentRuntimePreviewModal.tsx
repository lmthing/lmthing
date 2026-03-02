import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import type { Agent, Conversation, Message } from '@/../product/sections/agent-runtime/types'
import { AgentRuntimeView } from '../../agent-runtime/components'
import { runPrompt } from 'lmthing'
import { buildKnowledgeXml } from '@/lib/buildKnowledgeXml'
import { executeFlow, type FlowTask } from '@/lib/flowExecution'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import { useFlows } from '@/hooks/useFlows'
import type { FormFieldValue, SchemaField } from '@/../product/sections/agent-builder/types'

const THING_TOOL_EVENT_OPEN = '[[THING_TOOL_EVENT]]'
const THING_TOOL_EVENT_CLOSE = '[[/THING_TOOL_EVENT]]'

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function toToolEventBlock(payload: string): string {
  return `${THING_TOOL_EVENT_OPEN}\n${payload}\n${THING_TOOL_EVENT_CLOSE}`
}

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
  // Optional flow tasks to execute
  flowTasks?: FlowTask[]
  // Whether to enable flow execution mode
  enableFlowExecution?: boolean
  // Slash actions available for this agent
  slashActions?: Array<{ name: string; description: string; flowId: string; actionId: string }>
  // Rendering mode: 'modal' (default) or 'inline' (for sidebar view)
  mode?: 'modal' | 'inline'
  // Previous conversations for this agent (for inline mode)
  conversations?: Conversation[]
  // Loaded agent ID (for inline mode)
  loadedAgentId?: string | null
}

export function AgentRuntimePreviewModal({
  isOpen,
  onClose,
  enabledFilePaths: enabledFilePathsProp,
  generatedPrompt,
  runtimeFields,
  formValues,
  selectedDomainFields,
  onSaveConversation,
  canSaveConversation = false,
  flowTasks = [],
  enableFlowExecution = false,
  slashActions = [],
  mode = 'modal',
  conversations: previousConversations = [],
  loadedAgentId = null,
}: AgentRuntimePreviewModalProps) {
  const { knowledge } = useWorkspaceData()
  const { getFlow } = useFlows()
  const [runtimeFieldValues, setRuntimeFieldValues] = useState<Record<string, FormFieldValue>>({})
  const [flowExecutionState, setFlowExecutionState] = useState<{
    isExecuting: boolean
    currentTaskId: string | null
    taskStatuses: Record<string, 'pending' | 'in_progress' | 'completed' | 'failed'>
    flowOutput: Record<string, unknown>
  }>({
    isExecuting: false,
    currentTaskId: null,
    taskStatuses: {},
    flowOutput: {},
  })
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
  const [conversation, setConversation] = useState<Conversation>(() => {
    const welcomeContent = enableFlowExecution && flowTasks.length > 0
      ? `🎯 **Flow Execution Mode Enabled**\n\n**Available Commands:**\n• \`/execute-flow\` - Execute the ${flowTasks.length}-task flow with structured output\n• \`/flow\` - Short alias for flow execution\n\n**Flow Tasks:**\n${flowTasks.map((t, i) => `${i + 1}. **${t.name}**${t.type === 'updateFlowOutput' && t.targetFieldName ? ` → \`flowOutput.${t.targetFieldName}\`` : ''}`).join('\n')}\n\n**How it works:**\nEach task uses defTaskList for progress tracking (\`startTask\`, \`completeTask\`, \`failTask\`). Tasks of type \`updateFlowOutput\` add structured data to the flow output object.\n\nType a command above to start, or chat normally.`
      : 'Runtime preview ready. Try sending a message to test how this agent would respond in chat.'

    return {
      id: 'preview-conversation',
      agentId: 'preview-agent',
      agentName: 'Runtime Preview Agent',
      messages: [
        {
          id: 'msg-welcome',
          role: 'assistant',
          content: welcomeContent,
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
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
      slashActions: slashActions.map((action, index) => ({
        id: `slash-action-${index}`,
        actionId: action.actionId,
        name: action.name,
        description: action.description,
        flowId: action.flowId,
        agentId: 'preview-agent',
        enabled: true,
      })),
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      status: 'ready',
    }),
    [runtimeFields, generatedPrompt, toRuntimeValue, slashActions]
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

  const handleSlashCommandExecution = useCallback(async (flowId: string) => {
    // Load flow by ID
    const flow = getFlow(flowId)
    if (!flow) {
      const errorMessage: Message = {
        id: `msg-error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Error: Flow "${flowId}" not found.`,
        timestamp: new Date().toISOString(),
      }
      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        updatedAt: errorMessage.timestamp,
      }))
      setIsLoading(false)
      return
    }

    // Convert flow tasks to FlowTask format
    const tasks: FlowTask[] = flow.tasks.map(task => ({
      id: String(task.frontmatter?.id || `task-${task.order}`),
      name: task.name,
      order: task.order,
      instructions: task.instructions,
      type: (task.frontmatter?.type as 'updateFlowOutput' | 'executeTask') || 'executeTask',
      targetFieldName: task.targetFieldName,
      outputSchema: task.outputSchema as Record<string, unknown> | undefined,
    }))

    // Execute flow with defTaskList
    const startMessage: Message = {
      id: `msg-flow-start-${Date.now()}`,
      role: 'assistant',
      content: `🎯 Executing flow: **${flow.frontmatter.name || flowId}**\n\nTasks: ${tasks.length}\n\n`,
      timestamp: new Date().toISOString(),
    }

    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, startMessage],
      updatedAt: startMessage.timestamp,
    }))

    setFlowExecutionState({
      isExecuting: true,
      currentTaskId: null,
      taskStatuses: Object.fromEntries(tasks.map(t => [t.id, 'pending' as const])),
      flowOutput: {},
    })

    const flowMessageId = `msg-flow-${Date.now()}`
    const flowMessage: Message = {
      id: flowMessageId,
      role: 'assistant',
      content: '## Flow Execution Progress\n\n',
      timestamp: new Date().toISOString(),
    }

    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, flowMessage],
      updatedAt: flowMessage.timestamp,
    }))

    try {
      const result = await executeFlow({
        tasks,
        systemPrompt: generatedPrompt,
        knowledge,
        enabledFilePaths,
        model: 'zai:glm-4.5-air',
        temperature: 0.7,
        onTaskProgress: (taskId, status) => {
          setFlowExecutionState(prev => ({
            ...prev,
            currentTaskId: status === 'in_progress' ? taskId : prev.currentTaskId,
            taskStatuses: {
              ...prev.taskStatuses,
              [taskId]: status,
            },
          }))

          const taskName = tasks.find(t => t.id === taskId)?.name || taskId
          const statusEmoji = status === 'in_progress' ? '⏳' : status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏸️'
          const statusText = `${statusEmoji} **${taskName}** - ${status}\n`

          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === flowMessageId
                ? { ...msg, content: msg.content + statusText }
                : msg
            ),
          }))
        },
        onStreamUpdate: (text) => {
          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === flowMessageId
                ? { ...msg, content: msg.content + text }
                : msg
            ),
          }))
        },
      })

      if (result.success) {
        const summaryMessage: Message = {
          id: `msg-flow-complete-${Date.now()}`,
          role: 'assistant',
          content: `\n\n✅ **Flow completed successfully!**\n\n**Output:**\n\`\`\`json\n${JSON.stringify(result.flowOutput, null, 2)}\n\`\`\``,
          timestamp: new Date().toISOString(),
        }

        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, summaryMessage],
          updatedAt: summaryMessage.timestamp,
        }))
      } else {
        const errorMessage: Message = {
          id: `msg-flow-error-${Date.now()}`,
          role: 'assistant',
          content: `\n\n❌ **Flow execution failed:** ${result.error}`,
          timestamp: new Date().toISOString(),
        }

        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          updatedAt: errorMessage.timestamp,
        }))
      }
    } catch (error) {
      console.error('Flow execution error:', error)

      const errorMessage: Message = {
        id: `msg-flow-error-${Date.now()}`,
        role: 'assistant',
        content: `\n\n❌ **Flow execution error:** ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      }

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        updatedAt: errorMessage.timestamp,
      }))
    } finally {
      setIsLoading(false)
      setFlowExecutionState(prev => ({
        ...prev,
        isExecuting: false,
      }))
    }
  }, [getFlow, generatedPrompt, knowledge, enabledFilePaths])

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

    // Check if this is a slash command from agent's slashActions
    const trimmedContent = content.trim()
    if (trimmedContent.startsWith('/')) {
      const commandName = trimmedContent.substring(1).split(' ')[0]
      const matchingAction = slashActions.find(action => action.name === commandName)
      
      if (matchingAction) {
        // Execute the flow associated with this slash command
        await handleSlashCommandExecution(matchingAction.flowId)
        return
      }
    }

    // Check if this is a flow execution command
    const isFlowCommand = enableFlowExecution && flowTasks.length > 0 && 
      (content.toLowerCase().includes('/execute-flow') || content.toLowerCase().startsWith('/flow'))

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

      // Track accumulated content for streaming
      let accumulatedContent = ''

      // Use runPrompt to generate response
      const { result } = await runPrompt(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async ({ defSystem, $, ...context }: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const defTaskList = context.defTaskList as any
          // Add the generated prompt as system instructions
          defSystem('instructions', generatedPrompt)

          // Add knowledge XML if available
          if (knowledgeXml) {
            defSystem('knowledge', knowledgeXml)
          }

          // If this is a flow execution command, set up defTaskList
          if (isFlowCommand) {
            const lmthingTasks = flowTasks
              .sort((a, b) => a.order - b.order)
              .map(task => ({
                id: task.id,
                name: task.name,
                status: 'pending' as const,
                metadata: {
                  order: task.order,
                  description: task.description,
                  instructions: task.instructions,
                  type: task.type,
                },
              }))

            const [tasks] = defTaskList(lmthingTasks)

            // Initialize flow execution state
            setFlowExecutionState({
              isExecuting: true,
              currentTaskId: null,
              taskStatuses: Object.fromEntries(tasks.map((t: { id: string; status: string }) => [t.id, t.status])),
              flowOutput: {},
            })

            defSystem('flow-instructions', `
## Flow Execution Mode

You are now executing a multi-step flow with ${flowTasks.length} tasks.

**Flow Tasks:**
${flowTasks.map((t, i) => `${i + 1}. **${t.name}** (${t.id})
   - Type: ${t.type}
   - Description: ${t.description}
   - Instructions: ${t.instructions}${t.type === 'updateFlowOutput' && t.targetFieldName ? `
   - Output Target: flowOutput.${t.targetFieldName}${t.outputSchema ? `
   - Output Schema: ${JSON.stringify(t.outputSchema)}` : ''}` : ''}`).join('\n\n')}

**Flow Output Object:**
As you complete tasks, structured outputs will be added to the flow output object:
\`\`\`json
{
${flowTasks.filter(t => t.type === 'updateFlowOutput' && t.targetFieldName).map(t => `  "${t.targetFieldName}": { /* output from ${t.name} */ }`).join(',\n')}
}
\`\`\`

**Execution Rules:**
1. Use \`startTask(taskId)\` tool to begin each task
2. Execute the task according to its instructions
3. For \`updateFlowOutput\` tasks: generate structured output matching the schema and store it in the specified field
4. Use \`completeTask(taskId)\` tool when finished
5. If a task fails, use \`failTask(taskId, reason)\` with an explanation
6. Tasks must be completed in order (task 1, then task 2, etc.)
7. After completing all tasks, display the complete flow output

**Available Tools:**
- startTask(taskId) - Mark a task as in progress
- completeTask(taskId) - Mark a task as completed  
- failTask(taskId, reason) - Mark a task as failed

Start with the first task now.
`)
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
            // Capture tool calls and format them
            onStepFinish: (stepResult) => {
              // Handle flow state updates
              if (isFlowCommand) {
                const toolResults = stepResult.toolResults || []
                for (const toolResult of toolResults) {
                  const toolName = toolResult.toolName
                  if (toolName === 'startTask' || toolName === 'completeTask' || toolName === 'failTask') {
                    setFlowExecutionState(prev => {
                      const newStatuses = { ...prev.taskStatuses }
                      return {
                        ...prev,
                        taskStatuses: newStatuses,
                      }
                    })
                  }
                }
              }

              // Format and append tool events
              const toolCalls = stepResult.toolCalls || []
              const toolResults = stepResult.toolResults || []

              if (toolCalls.length > 0) {
                toolCalls.forEach((toolCall, index) => {
                  const toolResult = toolResults[index]
                  const toolEventData = {
                    tool: toolCall.toolName,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    args: (toolCall as any).args,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    result: (toolResult as any)?.result,
                  }
                  const toolEventJson = stringifyJson(toolEventData)
                  const toolEventBlock = toToolEventBlock(toolEventJson)
                  
                  // Append tool event to accumulated content
                  accumulatedContent += '\n\n' + toolEventBlock
                  
                  // Update the message with tool events
                  setConversation((prev) => ({
                    ...prev,
                    messages: prev.messages.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    ),
                  }))
                })
              }
            },
          },
        }
      )

      // Stream the response
      for await (const chunk of result.textStream) {
        accumulatedContent += chunk
        setConversation((prev) => ({
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: accumulatedContent }
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
  }, [knowledge, enabledFilePaths, generatedPrompt, conversation.messages, enableFlowExecution, flowTasks, slashActions, handleSlashCommandExecution])

  const handleExecuteFlow = useCallback(async () => {
    if (!enableFlowExecution || flowTasks.length === 0) return

    // Add flow execution start message
    const startMessage: Message = {
      id: `msg-flow-start-${Date.now()}`,
      role: 'assistant',
      content: `🔄 Starting flow execution with ${flowTasks.length} task${flowTasks.length !== 1 ? 's' : ''}...\n\n`,
      timestamp: new Date().toISOString(),
    }

    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, startMessage],
      updatedAt: startMessage.timestamp,
    }))

    setIsLoading(true)
    setFlowExecutionState({
      isExecuting: true,
      currentTaskId: null,
      taskStatuses: Object.fromEntries(flowTasks.map(t => [t.id, 'pending' as const])),
      flowOutput: {},
    })

    const flowMessageId = `msg-flow-${Date.now()}`
    const flowMessage: Message = {
      id: flowMessageId,
      role: 'assistant',
      content: '## Flow Execution Progress\n\n',
      timestamp: new Date().toISOString(),
    }

    setConversation((prev) => ({
      ...prev,
      messages: [...prev.messages, flowMessage],
      updatedAt: flowMessage.timestamp,
    }))

    try {
      const result = await executeFlow({
        tasks: flowTasks,
        systemPrompt: generatedPrompt,
        knowledge,
        enabledFilePaths,
        model: 'zai:glm-4.5-air',
        temperature: 0.7,
        onTaskProgress: (taskId, status) => {
          setFlowExecutionState(prev => ({
            ...prev,
            currentTaskId: status === 'in_progress' ? taskId : prev.currentTaskId,
            taskStatuses: { ...prev.taskStatuses, [taskId]: status },
          }))

          const task = flowTasks.find(t => t.id === taskId)
          const taskName = task?.name || taskId
          const statusEmoji = {
            pending: '⏳',
            in_progress: '▶️',
            completed: '✅',
            failed: '❌',
          }[status]

          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === flowMessageId
                ? {
                    ...msg,
                    content: msg.content + `\n${statusEmoji} **${taskName}** - ${status}`,
                  }
                : msg
            ),
          }))
        },
        onStreamUpdate: (text) => {
          setConversation((prev) => ({
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === flowMessageId
                ? {
                    ...msg,
                    content: msg.content + '\n\n' + text.slice(0, 500),
                  }
                : msg
            ),
          }))
        },
      })

      if (result.success) {
        const summaryMessage: Message = {
          id: `msg-flow-complete-${Date.now()}`,
          role: 'assistant',
          content: `\n\n✅ **Flow completed successfully!**\n\n**Flow Output:**\n\`\`\`json\n${JSON.stringify(result.flowOutput, null, 2)}\n\`\`\``,
          timestamp: new Date().toISOString(),
        }

        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, summaryMessage],
          updatedAt: summaryMessage.timestamp,
        }))

        setFlowExecutionState(prev => ({
          ...prev,
          isExecuting: false,
          flowOutput: result.flowOutput,
        }))
      } else {
        const errorMessage: Message = {
          id: `msg-flow-error-${Date.now()}`,
          role: 'assistant',
          content: `\n\n❌ **Flow execution failed:** ${result.error}`,
          timestamp: new Date().toISOString(),
        }

        setConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          updatedAt: errorMessage.timestamp,
        }))

        setFlowExecutionState(prev => ({
          ...prev,
          isExecuting: false,
        }))
      }
    } catch (error) {
      console.error('Flow execution error:', error)

      const errorMessage: Message = {
        id: `msg-flow-error-${Date.now()}`,
        role: 'assistant',
        content: `\n\n❌ **Flow execution error:** ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      }

      setConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
        updatedAt: errorMessage.timestamp,
      }))

      setFlowExecutionState(prev => ({
        ...prev,
        isExecuting: false,
      }))
    } finally {
      setIsLoading(false)
    }
  }, [enableFlowExecution, flowTasks, generatedPrompt, knowledge, enabledFilePaths])

  const handleSaveConversation = useCallback(() => {
    if (!onSaveConversation) return
    onSaveConversation(conversation)
  }, [onSaveConversation, conversation])

  const handleReset = useCallback(() => {
    const welcomeContent = enableFlowExecution && flowTasks.length > 0
      ? `🎯 **Flow Execution Mode Enabled**\n\n**Available Commands:**\n• \`/execute-flow\` - Execute the ${flowTasks.length}-task flow with structured output\n• \`/flow\` - Short alias for flow execution\n\n**Flow Tasks:**\n${flowTasks.map((t, i) => `${i + 1}. **${t.name}**${t.type === 'updateFlowOutput' && t.targetFieldName ? ` → \`flowOutput.${t.targetFieldName}\`` : ''}`).join('\n')}\n\n**How it works:**\nEach task uses defTaskList for progress tracking (\`startTask\`, \`completeTask\`, \`failTask\`). Tasks of type \`updateFlowOutput\` add structured data to the flow output object.\n\nType a command above to start, or chat normally.`
      : 'Runtime preview ready. Try sending a message to test how this agent would respond in chat.'

    setConversation({
      id: 'preview-conversation',
      agentId: 'preview-agent',
      agentName: 'Runtime Preview Agent',
      messages: [
        {
          id: 'msg-welcome',
          role: 'assistant',
          content: welcomeContent,
          timestamp: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setFlowExecutionState({
      isExecuting: false,
      currentTaskId: null,
      taskStatuses: {},
      flowOutput: {},
    })
  }, [enableFlowExecution, flowTasks])

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

  // Inline mode - render directly without modal wrapper
  if (mode === 'inline') {
    // Filter conversations for this agent
    const agentConversations = loadedAgentId 
      ? previousConversations.filter(c => c.agentId === loadedAgentId)
      : []

    return (
      <div className="h-full flex">
        {/* Main Chat Area */}
        <div className="flex-1 min-w-0 flex flex-col">
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
              onBackToList={() => {}}
              onRuntimeFieldChange={handleRuntimeFieldChange}
              onViewSystemPrompt={() => setShowSystemPrompt(true)}
            />
          </div>
        </div>

        {/* Conversations Sidebar - Right Side */}
        {agentConversations.length > 0 && (
          <div className="w-64 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Conversations
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">
                {agentConversations.length} total
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <button
                onClick={handleReset}
                className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors bg-violet-600 hover:bg-violet-700 text-white font-medium"
              >
                + New Conversation
              </button>
              {agentConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    setConversation(conv)
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    conversation.id === conv.id
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm ring-1 ring-violet-500/20'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="font-medium truncate">
                      {conv.messages[0]?.content.slice(0, 40) || 'New conversation'}...
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-500">
                      {new Date(conv.updatedAt).toLocaleDateString()} • {conv.messages.length} msgs
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* System Prompt Modal */}
        {showSystemPrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/40">
            <div className="relative w-full max-w-3xl max-h-[70vh] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Full System Prompt</h3>
                <button
                  onClick={() => setShowSystemPrompt(false)}
                  className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-950 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
                  {fullSystemPrompt}
                </pre>
              </div>
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(fullSystemPrompt)
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => setShowSystemPrompt(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors"
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

  // Modal mode - existing modal wrapper
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
            {enableFlowExecution && flowTasks.length > 0 && (
              <button
                onClick={handleExecuteFlow}
                disabled={flowExecutionState.isExecuting || isLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:bg-slate-400 disabled:cursor-not-allowed border border-violet-700 dark:border-violet-500 transition-colors flex items-center gap-1.5"
                title="Execute flow"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {flowExecutionState.isExecuting ? 'Executing...' : `Run Flow (${flowTasks.length})`}
              </button>
            )}
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
