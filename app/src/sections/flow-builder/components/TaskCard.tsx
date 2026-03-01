import type { Task, TaskType, TaskConfig } from '@/../product/sections/flow-builder/types'

interface TaskCardProps {
  task: Task
  isExpanded: boolean
  isDraggable: boolean
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
}

const TASK_TYPE_CONFIG: Record<TaskType, { label: string; icon: string; color: string; passesData: boolean }> = {
  'updateFlowOutput': { label: 'Update Output', icon: '↗', color: 'violet', passesData: true },
  'executeTask': { label: 'Execute', icon: '⚡', color: 'amber', passesData: false },
}

function formatDate(isoString: string | null): string {
  if (!isoString) return 'Never'
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TaskCard({ task, isExpanded, isDraggable, onClick, onEdit, onDelete, onDuplicate }: TaskCardProps) {
  const config = TASK_TYPE_CONFIG[task.type]
  const isValid = task.status === 'valid'

  return (
    <div
      className={`
        relative group transition-all duration-200
        ${isExpanded ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900' : ''}
      `}
    >
      {/* Connector line from above */}
      <div className="absolute -top-4 left-6 w-px h-4 bg-gradient-to-b from-transparent via-slate-300 to-slate-300 dark:via-slate-700 dark:to-slate-700" />

      {/* Main card */}
      <div
        onClick={onClick}
        className={`
          relative bg-white dark:bg-slate-900 rounded-xl border-2 transition-all duration-200 cursor-pointer
          ${isValid ? 'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700' : 'border-red-300 dark:border-red-900'}
          hover:shadow-lg hover:shadow-violet-500/5
        `}
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-4">
            {/* Drag handle */}
            {isDraggable && (
              <div className="flex items-center justify-center w-8 h-8 mt-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>
              </div>
            )}

            {/* Task type indicator */}
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-lg
              bg-${config.color}-100 dark:bg-${config.color}-900/30
              text-${config.color}-600 dark:text-${config.color}-400
              font-mono text-sm font-semibold
            `}>
              {config.icon}
            </div>

            {/* Task info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {task.name}
                </h3>
                <span className={`
                  px-2 py-0.5 text-xs font-medium rounded-full
                  bg-${config.color}-100 dark:bg-${config.color}-900/30
                  text-${config.color}-700 dark:text-${config.color}-300
                `}>
                  {config.label}
                </span>
                {config.passesData && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 17L17 7M7 7h10v10" />
                    </svg>
                    Passes Data
                  </span>
                )}
                {!isValid && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                    Invalid
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                {task.description}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                title="Edit task"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                title="Duplicate task"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Delete task"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <TaskConfigPreview task={task} />
            </div>
          )}
        </div>

        {/* Order badge */}
        <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">
          {task.order}
        </div>
      </div>

      {/* Connector line to below - only show if this task passes data to next */}
      {config.passesData && (
        <div className="absolute -bottom-4 left-6 w-px h-4 bg-gradient-to-b from-violet-400 via-violet-400 to-transparent dark:from-violet-600 dark:via-violet-600" />
      )}
    </div>
  )
}

function TaskConfigPreview({ task }: { task: Task }) {
  const config = task.config as TaskConfig

  const hasTargetFieldName = config.targetFieldName !== undefined
  const hasOutputSchema = config.outputSchema !== undefined
  const hasPromptFragments = config.promptFragmentFields && config.promptFragmentFields.length > 0
  const hasTools = config.enabledTools && config.enabledTools.length > 0
  const hasInstructions = config.taskInstructions && config.taskInstructions.length > 0
  const hasModel = config.model !== undefined
  const isPushable = config.isPushable === true

  return (
    <div className="space-y-4">
      {/* Target Field Name (updateFlowOutput only) */}
      {task.type === 'updateFlowOutput' && hasTargetFieldName && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <svg className="w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Target Field
            {isPushable && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                Add to Existing List
              </span>
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-2 text-sm">
            <span className="font-mono text-sky-600 dark:text-sky-400">{config.targetFieldName}</span>
            {isPushable && <span className="text-slate-500 ml-1">[]</span>}
          </div>
        </div>
      )}

      {/* Output Schema (updateFlowOutput only) */}
      {task.type === 'updateFlowOutput' && hasOutputSchema && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <svg className="w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            Expected Output Format
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-3 font-mono text-sm">
            <div className="text-violet-600 dark:text-violet-400">{`{`}</div>
            {config.outputSchema?.properties && Object.entries(config.outputSchema.properties).map(([key, value]: [string, any]) => (
              <div key={key} className="ml-4 text-slate-700 dark:text-slate-300">
                <span className="text-sky-600 dark:text-sky-400">{key}</span>
                {config.outputSchema?.required?.includes(key) && <span className="text-amber-500">*</span>}
                <span className="text-slate-500">: </span>
                <span className="text-emerald-600 dark:text-emerald-400">{value.type}</span>
                {value.enum && <span className="text-slate-500 ml-2">enum: [{value.enum.join(', ')}]</span>}
              </div>
            ))}
            <div className="text-violet-600 dark:text-violet-400">{`}`}</div>
          </div>
        </div>
      )}

      {/* Prompt Fragment Fields */}
      {hasPromptFragments && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <svg className="w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            Prompt Fragments ({config.promptFragmentFields!.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {config.promptFragmentFields!.map((pf, i) => (
              <span key={i} className="px-2 py-1 text-xs rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-mono">
                {pf.fragmentId}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Enabled Tools */}
      {hasTools && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
            Enabled Tools ({config.enabledTools!.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {config.enabledTools!.map((tool, i) => (
              <span key={i} className="px-2 py-1 text-xs rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-mono">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Task Instructions */}
      {hasInstructions && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <svg className="w-4 h-4 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Task Instructions
          </div>
          <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-3 max-h-32 overflow-y-auto">
            <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
              {config.taskInstructions}
            </p>
          </div>
        </div>
      )}

      {/* Model Settings */}
      {hasModel && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span className="font-mono">{config.model}</span>
          </div>
          {config.temperature !== undefined && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span>Temperature:</span>
              <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full" style={{ width: `${config.temperature * 100}%` }} />
              </div>
              <span className="text-xs">{config.temperature}</span>
            </div>
          )}
        </div>
      )}

      {/* No configuration */}
      {!hasTargetFieldName && !hasOutputSchema && !hasPromptFragments && !hasTools && !hasInstructions && !hasModel && (
        <div className="text-sm text-slate-500 dark:text-slate-400 italic">
          No configuration set
        </div>
      )}
    </div>
  )
}
