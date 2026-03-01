import { useState, useCallback, useEffect, useMemo, useRef, type FormEvent } from 'react'
import { Bot } from 'lucide-react'
import { runPrompt, type PromptConfig } from 'lmthing'
import { z } from 'zod'
import { useAgents, useFlows } from '@/lib/workspaceContext'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import type {
  EncryptedEnvFile,
  PackageJson,
  KnowledgeNode,
  Agent as WorkspaceAgent,
  Flow as WorkspaceFlow,
} from '@/types/workspace-data'

type ThingMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type ThingConversation = {
  id: string
  title: string
  messages: ThingMessage[]
  createdAt: string
  updatedAt: string
}

type ThingLmthingModelId = Extract<PromptConfig['model'], string>

const THING_ACTION_NAMES = [
  'viewWorkspaceData',
  'setCurrentWorkspace',
  'reload',
  'updatePackageJson',
  'upsertAgent',
  'deleteAgent',
  'upsertFlow',
  'deleteFlow',
  'upsertEnvFile',
  'deleteEnvFile',
  'updateKnowledgeFileContent',
  'updateKnowledgeFileFrontmatter',
  'updateKnowledgeDirectoryConfig',
  'addKnowledgeNode',
  'updateKnowledgeNodePath',
  'deleteKnowledgeNode',
  'duplicateKnowledgeNode',
] as const

const THING_WELCOME_MESSAGE =
  'I am thing. I can execute workspace data actions directly via tools. Ask in plain language, send JSON, or type help.'

const THING_CONVERSATIONS_STORAGE_KEY = 'lmthing-thing-conversations-v1'

const THING_HELP_MESSAGE = [
  `Available actions: ${THING_ACTION_NAMES.join(', ')}`,
  'You can ask naturally (for example: "create a new agent for onboarding").',
  'Or use JSON: {"action":"upsertAgent","payload":{...}}',
  'Example: {"action":"deleteKnowledgeNode","payload":{"nodePath":"education/sections/old-node.md"}}',
].join('\n')

function stripCodeFence(input: string): string {
  const trimmed = input.trim()
  if (!trimmed.startsWith('```')) return trimmed

  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
}

function countKnowledgeNodes(nodes: KnowledgeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countKnowledgeNodes(node.children || []), 0)
}

function isThingLmthingModelId(value: unknown): value is ThingLmthingModelId {
  if (typeof value !== 'string') return false

  const [provider, model] = value.split(':')
  return Boolean(provider?.trim() && model?.trim())
}

function parseWorkspacePath(path?: string): string[] {
  if (!path) return []

  return path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function getValueAtWorkspacePath(root: unknown, path?: string): unknown {
  const segments = parseWorkspacePath(path)

  return segments.reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined

    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return undefined
      }
      return current[index]
    }

    return (current as Record<string, unknown>)[segment]
  }, root)
}

function summarizeWorkspaceValue(value: unknown, depth: number): unknown {
  if (depth <= 0) {
    if (Array.isArray(value)) return `[array(${value.length})]`
    if (value && typeof value === 'object') return '[object]'
    return value
  }

  if (Array.isArray(value)) {
    const limit = 20
    return {
      type: 'array',
      length: value.length,
      items: value.slice(0, limit).map((item) => summarizeWorkspaceValue(item, depth - 1)),
      truncated: value.length > limit,
    }
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    const limit = 40
    const preview = entries.slice(0, limit).reduce<Record<string, unknown>>((acc, [key, child]) => {
      acc[key] = summarizeWorkspaceValue(child, depth - 1)
      return acc
    }, {})

    return {
      type: 'object',
      keyCount: entries.length,
      keys: entries.map(([key]) => key),
      preview,
      truncated: entries.length > limit,
    }
  }

  return value
}

