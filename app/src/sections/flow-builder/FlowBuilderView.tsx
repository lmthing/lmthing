import { useCallback, useMemo } from 'react'
import { useFlow } from '@/lib/workspaceContext'
import type { Flow, Task } from '@/../product/sections/flow-builder/types'
import { FlowDetailEditor } from './components'

// Default flow ID for preview
const DEFAULT_FLOW_ID = 'flow-generate-care-plan'

export default function FlowDetailPreview() {
  const flow = useFlow(DEFAULT_FLOW_ID)
  const { isLoading, error } = useFlow(DEFAULT_FLOW_ID)

  const handleUpdateFlow = useCallback((updates: Partial<Flow>) => {
    console.log('Update flow:', updates)
  }, [])

  const handleAddTask = useCallback((task: Omit<Task, 'id'>) => {
    console.log('Add task to flow:', task)
  }, [])

  const handleUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    console.log('Update task:', taskId)
  }, [])

  const handleDeleteTask = useCallback((taskId: string) => {
    console.log('Delete task:', taskId)
  }, [])

  const handleDuplicateTask = useCallback((taskId: string) => {
    console.log('Duplicate task:', taskId)
  }, [])

  const handleReorderTasks = useCallback((taskIds: string[]) => {
    console.log('Reorder tasks:', taskIds)
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }
  if (error || !flow) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error loading data</div>
  }

  // Convert internal flow format to component Flow type
  const previewFlow: Flow = {
    id: flow.id,
    name: flow.frontmatter.name || flow.id,
    description: flow.description,
    agentId: flow.frontmatter.agentId,
    status: flow.frontmatter.status,
    tags: flow.frontmatter.tags,
    taskCount: parseInt(flow.frontmatter.taskCount || '0', 10),
    createdAt: flow.frontmatter.createdAt,
    updatedAt: flow.frontmatter.updatedAt,
  }

  // Convert internal tasks to component Task type
  const previewTasks: Task[] = useMemo(() => {
    return (flow.tasks || []).map(task => ({
      id: `task_${task.order}`,
      flowId: flow.id,
      order: task.order,
      name: task.name,
      description: task.frontmatter.description || '',
      type: task.frontmatter.type || 'executeTask',
      model: task.frontmatter.model || 'claude-3-5-sonnet',
      temperature: task.frontmatter.temperature || 0.7,
      instructions: task.instructions,
      outputSchema: task.outputSchema,
      targetFieldName: task.targetFieldName,
    }))
  }, [flow])

  return (
    <FlowDetailEditor
      flow={previewFlow}
      tasks={previewTasks}
      onUpdateFlow={handleUpdateFlow}
      onAddTask={handleAddTask}
      onUpdateTask={handleUpdateTask}
      onDeleteTask={handleDeleteTask}
      onDuplicateTask={handleDuplicateTask}
      onReorderTasks={handleReorderTasks}
      onBack={() => console.log('Navigate back to flow list')}
    />
  )
}
