export interface AsyncSidebarProps {
  tasks: Array<{
    id: string;
    label: string;
    status: string;
    elapsed: number;
  }>;
  onCancel?: (taskId: string) => void;
}

export function AsyncSidebar({ tasks, onCancel }: AsyncSidebarProps) {
  const formatElapsed = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const statusColor = (status: string): string => {
    switch (status) {
      case 'running':
        return '#3182ce';
      case 'done':
        return '#38a169';
      case 'error':
        return '#e53e3e';
      case 'cancelled':
        return '#a0aec0';
      default:
        return '#718096';
    }
  };

  return (
    <div
      style={{
        width: 260,
        padding: 12,
        borderLeft: '1px solid #e2e8f0',
        backgroundColor: '#f7fafc',
        fontFamily: 'sans-serif',
        fontSize: 13,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#718096',
          marginBottom: 12,
        }}
      >
        Async Tasks
      </div>
      {tasks.length === 0 && (
        <div style={{ color: '#a0aec0', fontStyle: 'italic', fontSize: 12 }}>
          No active tasks
        </div>
      )}
      {tasks.map((task) => (
        <div
          key={task.id}
          style={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            padding: '10px 12px',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <span style={{ fontWeight: 500, color: '#2d3748' }}>{task.label}</span>
            <span style={{ fontSize: 11, color: '#a0aec0' }}>
              {formatElapsed(task.elapsed)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: statusColor(task.status),
              }}
            >
              {task.status}
            </span>
            {onCancel && task.status === 'running' && (
              <button
                onClick={() => onCancel(task.id)}
                style={{
                  background: 'none',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  color: '#e53e3e',
                  cursor: 'pointer',
                  fontSize: 11,
                  padding: '1px 8px',
                  lineHeight: '18px',
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
