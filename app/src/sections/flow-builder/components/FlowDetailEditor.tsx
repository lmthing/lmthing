import { useState } from 'react'
import type { Flow, Task } from '@/../product/sections/flow-builder/types'
import { TaskCard } from './TaskCard'
import { TaskConfigPanel } from './TaskConfigPanel'

interface FlowDetailEditorProps {
  flow: Flow
  tasks: Task[]
  availableTools?: Array<{ id: string; name: string; description: string }>
  onUpdateFlow?: (updates: Partial<Flow>) => void
  onAddTask?: (task: Omit<Task, 'id'>) => void
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void
  onDeleteTask?: (taskId: string) => void
  onDuplicateTask?: (taskId: string) => void
  onReorderTasks?: (taskIds: string[]) => void
  onBack?: () => void
}

const AVAILABLE_TOOLS = [
 
]

export function FlowDetailEditor({
  flow,
  tasks,
  availableTools = AVAILABLE_TOOLS,
  onUpdateFlow,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onDuplicateTask,
  onReorderTasks,
  onBack,
}: FlowDetailEditorProps) {
  const [isEditingMeta, setIsEditingMeta] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  // Sort tasks by order
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order)

  const allTags = Array.from(new Set([...flow.tags, 'automation', 'analytics', 'processing', 'integration']))

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {flow.name}
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''} • {flow.status}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsEditingMeta(!isEditingMeta)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              {isEditingMeta ? 'Done' : 'Edit'}
            </button>
          </div>

          {/* Editable metadata */}
          {isEditingMeta && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Flow Name
                </label>
                <input
                  type="text"
                  value={flow.name}
                  onChange={(e) => onUpdateFlow?.({ name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={flow.status}
                  onChange={(e) => onUpdateFlow?.({ status: e.target.value as Flow['status'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={flow.description}
                  onChange={(e) => onUpdateFlow?.({ description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        const nextTags = flow.tags.includes(tag)
                          ? flow.tags.filter((t) => t !== tag)
                          : [...flow.tags, tag]
                        onUpdateFlow?.({ tags: nextTags })
                      }}
                      className={`
                        px-3 py-1 rounded-full text-sm font-medium transition-all
                        ${flow.tags.includes(tag)
                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Flow stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Last Run</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {flow.lastRunAt
                ? new Date(flow.lastRunAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Never'
              }
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Tasks</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">{tasks.length}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Valid Tasks</div>
            <div className="font-semibold text-emerald-600">
              {tasks.filter(t => t.status === 'valid').length} / {tasks.length}
            </div>
          </div>
        </div>

        {/* Tasks list */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tasks</h2>
            <button
              onClick={() => {
                setEditingTaskId(null)
                setIsConfigPanelOpen(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Task
            </button>
          </div>

          {sortedTasks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                No tasks yet
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                Start building your flow by adding your first task.
              </p>
              <button
                onClick={() => setIsConfigPanelOpen(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Your First Task
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTasks.map((task, index) => (
                <div key={task.id} className="relative">
                  {/* Add task button between tasks */}
                  {index > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
                      <button
                        onClick={() => {
                          setEditingTaskId(null)
                          setIsConfigPanelOpen(true)
                        }}
                        className="p-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors opacity-0 group-hover:opacity-100"
                        title="Add task here"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="group">
                    <TaskCard
                      task={task}
                      isExpanded={expandedTaskId === task.id}
                      isDraggable={true}
                      onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                      onEdit={() => {
                        setEditingTaskId(task.id)
                        setIsConfigPanelOpen(true)
                      }}
                      onDelete={() => onDeleteTask?.(task.id)}
                      onDuplicate={() => onDuplicateTask?.(task.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flow output info */}
        {sortedTasks.length > 0 && (
          <div className="bg-gradient-to-br from-violet-50 to-amber-50 dark:from-violet-950/30 dark:to-amber-950/30 rounded-xl p-6 border border-violet-200 dark:border-violet-900/50">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Flow Output State</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              All tasks share a mutable flow output object that accumulates data across execution.
            </p>
            <div className="bg-white dark:bg-slate-900 rounded-lg p-4 font-mono text-sm text-slate-700 dark:text-slate-300">
              <span className="text-slate-400">// Accumulated flow state</span><br />
              <span className="text-violet-600 dark:text-violet-400">{`{`}</span><br />
              {sortedTasks
                .filter(t => t.type === 'updateFlowOutput' && t.config?.targetFieldName)
                .map((t, i) => (
                  <span key={t.id} className="ml-4">
                    <span className="text-sky-600 dark:text-sky-400">{t.config?.targetFieldName}</span>
                    {t.config?.isPushable && <span className="text-slate-500">[]</span>}
                    <span className="text-slate-500">: </span>
                    <span className="text-slate-400 italic">{`/* ${t.name} */`}</span>
                    {i < sortedTasks.filter(x => x.type === 'updateFlowOutput' && x.config?.targetFieldName).length - 1 && <span className="text-slate-500">,</span>}
                    <br />
                  </span>
                ))}
              <span className="text-violet-600 dark:text-violet-400">{`}`}</span>
            </div>
          </div>
        )}
      </div>

      {/* Task Config Panel */}
      <TaskConfigPanel
        task={editingTaskId ? tasks.find(t => t.id === editingTaskId) || null : null}
        availableTools={availableTools}
        isOpen={isConfigPanelOpen}
        onClose={() => {
          setIsConfigPanelOpen(false)
          setEditingTaskId(null)
        }}
        onSave={({ name, description, type, config }) => {
          if (editingTaskId) {
            onUpdateTask?.(editingTaskId, { name, description, type, config })
          } else {
            onAddTask?.({
              flowId: flow.id,
              type,
              order: tasks.length + 1,
              name,
              description,
              config,
              status: 'pending',
            })
          }
          setIsConfigPanelOpen(false)
          setEditingTaskId(null)
        }}
      />
    </div>
  )
}
