interface SidebarProps {
  tasks: Array<{ id: string; label: string; status: string; elapsed: number }>
  onCancel: (taskId: string, message?: string) => void
  collapsed: boolean
}

const STATUS_COLORS: Record<string, string> = {
  running: 'var(--twv-async-running)',
  completed: 'var(--twv-async-complete)',
  cancelled: 'var(--twv-async-cancelled)',
  failed: 'var(--twv-async-failed)',
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function Sidebar({ tasks, onCancel, collapsed }: SidebarProps) {
  return (
    <div className={`twv-async-sidebar ${collapsed ? 'twv-async-sidebar--collapsed' : ''}`}>
      <div className="twv-sidebar-title">Async Tasks</div>
      {tasks.length === 0 && (
        <div style={{ color: 'var(--twv-text-secondary)', fontStyle: 'italic', fontSize: 12 }}>
          No active tasks
        </div>
      )}
      {tasks.map(task => (
        <div key={task.id} className="twv-sidebar-task">
          <div className="twv-sidebar-task__header">
            <span className="twv-sidebar-task__label">{task.label || task.id}</span>
            <span className="twv-sidebar-task__elapsed">{formatElapsed(task.elapsed)}</span>
          </div>
          <div className="twv-sidebar-task__footer">
            <span className="twv-sidebar-task__status" style={{ color: STATUS_COLORS[task.status] ?? 'var(--twv-text-secondary)' }}>
              {task.status}
            </span>
            {task.status === 'running' && (
              <button className="twv-sidebar-task__cancel" onClick={() => onCancel(task.id)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
