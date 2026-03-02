import { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgents, useFlows, useKnowledgeSections } from '@/lib/workspaceContext'
import { AgentFormBuilder } from './components/AgentFormBuilder'
import { SavedAgentsList } from './components/SavedAgentsList'
import { ToolLibraryModal } from './components/ToolLibraryModal'
import { FlowBuilderModal } from './components/FlowBuilderModal'
import { FlowEditorModal } from './components/FlowEditorModal'
import type {
  FormFieldValue,
  AttachedFlow,
  AgentConfig,
  Domain,
  Tool,
  PromptPreview,
  EnabledTool,
} from '@/../product/sections/agent-builder/types'
import type { Flow, Task } from '@/../product/sections/flow-builder/types'

type AgentBuilderData = {
  domains: Domain[]
  toolLibrary: Tool[]
  savedAgentConfigs: AgentConfig[]
  promptPreview: PromptPreview
}

type FlowBuilderData = {
  flows: Flow[]
  tasks: Task[]
}

type AgentBuilderPreviewContentProps = {
  data: AgentBuilderData
  flowBuilderData: FlowBuilderData
  firstAgent: AgentConfig
}

/**
 * Preview wrapper for Agent Builder view
 *
 * Uses the new workspace state hooks (useAgents, useFlows, useKnowledgeSections)
 * instead of GitHub API data loading.
 */
