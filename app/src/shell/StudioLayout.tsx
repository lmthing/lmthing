import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { StudioShell } from './components'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import { FlowEditorModal } from '@/sections/agent-builder/components/FlowEditorModal'
import { CreateDomainModal } from './components/CreateDomainModal'
import { CreateAgentModal } from './components/CreateAgentModal'
import { useAgents, useFlows } from '@/lib/workspaceContext'
import { fromWorkspaceRouteParam, parseWorkspaceRepoRef, toWorkspaceRouteParam } from '@/lib/workspaces'
import type {
  PromptFragment,
  NewFileForm,
  NewFolderForm
} from '@/../product/sections/prompt-library/types'
import type { Flow, Task } from '@/../product/sections/flow-builder/types'
import type { AttachedFlow } from '@/../product/sections/agent-builder/types'
import type {
  Flow as WorkspaceFlow,
  Agent as WorkspaceAgent,
  TaskFrontmatter,
  TaskOutputSchema,
  KnowledgeNode,
  Agent,
} from '@/types/workspace-data'

type StudioState = {
  sidebarCollapsed: boolean
}

const STORAGE_KEY = 'studio-layout-state'

const DEFAULT_STATE: StudioState = {
  sidebarCollapsed: false,
}

function loadState(): StudioState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_STATE
}