function resolveThingModelId(): ThingLmthingModelId {
  const runtimeEnv =
    typeof window !== 'undefined'
      ? (window as Window & { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined

  const configuredModel =
    runtimeEnv?.LMTHING_THING_MODEL
    || runtimeEnv?.LM_MODEL_DEFAULT
    || runtimeEnv?.LM_MODEL_FAST
    || runtimeEnv?.LM_MODEL_LARGE

  if (isThingLmthingModelId(configuredModel)) {
    return configuredModel
  }

  return 'zai:glm-4.5'
}

function createThingWelcomeMessage(): ThingMessage {
  return {
    id: 'thing-welcome',
    role: 'assistant',
    content: THING_WELCOME_MESSAGE,
  }
}

function createThingConversation(title?: string): ThingConversation {
  const now = new Date().toISOString()
  const id = `thing-conversation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    title: title || 'New chat',
    messages: [createThingWelcomeMessage()],
    createdAt: now,
    updatedAt: now,
  }
}

function loadThingConversationsFromStorage(): ThingConversation[] {
  if (typeof window === 'undefined') return [createThingConversation()]

  try {
    const raw = window.localStorage.getItem(THING_CONVERSATIONS_STORAGE_KEY)
    if (!raw) return [createThingConversation()]

    const parsed = JSON.parse(raw) as ThingConversation[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [createThingConversation()]
    }

    return parsed.map((conversation) => ({
      ...conversation,
      title: conversation.title || 'Untitled chat',
      messages: Array.isArray(conversation.messages) && conversation.messages.length > 0
        ? conversation.messages
        : [createThingWelcomeMessage()],
    }))
  } catch {
    return [createThingConversation()]
  }
}

export interface ThingPanelProps {
  isOpen: boolean
}

export function ThingPanel({ isOpen }: ThingPanelProps) {
  const { agents: agentsMap } = useAgents()
  const { flows: flowsMap } = useFlows()
  const {
    setCurrentWorkspace,
    reload,
    workspaceData,
    knowledge,
    updatePackageJson,
    upsertAgent,
    deleteAgent,
    upsertFlow,
    deleteFlow,
    upsertEnvFile,
    deleteEnvFile,
    updateKnowledgeFileContent,
    updateKnowledgeFileFrontmatter,
    updateKnowledgeDirectoryConfig,
    addKnowledgeNode,
    updateKnowledgeNodePath,
    deleteKnowledgeNode,
    duplicateKnowledgeNode,
  } = useWorkspaceData()

  const [thingInput, setThingInput] = useState('')
  const [thingConversations, setThingConversations] = useState<ThingConversation[]>(() => loadThingConversationsFromStorage())
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isThingWorking, setIsThingWorking] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingMessageContent, setEditingMessageContent] = useState('')
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingConversationTitle, setEditingConversationTitle] = useState('')
  const thingMessagesEndRef = useRef<HTMLDivElement | null>(null)
  const thingModel = useMemo(() => resolveThingModelId(), [])

  const currentConversation = useMemo(() => {
    if (thingConversations.length === 0) return null
    if (!currentConversationId) return thingConversations[0]
    return thingConversations.find((conversation) => conversation.id === currentConversationId) || thingConversations[0]
  }, [thingConversations, currentConversationId])

  const thingMessages = useMemo(
    () => currentConversation?.messages || [createThingWelcomeMessage()],
    [currentConversation]
  )

  const totalKnowledgeNodeCount = useMemo(() => countKnowledgeNodes(knowledge), [knowledge])

  useEffect(() => {
    if (thingConversations.length === 0) {
      const fallback = createThingConversation()
      setThingConversations([fallback])
      setCurrentConversationId(fallback.id)
      return
    }

    if (!currentConversationId || !thingConversations.some((conversation) => conversation.id === currentConversationId)) {
      setCurrentConversationId(thingConversations[0].id)
    }
  }, [thingConversations, currentConversationId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(THING_CONVERSATIONS_STORAGE_KEY, JSON.stringify(thingConversations))
  }, [thingConversations])

  const updateConversationMessages = useCallback((conversationId: string, messages: ThingMessage[]) => {
    setThingConversations((prev) => prev.map((conversation) => (
      conversation.id === conversationId
        ? {
          ...conversation,
          messages,
          updatedAt: new Date().toISOString(),
        }
        : conversation
    )))
  }, [])

  const createNewChat = useCallback(() => {
    const nextIndex = thingConversations.length + 1
    const nextConversation = createThingConversation(`Chat ${nextIndex}`)
    setThingConversations((prev) => [nextConversation, ...prev])
    setCurrentConversationId(nextConversation.id)
    setThingInput('')
    setEditingMessageId(null)
    setEditingMessageContent('')
  }, [thingConversations.length])

  const startEditingConversationTitle = useCallback((conversation: ThingConversation) => {
    setEditingConversationId(conversation.id)
    setEditingConversationTitle(conversation.title)
  }, [])

  const cancelEditingConversationTitle = useCallback(() => {
    setEditingConversationId(null)
    setEditingConversationTitle('')
  }, [])

  const saveConversationTitle = useCallback(() => {
    if (!editingConversationId) return
    const nextTitle = editingConversationTitle.trim()
    if (!nextTitle) return

    setThingConversations((prev) => prev.map((conversation) => (
      conversation.id === editingConversationId
        ? {
          ...conversation,
          title: nextTitle,
          updatedAt: new Date().toISOString(),
        }
        : conversation
    )))

    cancelEditingConversationTitle()
  }, [editingConversationId, editingConversationTitle, cancelEditingConversationTitle])

  const handleThingMessage = useCallback(async (
    conversation: ThingMessage[],
    onTextDelta?: (delta: string) => void,
    onToolEvent?: (message: string) => void,
  ): Promise<string> => {
    const lastUserMessage = [...conversation].reverse().find((message) => message.role === 'user')
    const input = stripCodeFence(lastUserMessage?.content || '')
    const normalized = input.trim()

    if (!normalized) {
      return 'Please enter a message or JSON action envelope.'
    }

    if (normalized.toLowerCase() === 'help' || normalized === '/help') {
      return THING_HELP_MESSAGE
    }

    if (normalized.toLowerCase() === 'status' || normalized === '/status') {
      return [
        `Workspace: ${workspaceData?.id || 'none'}`,
        `Agents: ${Object.keys(agentsMap).length}`,
        `Flows: ${Object.keys(flowsMap).length}`,
        `Knowledge nodes: ${totalKnowledgeNodeCount}`,
      ].join('\n')
    }

    const unknownRecordSchema = z.record(z.string(), z.unknown())
    const knowledgeNodeSchema = z.object({
      path: z.string().min(1),
      type: z.enum(['directory', 'file']),
      config: unknownRecordSchema.optional(),
      children: z.array(z.unknown()).optional(),
      frontmatter: unknownRecordSchema.optional(),
      content: z.string().optional(),
    }).passthrough()

    try {
      const workspaceSummary = {
        workspaceId: workspaceData?.id ?? null,
        agentIds: Object.keys(agentsMap),
        flowIds: Object.keys(flowsMap),
        knowledgeNodeCount: totalKnowledgeNodeCount,
        actionNames: THING_ACTION_NAMES,
      }

      const { result } = await runPrompt(async (prompt) => {
        prompt.defSystem(
          'role',
          [
            'You are thing, the built-in AI assistant for lmthing studio — a no-code platform for building, configuring, and deploying custom AI agents.',
            '',
            'lmthing studio lets users:',
            '• Organize domain knowledge as markdown files in a tree structure (the Knowledge section).',
            '• Build specialized agents that combine instructions with selected knowledge domains (the Agent Studio).',
            '• Create multi-step task workflows (Flows) where each step has its own prompt, output schema, and model selection.',
            '• Test and run agents in a chat interface.',
            '',
            'You operate on workspace data directly through tools. You are precise, helpful, and proactive.',
          ].join('\n')
        )

        prompt.defSystem(
          'data-model',
          [
            'A workspace contains: agents, flows, knowledge (tree), packageJson, and optional env files.',
            '',
            '--- Agent shape ---',
            'An Agent requires:',
            '  id: string (kebab-case, e.g. "lesson-planner")',
            '  frontmatter: { name, description, tools?: string[], selectedDomains?: string[] }',
            '  mainInstruction: string (the agent\'s core system prompt, can be multi-line markdown)',
            '  slashActions: Array<{ name, description, flowId, actionId }> (commands the agent exposes)',
            '  config: { emptyFieldsForRuntime: Array<string | { id, label, domain }> } (fields the user fills at chat time)',
            '  formValues: Record<string, string | string[] | boolean | number> (default/saved field values)',
            '  conversations: Array<{ id, agentId, agentName, messages, createdAt, updatedAt }> (chat history)',
            '',
            '--- Flow shape ---',
            'A Flow requires:',
            '  id: string (kebab-case, e.g. "generate-lesson-plan")',
            '  frontmatter: { id, name, status ("active"|"draft"), scope, agentId, tags: string[], taskCount: string, createdAt, updatedAt }',
            '  description: string',
            '  tasks: Array of FlowTask, each with:',
            '    order: number (1-based sequence)',
            '    name: string (kebab-case)',
            '    frontmatter: { description?, type?, model?: "provider:model_id" (e.g. "openai:gpt-4o"), temperature?, enabledTools? }',
            '    instructions: string (the prompt for this task step)',
            '    outputSchema?: { type: "object", properties: Record<string, unknown>, required?: string[] }',
            '    targetFieldName?: string (agent field to write output into)',
            '',
            '--- Knowledge shape ---',
            'Knowledge is a tree of nodes. Each node has:',
            '  path: string (e.g. "education/classroom-management/strategies.md")',
            '  type: "directory" | "file"',
            '  For directories: config?: { label, description, icon, color, renderAs, fieldType, variableName, required, default }',
            '  For files: frontmatter?: { title, order, ... }, content?: string (markdown)',
            '  children?: KnowledgeNode[] (only for directories)',
            '',
            '--- PackageJson ---',
            '  name, version, description, dependencies, devDependencies, plus any extra fields.',
          ].join('\n')
        )

        prompt.defSystem(
          'behavior',
          [
            'Tool usage:',
            '• Always call tools for create, update, and delete operations — never just describe what you would do.',
            '• For read-only inspection or navigation, call viewWorkspaceData with the appropriate dot-path (e.g. "agents", "flows.my-flow", "knowledge").',
            '• Before creating or updating an entity, use viewWorkspaceData to check existing data so you don\'t overwrite things unintentionally.',
            '',
            'Interaction style:',
            '• If required fields are missing from the user\'s request, ask a single concise clarification question listing exactly what you need.',
            '• When a tool succeeds, give a short summary of what changed (e.g. "Created agent lesson-planner with 2 slash actions").',
            '• When a tool fails, explain the error clearly and suggest a corrected approach.',
            '• Accept both plain language ("create an agent for onboarding") and JSON envelopes ({"action":"upsertAgent","payload":{...}}).',
            '',
            'Quality defaults:',
            '• Generate kebab-case IDs from the name the user provides (e.g. "Lesson Planner" → "lesson-planner").',
            '• When creating agents, include a sensible mainInstruction, empty slashActions, emptyFieldsForRuntime, formValues, and conversations arrays/objects unless the user specifies otherwise.',
            '• When creating flows, set status to "draft", generate ISO timestamps for createdAt/updatedAt, and default taskCount to the number of tasks.',
            '• For knowledge nodes, infer the type from context — use "directory" for categories/sections and "file" for content documents.',
            '• Keep responses concise — prefer short confirmations over lengthy explanations.',
          ].join('\n')
        )

        prompt.defData('WORKSPACE_CONTEXT', workspaceSummary)

        prompt.defTool(
          'viewWorkspaceData',
          'Navigate and inspect workspace data by path. Use dot path, e.g. workspaceData.agents, workspaceData.flows.my-flow, workspaceData.knowledge[0].children.',
          z.object({
            path: z.string().optional(),
            depth: z.number().int().min(0).max(5).optional(),
          }),
          async ({ path, depth }: { path?: string; depth?: number }) => {
            const workspaceSnapshot = {
              workspaceId: workspaceData?.id ?? null,
              workspaceData: workspaceData ?? null,
              agents: agentsMap,
              flows: flowsMap,
              knowledge,
            }

            const resolvedPath = (path || 'workspaceData').trim()
            const value = getValueAtWorkspacePath(workspaceSnapshot, resolvedPath)

            if (value === undefined) {
              return {
                ok: false,
                message: `Path not found: ${resolvedPath}`,
                rootKeys: Object.keys(workspaceSnapshot),
              }
            }

            const safeDepth = depth ?? 2

            return {
              ok: true,
              path: resolvedPath,
              summary: summarizeWorkspaceValue(value, safeDepth),
            }
          }
        )

        prompt.defTool(
          'setCurrentWorkspace',
          'Switch active workspace context by workspace id.',
          z.object({ workspaceId: z.string().min(1) }),
          async ({ workspaceId }: { workspaceId: string }) => {
            setCurrentWorkspace(workspaceId)
            return { ok: true, message: `Switched workspace context to ${workspaceId}.` }
          }
        )

        prompt.defTool(
          'reload',
          'Reload workspace data from source and persisted state.',
          z.object({}),
          async () => {
            await reload()
            return { ok: true, message: 'Reload completed for workspace data.' }
          }
        )

        prompt.defTool(
          'updatePackageJson',
          'Replace current workspace package.json object.',
          z.object({ packageJson: unknownRecordSchema }),
          async ({ packageJson }: { packageJson: Record<string, unknown> }) => {
            updatePackageJson(packageJson as PackageJson)
            return { ok: true, message: 'Updated workspace package.json.' }
          }
        )

        prompt.defTool(
          'upsertAgent',
          'Create or update an agent by id.',
          z.object({ agent: z.object({ id: z.string().min(1) }).passthrough() }),
          async ({ agent }: { agent: { id: string } & Record<string, unknown> }) => {
            upsertAgent(agent as unknown as WorkspaceAgent)
            return { ok: true, message: `Upserted agent ${agent.id}.` }
          }
        )

        prompt.defTool(
          'deleteAgent',
          'Delete an agent by id.',
          z.object({ agentId: z.string().min(1) }),
          async ({ agentId }: { agentId: string }) => {
            deleteAgent(agentId)
            return { ok: true, message: `Deleted agent ${agentId}.` }
          }
        )

        prompt.defTool(
          'upsertFlow',
          'Create or update a flow by id. Validate task model format provider:model_id.',
          z.object({ flow: z.object({ id: z.string().min(1) }).passthrough() }),
          async ({ flow }: { flow: { id: string } & Record<string, unknown> }) => {
            const workspaceFlow = flow as unknown as WorkspaceFlow
            const invalidTask = workspaceFlow.tasks?.find((task) => {
              const model = task.frontmatter?.model
              return model !== undefined && !isThingLmthingModelId(model)
            })

            if (invalidTask) {
              throw new Error(
                [
                  `Invalid model in flow task ${invalidTask.order}.`,
                  'Expected model format: provider:model_id (for example openai:gpt-4o).',
                ].join(' ')
              )
            }

            upsertFlow(workspaceFlow)
            return { ok: true, message: `Upserted flow ${workspaceFlow.id}.` }
          }
        )

        prompt.defTool(
          'deleteFlow',
          'Delete a flow by id.',
          z.object({ flowId: z.string().min(1) }),
          async ({ flowId }: { flowId: string }) => {
            deleteFlow(flowId)
            return { ok: true, message: `Deleted flow ${flowId}.` }
          }
        )

        prompt.defTool(
          'upsertEnvFile',
          'Create or update an encrypted environment file entry.',
          z.object({
            fileName: z.string().min(1),
            file: z.object({
              schema: z.literal('lmthing-env-v1'),
              algorithm: z.literal('AES-GCM'),
              kdf: z.literal('PBKDF2'),
              digest: z.literal('SHA-256'),
              iterations: z.number(),
              salt: z.string(),
              iv: z.string(),
              ciphertext: z.string(),
              createdAt: z.string(),
              updatedAt: z.string(),
              expiresAt: z.string().optional(),
            }),
          }),
          async ({ fileName, file }: { fileName: string; file: EncryptedEnvFile }) => {
            upsertEnvFile(fileName, file as EncryptedEnvFile)
            return { ok: true, message: `Upserted env file ${fileName}.` }
          }
        )

        prompt.defTool(
          'deleteEnvFile',
          'Delete an encrypted environment file entry by filename.',
          z.object({ fileName: z.string().min(1) }),
          async ({ fileName }: { fileName: string }) => {
            deleteEnvFile(fileName)
            return { ok: true, message: `Deleted env file ${fileName}.` }
          }
        )

        prompt.defTool(
          'updateKnowledgeFileContent',
          'Update markdown content of a knowledge file node.',
          z.object({ filePath: z.string().min(1), content: z.string() }),
          async ({ filePath, content }: { filePath: string; content: string }) => {
            updateKnowledgeFileContent(filePath, content)
            return { ok: true, message: `Updated file content at ${filePath}.` }
          }
        )

        prompt.defTool(
          'updateKnowledgeFileFrontmatter',
          'Merge frontmatter fields for a knowledge file node.',
          z.object({ filePath: z.string().min(1), frontmatter: unknownRecordSchema }),
          async ({ filePath, frontmatter }: { filePath: string; frontmatter: Record<string, unknown> }) => {
            updateKnowledgeFileFrontmatter(filePath, frontmatter)
            return { ok: true, message: `Updated file frontmatter at ${filePath}.` }
          }
        )

        prompt.defTool(
          'updateKnowledgeDirectoryConfig',
          'Merge config fields for a knowledge directory node.',
          z.object({ directoryPath: z.string().min(1), config: unknownRecordSchema }),
          async ({ directoryPath, config }: { directoryPath: string; config: Record<string, unknown> }) => {
            updateKnowledgeDirectoryConfig(directoryPath, config)
            return { ok: true, message: `Updated directory config at ${directoryPath}.` }
          }
        )

        prompt.defTool(
          'addKnowledgeNode',
          'Add a knowledge node under a parent directory path, or root when parentNodePath is null.',
          z.object({
            parentNodePath: z.string().min(1).nullable().optional(),
            node: knowledgeNodeSchema,
          }),
          async ({ parentNodePath, node }: { parentNodePath?: string | null; node: KnowledgeNode }) => {
            addKnowledgeNode(parentNodePath ?? null, node as KnowledgeNode)
            return { ok: true, message: `Added knowledge node ${node.path}.` }
          }
        )

        prompt.defTool(
          'updateKnowledgeNodePath',
          'Rename or move a knowledge node path.',
          z.object({ oldPath: z.string().min(1), newPath: z.string().min(1) }),
          async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
            updateKnowledgeNodePath(oldPath, newPath)
            return { ok: true, message: `Renamed or moved knowledge node from ${oldPath} to ${newPath}.` }
          }
        )

        prompt.defTool(
          'deleteKnowledgeNode',
          'Delete a knowledge node recursively by path.',
          z.object({ nodePath: z.string().min(1) }),
          async ({ nodePath }: { nodePath: string }) => {
            deleteKnowledgeNode(nodePath)
            return { ok: true, message: `Deleted knowledge node ${nodePath}.` }
          }
        )

        prompt.defTool(
          'duplicateKnowledgeNode',
          'Duplicate a knowledge node and its subtree by path.',
          z.object({ nodePath: z.string().min(1) }),
          async ({ nodePath }: { nodePath: string }) => {
            duplicateKnowledgeNode(nodePath)
            return { ok: true, message: `Duplicated knowledge node ${nodePath}.` }
          }
        )

        conversation.forEach((message) => {
          prompt.defMessage(message.role, message.content)
        })
      }, {
        model: thingModel,
        options: {
          temperature: 0.1,
          maxOutputTokens: 600,
          onStepFinish: (stepResult) => {
            const resultAny = stepResult as {
              finishReason?: string
              toolCalls?: Array<{ toolName?: string }>
            }

            if (resultAny.finishReason !== 'tool-calls') {
              return
            }

            const toolNames = (resultAny.toolCalls || [])
              .map((toolCall) => toolCall.toolName)
              .filter((toolName): toolName is string => Boolean(toolName))

            if (toolNames.length === 0) {
              onToolEvent?.('🔧 Running tool...')
              return
            }

            onToolEvent?.(`🔧 Running tool${toolNames.length > 1 ? 's' : ''}: ${toolNames.join(', ')}`)
          },
        },
      })

      const streamCandidate = (result as { textStream?: unknown }).textStream
      let streamedText = ''

      if (
        streamCandidate
        && typeof streamCandidate === 'object'
        && Symbol.asyncIterator in streamCandidate
      ) {
        for await (const delta of streamCandidate as AsyncIterable<string>) {
          streamedText += delta
          onTextDelta?.(delta)
        }
      }

      const text = await result.text
      const finalText = text?.trim() || streamedText.trim() || 'Done.'
      return finalText
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return `I could not complete that request: ${message}`
    }
  }, [
    workspaceData,
    agentsMap,
    flowsMap,
    knowledge,
    totalKnowledgeNodeCount,
    thingModel,
    setCurrentWorkspace,
    reload,
    updatePackageJson,
    upsertAgent,
    deleteAgent,
    upsertFlow,
    deleteFlow,
    upsertEnvFile,
    deleteEnvFile,
    updateKnowledgeFileContent,
    updateKnowledgeFileFrontmatter,
    updateKnowledgeDirectoryConfig,
    addKnowledgeNode,
    updateKnowledgeNodePath,
    deleteKnowledgeNode,
    duplicateKnowledgeNode,
  ])

  const runThingConversation = useCallback((conversationId: string, conversation: ThingMessage[]) => {
    const assistantMessageId = `thing-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    updateConversationMessages(conversationId, [
      ...conversation,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      },
    ])

    setIsThingWorking(true)

    void (async () => {
      let streamedContent = ''

      const appendToAssistantMessage = (text: string) => {
        if (!text) return
        streamedContent += text

        setThingConversations((prev) => prev.map((item) => {
          if (item.id !== conversationId) return item
          return {
            ...item,
            updatedAt: new Date().toISOString(),
            messages: item.messages.map((message) => (
              message.id === assistantMessageId
                ? { ...message, content: (message.content || '') + text }
                : message
            )),
          }
        }))
      }

      const appendToolEvent = (eventText: string) => {
        const chunk = `${streamedContent ? '\n\n' : ''}${eventText}\n`
        appendToAssistantMessage(chunk)
      }

      const response = await handleThingMessage(
        conversation,
        (delta) => appendToAssistantMessage(delta),
        (eventMessage) => appendToolEvent(eventMessage),
      )

      setThingConversations((prev) => prev.map((item) => {
        if (item.id !== conversationId) return item
        return {
          ...item,
          updatedAt: new Date().toISOString(),
          messages: item.messages.map((message) => (
            message.id === assistantMessageId
              ? {
                ...message,
                content: message.content?.trim() ? message.content : response,
              }
              : message
          )),
        }
      }))

      setIsThingWorking(false)
    })()
  }, [handleThingMessage, updateConversationMessages])

  const startEditingMessage = useCallback((message: ThingMessage) => {
    if (isThingWorking) return
    setEditingMessageId(message.id)
    setEditingMessageContent(message.content)
  }, [isThingWorking])

  const cancelEditingMessage = useCallback(() => {
    setEditingMessageId(null)
    setEditingMessageContent('')
  }, [])

  const saveEditedMessage = useCallback((options?: { rerunFromUserMessage?: boolean }) => {
    if (!editingMessageId) return

    const nextContent = editingMessageContent.trim()
    if (!nextContent) return

    const currentMessages = thingMessages
    const targetIndex = currentMessages.findIndex((message) => message.id === editingMessageId)
    if (targetIndex === -1) {
      cancelEditingMessage()
      return
    }

    const targetMessage = currentMessages[targetIndex]
    const updatedMessages = currentMessages.map((message) => (
      message.id === editingMessageId
        ? { ...message, content: nextContent }
        : message
    ))

    cancelEditingMessage()

    if (options?.rerunFromUserMessage && targetMessage.role === 'user') {
      const truncatedConversation = updatedMessages.slice(0, targetIndex + 1)
      if (currentConversation) {
        runThingConversation(currentConversation.id, truncatedConversation)
      }
      return
    }

    if (currentConversation) {
      updateConversationMessages(currentConversation.id, updatedMessages)
    }
  }, [
    editingMessageId,
    editingMessageContent,
    thingMessages,
    cancelEditingMessage,
    runThingConversation,
    currentConversation,
    updateConversationMessages,
  ])

  const handleThingSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextInput = thingInput.trim()
    if (!nextInput || isThingWorking) return

    const nextUserMessage: ThingMessage = {
      id: `thing-user-${Date.now()}`,
      role: 'user',
      content: nextInput,
    }

    const nextConversation = [...thingMessages, nextUserMessage]

    setThingInput('')
    if (!currentConversation) return

    if (currentConversation.title === 'New chat' || currentConversation.title.startsWith('Chat ')) {
      const suggestedTitle = nextInput.slice(0, 48)
      setThingConversations((prev) => prev.map((conversation) => (
        conversation.id === currentConversation.id
          ? { ...conversation, title: suggestedTitle, updatedAt: new Date().toISOString() }
          : conversation
      )))
    }

    runThingConversation(currentConversation.id, nextConversation)
  }, [thingInput, thingMessages, isThingWorking, runThingConversation, currentConversation])

  useEffect(() => {
    if (!isOpen) return
    thingMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thingMessages, isOpen])

  if (!isOpen) return null

  return (
    <aside className="w-[420px] border-l border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/80 flex min-w-0 flex-col">
      <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">thing</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Workspace actions</span>
          <button
            type="button"
            onClick={createNewChat}
            disabled={isThingWorking}
            className="rounded-md border border-violet-300 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950/30"
          >
            New chat
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            History
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
            {thingConversations.map((conversation) => {
              const isCurrent = conversation.id === currentConversation?.id
              const isEditingTitle = editingConversationId === conversation.id

              return (
                <div key={conversation.id} className="rounded-md border border-transparent px-2 py-1.5 hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-950/40">
                  {isEditingTitle ? (
                    <div className="space-y-1">
                      <input
                        value={editingConversationTitle}
                        onChange={(event) => setEditingConversationTitle(event.target.value)}
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={saveConversationTitle}
                          disabled={!editingConversationTitle.trim()}
                          className="rounded bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingConversationTitle}
                          className="rounded border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentConversationId(conversation.id)}
                        className={`min-w-0 flex-1 truncate text-left text-xs ${isCurrent ? 'font-semibold text-violet-700 dark:text-violet-200' : 'text-slate-700 dark:text-slate-200'}`}
                        title={conversation.title}
                      >
                        {conversation.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditingConversationTitle(conversation)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        Rename
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {thingMessages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === 'user'
                ? 'ml-8 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-100'
                : 'mr-8 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide opacity-70">
              <span>{message.role === 'user' ? 'You' : 'Thing'}</span>
              {message.id !== 'thing-welcome' && !isThingWorking && (
                <button
                  type="button"
                  onClick={() => startEditingMessage(message)}
                  className="rounded px-1.5 py-0.5 text-[10px] normal-case tracking-normal hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  Edit
                </button>
              )}
            </div>

            {editingMessageId === message.id ? (
              <div className="space-y-2">
                <textarea
                  value={editingMessageContent}
                  onChange={(event) => setEditingMessageContent(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => saveEditedMessage()}
                    disabled={!editingMessageContent.trim()}
                    className="rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save
                  </button>
                  {message.role === 'user' && (
                    <button
                      type="button"
                      onClick={() => saveEditedMessage({ rerunFromUserMessage: true })}
                      disabled={!editingMessageContent.trim()}
                      className="rounded-md border border-violet-300 px-2 py-1 text-xs font-medium text-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-700 dark:text-violet-200"
                    >
                      Save & rerun
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={cancelEditingMessage}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        ))}

        {isThingWorking && (
          <div className="mr-8 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            thing is processing...
          </div>
        )}

        <div ref={thingMessagesEndRef} />
      </div>

      <form onSubmit={handleThingSubmit} className="border-t border-slate-200 p-3 space-y-2 dark:border-slate-800">
        <textarea
          value={thingInput}
          onChange={(event) => setThingInput(event.target.value)}
          rows={5}
          placeholder="Type help or paste JSON action envelope..."
          className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-violet-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">Try: help or status</span>
          <button
            type="submit"
            disabled={isThingWorking || !thingInput.trim()}
            className="inline-flex items-center rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  )
}