export default function AgentBuilderPreview() {
  const { agents: agentsMap, isLoading: agentsLoading, error: agentsError } = useAgents()
  const { flowList, isLoading: flowsLoading } = useFlows()
  const knowledgeSections = useKnowledgeSections()

  // Map workspace agents to AgentConfig format
  const savedAgentConfigs = useMemo(() => {
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
      emptyFieldsForRuntime: agent.config.emptyFieldsForRuntime || [],
      mainInstruction: agent.mainInstruction,
      attachedFlows: (agent.slashActions || []).map(sa => ({
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
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })) as unknown as AgentConfig[]
  }, [agentsMap])

  // Map flow list to Flow format
  const flows = useMemo(() => {
    return flowList.map(flow => ({
      id: flow.id,
      name: flow.name,
      description: flow.description,
      agentId: '', // Not in FlowListItem
      status: flow.status,
      tags: flow.tags,
      taskCount: flow.taskCount,
      createdAt: '',
      updatedAt: '',
    })) as Flow[]
  }, [flowList])

  // Map knowledge sections to Domain format
  const domains = useMemo(() => {
    return knowledgeSections.map(section => {
      // Build schema field nodes from each field-type child
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
          options: (field.children || []).map(opt => ({
            id: opt.path,
            value: opt.path.split('/').pop() || opt.path,
            label: opt.label || opt.path,
            filePath: opt.path,
          })),
        }))

      return {
        id: section.path,
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
    }) as unknown as Domain[]
  }, [knowledgeSections])

  // Get first agent for initial state
  const firstAgent = savedAgentConfigs[0] || ({
    id: 'default',
    name: 'Default Agent',
    description: '',
    selectedDomains: [],
    formValues: {},
    enabledTools: [],
    emptyFieldsForRuntime: [],
    mainInstruction: '',
    attachedFlows: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown) as AgentConfig

  if (agentsLoading || flowsLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (agentsError) {
    return <div className="flex items-center justify-center flex-col h-screen text-red-500">
      <p>Error loading data</p>
      <p className="text-sm mt-2">{agentsError}</p>
    </div>
  }

  // Construct data object
  const data: AgentBuilderData = {
    domains,
    toolLibrary: [], // Tool library not in extracted data
    savedAgentConfigs,
    promptPreview: {
      agentId: 'preview-agent',
      domains: [],
      generatedPrompt: '',
      tokenCount: 0,
      lastGenerated: new Date().toISOString()
    }
  }

  // Construct flow builder data
  const flowBuilderData: FlowBuilderData = {
    flows,
    tasks: [], // Tasks are nested within flows in the new structure
  }

  return (
    <AgentBuilderPreviewContent
      data={data}
      flowBuilderData={flowBuilderData}
      firstAgent={firstAgent}
    />
  )
}

function AgentBuilderPreviewContent({ data, flowBuilderData, firstAgent }: AgentBuilderPreviewContentProps) {
  const navigate = useNavigate()

  const [view, setView] = useState<'builder' | 'agents'>('builder')

  // Initial state with sample data - using the first saved agent config
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>(firstAgent.selectedDomains)
  const [formValues, setFormValues] = useState<Record<string, FormFieldValue>>(firstAgent.formValues)
  const [mainInstruction, setMainInstruction] = useState<string>(firstAgent.mainInstruction || '')
  const [enabledTools, setEnabledTools] = useState<EnabledTool[]>(firstAgent.enabledTools || [])
  const [emptyFieldsForRuntime, setEmptyFieldsForRuntime] = useState<string[]>(firstAgent.emptyFieldsForRuntime || [])
  const [toolLibraryOpen, setToolLibraryOpen] = useState(false)
  const [flowBuilderOpen, setFlowBuilderOpen] = useState(false)
  const [flowEditorOpen, setFlowEditorOpen] = useState(false)
  const [currentEditingFlow, setCurrentEditingFlow] = useState<Flow | null>(null)
  const [currentEditingTasks, setCurrentEditingTasks] = useState<Task[]>([])

  // Sample attached flows for demo - use from first agent if available
  const [attachedFlows, setAttachedFlows] = useState<AttachedFlow[]>(firstAgent.attachedFlows || [])

  // Available flows for attaching
  const availableFlows = flowBuilderData.flows.map((flow) => ({
    id: flow.id,
    name: flow.name,
    description: flow.description,
    taskCount: flow.taskCount,
  }))

  // Domain handlers
  const handleDomainsChange = useCallback((domainIds: string[]) => {
    setSelectedDomainIds(domainIds)
    setEmptyFieldsForRuntime([])
  }, [])

  // Field handlers
  const handleFieldValueChange = useCallback((fieldId: string, value: FormFieldValue) => {
    setFormValues(prev => {
      // If fieldId contains '/', handle nested update
      if (fieldId.includes('/')) {
        const parts = fieldId.split('/')
        const newFormValues = { ...prev }
        let current: any = newFormValues

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {}
          } else {
            current[part] = { ...current[part] }
          }
          current = current[part]
        }

        current[parts[parts.length - 1]] = value
        return newFormValues
      }

      // Otherwise fallback to flat update
      return { ...prev, [fieldId]: value }
    })
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

  // Tool handlers
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

  // Agent actions
  const handleGeneratePreview = useCallback(() => {
    console.log('Generate preview')
  }, [])

  const handleSaveAgent = useCallback((name: string, description: string) => {
    console.log('Save agent:', name, description)
  }, [])

  const handleNewAgent = useCallback(() => {
    setSelectedDomainIds([])
    setFormValues({})
    setMainInstruction('')
    setEnabledTools([])
    setEmptyFieldsForRuntime([])
    setAttachedFlows([])
    setView('agents')
  }, [])

  const handleLoadAgent = useCallback((agentId: string) => {
    console.log('Load agent:', agentId)
    const agent = data.savedAgentConfigs.find(a => a.id === agentId)
    if (agent) {
      setSelectedDomainIds(agent.selectedDomains)
      setFormValues(agent.formValues)
      setMainInstruction(agent.mainInstruction || '')
      setEnabledTools(agent.enabledTools)
      setEmptyFieldsForRuntime(agent.emptyFieldsForRuntime)
      setView('builder')
    }
  }, [data.savedAgentConfigs])

  const handleDeleteAgent = useCallback((agentId: string) => {
    console.log('Delete agent:', agentId)
  }, [])

  const handleDuplicateAgent = useCallback((agentId: string) => {
    console.log('Duplicate agent:', agentId)
  }, [])

  // Flow handlers
  const handleOpenFlowBuilder = useCallback(() => {
    setFlowBuilderOpen(true)
  }, [])

  const handleCloseFlowBuilder = useCallback(() => {
    setFlowBuilderOpen(false)
  }, [])

  const handleAttachFlow = useCallback(
    (flowId: string, actionId: string, name: string, description: string) => {
      const flow = availableFlows.find(f => f.id === flowId)
      if (!flow) return

      const newAttachedFlow: AttachedFlow = {
        flowId,
        flowName: flow.name,
        flowDescription: flow.description,
        taskCount: flow.taskCount,
        slashAction: {
          id: `sc_${Date.now()}`,
          actionId,
          name,
          description,
          flowId,
          flowName: flow.name,
          enabled: true,
        },
      }

      setAttachedFlows(prev => [...prev, newAttachedFlow])
      console.log('Attach flow:', flowId, 'as action:', actionId)
    },
    [availableFlows]
  )

  const handleDetachFlow = useCallback((slashActionId: string) => {
    setAttachedFlows(prev => prev.filter(af => af.slashAction.id !== slashActionId))
    console.log('Detach flow with action:', slashActionId)
  }, [])

  const handleToggleSlashAction = useCallback((slashActionId: string, enabled: boolean) => {
    setAttachedFlows(prev =>
      prev.map(af => {
        if (af.slashAction.id === slashActionId) {
          return { ...af, slashAction: { ...af.slashAction, enabled } }
        }
        return af
      })
    )
    console.log('Toggle action:', slashActionId, 'enabled:', enabled)
  }, [])

  // Find the attached flow by slash action ID
  const handleEditSlashAction = useCallback(
    (slashActionId: string) => {
      const attachedFlow = attachedFlows.find(af => af.slashAction.id === slashActionId)
      if (!attachedFlow) return

      // Get the full flow data from flow builder data
      const fullFlow = flowBuilderData.flows.find(f => f.id === attachedFlow.flowId)
      if (!fullFlow) return

      // Get the tasks for this flow
      const flowTasks = flowBuilderData.tasks.filter((t: Task) => t.flowId === attachedFlow.flowId)

      setCurrentEditingFlow(fullFlow)
      setCurrentEditingTasks(flowTasks)
      setFlowEditorOpen(true)

      // Navigate to a route based on the action name
      navigate(`/agent-builder/flow/${attachedFlow.slashAction.actionId}`)

      console.log('Edit flow:', attachedFlow.flowName, 'with', flowTasks.length, 'tasks')
    },
    [attachedFlows, flowBuilderData.flows, flowBuilderData.tasks, navigate]
  )

  // Flow editor handlers
  const handleCloseFlowEditor = useCallback(() => {
    setFlowEditorOpen(false)
    setCurrentEditingFlow(null)
    setCurrentEditingTasks([])
    // Navigate back to agent builder
    navigate('/agent-builder')
  }, [navigate])

  const handleUpdateFlow = useCallback((updates: Partial<Flow>) => {
    if (!currentEditingFlow) return
    setCurrentEditingFlow(prev => prev ? { ...prev, ...updates } : null)
    console.log('Update flow:', currentEditingFlow.id, updates)
  }, [currentEditingFlow])

  const handleAddTask = useCallback((task: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...task,
      id: `task_${Date.now()}`,
    }
    setCurrentEditingTasks(prev => [...prev, newTask])
    console.log('Add task to flow:', currentEditingFlow?.id)
  }, [currentEditingFlow])

  const handleUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setCurrentEditingTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, ...updates } : t))
    )
    console.log('Update task:', taskId)
  }, [])

  const handleDeleteTask = useCallback((taskId: string) => {
    setCurrentEditingTasks(prev => prev.filter(t => t.id !== taskId))
    console.log('Delete task:', taskId)
  }, [])

  const handleDuplicateTask = useCallback((taskId: string) => {
    setCurrentEditingTasks(prev => {
      const task = prev.find(t => t.id === taskId)
      if (!task) return prev
      const newTask: Task = {
        ...task,
        id: `task_${Date.now()}`,
        name: `${task.name} (copy)`,
        order: prev.length + 1,
      }
      return [...prev, newTask]
    })
    console.log('Duplicate task:', taskId)
  }, [])

  const handleReorderTasks = useCallback((taskIds: string[]) => {
    setCurrentEditingTasks(prev => {
      const taskMap = new Map(prev.map(t => [t.id, t]))
      return taskIds.map((id, index) => {
        const task = taskMap.get(id)
        return task ? { ...task, order: index + 1 } : prev[index]
      })
    })
    console.log('Reorder tasks:', taskIds)
  }, [])

  const promptPreview = data.promptPreview

  // Extract conversations from agents
  const allConversations = useMemo(() => {
    const result: Array<{
      id: string
      agentId: string
      agentName: string
      messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>
      createdAt: string
      updatedAt: string
    }> = []
    
    for (const agent of Object.values(agentsMap)) {
      for (const conv of agent.conversations || []) {
        result.push({
          id: conv.id,
          agentId: conv.agentId,
          agentName: conv.agentName,
          messages: conv.messages,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        })
      }
    }
    
    return result
  }, [agentsMap])

  const builderProps = {
    domains: data.domains,
    toolLibrary: data.toolLibrary,
    savedAgentConfigs: data.savedAgentConfigs,
    selectedDomainIds,
    formValues,
    enabledTools,
    emptyFieldsForRuntime,
    attachedFlows,
    availableFlows,
    mainInstruction,
    promptPreview,
    validationErrors: {},
    toolLibraryOpen,
    flowBuilderOpen,
    loadedAgentId: 'preview-agent',
    conversations: allConversations,
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
    onLoadAgent: handleLoadAgent,
    onDeleteAgent: handleDeleteAgent,
    onDuplicateAgent: handleDuplicateAgent,
    onNewAgent: handleNewAgent,
    onOpenFlowBuilder: handleOpenFlowBuilder,
    onCloseFlowBuilder: handleCloseFlowBuilder,
    onAttachFlow: handleAttachFlow,
    onDetachFlow: handleDetachFlow,
    onToggleSlashAction: handleToggleSlashAction,
    onEditSlashAction: handleEditSlashAction,
  }

  const agentsProps = {
    domains: data.domains,
    toolLibrary: data.toolLibrary,
    savedAgentConfigs: data.savedAgentConfigs,
    onLoadAgent: handleLoadAgent,
    onDuplicateAgent: handleDuplicateAgent,
    onDeleteAgent: handleDeleteAgent,
    onNewAgent: handleNewAgent,
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* View Toggle */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-1 px-4">
          <button
            onClick={() => setView('builder')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${view === 'builder'
              ? 'text-violet-600 dark:text-violet-400 border-violet-600'
              : 'text-slate-500 dark:text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-400'
              }`}
          >
            Agent Builder
          </button>
          <button
            onClick={() => setView('agents')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${view === 'agents'
              ? 'text-violet-600 dark:text-violet-400 border-violet-600'
              : 'text-slate-500 dark:text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-400'
              }`}
          >
            Saved Agents ({data.savedAgentConfigs.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'builder' ? (
          <AgentFormBuilder {...builderProps} />
        ) : (
          <SavedAgentsList {...agentsProps} />
        )}
      </div>

      {/* Tool Library Modal */}
      <ToolLibraryModal
        toolLibrary={data.toolLibrary}
        enabledTools={enabledTools}
        isOpen={toolLibraryOpen}
        onClose={handleCloseToolLibrary}
        onAddTool={handleAddTool}
        onRemoveTool={handleRemoveTool}
        onConfigureTool={handleConfigureTool}
      />

      {/* Flow Builder Modal */}
      <FlowBuilderModal
        isOpen={flowBuilderOpen}
        onClose={handleCloseFlowBuilder}
        agentId="preview-agent"
        availableFlows={availableFlows}
        onAttachFlow={handleAttachFlow}
        onCreateNewFlow={() => console.log('Create new flow')}
      />

      {/* Flow Editor Modal */}
      {currentEditingFlow && (
        <FlowEditorModal
          isOpen={flowEditorOpen}
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
    </div>
  )
}
