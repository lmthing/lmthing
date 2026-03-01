import { useEffect, useState } from 'react'
import type { Task, TaskType, TaskConfig, PromptFragmentField, JSONSchema } from '@/../product/sections/flow-builder/types'
import { JsonSchemaEditor } from './JsonSchemaEditor'

interface TaskConfigPanelProps {
  task: Task | null
  availableTools: Array<{ id: string; name: string; description: string }>
  availablePromptFragments?: Array<{ id: string; name: string; description: string }>
  isOpen: boolean
  onClose: () => void
  onSave: (updates: { name: string; description: string; type: TaskType; config: TaskConfig }) => void
}

const TASK_TYPES: { type: TaskType; label: string; description: string; passesData: boolean }[] = [
  {
    type: 'updateFlowOutput',
    label: 'Update Flow Output',
    description: 'Update a specific key in the flow output with structured LLM output',
    passesData: true
  },
  {
    type: 'executeTask',
    label: 'Execute Task',
    description: 'Perform operations without adding structured output to the flow state',
    passesData: false
  },
]

export function TaskConfigPanel({ task, availableTools, availablePromptFragments = [], isOpen, onClose, onSave }: TaskConfigPanelProps) {
  const [selectedType, setSelectedType] = useState<TaskType>(task?.type || 'updateFlowOutput')
  const [taskName, setTaskName] = useState(task?.name || '')
  const [taskDescription, setTaskDescription] = useState(task?.description || '')

  // Config states for updateFlowOutput
  const [outputSchema, setOutputSchema] = useState<JSONSchema | null>(
    task?.config?.outputSchema || null
  )
  const [targetFieldName, setTargetFieldName] = useState(task?.config?.targetFieldName || '')
  const [isPushable, setIsPushable] = useState(task?.config?.isPushable ?? false)

  // Prompt fragment fields
  const [promptFragmentFields, setPromptFragmentFields] = useState<PromptFragmentField[]>(
    task?.config?.promptFragmentFields || []
  )

  // Shared config states
  const [enabledTools, setEnabledTools] = useState<string[]>(task?.config?.enabledTools || [])
  const [taskInstructions, setTaskInstructions] = useState(task?.config?.taskInstructions || '')
  const [model, setModel] = useState(task?.config?.model || 'claude-3-5-sonnet')
  const [temperature, setTemperature] = useState(task?.config?.temperature ?? 0.7)

  // Sync form state with task prop when it changes (e.g., when editing different tasks)
  useEffect(() => {
    if (task) {
      setSelectedType(task.type)
      setTaskName(task.name)
      setTaskDescription(task.description)
      setOutputSchema(task.config?.outputSchema || null)
      setTargetFieldName(task.config?.targetFieldName || '')
      setIsPushable(task.config?.isPushable ?? false)
      setPromptFragmentFields(task.config?.promptFragmentFields || [])
      setEnabledTools(task.config?.enabledTools || [])
      setTaskInstructions(task.config?.taskInstructions || '')
      setModel(task.config?.model || 'claude-3-5-sonnet')
      setTemperature(task.config?.temperature ?? 0.7)
    } else {
      // Reset for new task
      setSelectedType('updateFlowOutput')
      setTaskName('')
      setTaskDescription('')
      setOutputSchema(null)
      setTargetFieldName('')
      setIsPushable(false)
      setPromptFragmentFields([])
      setEnabledTools([])
      setTaskInstructions('')
      setModel('claude-3-5-sonnet')
      setTemperature(0.7)
    }
  }, [task?.id, isOpen])

  if (!isOpen) return null

  const isEditMode = task !== null
  const taskConfig = TASK_TYPES.find(t => t.type === selectedType)

  const handleSave = () => {
    const config: TaskConfig = {
      model,
      temperature,
    }

    // updateFlowOutput specific fields
    if (selectedType === 'updateFlowOutput') {
      if (!targetFieldName.trim()) {
        // In real app would show validation error
        return
      }
      config.targetFieldName = targetFieldName.trim()

      if (isPushable) {
        config.isPushable = true
      }

      if (outputSchema) {
        config.outputSchema = outputSchema
      }
    }

    // Prompt fragment fields
    if (promptFragmentFields.length > 0) {
      config.promptFragmentFields = promptFragmentFields
    }

    // Enabled tools
    if (enabledTools.length > 0) {
      config.enabledTools = enabledTools
    }

    // Task instructions
    if (taskInstructions.trim()) {
      config.taskInstructions = taskInstructions.trim()
    }

    onSave({
      name: taskName.trim() || 'New Task',
      description: taskDescription.trim(),
      type: selectedType,
      config,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {isEditMode ? 'Edit Task' : 'Add Task'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure task settings and behavior
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Task Type Selector */}
          {!isEditMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Task Type
              </label>
              <div className="grid grid-cols-1 gap-3">
                {TASK_TYPES.map(({ type, label, description, passesData }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`
                      p-4 rounded-xl border-2 text-left transition-all
                      ${selectedType === type
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 ring-2 ring-violet-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{label}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</div>
                      </div>
                      {passesData && (
                        <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 17L17 7M7 7h10v10" />
                          </svg>
                          Passes Data
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name & Description */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Task Name
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g., Extract Customer Data"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Briefly describe what this task does..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>

          {/* Task Configuration */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-6">
            {/* updateFlowOutput specific fields */}
            {selectedType === 'updateFlowOutput' && (
              <>
                {/* Target Field Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Target Field Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={targetFieldName}
                    onChange={(e) => setTargetFieldName(e.target.value)}
                    placeholder="e.g., customerAnalysis, extractedData"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    The key in the flow output object where this task's LLM output will be stored
                  </p>
                </div>

                {/* Is Pushable */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl">
                  <button
                    onClick={() => setIsPushable(!isPushable)}
                    className={`
                      relative w-12 h-6 rounded-full transition-colors
                      ${isPushable ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-700'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                        ${isPushable ? 'translate-x-7' : 'translate-x-1'}
                      `}
                    />
                  </button>
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100">Add to Existing List</div>
                    <div className="text-sm text-slate-500">
                      Turn this on if you want the AI to add new items to a list you started in a previous step, rather than replacing it.
                    </div>
                  </div>
                </div>

                {/* Output Schema */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Expected Output Format
                  </label>
                  <JsonSchemaEditor
                    value={outputSchema}
                    onChange={setOutputSchema}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Tell the AI exactly how to format its answer so you can use it in the next step.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Text (Paragraph / Word): Best for titles, descriptions, or summaries.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    List of Items: Best for learning objectives, steps, or multiple ideas. The AI will output distinct bullet points.
                  </p>
                </div>
              </>
            )}

            {/* Prompt Fragment Fields */}
            {(availablePromptFragments.length > 0 || promptFragmentFields.length > 0) && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Prompt Fragments
                </label>
                <div className="space-y-2">
                  {promptFragmentFields.map((pf, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg">
                      <span className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-300">
                        {pf.fragmentId}
                      </span>
                      <button
                        onClick={() => setPromptFragmentFields(prev => prev.filter((_, i) => i !== index))}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {availablePromptFragments.length > 0 && (
                    <button
                      onClick={() => {
                        const fragment = availablePromptFragments[0]
                        if (fragment) {
                          setPromptFragmentFields(prev => [
                            ...prev,
                            { fragmentId: fragment.id, fieldValues: {} }
                          ])
                        }
                      }}
                      className="w-full p-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-violet-500 hover:text-violet-500 transition-colors text-sm"
                    >
                      + Add Prompt Fragment
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Enable specific prompt fragments based on field values
                </p>
              </div>
            )}

            {/* Enabled Tools */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Enabled Tools
              </label>
              <div className="grid grid-cols-2 gap-2">
                {availableTools.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setEnabledTools(prev =>
                        prev.includes(tool.id)
                          ? prev.filter(id => id !== tool.id)
                          : [...prev, tool.id]
                      )
                    }}
                    className={`
                      p-3 rounded-lg text-left text-sm transition-all
                      ${enabledTools.includes(tool.id)
                        ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }
                    `}
                  >
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{tool.name}</div>
                    <div className="text-xs text-slate-500 truncate">{tool.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Task Instructions */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Task Instructions
              </label>
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4">
                <textarea
                  value={taskInstructions}
                  onChange={(e) => setTaskInstructions(e.target.value)}
                  rows={4}
                  className="w-full text-sm bg-transparent text-slate-700 dark:text-slate-300 resize-none focus:outline-none"
                  placeholder="Describe what this task should do..."
                />
              </div>
              <div className="mt-2 p-2 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span className="font-semibold">Template variables:</span>
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded">{`{{input}}`}</code>
                  <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded">{`{{previousTask.taskId.field}}`}</code>
                  <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded">{`{{flow.output.field}}`}</code>
                  <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded">{`{{now}}`}</code>
                  <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded">{`{{agent.name}}`}</code>
                </div>
              </div>
            </div>

            {/* Model Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Model
                </label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="claude-3-haiku">Claude 3 Haiku</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full mt-3 accent-violet-500"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg font-medium bg-violet-500 text-white hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25"
          >
            {isEditMode ? 'Save Changes' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
