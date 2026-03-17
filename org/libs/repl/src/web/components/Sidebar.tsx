interface SidebarProps {
  tasks: Array<{ id: string; label: string; status: string; elapsed: number }>
  onCancel: (taskId: string, message?: string) => void
  collapsed: boolean
}

const STATUS_COLORS: Record<string, string> = {
  running: 'var(--async-running)',
  completed: 'var(--async-complete)',
  cancelled: 'var(--async-cancelled)',
  failed: 'var(--async-failed)',
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function Sidebar({ tasks, onCancel, collapsed }: SidebarProps) {
  return (
    <div className={`async-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-title">Async Tasks</div>
      {tasks.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 12 }}>
          No active tasks
        </div>
      )}
      {tasks.map(task => (
        <div key={task.id} className="sidebar-task">
          <div className="task-header">
            <span className="task-label">{task.label || task.id}</span>
            <span className="task-elapsed">{formatElapsed(task.elapsed)}</span>
          </div>
          <div className="task-footer">
            <span className="task-status" style={{ color: STATUS_COLORS[task.status] ?? 'var(--text-secondary)' }}>
              {task.status}
            </span>
            {task.status === 'running' && (
              <button className="task-cancel" onClick={() => onCancel(task.id)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
