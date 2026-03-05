export type ToolConfigStatus = 'installed' | 'needs-config' | 'ready'

export interface Tool {
  id: string
  name: string
  description: string
  category: string
  version: string
  package?: string
  configRequired?: boolean
}

export interface EnabledToolMapping {
  tool: Tool
  status: ToolConfigStatus
  source: 'manual' | 'field'
}

interface ToolsPanelProps {
  enabledTools: EnabledToolMapping[]
  onOpenLibrary: () => void
  onRemoveTool: (toolId: string) => void
  onConfigureTool: (toolId: string, config: Record<string, unknown>) => void
}

const statusLabels: Record<ToolConfigStatus, { label: string; badge: string; icon: string }> = {
  installed: { label: 'Installed', badge: 'badge--success', icon: '\u2713' },
  'needs-config': { label: 'Needs Config', badge: 'badge--primary', icon: '\u2699' },
  ready: { label: 'Ready', badge: 'badge--muted', icon: '\u25CF' },
}

export function ToolsPanel({ enabledTools, onOpenLibrary, onRemoveTool, onConfigureTool }: ToolsPanelProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel__header">
        <div className="stack stack--row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="label label--sm">Enabled Tools</h3>
          <button onClick={onOpenLibrary} className="btn btn--primary btn--sm">
            + Add Tools
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {enabledTools.length === 0 ? (
          <div className="stack" style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔧</div>
            <h4 className="label">No tools enabled</h4>
            <p className="caption caption--muted" style={{ maxWidth: '200px', margin: '0 auto' }}>
              Add tools from the library to extend your assistant's capabilities
            </p>
            <button onClick={onOpenLibrary} className="btn btn--ghost btn--sm" style={{ marginTop: '1rem' }}>
              Browse Tool Library
            </button>
          </div>
        ) : (
          <div className="stack stack--gap-sm">
            {enabledTools.map(mapping => (
              <ToolCard
                key={mapping.tool.id}
                mapping={mapping}
                onRemove={mapping.source === 'manual' ? () => onRemoveTool(mapping.tool.id) : undefined}
                onConfigure={() => onConfigureTool(mapping.tool.id, {})}
              />
            ))}
          </div>
        )}
      </div>

      <div className="card__footer">
        <p className="caption caption--muted" style={{ textAlign: 'center' }}>
          Tools are manually enabled from the library
        </p>
      </div>
    </div>
  )
}

interface ToolCardProps {
  mapping: EnabledToolMapping
  onRemove?: () => void
  onConfigure?: () => void
}

function ToolCard({ mapping, onRemove, onConfigure }: ToolCardProps) {
  const status = statusLabels[mapping.status]

  return (
    <div className="card card--interactive">
      <div className="card__body">
        <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.25rem', flexShrink: 0 }}>📦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center', marginBottom: '0.25rem' }}>
              <h4 className="label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mapping.tool.name}
              </h4>
              <span className={`badge ${status.badge}`} style={{ fontSize: '0.625rem' }}>
                {status.icon} {status.label}
              </span>
            </div>
            <p className="caption caption--muted" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {mapping.tool.description}
            </p>
            <div className="stack stack--row stack--gap-sm" style={{ marginTop: '0.5rem' }}>
              <span className="badge badge--muted" style={{ fontSize: '0.625rem' }}>{mapping.tool.category}</span>
              <span className="caption caption--muted">v{mapping.tool.version}</span>
            </div>
          </div>
          <div className="stack stack--gap-sm" style={{ opacity: 0 }}>
            {mapping.tool.configRequired && mapping.status !== 'ready' && (
              <button onClick={onConfigure} className="btn btn--ghost btn--sm" title="Configure tool">⚙</button>
            )}
            {mapping.source === 'manual' && onRemove && (
              <button onClick={onRemove} className="btn btn--ghost btn--sm" title="Remove tool">✕</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