function saveState(state: StudioState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

function normalizeKnowledgeParentPath(path: string | null | undefined): string | null {
  if (!path || path === 'root' || path === '/') {
    return null
  }

  return path
}

export default function StudioLayout() {
  const { agentId, actionId, workspaceName } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<StudioState>(loadState)
  const {
    setCurrentWorkspace,
    createWorkspace,
    workspaceData,
    upsertFlow,
    upsertAgent,
    addKnowledgeNode,
    updateKnowledgeNodePath,
    deleteKnowledgeNode,
    duplicateKnowledgeNode
  } = useWorkspaceData()

  const studioPath = workspaceName
    ? `/workspace/${toWorkspaceRouteParam(workspaceName)}/studio`
    : '/studio'

  // Redirect /settings to /settings/env by default
  useEffect(() => {
    if (location.pathname.endsWith('/settings')) {
      navigate(`${studioPath}/settings/env`, { replace: true })
    }
  }, [location.pathname, navigate, studioPath])

  // Sync URL workspace param into the data context
  useEffect(() => {
    if (workspaceName) {
      setCurrentWorkspace(workspaceName)
    }
  }, [workspaceName, setCurrentWorkspace])

  useEffect(() => {
    if (!workspaceName || workspaceData) return

    const decodedWorkspace = fromWorkspaceRouteParam(workspaceName)
    const repoRef = parseWorkspaceRepoRef(decodedWorkspace)
    if (repoRef?.owner !== 'local' || !repoRef.repo) return

    createWorkspace(repoRef.repo, { setAsCurrent: false })
  }, [workspaceName, workspaceData, createWorkspace])

  // Use the new state hooks
  const { agents: agentsMap } = useAgents()
  const { flows: flowsMap } = useFlows()

  // Flow editor state
  const [currentEditingFlow, setCurrentEditingFlow] = useState<Flow | null>(null)
  const [currentEditingTasks, setCurrentEditingTasks] = useState<Task[]>([])
  const currentEditingFlowRef = useRef<Flow | null>(null)
  const currentEditingTasksRef = useRef<Task[]>([])

  const [isCreateDomainModalOpen, setIsCreateDomainModalOpen] = useState(false)
  const [isCreateAgentModalOpen, setIsCreateAgentModalOpen] = useState(false)

  useEffect(() => {
    currentEditingFlowRef.current = currentEditingFlow
  }, [currentEditingFlow])

  useEffect(() => {
    currentEditingTasksRef.current = currentEditingTasks
  }, [currentEditingTasks])

  const persistFlowToWorkspace = useCallback((flowDraft: Flow, tasksDraft: Task[]) => {
    const existingFlow = flowsMap[flowDraft.id]

    const normalizedTasks = [...tasksDraft]
      .sort((a, b) => a.order - b.order)
      .map((task, index) => {
        const existingTaskByOrder = existingFlow?.tasks?.find((t) => t.order === index + 1)

        return {
          order: index + 1,
          name: task.name,
          frontmatter: {
            ...(existingTaskByOrder?.frontmatter || {}),
            description: task.description,
            type: task.type,
            ...(task.config?.model ? { model: task.config.model } : {}),
            ...(task.config?.temperature !== undefined
              ? { temperature: task.config.temperature }
              : {}),
            ...(task.config?.isPushable !== undefined
              ? { isPushable: String(task.config.isPushable) }
              : {}),
            ...(task.config?.enabledTools ? { enabledTools: task.config.enabledTools } : {}),
          } as TaskFrontmatter,
          instructions: task.config?.taskInstructions || '',
          outputSchema: task.config?.outputSchema as TaskOutputSchema | undefined,
          targetFieldName: task.config?.targetFieldName,
        }
      })

    const workspaceFlow: WorkspaceFlow = {
      id: flowDraft.id,
      frontmatter: {
        ...(existingFlow?.frontmatter || {}),
        id: flowDraft.id,
        name: flowDraft.name,
        status: flowDraft.status,
        scope: flowDraft.scope,
        agentId: flowDraft.agentId || '',
        tags: flowDraft.tags,
        taskCount: String(normalizedTasks.length),
        createdAt: existingFlow?.frontmatter.createdAt || flowDraft.createdAt,
        updatedAt: new Date().toISOString(),
        lastRunAt: flowDraft.lastRunAt || undefined,
      },
      description: flowDraft.description,
      tasks: normalizedTasks,
    }

    upsertFlow(workspaceFlow)
  }, [flowsMap, upsertFlow])

  // Get attached flows from agent data (memoized to prevent infinite loop)
  const attachedFlows = useMemo(() => {
    const agent = agentsMap[agentId || '']
    if (!agent?.slashActions) return []

    return agent.slashActions.map(sa => ({
      flowId: sa.flowId,
      flowName: sa.name,
      flowDescription: sa.description,
      slashAction: {
        id: `sa_${sa.actionId}`,
        actionId: sa.actionId,
        name: sa.name,
        description: sa.description,
        enabled: true,
      },
    })) as AttachedFlow[]
  }, [agentsMap, agentId])

  // Handle URL parameter for flow editing
  useEffect(() => {
    if (!actionId) {
      setCurrentEditingFlow(null)
      setCurrentEditingTasks([])
      return
    }

    // Find the attached flow with this action ID
    const attachedFlow = attachedFlows.find(af => af.slashAction?.actionId === actionId)
    if (!attachedFlow) {
      setCurrentEditingFlow(null)
      setCurrentEditingTasks([])
      return
    }

    // Get the flow ID and source flow data first (needed for fullFlow construction)
    const flowId = attachedFlow.flowId
    const sourceFlow = flowId ? flowsMap[flowId] : null

    // Build the Flow object for the UI editor
    const fullFlow: Flow = {
      id: attachedFlow.flowId,
      name: attachedFlow.flowName,
      description: attachedFlow.flowDescription ?? '',
      agentId: agentId || '',
      status: 'active',
      scope: (sourceFlow?.frontmatter?.scope as Flow['scope']) ?? 'agent-specific',
      tags: [],
      taskCount: 0,
      lastRunAt: (sourceFlow?.frontmatter?.lastRunAt as string) ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const flowTasks: Task[] = (sourceFlow?.tasks ?? []).map(ft => ({
      id: `task_${ft.order}_${flowId}`,
      flowId: flowId,
      type: (ft.frontmatter?.type as Task['type']) ?? 'updateFlowOutput',
      order: ft.order,
      name: ft.name,
      description: ft.frontmatter?.description ?? '',
      config: {
        taskInstructions: ft.instructions,
        outputSchema: ft.outputSchema as import('@/../product/sections/flow-builder/types').JSONSchema | undefined,
        targetFieldName: ft.targetFieldName,
        model: ft.frontmatter?.model as string | undefined,
        temperature: ft.frontmatter?.temperature as number | undefined,
      },
      status: 'valid' as const,
    }))

    setCurrentEditingFlow(fullFlow)
    setCurrentEditingTasks(flowTasks)
  }, [actionId, attachedFlows, flowsMap, agentId])

  const handleCloseFlowEditor = useCallback(() => {
    setCurrentEditingFlow(null)
    setCurrentEditingTasks([])
    // Note: Navigation is handled by the router when URL changes
    window.history.back()
  }, [])

  const handleUpdateFlow = useCallback((updates: Partial<Flow>) => {
    const activeFlow = currentEditingFlowRef.current
    if (!activeFlow) return

    const nextFlow = {
      ...activeFlow,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    setCurrentEditingFlow(nextFlow)
    persistFlowToWorkspace(nextFlow, currentEditingTasksRef.current)

    if (agentId && actionId && (updates.name !== undefined || updates.description !== undefined)) {
      const existingAgent = agentsMap[agentId]
      if (existingAgent) {
        const updatedAgent: WorkspaceAgent = {
          ...existingAgent,
          slashActions: (existingAgent.slashActions || []).map((sa) =>
            sa.actionId === actionId
              ? {
                ...sa,
                name: updates.name ?? sa.name,
                description: updates.description ?? sa.description,
              }
              : sa
          ),
        }
        upsertAgent(updatedAgent)
      }
    }
  }, [
    persistFlowToWorkspace,
    agentId,
    actionId,
    agentsMap,
    upsertAgent,
  ])

  const handleAddTask = useCallback((task: Omit<Task, 'id'>) => {
    const activeFlow = currentEditingFlowRef.current
    const next = [
      ...currentEditingTasksRef.current,
      {
        ...task,
        id: `task_${Date.now()}`,
      },
    ]

    setCurrentEditingTasks(next)
    if (activeFlow) {
      persistFlowToWorkspace(activeFlow, next)
    }
  }, [persistFlowToWorkspace])

  const handleUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    const activeFlow = currentEditingFlowRef.current
    const next = currentEditingTasksRef.current.map(t => (t.id === taskId ? { ...t, ...updates } : t))

    setCurrentEditingTasks(next)
    if (activeFlow) {
      persistFlowToWorkspace(activeFlow, next)
    }
  }, [persistFlowToWorkspace])

  const handleDeleteTask = useCallback((taskId: string) => {
    const activeFlow = currentEditingFlowRef.current
    const next = currentEditingTasksRef.current.filter(t => t.id !== taskId)

    setCurrentEditingTasks(next)
    if (activeFlow) {
      persistFlowToWorkspace(activeFlow, next)
    }
  }, [persistFlowToWorkspace])

  const handleDuplicateTask = useCallback((taskId: string) => {
    const activeFlow = currentEditingFlowRef.current
    const existingTasks = currentEditingTasksRef.current
    const task = existingTasks.find(t => t.id === taskId)
    if (!task) return

    const next = [
      ...existingTasks,
      {
        ...task,
        id: `task_${Date.now()}`,
        name: `${task.name} (copy)`,
        order: existingTasks.length + 1,
      },
    ]

    setCurrentEditingTasks(next)
    if (activeFlow) {
      persistFlowToWorkspace(activeFlow, next)
    }
  }, [persistFlowToWorkspace])

  const handleReorderTasks = useCallback((taskIds: string[]) => {
    const activeFlow = currentEditingFlowRef.current
    const existingTasks = currentEditingTasksRef.current
    const taskMap = new Map(existingTasks.map(t => [t.id, t]))
    const next = taskIds.map((id, index) => {
      const task = taskMap.get(id)
      return task ? { ...task, order: index + 1 } : existingTasks[index]
    })

    setCurrentEditingTasks(next)
    if (activeFlow) {
      persistFlowToWorkspace(activeFlow, next)
    }
  }, [persistFlowToWorkspace])
  // Persist state changes
  useEffect(() => {
    saveState(state)
  }, [state])

  // Prompt Library callbacks
  const handleSelectFile = useCallback((file: PromptFragment) => {
    console.log('Select file:', file.id)
  }, [])

  const handleToggleFolder = useCallback((path: string) => {
    console.log('Toggle folder:', path)
  }, [])

  const handleExpandAll = useCallback(() => {
    console.log('Expand all folders')
  }, [])

  const handleCollapseAll = useCallback(() => {
    console.log('Collapse all folders')
  }, [])

  const handleEditContent = useCallback(() => {
    // console.log('Edit content, length:', content.length)
  }, [])

  const handleSave = useCallback(() => {
    console.log('Save changes')
  }, [])

  const handleCreateFile = useCallback((form: NewFileForm) => {
    const parent = normalizeKnowledgeParentPath(form.parentPath)
    const newPath = parent ? `${parent}/${form.filename}` : form.filename
    const label = form.filename

    const newNode: KnowledgeNode = {
      path: newPath,
      type: 'file',
      content: '',
      frontmatter: { title: label },
      config: {
        label,
        renderAs: 'file'
      }
    }

    addKnowledgeNode(parent, newNode)
  }, [addKnowledgeNode])

  const handleCreateFolder = useCallback((form: NewFolderForm) => {
    const parent = normalizeKnowledgeParentPath(form.parentPath)
    const newPath = parent ? `${parent}/${form.folderName}` : form.folderName

    const newNode: KnowledgeNode = {
      path: newPath,
      type: 'directory',
      children: [],
      config: {
        label: form.folderName,
        renderAs: 'section'
      }
    }

    addKnowledgeNode(parent, newNode)
  }, [addKnowledgeNode])

  const handleRename = useCallback((nodeId: string, newName: string) => {
    const parts = nodeId.split('/')
    parts.pop()
    const parentPath = parts.join('/')
    const newPath = parentPath ? `${parentPath}/${newName}` : newName
    updateKnowledgeNodePath(nodeId, newPath)
  }, [updateKnowledgeNodePath])

  const handleMove = useCallback((nodeId: string, newParentPath: string) => {
    const normalizedParent = normalizeKnowledgeParentPath(newParentPath)
    const name = nodeId.split('/').pop() || ''
    const newPath = normalizedParent ? `${normalizedParent}/${name}` : name
    updateKnowledgeNodePath(nodeId, newPath)
  }, [updateKnowledgeNodePath])

  const handleDelete = useCallback((nodeId: string) => {
    deleteKnowledgeNode(nodeId)
  }, [deleteKnowledgeNode])

  const handleDuplicate = useCallback((nodeId: string) => {
    duplicateKnowledgeNode(nodeId)
  }, [duplicateKnowledgeNode])

  return (
    <>
      <StudioShell
        defaultSidebarCollapsed={state.sidebarCollapsed}
        onSidebarCollapsedChange={(collapsed) =>
          setState((prev) =>
            prev.sidebarCollapsed === collapsed
              ? prev
              : { ...prev, sidebarCollapsed: collapsed }
          )
        }
        onOpenSettings={() => navigate(`${studioPath}/settings/env`)}
        onCreateDomain={() => setIsCreateDomainModalOpen(true)}
        onEditDomain={(id) => console.log('Edit domain:', id)}
        onDeleteDomain={(id) => console.log('Delete domain:', id)}
        onCreateAgent={() => setIsCreateAgentModalOpen(true)}
        onEditAgent={(id) => console.log('Edit agent:', id)}
        onDeleteAgent={(id) => console.log('Delete agent:', id)}
        onSelectFile={handleSelectFile}
        onToggleFolder={handleToggleFolder}
        onExpandAll={handleExpandAll}
        onCollapseAll={handleCollapseAll}
        onEditContent={handleEditContent}
        onSave={handleSave}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onRename={handleRename}
        onMove={handleMove}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        user={{ name: 'Alex Morgan' }}
      />

      {/* Flow Editor Modal */}
      {currentEditingFlow && (
        <FlowEditorModal
          isOpen={!!currentEditingFlow}
          onClose={handleCloseFlowEditor}
          flow={currentEditingFlow}
          tasks={currentEditingTasks}
          onUpdateFlow={handleUpdateFlow}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onDuplicateTask={handleDuplicateTask}
          onReorderTasks={handleReorderTasks}
        />
      )}

      <CreateDomainModal
        isOpen={isCreateDomainModalOpen}
        onClose={() => setIsCreateDomainModalOpen(false)}
        onSubmit={(name: string, description: string) => {
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
          const newId = slug
          const newNode: KnowledgeNode = {
            path: newId,
            type: 'directory',
            config: {
              label: name,
              description: description,
              color: '#10b981',
              icon: 'folder',
              renderAs: 'section'
            },
            children: []
          }
          addKnowledgeNode(null, newNode)
          setIsCreateDomainModalOpen(false)
          navigate(`${studioPath}/domain/${newId}`)
        }}
      />

      <CreateAgentModal
        isOpen={isCreateAgentModalOpen}
        onClose={() => setIsCreateAgentModalOpen(false)}
        onSubmit={(name: string, description: string) => {
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
          const newId = `agent-${slug}-${Date.now()}` // optionally just use slug or slug + Date.now for uniqueness
          const newAgent: Agent = {
            id: newId,
            frontmatter: {
              name: name,
              description: description,
              selectedDomains: []
            },
            mainInstruction: '',
            slashActions: [],
            config: {
              emptyFieldsForRuntime: []
            },
            formValues: {},
            conversations: []
          }
          upsertAgent(newAgent)
          setIsCreateAgentModalOpen(false)
          navigate(`${studioPath}/agent/${newId}`)
        }}
      />
    </>
  )
}
