import type { Flow, Task } from '@/../product/sections/flow-builder/types'
import { FlowDetailEditor } from '@/sections/flow-builder/components'

interface FlowEditorModalProps {
  isOpen: boolean
  onClose: () => void
  flow: Flow
  tasks: Task[]
  onUpdateFlow?: (updates: Partial<Flow>) => void
  onAddTask?: (task: Omit<Task, 'id'>) => void
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void
  onDeleteTask?: (taskId: string) => void
  onDuplicateTask?: (taskId: string) => void
  onReorderTasks?: (taskIds: string[]) => void
}

export function FlowEditorModal({
  isOpen,
  onClose,
  flow,
  tasks,
  onUpdateFlow,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onDuplicateTask,
  onReorderTasks,
}: FlowEditorModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col m-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <FlowDetailEditor
            flow={flow}
            tasks={tasks}
            onUpdateFlow={onUpdateFlow}
            onAddTask={onAddTask}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onDuplicateTask={onDuplicateTask}
            onReorderTasks={onReorderTasks}
            onBack={onClose}
          />
        </div>
      </div>
    </div>
  )
}
