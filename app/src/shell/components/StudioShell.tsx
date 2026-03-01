import { useState, useCallback, useMemo, useEffect, useRef, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { StudioSidebar } from './StudioSidebar'
import { Plus, Bot, Folder, Zap, Play, Download, Github } from 'lucide-react'
import { PromptLibrary } from '@/sections/prompt-library/components/PromptLibrary'
import { AgentFormBuilder } from '@/sections/agent-builder/components/AgentFormBuilder'
import { AgentRuntimeView } from '@/sections/agent-runtime/components'
import { useAgents, useKnowledgeSections, useFlows, useRuntimeAgents } from '@/lib/workspaceContext'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import { useGithub } from '@/lib/github/GithubContext'
import type { PromptConfig } from 'lmthing'
import type {
  KnowledgeNode,
  Agent as WorkspaceAgent,
  Flow as WorkspaceFlow,
} from '@/types/workspace-data'
import type {
  PromptLibraryProps,
  FileSystemNode,
  PromptFragment,
  Directory,
  DirectoryConfig,
  NewFileForm,
  NewFolderForm,
  PromptFrontmatter,
} from '@/../product/sections/prompt-library/types'
import type {
  AgentBuilderScreenProps,
  FormFieldValue,
  AttachedFlow,
} from '@/../product/sections/agent-builder/types'
import type {
  Agent as RuntimeAgent,
  Conversation as RuntimeConversation,
  MessageRole,
  RuntimeFieldType,
} from '@/../product/sections/agent-runtime/types'
import { workspaceToSlug, type Workspace } from './WorkspaceSelector'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { flattenEmptyFieldsForRuntime } from '@/lib/utils'
import { downloadWorkspaceZip, exportWorkspaceToNewGithubRepo } from '@/lib/workspaceExport'
import { fromWorkspaceRouteParam, toWorkspaceRouteParam } from '@/lib/workspaces'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function toAgentId(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || `agent-${Date.now()}`
}

function toRuntimeDefaultValue(fieldType?: string): string | string[] | boolean {
  switch (fieldType) {
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
}

function toRuntimeFieldType(fieldType?: string): RuntimeFieldType {
  switch (fieldType) {
    case 'text':
    case 'textarea':
    case 'select':
    case 'multiselect':
    case 'toggle':
      return fieldType
    default:
      return 'text'
  }
}

function areAgentDraftsEqual(a: WorkspaceAgent, b: WorkspaceAgent): boolean {
  return (
    a.id === b.id &&
    JSON.stringify(a.frontmatter) === JSON.stringify(b.frontmatter) &&
    a.mainInstruction === b.mainInstruction &&
    JSON.stringify(a.slashActions) === JSON.stringify(b.slashActions) &&
    JSON.stringify(a.config) === JSON.stringify(b.config) &&
    JSON.stringify(a.formValues) === JSON.stringify(b.formValues)
  )
}

// Helper to get workspace from URL param
function useWorkspace(workspaceName?: string): Workspace {
  const { data: workspaces } = useWorkspaces()

  return useMemo(() => {
    const displayWorkspaceName = workspaceName ? fromWorkspaceRouteParam(workspaceName) : 'Workspace'
    const defaultWorkspace = {
      id: displayWorkspaceName.startsWith('local/')
        ? `local-${displayWorkspaceName.replace('local/', '')}`
        : 'default',
      name: displayWorkspaceName,
      color: '#10b981',
    }
    if (!workspaces) return defaultWorkspace

    if (workspaceName) {
      const decodedWorkspaceName = fromWorkspaceRouteParam(workspaceName)

      const found = workspaces.find(
        w => workspaceToSlug(w.name) === workspaceName || w.name === decodedWorkspaceName
      )
      if (found) {
        return { id: found.id.toString(), name: found.name, color: '#10b981' }
      }

      // Keep the URL-selected workspace visible (e.g. local/*),
      // even if it is not part of GitHub workspace results.
      return defaultWorkspace
    }

    const first = workspaces[0]
    return first ? { id: first.id.toString(), name: first.name, color: '#10b981' } : defaultWorkspace
  }, [workspaceName, workspaces])
}

type StudioState = {
  sidebarCollapsed: boolean
}

export interface StudioShellProps {
  // User props
  user?: { name: string; avatarUrl?: string }
  onLogout?: () => void
  onOpenSettings?: () => void
  // Sidebar state
  defaultSidebarCollapsed?: boolean
  onSidebarCollapsedChange?: (collapsed: boolean) => void
  // Callbacks for domain actions
  onCreateDomain?: () => void
  onEditDomain?: (domainId: string) => void
  onDeleteDomain?: (domainId: string) => void
  // Callbacks for agent actions
  onCreateAgent?: () => void
  onEditAgent?: (agentId: string) => void
  onDeleteAgent?: (agentId: string) => void
  // Prompt Library callbacks
  onSelectFile?: (file: PromptFragment) => void
  onToggleFolder?: (path: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  onEditContent?: (content: string) => void
  onEditDirectoryConfig?: (directoryPath: string, config: DirectoryConfig) => void
  onSave?: () => void
  onCreateFile?: (form: NewFileForm) => void
  onCreateFolder?: (form: NewFolderForm) => void
  onRename?: (nodeId: string, newName: string) => void
  onMove?: (nodeId: string, newParentPath: string) => void
  onDelete?: (nodeId: string) => void
  onDuplicate?: (nodeId: string) => void
}

type Domain = {
  id: string
  name: string
  label: string
  description: string
  icon: string
  color: string
  path: string
}

/**
 * Recursively convert a raw KnowledgeNode (from workspace JSON) into the
 * Directory | PromptFragment shape required by PromptLibrary.
 * File nodes carry markdown `content`; directory nodes carry nested children.
 */
function knowledgeNodeToFileSystem(node: KnowledgeNode): Directory | PromptFragment {
  if (node.type === 'file') {
    const fileName = node.path.split('/').pop() || node.path
    const rawFrontmatter = (node.frontmatter || {}) as Record<string, unknown>
    return {
      id: node.path,
      name: fileName,
      type: 'file',
      path: node.path,
      content: node.content || '',
      frontmatter: {
        ...rawFrontmatter,
        title: rawFrontmatter.title as string | undefined,
        description: rawFrontmatter.description as string | undefined,
        order:
          rawFrontmatter.order !== undefined
            ? Number(rawFrontmatter.order)
            : undefined,
      },
    } as PromptFragment
  }

  // Directory node
  const dirName = node.path.split('/').pop() || node.path
  return {
    id: node.path,
    name: node.config?.label || dirName,
    type: 'directory',
    path: node.path,
    config: node.config,
    children: (node.children || []).map(knowledgeNodeToFileSystem),
  } as Directory
}

type AgentConfig = {
  id: string
  name: string
  description: string
  selectedDomains: string[]
  formValues: Record<string, FormFieldValue>
  enabledTools: Array<{ toolId: string; source: string; config?: Record<string, unknown> }>
  emptyFieldsForRuntime?: string[]
  attachedFlows: AttachedFlow[]
  mainInstruction?: string
  createdAt: string
  updatedAt: string
}

type ThingMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type ThingLmthingModelId = Extract<PromptConfig['model'], string>

const THING_ACTION_NAMES = [
  'setCurrentWorkspace',
  'reload',
  'upsertAgent',
  'deleteAgent',
  'upsertFlow',
  'deleteFlow',
  'updateKnowledgeFileContent',
  'updateKnowledgeFileFrontmatter',
  'updateKnowledgeDirectoryConfig',
  'addKnowledgeNode',
  'updateKnowledgeNodePath',
  'deleteKnowledgeNode',
  'duplicateKnowledgeNode',
] as const

const THING_WELCOME_MESSAGE =
  'I am thing. I can execute workspace data actions directly. Send a JSON action envelope, or type help.'

const THING_HELP_MESSAGE = [
  `Available actions: ${THING_ACTION_NAMES.join(', ')}`,
  'Format: {"action":"upsertAgent","payload":{...}}',
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

export function StudioShell({
  user,
  onLogout,
  onOpenSettings,
  defaultSidebarCollapsed = false,
  onSidebarCollapsedChange,
  onCreateDomain,
  onEditDomain,
  onDeleteDomain,
  onCreateAgent,
  onEditAgent,
  onDeleteAgent,
  onSelectFile,
  onToggleFolder,
  onExpandAll,
  onCollapseAll,
  onEditContent,
  onEditDirectoryConfig,
  onSave,
  onCreateFile,
  onCreateFolder,
  onRename,
  onMove,
  onDelete,
  onDuplicate,
}: StudioShellProps) {
  const { domainId, agentId, workspaceName, conversationId } = useParams()
  const navigate = useNavigate()

  // Use the new state hooks
  const knowledgeSections = useKnowledgeSections()
  const { agents: agentsMap } = useAgents()
  const runtimeAgents = useRuntimeAgents()
  const { flows: flowsMap } = useFlows()

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(defaultSidebarCollapsed)

  // Workspace - derived directly from URL
  const currentWorkspace = useWorkspace(workspaceName)

  // Build workspace-aware path helper
  const studioPath = workspaceName ? `/workspace/${toWorkspaceRouteParam(workspaceName)}/studio` : '/studio'

  // Prompt Library state
  const [selectedFile, setSelectedFile] = useState<PromptFragment | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  const [unsavedChanges, setUnsavedChanges] = useState(false)

  // Agent Builder state
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([])
  const [formValues, setFormValues] = useState<Record<string, FormFieldValue>>({})
  const [mainInstruction, setMainInstruction] = useState<string>('')
  const [enabledTools, setEnabledTools] = useState<Array<{ toolId: string; source: string; config?: Record<string, unknown> }>>([])
  const [emptyFieldsForRuntime, setEmptyFieldsForRuntime] = useState<string[]>([])
  const [toolLibraryOpen, setToolLibraryOpen] = useState(false)
  const [flowBuilderOpen, setFlowBuilderOpen] = useState(false)
  const [attachedFlows, setAttachedFlows] = useState<AttachedFlow[]>([])
  const [runtimeChatLoading, setRuntimeChatLoading] = useState(false)
  const hydratedAgentIdRef = useRef<string | null>(null)
  const lastAutoSavedSnapshotRef = useRef<string>('')
  const contentEditDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frontmatterEditDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingContentEditRef = useRef<{ path: string; content: string } | null>(null)
  const pendingFrontmatterEditRef = useRef<{ path: string; frontmatter: Record<string, unknown> } | null>(null)
  const runtimeResponseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isExportingWorkspace, setIsExportingWorkspace] = useState(false)
  const [isExportingGithubRepo, setIsExportingGithubRepo] = useState(false)
  const [isThingOpen, setIsThingOpen] = useState(false)
  const [thingInput, setThingInput] = useState('')
  const [thingMessages, setThingMessages] = useState<ThingMessage[]>([
    {
      id: 'thing-welcome',
      role: 'assistant',
      content: THING_WELCOME_MESSAGE,
    },
  ])
  const [isThingWorking, setIsThingWorking] = useState(false)
  const thingMessagesEndRef = useRef<HTMLDivElement | null>(null)
  const [githubExportProgress, setGithubExportProgress] = useState<{
    uploadedFiles: number
    totalFiles: number
    currentPath: string
  } | null>(null)

  // Extract domains from knowledge sections
  const domains = useMemo(() => {
    return knowledgeSections.map(section => {
      // Build field nodes from field-type children
      const fieldNodes = (section.children || [])
        .filter(c => c.type === 'field')
        .map(field => ({
          id: field.path,
          type: 'field' as const,
          label: field.label || field.path,
          description: field.description || '',
          variableName: field.variableName || field.path.split('/').pop() || field.path,
          fieldType: field.fieldType || 'select',
          required: field.required || false,
          runtimeOptional: true,
          options: (field.children || []).map(opt => {
            const stem = opt.path.split('/').pop()?.replace(/\.md$/, '') ?? opt.path
            return {
              id: opt.path,
              value: stem,
              label: opt.label || stem,
              filePath: opt.path,
            }
          }),
        }))

      return {
        id: section.path,           // Use path directly (e.g. 'plant-profile')
        name: section.label || section.path,
        label: section.label || section.path,
        description: section.description || '',
        icon: section.icon || '📁',
        color: section.color || '#6366f1',
        path: section.path,
        directoryPath: section.path,
        category: 'Knowledge',
        schema: {
          root: {
            id: section.path,
            type: 'section' as const,
            label: section.label || section.path,
            description: section.description || '',
            children: fieldNodes,
          },
        },
        fields: fieldNodes,
      }
    })
  }, [knowledgeSections])

  // Access raw knowledge nodes and in-memory mutators from workspace context
  const {
    setCurrentWorkspace,
    reload,
    workspaceData,
    isLoading,
    githubLoadProgress,
    knowledge: rawKnowledge,
    upsertAgent,
    deleteAgent,
    upsertFlow,
    deleteFlow,
    updateKnowledgeFileContent,
    updateKnowledgeFileFrontmatter,
    updateKnowledgeDirectoryConfig,
    addKnowledgeNode,
    updateKnowledgeNodePath,
    deleteKnowledgeNode,
    duplicateKnowledgeNode,
  } = useWorkspaceData()
  const { octokit, isAuthenticated, user: githubUser } = useGithub()

  // Extract agents from agents map
  const agents = useMemo(() => {
    return Object.values(agentsMap).map(agent => ({
      id: agent.id,
      name: agent.frontmatter.name || agent.id,
      description: agent.frontmatter.description || '',
      selectedDomains: (agent.frontmatter.selectedDomains || []).map(id =>
        // Normalize: 'domain-plant-profile' → 'plant-profile' to match knowledge section paths
        id.startsWith('domain-') ? id.slice('domain-'.length) : id
      ),
      formValues: agent.formValues,
      enabledTools: [],
      emptyFieldsForRuntime: flattenEmptyFieldsForRuntime(agent.config.emptyFieldsForRuntime),
      attachedFlows: (agent.slashActions || []).map(sa => ({
        flowId: sa.flowId,
        flowName: sa.name,
        flowDescription: sa.description,
        taskCount: flowsMap[sa.flowId]?.tasks?.length || 0,
        slashAction: {
          id: `sa_${sa.actionId}`,
          actionId: sa.actionId,
          name: sa.name,
          description: sa.description,
          enabled: true,
        },
      })),
      mainInstruction: agent.mainInstruction,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })) as unknown as AgentConfig[]
  }, [agentsMap, flowsMap])

  // Get the active domain
  const activeDomain = useMemo(
    () => (domainId ? domains.find((d) => d.id === domainId) || null : null),
    [domainId, domains]
  )

  // Get the active agent
  const activeAgent = useMemo(
    () => (agentId ? agents.find((a) => a.id === agentId) || null : null),
    [agentId, agents]
  )

  const activeRuntimeAgent = useMemo<RuntimeAgent | null>(
    () => (agentId ? runtimeAgents.find((a) => a.id === agentId) || null : null),
    [agentId, runtimeAgents]
  )

  const selectedDomainsForRuntime = useMemo(
    () => domains.filter((domain) => selectedDomainIds.includes(domain.id)),
    [domains, selectedDomainIds]
  )

  const runtimeFieldsForConversation = useMemo(() => {
    const runtimeFieldIds = new Set(emptyFieldsForRuntime)

    const selectedFieldEntries = selectedDomainsForRuntime.flatMap((domain) =>
      (domain.fields || []).map((field) => ({ field, domainName: domain.name }))
    )

    return selectedFieldEntries
      .filter(({ field }) =>
        runtimeFieldIds.has(field.id) || runtimeFieldIds.has(field.variableName)
      )
      .map(({ field, domainName }) => ({
        id: field.id,
        label: field.label,
        type: toRuntimeFieldType(field.fieldType),
        options: (field.options || []).map((option) => option.label),
        value: toRuntimeDefaultValue(field.fieldType),
        domain: domainName,
      }))
  }, [emptyFieldsForRuntime, selectedDomainsForRuntime])

  const studioRuntimeAgent = useMemo<RuntimeAgent | null>(() => {
    if (!activeRuntimeAgent) return null

    return {
      ...activeRuntimeAgent,
      domains: selectedDomainsForRuntime.map((domain) => domain.name),
      runtimeFields: runtimeFieldsForConversation,
    }
  }, [activeRuntimeAgent, selectedDomainsForRuntime, runtimeFieldsForConversation])

  const totalKnowledgeNodeCount = useMemo(() => countKnowledgeNodes(rawKnowledge), [rawKnowledge])

  const runtimeConversations = useMemo<RuntimeConversation[]>(() => {
    if (!agentId) return []

    const source = agentsMap[agentId]?.conversations || []
    return source
      .map((conv) => ({
        id: conv.id,
        agentId: conv.agentId,
        agentName: conv.agentName,
        messages: (conv.messages || [])
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg) => ({
            id: msg.id,
            role: msg.role as MessageRole,
            content: msg.content,
            timestamp: msg.timestamp,
            slashAction: msg.slashAction,
            structuredOutput: msg.structuredOutput,
          })),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [agentId, agentsMap])

  // Load agent data only when the route agent changes
  useEffect(() => {
    if (!agentId) {
      hydratedAgentIdRef.current = null
      lastAutoSavedSnapshotRef.current = ''

      // Reset state when no agent selected
      setSelectedDomainIds([])
      setFormValues({})
      setMainInstruction('')
      setEnabledTools([])
      setEmptyFieldsForRuntime([])
      setAttachedFlows([])
      return
    }

    if (hydratedAgentIdRef.current === agentId) {
      return
    }

    const sourceAgent = agentsMap[agentId]
    if (!sourceAgent) {
      return
    }

    const mappedAgent = agents.find((a) => a.id === agentId) || null

    setSelectedDomainIds(mappedAgent?.selectedDomains || [])
    setFormValues((sourceAgent.formValues || {}) as Record<string, FormFieldValue>)
    setMainInstruction(sourceAgent.mainInstruction || '')
    setEnabledTools([])
    setEmptyFieldsForRuntime(flattenEmptyFieldsForRuntime(sourceAgent.config?.emptyFieldsForRuntime))
    setAttachedFlows(mappedAgent?.attachedFlows || [])

    hydratedAgentIdRef.current = agentId
    lastAutoSavedSnapshotRef.current = JSON.stringify(sourceAgent)
  }, [agentId, agentsMap, agents])

  // Determine view mode from URL params
  const viewMode: 'list' | 'domain-detail' | 'agent-detail' | 'agent-conversation' = conversationId
    ? 'agent-conversation'
    : agentId
      ? 'agent-detail'
      : domainId
        ? 'domain-detail'
        : 'list'

  // Get filtered file system for the selected domain
  // knowledgeNodeToFileSystem is a module-level pure function – no useCallback needed
  const domainFileSystem = useMemo(() => {
    if (!activeDomain) return null

    // Find the raw knowledge section (contains content on file nodes)
    const section = rawKnowledge.find(s => s.path === activeDomain.path)
    if (!section) return null

    // Build a root Directory using section children directly.
    // This avoids showing the selected domain as an extra top-level folder
    // inside PromptLibrary.
    return {
      id: 'root',
      name: 'root',
      type: 'directory' as const,
      path: '/',
      children: (section.children || []).map(knowledgeNodeToFileSystem),
    } as Directory
  }, [activeDomain, rawKnowledge])

  // Available flows (empty for now, would come from flow builder data)
  const availableFlows: any[] = []

  // Prompt library callbacks
  const handleSelectFile = useCallback((file: PromptFragment) => {
    setSelectedFile(file)
    setUnsavedChanges(false)
    onSelectFile?.(file)
  }, [onSelectFile])

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    )
    onToggleFolder?.(path)
  }, [onToggleFolder])

  const handleExpandAll = useCallback(() => {
    const allPaths: string[] = []
    const collectPaths = (node: FileSystemNode) => {
      if (node.type === 'directory') {
        allPaths.push(node.path)
        node.children?.forEach(collectPaths)
      }
    }
    if (domainFileSystem) {
      domainFileSystem.children?.forEach(collectPaths)
    }
    setExpandedFolders(allPaths)
    onExpandAll?.()
  }, [domainFileSystem, onExpandAll])

  const handleCollapseAll = useCallback(() => {
    setExpandedFolders([])
    onCollapseAll?.()
  }, [onCollapseAll])

  const handleEditContent = useCallback((content: string) => {
    if (selectedFile?.path) {
      pendingContentEditRef.current = { path: selectedFile.path, content }

      if (contentEditDebounceRef.current) {
        clearTimeout(contentEditDebounceRef.current)
      }

      contentEditDebounceRef.current = setTimeout(() => {
        if (pendingContentEditRef.current) {
          updateKnowledgeFileContent(
            pendingContentEditRef.current.path,
            pendingContentEditRef.current.content
          )
          pendingContentEditRef.current = null
        }
      }, 200)

      setSelectedFile((prev) => (prev ? { ...prev, content } : prev))
    }
    setUnsavedChanges(false)
    onEditContent?.(content)
  }, [onEditContent, selectedFile, updateKnowledgeFileContent])

  const handleEditFrontmatter = useCallback((frontmatter: PromptFrontmatter) => {
    if (selectedFile?.path) {
      pendingFrontmatterEditRef.current = {
        path: selectedFile.path,
        frontmatter: frontmatter as Record<string, unknown>,
      }

      if (frontmatterEditDebounceRef.current) {
        clearTimeout(frontmatterEditDebounceRef.current)
      }

      frontmatterEditDebounceRef.current = setTimeout(() => {
        if (pendingFrontmatterEditRef.current) {
          updateKnowledgeFileFrontmatter(
            pendingFrontmatterEditRef.current.path,
            pendingFrontmatterEditRef.current.frontmatter
          )
          pendingFrontmatterEditRef.current = null
        }
      }, 200)

      setSelectedFile((prev) => (prev ? { ...prev, frontmatter } : prev))
    }
  }, [selectedFile, updateKnowledgeFileFrontmatter])

  const handleEditDirectoryConfig = useCallback((directoryPath: string, config: DirectoryConfig) => {
    updateKnowledgeDirectoryConfig(directoryPath, config as Record<string, unknown>)
    onEditDirectoryConfig?.(directoryPath, config)
  }, [onEditDirectoryConfig, updateKnowledgeDirectoryConfig])

  const flushPendingKnowledgeEdits = useCallback(() => {
    if (contentEditDebounceRef.current) {
      clearTimeout(contentEditDebounceRef.current)
      contentEditDebounceRef.current = null
    }
    if (frontmatterEditDebounceRef.current) {
      clearTimeout(frontmatterEditDebounceRef.current)
      frontmatterEditDebounceRef.current = null
    }

    if (pendingContentEditRef.current) {
      updateKnowledgeFileContent(
        pendingContentEditRef.current.path,
        pendingContentEditRef.current.content
      )
      pendingContentEditRef.current = null
    }

    if (pendingFrontmatterEditRef.current) {
      updateKnowledgeFileFrontmatter(
        pendingFrontmatterEditRef.current.path,
        pendingFrontmatterEditRef.current.frontmatter
      )
      pendingFrontmatterEditRef.current = null
    }
  }, [updateKnowledgeFileContent, updateKnowledgeFileFrontmatter])

  useEffect(() => {
    return () => {
      flushPendingKnowledgeEdits()
    }
  }, [flushPendingKnowledgeEdits])

  useEffect(() => {
    return () => {
      if (runtimeResponseTimeoutRef.current) {
        clearTimeout(runtimeResponseTimeoutRef.current)
      }
    }
  }, [])

  const handleSave = useCallback(() => {
    flushPendingKnowledgeEdits()
    setUnsavedChanges(false)
    onSave?.()
  }, [flushPendingKnowledgeEdits, onSave])

  const handleCreateFile = useCallback((form: NewFileForm) => {
    const parentPath =
      form.parentPath === '/' && activeDomain?.path
        ? activeDomain.path
        : form.parentPath

    onCreateFile?.({
      ...form,
      parentPath,
    })
  }, [onCreateFile, activeDomain?.path])

  const handleCreateFolder = useCallback((form: NewFolderForm) => {
    const parentPath =
      form.parentPath === '/' && activeDomain?.path
        ? activeDomain.path
        : form.parentPath

    onCreateFolder?.({
      ...form,
      parentPath,
    })
  }, [onCreateFolder, activeDomain?.path])

  const handleRename = useCallback((nodeId: string, newName: string) => {
    onRename?.(nodeId, newName)
  }, [onRename])

  const handleMove = useCallback((nodeId: string, newParentPath: string) => {
    onMove?.(nodeId, newParentPath)
  }, [onMove])

  const handleDelete = useCallback((nodeId: string) => {
    onDelete?.(nodeId)
  }, [onDelete])

  const handleDuplicate = useCallback((nodeId: string) => {
    onDuplicate?.(nodeId)
  }, [onDuplicate])

  // Agent Builder callbacks
  const handleDomainsChange = useCallback((domainIds: string[]) => {
    setSelectedDomainIds(domainIds)
    setEmptyFieldsForRuntime([])
  }, [])

  const handleFieldValueChange = useCallback((fieldId: string, value: FormFieldValue) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }))
  }, [])

  const handleEnableFieldForRuntime = useCallback((fieldId: string) => {
    setEmptyFieldsForRuntime(prev => [...prev, fieldId])
  }, [])

  const handleDisableFieldForRuntime = useCallback((fieldId: string) => {
    setEmptyFieldsForRuntime(prev => prev.filter(id => id !== fieldId))
  }, [])

  const handleMainInstructionChange = useCallback((instruction: string) => {
    setMainInstruction(instruction)
  }, [])

  const handleOpenToolLibrary = useCallback(() => {
    setToolLibraryOpen(true)
  }, [])

  const handleCloseToolLibrary = useCallback(() => {
    setToolLibraryOpen(false)
  }, [])

  const handleAddTool = useCallback((toolId: string, config?: Record<string, unknown>) => {
    setEnabledTools(prev => {
      if (prev.some(t => t.toolId === toolId)) return prev
      return [...prev, { toolId, source: 'manual', config }]
    })
  }, [])

  const handleRemoveTool = useCallback((toolId: string) => {
    setEnabledTools(prev => prev.filter(t => t.toolId !== toolId))
  }, [])

  const handleConfigureTool = useCallback((toolId: string, config: Record<string, unknown>) => {
    console.log('Configure tool:', toolId, config)
  }, [])

  const handleGeneratePreview = useCallback(() => {
    console.log('Generate preview')
  }, [])

  const buildAgentPayload = useCallback(
    (targetAgentId: string, name: string, description: string): WorkspaceAgent => {
      const existingAgent = agentsMap[targetAgentId]
      const slashActions = attachedFlows
        .filter((af) => Boolean(af.slashAction?.actionId))
        .map((af) => ({
          name: af.slashAction?.name || af.flowName,
          description: af.slashAction?.description || af.flowDescription || '',
          flowId: af.flowId,
          actionId: af.slashAction?.actionId || '',
        }))

      return {
        id: targetAgentId,
        frontmatter: {
          ...(existingAgent?.frontmatter || {}),
          name,
          description,
          selectedDomains: selectedDomainIds,
          tools: enabledTools.map((tool) => tool.toolId),
        },
        mainInstruction,
        slashActions,
        config: {
          ...(existingAgent?.config || {}),
          emptyFieldsForRuntime,
        },
        formValues,
        conversations: existingAgent?.conversations || [],
      }
    },
    [agentsMap, attachedFlows, selectedDomainIds, enabledTools, mainInstruction, emptyFieldsForRuntime, formValues]
  )

  // Auto-save draft in memory for existing agents whenever form state changes
  useEffect(() => {
    if (!agentId) return

    const existingAgent = agentsMap[agentId]
    if (!existingAgent) return

    const draft = buildAgentPayload(
      agentId,
      (existingAgent.frontmatter.name as string) || agentId,
      (existingAgent.frontmatter.description as string) || ''
    )

    const nextSnapshot = JSON.stringify(draft)
    if (lastAutoSavedSnapshotRef.current === nextSnapshot) return

    if (areAgentDraftsEqual(existingAgent, draft)) {
      lastAutoSavedSnapshotRef.current = nextSnapshot
      return
    }

    lastAutoSavedSnapshotRef.current = nextSnapshot
    upsertAgent(draft)
  }, [
    agentId,
    agentsMap,
    selectedDomainIds,
    formValues,
    mainInstruction,
    enabledTools,
    emptyFieldsForRuntime,
    attachedFlows,
    buildAgentPayload,
    upsertAgent,
  ])

  const handleSaveAgent = useCallback((name: string, description: string) => {
    const nextAgentId = agentId || toAgentId(name)
    upsertAgent(buildAgentPayload(nextAgentId, name, description))

    if (!agentId) {
      navigate(`${studioPath}/agent/${nextAgentId}`, { replace: true })
    }
  }, [
    agentId,
    navigate,
    studioPath,
    upsertAgent,
    buildAgentPayload,
  ])

  const handleSaveRuntimeConversation = useCallback((conversation: RuntimeConversation) => {
    if (!agentId) return

    const existingAgent = agentsMap[agentId]
    if (!existingAgent) return

    const persistedId =
      conversation.id === 'preview-conversation'
        ? `conversation-${Date.now()}`
        : conversation.id

    const now = new Date().toISOString()
    const persistedConversation = {
      ...conversation,
      id: persistedId,
      agentId,
      agentName: (existingAgent.frontmatter.name as string) || agentId,
      updatedAt: now,
    }

    const currentConversations = existingAgent.conversations || []
    const existingIndex = currentConversations.findIndex((item) => item.id === persistedId)

    const nextConversations =
      existingIndex >= 0
        ? currentConversations.map((item, index) =>
          index === existingIndex ? persistedConversation : item
        )
        : [...currentConversations, persistedConversation]

    upsertAgent({
      ...existingAgent,
      conversations: nextConversations,
    })
  }, [agentId, agentsMap, upsertAgent])

  const handleSelectRuntimeConversation = useCallback((targetConversationId: string) => {
    if (!agentId) return
    navigate(`${studioPath}/agent/${agentId}/conversation/${targetConversationId}`)
  }, [agentId, navigate, studioPath])

  const handleCreateRuntimeConversation = useCallback(() => {
    if (!agentId) return

    const existingAgent = agentsMap[agentId]
    if (!existingAgent) return

    const now = new Date().toISOString()
    const nextConversationId = `conversation-${Date.now()}`
    const nextConversation = {
      id: nextConversationId,
      agentId,
      agentName: (existingAgent.frontmatter.name as string) || agentId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    }

    upsertAgent({
      ...existingAgent,
      conversations: [...(existingAgent.conversations || []), nextConversation],
    })

    navigate(`${studioPath}/agent/${agentId}/conversation/${nextConversationId}`)
  }, [agentId, agentsMap, navigate, studioPath, upsertAgent])

  const handleDeleteRuntimeConversation = useCallback((targetConversationId: string) => {
    if (!agentId) return

    const existingAgent = agentsMap[agentId]
    if (!existingAgent) return

    const remaining = (existingAgent.conversations || []).filter((c) => c.id !== targetConversationId)

    upsertAgent({
      ...existingAgent,
      conversations: remaining,
    })

    if (conversationId === targetConversationId) {
      if (remaining.length > 0) {
        navigate(`${studioPath}/agent/${agentId}/conversation/${remaining[0].id}`)
      } else {
        navigate(`${studioPath}/agent/${agentId}`)
      }
    }
  }, [agentId, agentsMap, conversationId, navigate, studioPath, upsertAgent])

  const handleSendRuntimeMessage = useCallback((content: string) => {
    if (!agentId || !conversationId) return

    const existingAgent = agentsMap[agentId]
    if (!existingAgent) return

    const targetConversation = (existingAgent.conversations || []).find((c) => c.id === conversationId)
    if (!targetConversation) return

    const now = new Date().toISOString()
    const userMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: now,
    }

    const updatedConversation = {
      ...targetConversation,
      messages: [...(targetConversation.messages || []), userMessage],
      updatedAt: now,
    }

    upsertAgent({
      ...existingAgent,
      conversations: (existingAgent.conversations || []).map((c) =>
        c.id === conversationId ? updatedConversation : c
      ),
    })

    setRuntimeChatLoading(true)

    if (runtimeResponseTimeoutRef.current) {
      clearTimeout(runtimeResponseTimeoutRef.current)
      runtimeResponseTimeoutRef.current = null
    }

    runtimeResponseTimeoutRef.current = setTimeout(() => {
      const assistantNow = new Date().toISOString()
      const assistantMessage = {
        id: `msg-assistant-${Date.now()}`,
        role: 'assistant' as const,
        content: 'Preview response: I would use your assembled prompt and enabled files to answer this request.',
        timestamp: assistantNow,
      }

      upsertAgent({
        ...existingAgent,
        conversations: (existingAgent.conversations || []).map((c) =>
          c.id === conversationId
            ? {
              ...updatedConversation,
              messages: [...(updatedConversation.messages || []), assistantMessage],
              updatedAt: assistantNow,
            }
            : c
        ),
      })

      setRuntimeChatLoading(false)
      runtimeResponseTimeoutRef.current = null
    }, 700)
  }, [agentId, conversationId, agentsMap, upsertAgent])

  const handleSaveActiveRuntimeConversation = useCallback(() => {
    if (!conversationId) return

    const targetConversation = runtimeConversations.find((conv) => conv.id === conversationId)
    if (!targetConversation) return

    handleSaveRuntimeConversation(targetConversation)
  }, [conversationId, runtimeConversations, handleSaveRuntimeConversation])

  const handleNewAgent = useCallback(() => {
    setSelectedDomainIds([])
    setFormValues({})
    setMainInstruction('')
    setEnabledTools([])
    setEmptyFieldsForRuntime([])
    setAttachedFlows([])
    navigate(studioPath)
  }, [navigate, studioPath])

  const handleOpenFlowBuilder = useCallback(() => {
    setFlowBuilderOpen(true)
  }, [])

  const handleCloseFlowBuilder = useCallback(() => {
    setFlowBuilderOpen(false)
  }, [])

  const handleAttachFlow = useCallback((
    flowId: string,
    actionId: string,
    name: string,
    description: string
  ) => {
    const newAttachedFlow: AttachedFlow = {
      flowId,
      flowName: name,
      flowDescription: description,
      taskCount: flowsMap[flowId]?.tasks?.length || 0,
      slashAction: {
        id: `sc_${Date.now()}`,
        actionId,
        name,
        description,
        flowId,
        flowName: name,
        enabled: true,
      },
    }
    setAttachedFlows(prev => [...prev, newAttachedFlow])
  }, [])

  const handleDetachFlow = useCallback((slashActionId: string) => {
    setAttachedFlows(prev => prev.filter(af => af.slashAction?.id !== slashActionId))
  }, [])

  const handleToggleSlashAction = useCallback((slashActionId: string, enabled: boolean) => {
    setAttachedFlows(prev =>
      prev.map(af => {
        if (af.slashAction?.id === slashActionId) {
          return { ...af, slashAction: { ...af.slashAction, enabled } }
        }
        return af
      })
    )
  }, [])

  const handleEditSlashAction = useCallback((
    slashActionId: string
  ) => {
    // Find the attached flow to get the actionId
    const attachedFlow = attachedFlows.find(af => af.slashAction?.id === slashActionId)
    if (!attachedFlow) {
      console.log('Flow not found for slash action:', slashActionId)
      return
    }

    // Navigate to the agent flow editing route
    navigate(`${studioPath}/agent/${agentId}/actions/${attachedFlow.slashAction.actionId}`)
  }, [navigate, agentId, attachedFlows, studioPath])

  // Navigation helpers
  const handleBackToList = useCallback(() => {
    navigate(studioPath)
  }, [navigate, studioPath])

  const handleCreateAgent = useCallback(() => {
    onCreateAgent?.()
  }, [onCreateAgent])

  const handleCreateDomain = useCallback(() => {
    onCreateDomain?.()
  }, [onCreateDomain])

  const handleEditAgentClick = useCallback((agentId: string) => {
    onEditAgent?.(agentId)
  }, [onEditAgent])

  const handleDeleteAgentClick = useCallback((targetAgentId: string) => {
    deleteAgent(targetAgentId)
    onDeleteAgent?.(targetAgentId)

    if (agentId === targetAgentId) {
      navigate(studioPath)
    }
  }, [agentId, deleteAgent, navigate, onDeleteAgent, studioPath])

  const handleEditDomainClick = useCallback((domainId: string) => {
    onEditDomain?.(domainId)
  }, [onEditDomain])

  const handleDeleteDomainClick = useCallback((domainId: string) => {
    onDeleteDomain?.(domainId)
  }, [onDeleteDomain])

  const handleExportWorkspace = useCallback(async () => {
    if (!workspaceData) return

    try {
      setIsExportingWorkspace(true)
      await downloadWorkspaceZip(workspaceData)
    } catch (error) {
      console.error('Failed to export workspace:', error)
    } finally {
      setIsExportingWorkspace(false)
    }
  }, [workspaceData])

  const handleExportWorkspaceToGithub = useCallback(async () => {
    if (!workspaceData || !octokit || !githubUser) return

    const defaultRepoName = `${workspaceData.id}-export`
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')

    const repoName = window.prompt('Repository name for export:', defaultRepoName)?.trim()
    if (!repoName) return

    const privateRepo = window.confirm(
      'Create as a private repository?\n\nClick OK for private, Cancel for public.'
    )

    const commitMessage = window.prompt(
      'Commit message for the initial export:',
      `Export workspace "${workspaceData.id}"`
    )?.trim()

    if (!commitMessage) return

    try {
      setIsExportingGithubRepo(true)
      setGithubExportProgress({
        uploadedFiles: 0,
        totalFiles: 0,
        currentPath: 'Preparing export…',
      })

      const result = await exportWorkspaceToNewGithubRepo(workspaceData, {
        octokit,
        owner: githubUser.login,
        repoName,
        privateRepo,
        commitMessage,
        onProgress: (progress) => {
          setGithubExportProgress(progress)
        },
      })

      const shouldOpen = window.confirm(
        `Export completed. Created ${result.filesCreated} files in ${result.owner}/${result.repoName}.\n\nOpen repository now?`
      )
      if (shouldOpen) {
        window.open(result.repoUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      console.error('Failed to export workspace to GitHub:', error)
      const apiError = error as {
        status?: number
        message?: string
        response?: {
          data?: {
            message?: string
          }
        }
      }

      const statusText = apiError?.status ? ` (status ${apiError.status})` : ''
      const detail = apiError?.response?.data?.message || apiError?.message || 'Unknown error'
      window.alert(
        `Failed to create GitHub repository export${statusText}. ${detail}`
      )
    } finally {
      setIsExportingGithubRepo(false)
      setGithubExportProgress(null)
    }
  }, [workspaceData, octokit, githubUser])

  const handleThingMessage = useCallback((rawInput: string): string => {
    const input = stripCodeFence(rawInput)
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

    let parsed: unknown
    try {
      parsed = JSON.parse(normalized)
    } catch {
      return [
        'I could not parse JSON.',
        'Type help for supported actions, or send a JSON envelope.',
      ].join('\n')
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'Invalid action envelope. Expected an object with action and payload.'
    }

    const envelope = parsed as { action?: unknown; payload?: unknown }
    if (typeof envelope.action !== 'string') {
      return 'Invalid action envelope: action must be a string.'
    }

    const payload =
      envelope.payload && typeof envelope.payload === 'object' && !Array.isArray(envelope.payload)
        ? (envelope.payload as Record<string, unknown>)
        : {}

    try {
      switch (envelope.action) {
        case 'setCurrentWorkspace': {
          const workspaceId = payload.workspaceId
          if (typeof workspaceId !== 'string' || !workspaceId.trim()) {
            return 'setCurrentWorkspace requires payload.workspaceId (string).'
          }
          setCurrentWorkspace(workspaceId)
          return `Switched workspace context to ${workspaceId}.`
        }
        case 'reload': {
          void reload()
          return 'Reload started for workspace data.'
        }
        case 'upsertAgent': {
          const agent = payload.agent as WorkspaceAgent | undefined
          if (!agent?.id) {
            return 'upsertAgent requires payload.agent with a valid id.'
          }
          upsertAgent(agent)
          return `Upserted agent ${agent.id}.`
        }
        case 'deleteAgent': {
          const targetAgentId = payload.agentId
          if (typeof targetAgentId !== 'string' || !targetAgentId.trim()) {
            return 'deleteAgent requires payload.agentId (string).'
          }
          deleteAgent(targetAgentId)
          return `Deleted agent ${targetAgentId}.`
        }
        case 'upsertFlow': {
          const flow = payload.flow as WorkspaceFlow | undefined
          if (!flow?.id) {
            return 'upsertFlow requires payload.flow with a valid id.'
          }

          const invalidTask = flow.tasks?.find((task) => {
            const model = task.frontmatter?.model
            return model !== undefined && !isThingLmthingModelId(model)
          })

          if (invalidTask) {
            return [
              `Invalid model in flow task ${invalidTask.order}.`,
              'Expected model format: provider:model_id (for example openai:gpt-4o).',
            ].join('\n')
          }

          upsertFlow(flow)
          return `Upserted flow ${flow.id}.`
        }
        case 'deleteFlow': {
          const flowId = payload.flowId
          if (typeof flowId !== 'string' || !flowId.trim()) {
            return 'deleteFlow requires payload.flowId (string).'
          }
          deleteFlow(flowId)
          return `Deleted flow ${flowId}.`
        }
        case 'updateKnowledgeFileContent': {
          const filePath = payload.filePath
          const content = payload.content
          if (typeof filePath !== 'string' || typeof content !== 'string') {
            return 'updateKnowledgeFileContent requires payload.filePath and payload.content (string).'
          }
          updateKnowledgeFileContent(filePath, content)
          return `Updated file content at ${filePath}.`
        }
        case 'updateKnowledgeFileFrontmatter': {
          const filePath = payload.filePath
          const frontmatter = payload.frontmatter
          if (
            typeof filePath !== 'string' ||
            !frontmatter ||
            typeof frontmatter !== 'object' ||
            Array.isArray(frontmatter)
          ) {
            return 'updateKnowledgeFileFrontmatter requires payload.filePath (string) and payload.frontmatter (object).'
          }
          updateKnowledgeFileFrontmatter(filePath, frontmatter as Record<string, unknown>)
          return `Updated file frontmatter at ${filePath}.`
        }
        case 'updateKnowledgeDirectoryConfig': {
          const directoryPath = payload.directoryPath
          const config = payload.config
          if (
            typeof directoryPath !== 'string' ||
            !config ||
            typeof config !== 'object' ||
            Array.isArray(config)
          ) {
            return 'updateKnowledgeDirectoryConfig requires payload.directoryPath (string) and payload.config (object).'
          }
          updateKnowledgeDirectoryConfig(directoryPath, config as Record<string, unknown>)
          return `Updated directory config at ${directoryPath}.`
        }
        case 'addKnowledgeNode': {
          const parentNodePath = payload.parentNodePath
          const node = payload.node as KnowledgeNode | undefined
          if (!node?.path || !node.type) {
            return 'addKnowledgeNode requires payload.node with path and type.'
          }
          if (
            parentNodePath !== null
            && parentNodePath !== undefined
            && typeof parentNodePath !== 'string'
          ) {
            return 'addKnowledgeNode payload.parentNodePath must be string or null.'
          }
          addKnowledgeNode((parentNodePath as string | null | undefined) ?? null, node)
          return `Added knowledge node ${node.path}.`
        }
        case 'updateKnowledgeNodePath': {
          const oldPath = payload.oldPath
          const newPath = payload.newPath
          if (typeof oldPath !== 'string' || typeof newPath !== 'string') {
            return 'updateKnowledgeNodePath requires payload.oldPath and payload.newPath (string).'
          }
          updateKnowledgeNodePath(oldPath, newPath)
          return `Renamed or moved knowledge node from ${oldPath} to ${newPath}.`
        }
        case 'deleteKnowledgeNode': {
          const nodePath = payload.nodePath
          if (typeof nodePath !== 'string' || !nodePath.trim()) {
            return 'deleteKnowledgeNode requires payload.nodePath (string).'
          }
          deleteKnowledgeNode(nodePath)
          return `Deleted knowledge node ${nodePath}.`
        }
        case 'duplicateKnowledgeNode': {
          const nodePath = payload.nodePath
          if (typeof nodePath !== 'string' || !nodePath.trim()) {
            return 'duplicateKnowledgeNode requires payload.nodePath (string).'
          }
          duplicateKnowledgeNode(nodePath)
          return `Duplicated knowledge node ${nodePath}.`
        }
        default:
          return `Unknown action: ${envelope.action}. Type help for supported actions.`
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return `Action failed: ${message}`
    }
  }, [
    workspaceData?.id,
    agentsMap,
    flowsMap,
    totalKnowledgeNodeCount,
    setCurrentWorkspace,
    reload,
    upsertAgent,
    deleteAgent,
    upsertFlow,
    deleteFlow,
    updateKnowledgeFileContent,
    updateKnowledgeFileFrontmatter,
    updateKnowledgeDirectoryConfig,
    addKnowledgeNode,
    updateKnowledgeNodePath,
    deleteKnowledgeNode,
    duplicateKnowledgeNode,
  ])

  const handleThingSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextInput = thingInput.trim()
    if (!nextInput || isThingWorking) return

    setThingInput('')
    setThingMessages((prev) => [
      ...prev,
      {
        id: `thing-user-${Date.now()}`,
        role: 'user',
        content: nextInput,
      },
    ])

    setIsThingWorking(true)

    const response = handleThingMessage(nextInput)

    setThingMessages((prev) => [
      ...prev,
      {
        id: `thing-assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
      },
    ])

    setIsThingWorking(false)
  }, [thingInput, isThingWorking, handleThingMessage])

  useEffect(() => {
    if (!isThingOpen) return
    thingMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thingMessages, isThingOpen])

  // Show loading state while workspace data loads
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-slate-500">Loading workspace data...</div>
          {githubLoadProgress && (
            <div className="mt-2 text-xs text-slate-400">
              <div>
                {githubLoadProgress.loadedFiles}/{githubLoadProgress.totalFiles} files
              </div>
              <div className="mt-1 max-w-[560px] truncate" title={githubLoadProgress.currentPath}>
                {githubLoadProgress.currentPath}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Prompt preview - create a default one
  const promptPreview = {
    agentId: agentId || 'default',
    domains: selectedDomainIds,
    generatedPrompt: mainInstruction || '',
    tokenCount: mainInstruction?.length || 0,
    lastGenerated: new Date().toISOString(),
  }

  // Build agent builder props using new data structure
  const agentBuilderProps: AgentBuilderScreenProps = {
    domains,
    toolLibrary: [], // Empty for now - tool library not in extracted data
    savedAgentConfigs: agents,
    selectedDomainIds,
    formValues,
    enabledTools: enabledTools.map(t => ({ ...t, source: 'manual' as const })),
    emptyFieldsForRuntime,
    attachedFlows: attachedFlows.map(af => ({
      ...af,
      taskCount: af.taskCount || flowsMap[af.flowId]?.tasks?.length || 0
    })),
    availableFlows,
    mainInstruction,
    promptPreview,
    validationErrors: {},
    toolLibraryOpen,
    flowBuilderOpen,
    loadedAgentId: agentId || null,
    onDomainsChange: handleDomainsChange,
    onFieldValueChange: handleFieldValueChange,
    onEnableFieldForRuntime: handleEnableFieldForRuntime,
    onDisableFieldForRuntime: handleDisableFieldForRuntime,
    onMainInstructionChange: handleMainInstructionChange,
    onOpenToolLibrary: handleOpenToolLibrary,
    onCloseToolLibrary: handleCloseToolLibrary,
    onAddTool: handleAddTool,
    onRemoveTool: handleRemoveTool,
    onConfigureTool: handleConfigureTool,
    onGeneratePreview: handleGeneratePreview,
    onSaveAgent: handleSaveAgent,
    onNewAgent: handleNewAgent,
    onOpenFlowBuilder: handleOpenFlowBuilder,
    onCloseFlowBuilder: handleCloseFlowBuilder,
    onAttachFlow: handleAttachFlow,
    onDetachFlow: handleDetachFlow,
    onToggleSlashAction: handleToggleSlashAction,
    onEditSlashAction: handleEditSlashAction,
    onSaveRuntimeConversation: handleSaveRuntimeConversation,
  }

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950">
      {/* Sidebar */}
      <StudioSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => {
          const newState = !isSidebarCollapsed
          setIsSidebarCollapsed(newState)
          onSidebarCollapsedChange?.(newState)
        }}
        activeDomainId={domainId}
        activeAgentId={agentId}
        onOpenSettings={onOpenSettings}
        onCreateDomain={handleCreateDomain}
        onCreateAgent={handleCreateAgent}
        workspace={currentWorkspace}
      />

      {/* Main Content + Thing Panel */}
      <div className="flex-1 min-w-0 flex">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            {(activeDomain || activeAgent) && (
              <button
                onClick={handleBackToList}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {activeAgent ? activeAgent.name : activeDomain ? activeDomain.label : 'Studio'}
            </h1>
            {(activeDomain || activeAgent) && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {activeAgent?.description || activeDomain?.description}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsThingOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Bot className="h-4 w-4" />
              {isThingOpen ? 'Hide Thing' : 'Thing'}
            </button>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={!workspaceData || isExportingWorkspace || isExportingGithubRepo}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4" />
                    {isExportingWorkspace
                      ? 'Downloading…'
                      : isExportingGithubRepo
                        ? `Creating repo… (${githubExportProgress?.uploadedFiles ?? 0}/${githubExportProgress?.totalFiles ?? 0})`
                        : 'Export'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      void handleExportWorkspace()
                    }}
                    disabled={!workspaceData || isExportingWorkspace || isExportingGithubRepo}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download ZIP
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      void handleExportWorkspaceToGithub()
                    }}
                    disabled={!workspaceData || isExportingWorkspace || isExportingGithubRepo}
                  >
                    <Github className="mr-2 h-4 w-4" />
                    Create GitHub Repo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={handleExportWorkspace}
                disabled={!workspaceData || isExportingWorkspace}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                {isExportingWorkspace ? 'Exporting…' : 'Export'}
              </button>
            )}
            {isExportingGithubRepo && githubExportProgress && (
              <span
                className="max-w-64 truncate text-xs text-slate-500 dark:text-slate-400"
                title={githubExportProgress.currentPath}
              >
                Uploading: {githubExportProgress.currentPath}
              </span>
            )}
          </div>
        </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto">
          {/* Main List View */}
          {viewMode === 'list' && (
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Manage knowledge and agents
                </h2>
              </div>

              {/* Domains Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Folder className="w-5 h-5 text-emerald-500" />
                    Knowledge
                  </h3>
                  <button
                    onClick={handleCreateDomain}
                    className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium"
                  >
                    + Create Knowledge Area
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {domains.map((domain) => (
                    <Link
                      key={domain.id}
                      to={`${studioPath}/domain/${domain.id}`}
                      className="group p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition-all bg-white dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${domain.color}20` }}
                        >
                          <div
                            className="w-5 h-5 rounded"
                            style={{ backgroundColor: domain.color }}
                          />
                        </div>
                        <svg
                          className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        {domain.label}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                        {domain.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Agents Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Bot className="w-5 h-5 text-violet-500" />
                    Agents
                  </h3>
                  <button
                    onClick={handleCreateAgent}
                    className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium"
                  >
                    + Create Agent
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agents.map((agent) => {
                    const slashAction = agent.attachedFlows?.find((f) => f.slashAction?.enabled)
                    return (
                      <Link
                        key={agent.id}
                        to={`${studioPath}/agent/${agent.id}`}
                        className="group p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-500 hover:shadow-lg transition-all bg-white dark:bg-slate-900"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="flex items-center gap-2">
                            {slashAction && (
                              <span className="px-2 py-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 rounded-full">
                                /{slashAction.slashAction?.name}
                              </span>
                            )}
                            <svg
                              className="w-5 h-5 text-slate-400 group-hover:text-violet-500 transition-colors"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                          {agent.name}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
                          {agent.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
                          <span>{agent.selectedDomains.length} knowledge areas</span>
                          <span>{agent.enabledTools?.length || 0} tools</span>
                          <span>{agent.attachedFlows?.length || 0} flows</span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Domain Detail View - Use PromptLibrary Component */}
          {viewMode === 'domain-detail' && domainFileSystem && (
            <PromptLibrary
              fileSystem={domainFileSystem}
              selectedFile={selectedFile}
              expandedFolders={expandedFolders}
              unsavedChanges={unsavedChanges}
              onSelectFile={handleSelectFile}
              onToggleFolder={handleToggleFolder}
              onExpandAll={handleExpandAll}
              onCollapseAll={handleCollapseAll}
              onEditContent={handleEditContent}
              onEditFrontmatter={handleEditFrontmatter}
              onEditDirectoryConfig={handleEditDirectoryConfig}
              onSave={handleSave}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onRename={handleRename}
              onMove={handleMove}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          )}

          {/* Agent Detail View - Use AgentFormBuilder Component */}
          {viewMode === 'agent-detail' && (
            <div className="h-full flex flex-col">
              <AgentFormBuilder {...agentBuilderProps} />
            </div>
          )}

          {/* Agent Conversation View - Use AgentRuntimeView/ChatPanel implementation */}
          {viewMode === 'agent-conversation' && (
            <AgentRuntimeView
              agent={studioRuntimeAgent}
              conversations={runtimeConversations}
              activeConversationId={conversationId || null}
              isLoading={runtimeChatLoading}
              onBackToList={handleBackToList}
              onSendMessage={handleSendRuntimeMessage}
              onSelectConversation={handleSelectRuntimeConversation}
              onCreateConversation={handleCreateRuntimeConversation}
              onDeleteConversation={handleDeleteRuntimeConversation}
              onSaveConversation={handleSaveActiveRuntimeConversation}
              canSaveConversation={Boolean(agentId && conversationId)}
              hideTopNav
            />
          )}
          </div>
        </div>

        {isThingOpen && (
          <aside className="w-[420px] border-l border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/80 flex min-w-0 flex-col">
            <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">thing</h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">Workspace actions</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {thingMessages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === 'user'
                      ? 'ml-8 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-900/40 dark:bg-violet-900/20 dark:text-violet-100'
                      : 'mr-8 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }
                >
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide opacity-70">
                    {message.role === 'user' ? 'You' : 'Thing'}
                  </div>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
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
        )}
      </div>
    </div>
  )
}
