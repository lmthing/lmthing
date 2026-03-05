export interface AttachedWorkflow {
  workflowId: string
  workflowName: string
  stepCount: number
  slashAction: {
    id: string
    actionId: string
    name: string
    description: string
    enabled: boolean
  }
}

interface ActionsPanelProps {
  attachedWorkflows: AttachedWorkflow[]
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEditAction: (slashActionId: string) => void
  onDetachWorkflow: (slashActionId: string) => void
  onOpenWorkflowBuilder: () => void
}

export function ActionsPanel({
  attachedWorkflows,
  onToggleEnabled,
  onEditAction,
  onDetachWorkflow,
  onOpenWorkflowBuilder,
}: ActionsPanelProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel__header">
        <div className="stack stack--row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="label label--sm">Slash Actions</h3>
            <p className="caption caption--muted">Attach workflows with custom triggers</p>
          </div>
          <button onClick={onOpenWorkflowBuilder} className="btn btn--primary btn--sm">
            + Attach Workflow
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {attachedWorkflows.length === 0 ? (
          <div className="stack" style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
            <h4 className="label">No actions attached</h4>
            <p className="caption caption--muted" style={{ maxWidth: '200px', margin: '0 auto 1rem' }}>
              Attach workflows to give users quick access to multi-step tasks
            </p>
            <button onClick={onOpenWorkflowBuilder} className="btn btn--ghost btn--sm">
              Attach Your First Workflow
            </button>
          </div>
        ) : (
          <div className="stack stack--gap-sm">
            {attachedWorkflows.map(workflow => (
              <SlashActionCard
                key={workflow.slashAction.id}
                workflow={workflow}
                onToggleEnabled={onToggleEnabled}
                onEdit={onEditAction}
                onDetach={onDetachWorkflow}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card__footer">
        <p className="caption caption--muted" style={{ textAlign: 'center' }}>
          Actions are invoked with <code className="code-inline">/action</code>
        </p>
      </div>
    </div>
  )
}

interface SlashActionCardProps {
  workflow: AttachedWorkflow
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEdit: (slashActionId: string) => void
  onDetach: (slashActionId: string) => void
}

function SlashActionCard({ workflow, onToggleEnabled, onEdit, onDetach }: SlashActionCardProps) {
  return (
    <div className="card card--interactive">
      <div className="card__body">
        <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center', marginBottom: '0.25rem' }}>
              <code className="code-inline">/{workflow.slashAction.actionId}</code>
              <span className={`badge ${workflow.slashAction.enabled ? 'badge--success' : 'badge--muted'}`} style={{ fontSize: '0.625rem' }}>
                {workflow.slashAction.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <h4 className="label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {workflow.slashAction.name}
            </h4>
            <p className="caption caption--muted" style={{ marginTop: '0.125rem' }}>
              {workflow.slashAction.description}
            </p>
            <div className="stack stack--row stack--gap-sm" style={{ marginTop: '0.5rem' }}>
              <span className="badge badge--muted" style={{ fontSize: '0.625rem' }}>
                {workflow.stepCount} step{workflow.stepCount > 1 ? 's' : ''}
              </span>
              <span className="caption caption--muted">{workflow.workflowName}</span>
            </div>
          </div>
          <div className="stack stack--gap-sm">
            <button
              onClick={() => onToggleEnabled(workflow.slashAction.id, !workflow.slashAction.enabled)}
              className="btn btn--ghost btn--sm"
              title={workflow.slashAction.enabled ? 'Disable' : 'Enable'}
            >
              {workflow.slashAction.enabled ? '✓' : '○'}
            </button>
            <button onClick={() => onEdit(workflow.slashAction.id)} className="btn btn--ghost btn--sm" title="Edit">✎</button>
            <button onClick={() => onDetach(workflow.slashAction.id)} className="btn btn--ghost btn--sm" title="Detach">✕</button>
          </div>
        </div>
      </div>
    </div>
  )
}
