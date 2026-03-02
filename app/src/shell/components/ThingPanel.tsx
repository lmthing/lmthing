import { useState, useCallback, useEffect, useMemo, useRef, type FormEvent } from 'react'
import { Bot } from 'lucide-react'
import { runPrompt, type PromptConfig } from 'lmthing'
import { z } from 'zod'
import { useAgents, useFlows } from '@/lib/workspaceContext'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import { ToolCallDisplay } from './ToolCallDisplay'
import type { AgentBuilderScreenProps } from '@/../product/sections/agent-builder/types'
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
  'listWorkspaceRoots',
  'listChildren',
  'searchWorkspace',
  'getEntity',
  'resolveReference',
  'findBacklinks',
  'getBreadcrumbs',
  'recentlyTouched',
  'snapshotWorkspace',
  'diffSnapshots',
  'suggestNextNavigation',
  'createWorkspace',
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
  'I am THING. I can execute workspace data actions directly via tools. Ask in plain language, send JSON, or type help.'

const THING_CONVERSATIONS_STORAGE_KEY = 'lmthing-thing-conversations-v1'
const THING_TOOL_EVENT_OPEN = '[[THING_TOOL_EVENT]]'
const THING_TOOL_EVENT_CLOSE = '[[/THING_TOOL_EVENT]]'

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

type KnowledgeFlatEntry = {
  node: KnowledgeNode
  parentPath: string | null
  depth: number
}

type NavigationDomain = 'agents' | 'flows' | 'knowledge' | 'packageJson' | 'envFiles'

type SnapshotScope = 'workspace' | 'agents' | 'flows' | 'knowledge' | 'packageJson' | 'envFiles'

type SnapshotDiffEntry = {
  path: string
  kind: 'added' | 'removed' | 'changed'
  before?: unknown
  after?: unknown
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizeKnowledgePath(path?: string | null): string | null {
  if (!path) return null

  const trimmed = path.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  if (!trimmed || trimmed === 'root' || trimmed === 'knowledge') {
    return null
  }

  return trimmed.replace(/^knowledge\//, '')
}

function flattenKnowledgeNodes(
  nodes: KnowledgeNode[],
  parentPath: string | null = null,
  depth = 0,
  acc: KnowledgeFlatEntry[] = [],
): KnowledgeFlatEntry[] {
  nodes.forEach((node) => {
    acc.push({ node, parentPath, depth })
    if (node.type === 'directory' && Array.isArray(node.children) && node.children.length > 0) {
      flattenKnowledgeNodes(node.children, node.path, depth + 1, acc)
    }
  })
  return acc
}

function findKnowledgeEntryByPath(nodes: KnowledgeNode[], targetPath: string): KnowledgeFlatEntry | null {
  const normalized = normalizeKnowledgePath(targetPath)
  if (!normalized) return null

  const flattened = flattenKnowledgeNodes(nodes)
  return flattened.find((entry) => normalizeKnowledgePath(entry.node.path) === normalized) || null
}

function paginateItems<T>(items: T[], limit = 25, cursor?: string): {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
  offset: number
} {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 25, 1), 100)
  const offset = Math.max(Number.parseInt(cursor || '0', 10) || 0, 0)
  const nextOffset = offset + safeLimit
  const paged = items.slice(offset, nextOffset)

  return {
    items: paged,
    nextCursor: nextOffset < items.length ? String(nextOffset) : null,
    hasMore: nextOffset < items.length,
    offset,
  }
}

function stringifyForSearch(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function toSearchSnippet(content: string, query: string, maxLength = 180): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''

  const index = normalized.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) {
    return normalized.slice(0, maxLength)
  }

  const start = Math.max(index - 40, 0)
  const end = Math.min(index + query.length + 80, normalized.length)
  return normalized.slice(start, end)
}

function parseEntityReference(ref: string): {
  kind: string
  idOrPath: string
  extra?: string
} | null {
  const [kindPart, rawRest] = ref.split(':', 2)
  const kind = kindPart?.trim()
  const rest = rawRest?.trim()

  if (!kind || !rest) return null

  if (kind === 'slashAction' || kind === 'task') {
    const [idOrPath, extra] = rest.split('/', 2)
    if (!idOrPath || !extra) return null
    return { kind, idOrPath, extra }
  }

  return { kind, idOrPath: rest }
}

function cloneSnapshot<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function buildSnapshotDiff(
  before: unknown,
  after: unknown,
  currentPath = '$',
  depth = 0,
  maxDepth = 4,
  acc: SnapshotDiffEntry[] = [],
): SnapshotDiffEntry[] {
  if (acc.length >= 200) return acc

  if (before === undefined && after !== undefined) {
    acc.push({ path: currentPath, kind: 'added', after: summarizeWorkspaceValue(after, 1) })
    return acc
  }

  if (before !== undefined && after === undefined) {
    acc.push({ path: currentPath, kind: 'removed', before: summarizeWorkspaceValue(before, 1) })
    return acc
  }

  if (Object.is(before, after)) {
    return acc
  }

  if (depth >= maxDepth) {
    acc.push({
      path: currentPath,
      kind: 'changed',
      before: summarizeWorkspaceValue(before, 1),
      after: summarizeWorkspaceValue(after, 1),
    })
    return acc
  }

  const beforeIsObject = Boolean(before && typeof before === 'object')
  const afterIsObject = Boolean(after && typeof after === 'object')

  if (!beforeIsObject || !afterIsObject) {
    acc.push({
      path: currentPath,
      kind: 'changed',
      before,
      after,
    })
    return acc
  }

  if (Array.isArray(before) || Array.isArray(after)) {
    if (!Array.isArray(before) || !Array.isArray(after)) {
      acc.push({
        path: currentPath,
        kind: 'changed',
        before: summarizeWorkspaceValue(before, 1),
        after: summarizeWorkspaceValue(after, 1),
      })
      return acc
    }

    const maxLen = Math.max(before.length, after.length)
    for (let i = 0; i < maxLen; i += 1) {
      buildSnapshotDiff(before[i], after[i], `${currentPath}[${i}]`, depth + 1, maxDepth, acc)
      if (acc.length >= 200) break
    }
    return acc
  }

  const beforeRecord = before as Record<string, unknown>
  const afterRecord = after as Record<string, unknown>
  const keySet = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])

  keySet.forEach((key) => {
    if (acc.length >= 200) return
    buildSnapshotDiff(beforeRecord[key], afterRecord[key], `${currentPath}.${key}`, depth + 1, maxDepth, acc)
  })

  return acc
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

  return 'zai:glm-4.5-air'
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
  agentBuilderProps?: AgentBuilderScreenProps
}

export function ThingPanel({ isOpen, agentBuilderProps }: ThingPanelProps) {
  const { agents: agentsMap } = useAgents()
  const { flows: flowsMap } = useFlows()
  const {
    createWorkspace,
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
  const thingSnapshotsRef = useRef<Record<string, unknown>>({})
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
    const navigationDomainSchema = z.enum(['agents', 'flows', 'knowledge', 'packageJson', 'envFiles'])
    const snapshotScopeSchema = z.enum(['workspace', 'agents', 'flows', 'knowledge', 'packageJson', 'envFiles'])
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
        envFileNames: Object.keys(workspaceData?.env || {}),
        actionNames: THING_ACTION_NAMES,
        agentBuilderState: agentBuilderProps
          ? {
            loadedAgentId: agentBuilderProps.loadedAgentId ?? null,
            selectedDomainIds: agentBuilderProps.selectedDomainIds ?? [],
            attachedFlowCount: agentBuilderProps.attachedFlows?.length ?? 0,
          }
          : null,
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
            '• Prefer navigation tools for inspection: listWorkspaceRoots, listChildren, searchWorkspace, getEntity, getBreadcrumbs, findBacklinks.',
            '• Use viewWorkspaceData when you explicitly need dot-path access (e.g. "agents", "flows.my-flow", "knowledge").',
            '• Before creating or updating an entity, use viewWorkspaceData to check existing data so you don\'t overwrite things unintentionally.',
            '',
            'Interaction style:',
            '• If required fields are missing from the user\'s request, ask a single concise clarification question listing exactly what you need.',
            '• When a tool succeeds, give a short summary of what changed (e.g. "Created agent lesson-planner with 2 slash actions").',
            '• When a tool fails, explain the error clearly and suggest a corrected approach.',
            '• Accept both plain language ("create an agent for onboarding") and JSON envelopes ({"action":"upsertAgent","payload":{...}}).',
            '',
            'Quality defaults:',
            '• When creating workspaces, initialize them with empty agents, flows, and knowledge, plus a sensible package.json.',
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
            depth: z.number().int().min(0).max(2).optional(),
          }),
          async ({ path, depth }: { path?: string; depth?: number }) => {
            const workspaceSnapshot = {
              workspaceId: workspaceData?.id ?? null,
              workspaceData: workspaceData ?? null,
              agents: agentsMap,
              flows: flowsMap,
              knowledge,
              envFiles: workspaceData?.env || {},
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
          'listWorkspaceRoots',
          'List top-level workspace domains with counts to quickly orient navigation.',
          z.object({}),
          async () => {
            const envFileCount = Object.keys(workspaceData?.env || {}).length

            return {
              ok: true,
              workspaceId: workspaceData?.id ?? null,
              roots: [
                {
                  domain: 'agents' as const,
                  count: Object.keys(agentsMap).length,
                  description: 'Agent definitions and chat configurations',
                },
                {
                  domain: 'flows' as const,
                  count: Object.keys(flowsMap).length,
                  description: 'Flow workflows and task steps',
                },
                {
                  domain: 'knowledge' as const,
                  count: countKnowledgeNodes(knowledge),
                  description: 'Knowledge tree (directories and markdown files)',
                },
                {
                  domain: 'packageJson' as const,
                  count: workspaceData?.packageJson ? 1 : 0,
                  description: 'Workspace package configuration',
                },
                {
                  domain: 'envFiles' as const,
                  count: envFileCount,
                  description: 'Encrypted environment files',
                },
              ],
            }
          }
        )

        prompt.defTool(
          'listChildren',
          'Browse children for a domain or specific node with optional filtering and pagination.',
          z.object({
            domain: navigationDomainSchema.optional(),
            nodePath: z.string().optional().describe('For knowledge, provide a directory path. Use "root" or omit for top level.'),
            type: z.enum(['directory', 'file']).optional().describe('Knowledge-only type filter.'),
            filter: z.string().optional().describe('Case-insensitive substring filter by id/name/path.'),
            limit: z.number().int().min(1).max(100).optional(),
            cursor: z.string().optional(),
          }),
          async ({
            domain,
            nodePath,
            type,
            filter,
            limit,
            cursor,
          }: {
            domain?: NavigationDomain
            nodePath?: string
            type?: 'directory' | 'file'
            filter?: string
            limit?: number
            cursor?: string
          }) => {
            const resolvedDomain = domain || 'knowledge'
            const normalizedFilter = filter?.trim().toLowerCase()

            if (resolvedDomain === 'agents') {
              const items = Object.values(agentsMap).map((agent) => ({
                id: agent.id,
                name: normalizeString(agent.frontmatter?.name) || agent.id,
                description: normalizeString(agent.frontmatter?.description),
                slashActionCount: Array.isArray(agent.slashActions) ? agent.slashActions.length : 0,
              }))

              const filtered = normalizedFilter
                ? items.filter((item) => stringifyForSearch(item).toLowerCase().includes(normalizedFilter))
                : items

              const page = paginateItems(filtered, limit, cursor)
              return {
                ok: true,
                domain: resolvedDomain,
                total: filtered.length,
                ...page,
              }
            }

            if (resolvedDomain === 'flows') {
              const items = Object.values(flowsMap).map((flow) => ({
                id: flow.id,
                name: normalizeString(flow.frontmatter?.name) || flow.id,
                status: normalizeString(flow.frontmatter?.status),
                taskCount: Array.isArray(flow.tasks) ? flow.tasks.length : 0,
                tags: Array.isArray(flow.frontmatter?.tags) ? flow.frontmatter.tags : [],
              }))

              const filtered = normalizedFilter
                ? items.filter((item) => stringifyForSearch(item).toLowerCase().includes(normalizedFilter))
                : items

              const page = paginateItems(filtered, limit, cursor)
              return {
                ok: true,
                domain: resolvedDomain,
                total: filtered.length,
                ...page,
              }
            }

            if (resolvedDomain === 'envFiles') {
              const envEntries = Object.entries(workspaceData?.env || {}).map(([fileName, envFile]) => ({
                fileName,
                updatedAt: normalizeString(envFile?.updatedAt),
                createdAt: normalizeString(envFile?.createdAt),
                expiresAt: normalizeString(envFile?.expiresAt),
              }))

              const filtered = normalizedFilter
                ? envEntries.filter((item) => stringifyForSearch(item).toLowerCase().includes(normalizedFilter))
                : envEntries

              const page = paginateItems(filtered, limit, cursor)
              return {
                ok: true,
                domain: resolvedDomain,
                total: filtered.length,
                ...page,
              }
            }

            if (resolvedDomain === 'packageJson') {
              const entries = Object.entries(workspaceData?.packageJson || {}).map(([key, value]) => ({
                key,
                value: summarizeWorkspaceValue(value, 1),
              }))

              const filtered = normalizedFilter
                ? entries.filter((item) => stringifyForSearch(item).toLowerCase().includes(normalizedFilter))
                : entries

              const page = paginateItems(filtered, limit, cursor)
              return {
                ok: true,
                domain: resolvedDomain,
                total: filtered.length,
                ...page,
              }
            }

            const normalizedPath = normalizeKnowledgePath(nodePath)
            const parentEntry = normalizedPath ? findKnowledgeEntryByPath(knowledge, normalizedPath) : null

            if (normalizedPath && !parentEntry) {
              return {
                ok: false,
                message: `Knowledge node not found: ${normalizedPath}`,
              }
            }

            if (parentEntry && parentEntry.node.type !== 'directory') {
              return {
                ok: false,
                message: `Knowledge node is not a directory: ${parentEntry.node.path}`,
              }
            }

            const rawChildren = parentEntry ? (parentEntry.node.children || []) : knowledge
            const children = rawChildren.map((node) => ({
              path: node.path,
              type: node.type,
              label: normalizeString(node.config?.label) || normalizeString(node.frontmatter?.title) || node.path,
              childCount: node.type === 'directory' ? (node.children?.length || 0) : 0,
            }))

            const typed = type ? children.filter((child) => child.type === type) : children
            const filtered = normalizedFilter
              ? typed.filter((child) => stringifyForSearch(child).toLowerCase().includes(normalizedFilter))
              : typed

            const page = paginateItems(filtered, limit, cursor)

            return {
              ok: true,
              domain: 'knowledge' as const,
              nodePath: parentEntry?.node.path || 'root',
              total: filtered.length,
              ...page,
            }
          }
        )

        prompt.defTool(
          'searchWorkspace',
          'Search agents, flows, knowledge, package.json, and env files using text and optional filters.',
          z.object({
            query: z.string().min(1),
            domain: navigationDomainSchema.optional(),
            type: z.enum(['directory', 'file']).optional(),
            tags: z.array(z.string()).optional(),
            limit: z.number().int().min(1).max(100).optional(),
          }),
          async ({
            query,
            domain,
            type,
            tags,
            limit,
          }: {
            query: string
            domain?: NavigationDomain
            type?: 'directory' | 'file'
            tags?: string[]
            limit?: number
          }) => {
            const needle = query.trim().toLowerCase()
            const maxItems = Math.min(Math.max(limit || 30, 1), 100)
            const requestedTags = (tags || []).map((tag) => tag.toLowerCase())
            const includeDomain = (value: NavigationDomain): boolean => !domain || domain === value

            const matches: Array<Record<string, unknown>> = []

            if (includeDomain('agents')) {
              Object.values(agentsMap).forEach((agent) => {
                const haystack = [
                  agent.id,
                  normalizeString(agent.frontmatter?.name),
                  normalizeString(agent.frontmatter?.description),
                  normalizeString(agent.mainInstruction),
                  ...(agent.frontmatter?.selectedDomains || []),
                ].join(' \n ')

                if (!haystack.toLowerCase().includes(needle)) return

                matches.push({
                  domain: 'agents',
                  kind: 'agent',
                  id: agent.id,
                  name: normalizeString(agent.frontmatter?.name) || agent.id,
                  snippet: toSearchSnippet(haystack, query),
                })
              })
            }

            if (includeDomain('flows')) {
              Object.values(flowsMap).forEach((flow) => {
                const flowTags = Array.isArray(flow.frontmatter?.tags) ? flow.frontmatter.tags : []
                if (requestedTags.length > 0 && !requestedTags.every((tag) => flowTags.map((t) => t.toLowerCase()).includes(tag))) {
                  return
                }

                const haystack = [
                  flow.id,
                  normalizeString(flow.frontmatter?.name),
                  normalizeString(flow.description),
                  flowTags.join(' '),
                  ...flow.tasks.map((task) => `${task.name} ${task.instructions}`),
                ].join(' \n ')

                if (!haystack.toLowerCase().includes(needle)) return

                matches.push({
                  domain: 'flows',
                  kind: 'flow',
                  id: flow.id,
                  name: normalizeString(flow.frontmatter?.name) || flow.id,
                  tags: flowTags,
                  snippet: toSearchSnippet(haystack, query),
                })
              })
            }

            if (includeDomain('knowledge')) {
              const flattened = flattenKnowledgeNodes(knowledge)
              flattened.forEach(({ node }) => {
                if (type && node.type !== type) return

                const haystack = [
                  node.path,
                  normalizeString(node.config?.label),
                  normalizeString(node.config?.description),
                  stringifyForSearch(node.frontmatter),
                  normalizeString(node.content),
                ].join(' \n ')

                if (!haystack.toLowerCase().includes(needle)) return

                matches.push({
                  domain: 'knowledge',
                  kind: node.type,
                  path: node.path,
                  label: normalizeString(node.config?.label) || normalizeString(node.frontmatter?.title) || node.path,
                  snippet: toSearchSnippet(haystack, query),
                })
              })
            }

            if (includeDomain('packageJson')) {
              const packageSource = stringifyForSearch(workspaceData?.packageJson || {})
              if (packageSource.toLowerCase().includes(needle)) {
                matches.push({
                  domain: 'packageJson',
                  kind: 'packageJson',
                  id: 'package.json',
                  snippet: toSearchSnippet(packageSource, query),
                })
              }
            }

            if (includeDomain('envFiles')) {
              Object.entries(workspaceData?.env || {}).forEach(([fileName, envFile]) => {
                const haystack = [fileName, normalizeString(envFile.updatedAt), normalizeString(envFile.expiresAt)].join(' ')
                if (!haystack.toLowerCase().includes(needle)) return

                matches.push({
                  domain: 'envFiles',
                  kind: 'envFile',
                  fileName,
                  snippet: toSearchSnippet(haystack, query),
                })
              })
            }

            return {
              ok: true,
              query,
              total: matches.length,
              results: matches.slice(0, maxItems),
              truncated: matches.length > maxItems,
            }
          }
        )

        prompt.defTool(
          'getEntity',
          'Get a single canonical entity by kind and id/path.',
          z.object({
            kind: z.enum(['workspace', 'agent', 'flow', 'knowledgeNode', 'packageJson', 'envFile']),
            idOrPath: z.string().optional(),
            depth: z.number().int().min(0).max(3).optional(),
          }),
          async ({
            kind,
            idOrPath,
            depth,
          }: {
            kind: 'workspace' | 'agent' | 'flow' | 'knowledgeNode' | 'packageJson' | 'envFile'
            idOrPath?: string
            depth?: number
          }) => {
            const safeDepth = depth ?? 2

            if (kind === 'workspace') {
              return {
                ok: true,
                kind,
                id: workspaceData?.id ?? null,
                entity: summarizeWorkspaceValue(workspaceData, safeDepth),
              }
            }

            if (kind === 'packageJson') {
              return {
                ok: true,
                kind,
                id: 'package.json',
                entity: summarizeWorkspaceValue(workspaceData?.packageJson || null, safeDepth),
              }
            }

            if (!idOrPath) {
              return { ok: false, message: `idOrPath is required for kind ${kind}.` }
            }

            if (kind === 'agent') {
              const entity = agentsMap[idOrPath]
              if (!entity) return { ok: false, message: `Agent not found: ${idOrPath}` }
              return { ok: true, kind, id: idOrPath, entity: summarizeWorkspaceValue(entity, safeDepth) }
            }

            if (kind === 'flow') {
              const entity = flowsMap[idOrPath]
              if (!entity) return { ok: false, message: `Flow not found: ${idOrPath}` }
              return { ok: true, kind, id: idOrPath, entity: summarizeWorkspaceValue(entity, safeDepth) }
            }

            if (kind === 'envFile') {
              const entity = workspaceData?.env?.[idOrPath]
              if (!entity) return { ok: false, message: `Env file not found: ${idOrPath}` }
              return { ok: true, kind, id: idOrPath, entity: summarizeWorkspaceValue(entity, safeDepth) }
            }

            const entry = findKnowledgeEntryByPath(knowledge, idOrPath)
            if (!entry) return { ok: false, message: `Knowledge node not found: ${idOrPath}` }

            return {
              ok: true,
              kind,
              id: entry.node.path,
              entity: summarizeWorkspaceValue(entry.node, safeDepth),
              parentPath: entry.parentPath,
            }
          }
        )

        prompt.defTool(
          'resolveReference',
          'Resolve linked entities. from format: kind:value (agent:id, flow:id, knowledge:path, slashAction:agentId/actionName, task:flowId/order).',
          z.object({
            from: z.string().min(1),
            relation: z.enum([
              'agent.flows',
              'agent.selectedKnowledge',
              'flow.agent',
              'flow.slashActions',
              'flow.tasks',
              'knowledge.parent',
              'knowledge.children',
              'slashAction.flow',
              'task.flow',
              'task.agent',
            ]),
            depth: z.number().int().min(0).max(2).optional(),
          }),
          async ({
            from,
            relation,
            depth,
          }: {
            from: string
            relation:
              | 'agent.flows'
              | 'agent.selectedKnowledge'
              | 'flow.agent'
              | 'flow.slashActions'
              | 'flow.tasks'
              | 'knowledge.parent'
              | 'knowledge.children'
              | 'slashAction.flow'
              | 'task.flow'
              | 'task.agent'
            depth?: number
          }) => {
            const parsed = parseEntityReference(from)
            if (!parsed) {
              return { ok: false, message: 'Invalid from reference. Example: flow:my-flow or slashAction:agent-id/my-action' }
            }

            const safeDepth = depth ?? 1

            if (relation === 'agent.flows') {
              if (parsed.kind !== 'agent') return { ok: false, message: 'agent.flows requires from=agent:<agentId>' }
              const related = Object.values(flowsMap).filter((flow) => flow.frontmatter?.agentId === parsed.idOrPath)
              return {
                ok: true,
                relation,
                from,
                items: related.map((flow) => ({
                  id: flow.id,
                  name: normalizeString(flow.frontmatter?.name) || flow.id,
                  summary: summarizeWorkspaceValue(flow, safeDepth),
                })),
              }
            }

            if (relation === 'agent.selectedKnowledge') {
              if (parsed.kind !== 'agent') return { ok: false, message: 'agent.selectedKnowledge requires from=agent:<agentId>' }
              const agent = agentsMap[parsed.idOrPath]
              if (!agent) return { ok: false, message: `Agent not found: ${parsed.idOrPath}` }

              const selectedDomains = (agent.frontmatter?.selectedDomains || []).map((domainPath) => {
                const entry = findKnowledgeEntryByPath(knowledge, domainPath)
                return {
                  path: domainPath,
                  exists: Boolean(entry),
                  type: entry?.node.type || null,
                  label: normalizeString(entry?.node.config?.label) || normalizeString(entry?.node.frontmatter?.title) || null,
                }
              })

              return {
                ok: true,
                relation,
                from,
                selectedDomains,
              }
            }

            if (relation === 'flow.agent') {
              if (parsed.kind !== 'flow') return { ok: false, message: 'flow.agent requires from=flow:<flowId>' }
              const flow = flowsMap[parsed.idOrPath]
              if (!flow) return { ok: false, message: `Flow not found: ${parsed.idOrPath}` }
              const agentId = normalizeString(flow.frontmatter?.agentId)
              const agent = agentId ? agentsMap[agentId] : undefined

              return {
                ok: true,
                relation,
                from,
                agentId,
                agent: agent ? summarizeWorkspaceValue(agent, safeDepth) : null,
              }
            }

            if (relation === 'flow.slashActions') {
              if (parsed.kind !== 'flow') return { ok: false, message: 'flow.slashActions requires from=flow:<flowId>' }

              const linkedActions = Object.values(agentsMap).flatMap((agent) => (
                (agent.slashActions || [])
                  .filter((slashAction) => slashAction.flowId === parsed.idOrPath)
                  .map((slashAction) => ({
                    agentId: agent.id,
                    agentName: normalizeString(agent.frontmatter?.name) || agent.id,
                    name: slashAction.name,
                    actionId: slashAction.actionId,
                    description: slashAction.description,
                  }))
              ))

              return { ok: true, relation, from, items: linkedActions }
            }

            if (relation === 'flow.tasks') {
              if (parsed.kind !== 'flow') return { ok: false, message: 'flow.tasks requires from=flow:<flowId>' }
              const flow = flowsMap[parsed.idOrPath]
              if (!flow) return { ok: false, message: `Flow not found: ${parsed.idOrPath}` }
              return {
                ok: true,
                relation,
                from,
                items: flow.tasks.map((task) => ({
                  order: task.order,
                  name: task.name,
                  model: task.frontmatter?.model || null,
                  targetFieldName: task.targetFieldName || null,
                  summary: summarizeWorkspaceValue(task, safeDepth),
                })),
              }
            }

            if (relation === 'knowledge.parent') {
              if (parsed.kind !== 'knowledge') return { ok: false, message: 'knowledge.parent requires from=knowledge:<path>' }
              const entry = findKnowledgeEntryByPath(knowledge, parsed.idOrPath)
              if (!entry) return { ok: false, message: `Knowledge node not found: ${parsed.idOrPath}` }
              const parent = entry.parentPath ? findKnowledgeEntryByPath(knowledge, entry.parentPath) : null

              return {
                ok: true,
                relation,
                from,
                parentPath: entry.parentPath,
                parent: parent ? summarizeWorkspaceValue(parent.node, safeDepth) : null,
              }
            }

            if (relation === 'knowledge.children') {
              if (parsed.kind !== 'knowledge') return { ok: false, message: 'knowledge.children requires from=knowledge:<path>' }
              const entry = findKnowledgeEntryByPath(knowledge, parsed.idOrPath)
              if (!entry) return { ok: false, message: `Knowledge node not found: ${parsed.idOrPath}` }
              if (entry.node.type !== 'directory') {
                return { ok: true, relation, from, items: [], message: 'Node is a file and has no children.' }
              }

              return {
                ok: true,
                relation,
                from,
                items: (entry.node.children || []).map((child) => ({
                  path: child.path,
                  type: child.type,
                  label: normalizeString(child.config?.label) || normalizeString(child.frontmatter?.title) || child.path,
                })),
              }
            }

            if (relation === 'slashAction.flow') {
              if (parsed.kind !== 'slashAction') return { ok: false, message: 'slashAction.flow requires from=slashAction:<agentId>/<actionName>' }
              const agent = agentsMap[parsed.idOrPath]
              if (!agent) return { ok: false, message: `Agent not found: ${parsed.idOrPath}` }

              const slashAction = (agent.slashActions || []).find((action) => action.name === parsed.extra)
              if (!slashAction) return { ok: false, message: `Slash action not found: ${parsed.extra}` }
              const flow = flowsMap[slashAction.flowId]

              return {
                ok: true,
                relation,
                from,
                slashAction,
                flow: flow ? summarizeWorkspaceValue(flow, safeDepth) : null,
                flowExists: Boolean(flow),
              }
            }

            if (relation === 'task.flow') {
              if (parsed.kind !== 'task') return { ok: false, message: 'task.flow requires from=task:<flowId>/<order>' }
              const flow = flowsMap[parsed.idOrPath]
              if (!flow) return { ok: false, message: `Flow not found: ${parsed.idOrPath}` }
              const order = Number.parseInt(parsed.extra || '', 10)
              if (!Number.isInteger(order)) return { ok: false, message: 'Task order must be an integer.' }
              const task = flow.tasks.find((item) => item.order === order)
              if (!task) return { ok: false, message: `Task ${order} not found in flow ${flow.id}.` }

              return {
                ok: true,
                relation,
                from,
                flow: summarizeWorkspaceValue(flow, safeDepth),
                task: summarizeWorkspaceValue(task, safeDepth),
              }
            }

            if (parsed.kind !== 'task') {
              return { ok: false, message: 'task.agent requires from=task:<flowId>/<order>' }
            }

            const flow = flowsMap[parsed.idOrPath]
            if (!flow) return { ok: false, message: `Flow not found: ${parsed.idOrPath}` }

            const order = Number.parseInt(parsed.extra || '', 10)
            if (!Number.isInteger(order)) return { ok: false, message: 'Task order must be an integer.' }
            const task = flow.tasks.find((item) => item.order === order)
            if (!task) return { ok: false, message: `Task ${order} not found in flow ${flow.id}.` }

            const agentId = normalizeString(flow.frontmatter?.agentId)
            const agent = agentId ? agentsMap[agentId] : undefined

            return {
              ok: true,
              relation,
              from,
              task: summarizeWorkspaceValue(task, safeDepth),
              agentId,
              agent: agent ? summarizeWorkspaceValue(agent, safeDepth) : null,
            }
          }
        )

        prompt.defTool(
          'findBacklinks',
          'Find references pointing to a target entity. target format: kind:value (agent:id, flow:id, knowledge:path, envFile:name).',
          z.object({
            target: z.string().min(1),
            limit: z.number().int().min(1).max(200).optional(),
          }),
          async ({ target, limit }: { target: string; limit?: number }) => {
            const parsed = parseEntityReference(target)
            if (!parsed) {
              return { ok: false, message: 'Invalid target. Example: flow:my-flow or knowledge:education/section.md' }
            }

            const maxItems = Math.min(Math.max(limit || 100, 1), 200)
            const backlinks: Array<Record<string, unknown>> = []

            if (parsed.kind === 'flow') {
              Object.values(agentsMap).forEach((agent) => {
                ;(agent.slashActions || []).forEach((action) => {
                  if (action.flowId !== parsed.idOrPath) return
                  backlinks.push({
                    sourceKind: 'agentSlashAction',
                    sourceId: `${agent.id}/${action.name}`,
                    sourceAgentId: agent.id,
                    slashActionName: action.name,
                    relation: 'references flowId',
                  })
                })
              })
            }

            if (parsed.kind === 'agent') {
              Object.values(flowsMap).forEach((flow) => {
                if (flow.frontmatter?.agentId !== parsed.idOrPath) return
                backlinks.push({
                  sourceKind: 'flow',
                  sourceId: flow.id,
                  relation: 'frontmatter.agentId',
                })
              })
            }

            if (parsed.kind === 'knowledge') {
              const normalizedTarget = normalizeKnowledgePath(parsed.idOrPath)
              Object.values(agentsMap).forEach((agent) => {
                const selectedDomains = agent.frontmatter?.selectedDomains || []
                selectedDomains.forEach((domainPath) => {
                  const normalizedDomain = normalizeKnowledgePath(domainPath)
                  if (!normalizedTarget || !normalizedDomain) return

                  const isDirect = normalizedDomain === normalizedTarget
                  const isDescendant = normalizedDomain.startsWith(`${normalizedTarget}/`)
                  const isAncestor = normalizedTarget.startsWith(`${normalizedDomain}/`)

                  if (!isDirect && !isDescendant && !isAncestor) return

                  backlinks.push({
                    sourceKind: 'agent',
                    sourceId: agent.id,
                    relation: 'frontmatter.selectedDomains',
                    selectedDomain: domainPath,
                  })
                })
              })
            }

            if (parsed.kind === 'envFile') {
              const exists = Boolean(workspaceData?.env?.[parsed.idOrPath])
              if (exists) {
                backlinks.push({
                  sourceKind: 'workspace',
                  sourceId: workspaceData?.id || 'unknown',
                  relation: 'workspace.env',
                })
              }
            }

            return {
              ok: true,
              target,
              total: backlinks.length,
              items: backlinks.slice(0, maxItems),
              truncated: backlinks.length > maxItems,
            }
          }
        )

        prompt.defTool(
          'getBreadcrumbs',
          'Get breadcrumb trail for navigation paths (knowledge/path, agents/id, flows/id, envFiles/name, packageJson).',
          z.object({
            path: z.string().min(1),
            includeSiblings: z.boolean().optional(),
          }),
          async ({ path, includeSiblings }: { path: string; includeSiblings?: boolean }) => {
            const trimmedPath = path.trim().replace(/^\/+/, '')
            const [head, ...rest] = trimmedPath.split('/')

            if (head === 'packageJson' || trimmedPath === 'package.json') {
              return {
                ok: true,
                breadcrumbs: [
                  { label: 'workspace', path: 'workspace' },
                  { label: 'packageJson', path: 'packageJson' },
                ],
              }
            }

            if (head === 'agents') {
              const agentId = rest.join('/')
              const agent = agentId ? agentsMap[agentId] : undefined
              return {
                ok: true,
                breadcrumbs: [
                  { label: 'workspace', path: 'workspace' },
                  { label: 'agents', path: 'agents' },
                  ...(agentId
                    ? [{ label: normalizeString(agent?.frontmatter?.name) || agentId, path: `agents/${agentId}` }]
                    : []),
                ],
              }
            }

            if (head === 'flows') {
              const flowId = rest.join('/')
              const flow = flowId ? flowsMap[flowId] : undefined
              return {
                ok: true,
                breadcrumbs: [
                  { label: 'workspace', path: 'workspace' },
                  { label: 'flows', path: 'flows' },
                  ...(flowId
                    ? [{ label: normalizeString(flow?.frontmatter?.name) || flowId, path: `flows/${flowId}` }]
                    : []),
                ],
              }
            }

            if (head === 'envFiles') {
              const fileName = rest.join('/')
              return {
                ok: true,
                breadcrumbs: [
                  { label: 'workspace', path: 'workspace' },
                  { label: 'envFiles', path: 'envFiles' },
                  ...(fileName ? [{ label: fileName, path: `envFiles/${fileName}` }] : []),
                ],
              }
            }

            const knowledgePath = head === 'knowledge' ? rest.join('/') : trimmedPath
            const normalizedKnowledgePath = normalizeKnowledgePath(knowledgePath)

            if (!normalizedKnowledgePath) {
              return {
                ok: true,
                breadcrumbs: [
                  { label: 'workspace', path: 'workspace' },
                  { label: 'knowledge', path: 'knowledge' },
                ],
                siblings: includeSiblings
                  ? knowledge.map((node) => ({ path: node.path, type: node.type }))
                  : undefined,
              }
            }

            const entry = findKnowledgeEntryByPath(knowledge, normalizedKnowledgePath)
            if (!entry) {
              return {
                ok: false,
                message: `Knowledge path not found: ${normalizedKnowledgePath}`,
              }
            }

            const crumbs: Array<{ label: string; path: string }> = [
              { label: 'workspace', path: 'workspace' },
              { label: 'knowledge', path: 'knowledge' },
            ]

            const chain: KnowledgeFlatEntry[] = []
            let cursor: KnowledgeFlatEntry | null = entry
            while (cursor) {
              chain.push(cursor)
              cursor = cursor.parentPath ? findKnowledgeEntryByPath(knowledge, cursor.parentPath) : null
            }

            chain.reverse().forEach((item) => {
              crumbs.push({
                label: normalizeString(item.node.config?.label) || normalizeString(item.node.frontmatter?.title) || item.node.path,
                path: `knowledge/${item.node.path}`,
              })
            })

            const siblings = includeSiblings
              ? (
                entry.parentPath
                  ? (findKnowledgeEntryByPath(knowledge, entry.parentPath)?.node.children || [])
                  : knowledge
              ).map((node) => ({
                path: node.path,
                type: node.type,
                label: normalizeString(node.config?.label) || normalizeString(node.frontmatter?.title) || node.path,
              }))
              : undefined

            return {
              ok: true,
              breadcrumbs: crumbs,
              siblings,
            }
          }
        )

        prompt.defTool(
          'recentlyTouched',
          'List recently updated entities across flows, conversations, env files, and workspace metadata.',
          z.object({
            since: z.string().optional(),
            actor: z.string().optional(),
            limit: z.number().int().min(1).max(200).optional(),
          }),
          async ({ since, actor, limit }: { since?: string; actor?: string; limit?: number }) => {
            const sinceEpoch = since ? Date.parse(since) : Number.NaN
            const hasValidSince = Number.isFinite(sinceEpoch)
            const requestedActor = actor?.trim().toLowerCase()
            const maxItems = Math.min(Math.max(limit || 30, 1), 200)

            const timeline: Array<{
              kind: string
              id: string
              updatedAt: string
              actor: string
              details?: Record<string, unknown>
            }> = []

            Object.values(flowsMap).forEach((flow) => {
              if (!flow.frontmatter?.updatedAt) return
              timeline.push({
                kind: 'flow',
                id: flow.id,
                updatedAt: flow.frontmatter.updatedAt,
                actor: 'workspace',
                details: { name: normalizeString(flow.frontmatter?.name) || flow.id },
              })
            })

            Object.values(agentsMap).forEach((agent) => {
              ;(agent.conversations || []).forEach((conversationItem) => {
                if (!conversationItem.updatedAt) return
                timeline.push({
                  kind: 'agentConversation',
                  id: `${agent.id}/${conversationItem.id}`,
                  updatedAt: conversationItem.updatedAt,
                  actor: 'chat',
                  details: { agentId: agent.id, agentName: normalizeString(agent.frontmatter?.name) || agent.id },
                })
              })
            })

            Object.entries(workspaceData?.env || {}).forEach(([fileName, envFile]) => {
              if (!envFile.updatedAt) return
              timeline.push({
                kind: 'envFile',
                id: fileName,
                updatedAt: envFile.updatedAt,
                actor: 'workspace',
              })
            })

            const sorted = timeline
              .filter((entry) => {
                if (hasValidSince && Date.parse(entry.updatedAt) < sinceEpoch) return false
                if (requestedActor && entry.actor.toLowerCase() !== requestedActor) return false
                return true
              })
              .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))

            return {
              ok: true,
              total: sorted.length,
              items: sorted.slice(0, maxItems),
              truncated: sorted.length > maxItems,
            }
          }
        )

        prompt.defTool(
          'snapshotWorkspace',
          'Create and store a workspace snapshot for later diffing. Returns snapshot id and summary.',
          z.object({
            snapshotId: z.string().optional(),
            scope: snapshotScopeSchema.optional(),
          }),
          async ({ snapshotId, scope }: { snapshotId?: string; scope?: SnapshotScope }) => {
            const resolvedScope = scope || 'workspace'
            const snapshotValue = (() => {
              if (resolvedScope === 'agents') return agentsMap
              if (resolvedScope === 'flows') return flowsMap
              if (resolvedScope === 'knowledge') return knowledge
              if (resolvedScope === 'packageJson') return workspaceData?.packageJson || null
              if (resolvedScope === 'envFiles') return workspaceData?.env || {}
              return {
                id: workspaceData?.id ?? null,
                agents: agentsMap,
                flows: flowsMap,
                knowledge,
                packageJson: workspaceData?.packageJson || null,
                envFiles: workspaceData?.env || {},
              }
            })()

            const id = snapshotId?.trim() || `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            thingSnapshotsRef.current[id] = cloneSnapshot(snapshotValue)

            return {
              ok: true,
              snapshotId: id,
              scope: resolvedScope,
              summary: summarizeWorkspaceValue(snapshotValue, 1),
            }
          }
        )

        prompt.defTool(
          'diffSnapshots',
          'Compare two stored snapshots and return structural differences.',
          z.object({
            a: z.string().min(1),
            b: z.string().min(1),
            maxDepth: z.number().int().min(1).max(8).optional(),
          }),
          async ({ a, b, maxDepth }: { a: string; b: string; maxDepth?: number }) => {
            const snapshotA = thingSnapshotsRef.current[a]
            const snapshotB = thingSnapshotsRef.current[b]

            if (snapshotA === undefined) {
              return { ok: false, message: `Snapshot not found: ${a}` }
            }

            if (snapshotB === undefined) {
              return { ok: false, message: `Snapshot not found: ${b}` }
            }

            const changes = buildSnapshotDiff(snapshotA, snapshotB, '$', 0, maxDepth || 4)

            return {
              ok: true,
              a,
              b,
              totalChanges: changes.length,
              changes,
            }
          }
        )

        prompt.defTool(
          'suggestNextNavigation',
          'Suggest likely next navigation actions based on user intent and current context.',
          z.object({
            intent: z.string().min(1),
            currentContext: z.string().optional(),
          }),
          async ({ intent, currentContext }: { intent: string; currentContext?: string }) => {
            const text = `${intent} ${currentContext || ''}`.toLowerCase()
            const suggestions: Array<{
              tool: string
              args: Record<string, unknown>
              reason: string
            }> = []

            const push = (tool: string, args: Record<string, unknown>, reason: string) => {
              suggestions.push({ tool, args, reason })
            }

            push('listWorkspaceRoots', {}, 'Get a quick workspace overview before drilling down.')

            if (text.includes('agent')) {
              push('listChildren', { domain: 'agents', limit: 25 }, 'Browse agents list.')
              push('searchWorkspace', { domain: 'agents', query: intent, limit: 20 }, 'Find matching agents by name/description/instructions.')
            }

            if (text.includes('flow') || text.includes('workflow') || text.includes('task')) {
              push('listChildren', { domain: 'flows', limit: 25 }, 'Browse flows and task counts.')
              push('searchWorkspace', { domain: 'flows', query: intent, limit: 20 }, 'Find relevant flows and task content.')
            }

            if (text.includes('knowledge') || text.includes('domain') || text.includes('markdown') || text.includes('.md')) {
              push('listChildren', { domain: 'knowledge', nodePath: 'root', limit: 30 }, 'Browse top-level knowledge directories/files.')
              push('searchWorkspace', { domain: 'knowledge', query: intent, limit: 30 }, 'Search knowledge paths/content.')
            }

            if (text.includes('dependency') || text.includes('reference') || text.includes('used by') || text.includes('impact')) {
              push('findBacklinks', { target: 'flow:<flowId>' }, 'Check dependencies before rename/delete.')
            }

            if (text.includes('change') || text.includes('diff') || text.includes('compare')) {
              push('snapshotWorkspace', { scope: 'workspace' }, 'Capture current state for comparison.')
              push('diffSnapshots', { a: '<snapA>', b: '<snapB>' }, 'Compare two captured snapshots.')
            }

            if (suggestions.length < 3) {
              push('searchWorkspace', { query: intent, limit: 20 }, 'Fallback global search across workspace domains.')
              push('listChildren', { domain: 'knowledge', nodePath: 'root', limit: 20 }, 'Fallback browse starting at knowledge root.')
            }

            return {
              ok: true,
              intent,
              currentContext: currentContext || null,
              suggestions: suggestions.slice(0, 8),
            }
          }
        )

        prompt.defTool(
          'createWorkspace',
          'Create a new workspace by id. Optionally set as current and/or provide package.json overrides.',
          z.object({
            workspaceId: z.string().min(1),
            setAsCurrent: z.boolean().optional(),
            packageJson: unknownRecordSchema.optional(),
          }),
          async ({
            workspaceId,
            setAsCurrent,
            packageJson,
          }: {
            workspaceId: string
            setAsCurrent?: boolean
            packageJson?: Record<string, unknown>
          }) => {
            const created = createWorkspace(workspaceId, {
              setAsCurrent,
              packageJson: packageJson as PackageJson | undefined,
            })

            if (created.created) {
              return {
                ok: true,
                message: `Created workspace ${created.workspaceId}${(setAsCurrent ?? true) ? ' and switched to it' : ''}.`,
              }
            }

            return {
              ok: true,
              message: `Workspace ${created.workspaceId} already exists${(setAsCurrent ?? true) ? '; switched to it' : ''}.`,
              created: false,
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
            parentNodePath: z.string().min(1).nullable().optional().describe('Path of the parent directory node, or `root` for root level'),
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
              toolCalls?: Array<{ toolName?: string; input?: unknown }>
              toolResults?: Array<{ toolName?: string; input?: unknown; output?: unknown }>
            }

            if (resultAny.finishReason !== 'tool-calls') {
              return
            }

            const toolResults = resultAny.toolResults || []

            if (toolResults.length > 0) {
              const lines = toolResults.map((toolResult) => {
                const name = toolResult.toolName || 'unknown'
                const argsStr = stringifyJson(toolResult.input)
                const outputStr = stringifyJson(toolResult.output)
                return toToolEventBlock(`🔧 ${name}\n⤷ args: ${argsStr}\n⤷ result: ${outputStr}`)
              })
              onToolEvent?.(lines.join('\n\n'))
              return
            }

            const toolCalls = resultAny.toolCalls || []
            const toolNames = toolCalls
              .map((toolCall) => toolCall.toolName)
              .filter((toolName): toolName is string => Boolean(toolName))

            if (toolNames.length === 0) {
              onToolEvent?.(toToolEventBlock('🔧 Running tool...'))
              return
            }

            onToolEvent?.(toToolEventBlock(`🔧 Running tool${toolNames.length > 1 ? 's' : ''}: ${toolNames.join(', ')}`))
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
    agentBuilderProps,
    totalKnowledgeNodeCount,
    thingModel,
    createWorkspace,
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
            ) : message.role === 'assistant' ? (
              <ToolCallDisplay content={message.content} />
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
          </div>
        ))}

        {isThingWorking && (
          <div className="mr-8 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">Thing</div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-40" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-gradient-to-br from-violet-500 to-purple-500" />
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Processing…</span>
            </div>
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