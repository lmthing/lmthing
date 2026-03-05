interface KnowledgeField {
  id: string
  name: string
  category?: string
}

interface AssistantConfigItem {
  id: string
  name: string
  description: string
  selectedFields: string[]
  enabledTools: string[]
  updatedAt: string
}

interface SavedAssistantsListProps {
  fields: KnowledgeField[]
  savedAssistants: AssistantConfigItem[]
  onLoadAssistant?: (assistantId: string) => void
  onDuplicateAssistant?: (assistantId: string) => void
  onDeleteAssistant?: (assistantId: string) => void
  onNewAssistant?: () => void
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString()
}

function AssistantCard({
  assistant,
  fields,
  onLoad,
  onDuplicate,
  onDelete,
}: {
  assistant: AssistantConfigItem
  fields: KnowledgeField[]
  onLoad?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  const assistantFields = fields.filter(f => assistant.selectedFields.includes(f.id))

  return (
    <div className="card card--interactive">
      <div className="card__body">
        <div className="stack stack--row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="label" style={{ fontWeight: 600 }}>{assistant.name}</h3>
            <p className="caption caption--muted" style={{ marginTop: '0.25rem', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {assistant.description}
            </p>
          </div>
          <div className="stack stack--row stack--gap-sm">
            <button onClick={onDuplicate} className="btn btn--ghost btn--sm" title="Duplicate">⧉</button>
            <button onClick={onDelete} className="btn btn--ghost btn--sm" title="Delete">🗑</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
          {assistantFields.slice(0, 3).map(field => (
            <span key={field.id} className="badge badge--muted" style={{ fontSize: '0.625rem' }}>
              {field.name}
            </span>
          ))}
          {assistantFields.length > 3 && (
            <span className="badge badge--muted" style={{ fontSize: '0.625rem' }}>
              +{assistantFields.length - 3} more
            </span>
          )}
        </div>

        <div className="card__footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="stack stack--row stack--gap-sm">
            <span className="caption caption--muted">🔧 {assistant.enabledTools.length} tools</span>
            <span className="caption caption--muted">🕐 {formatDate(assistant.updatedAt)}</span>
          </div>
          <button onClick={onLoad} className="btn btn--ghost btn--sm">
            Load →
          </button>
        </div>
      </div>
    </div>
  )
}

export function SavedAssistantsList({
  fields,
  savedAssistants,
  onLoadAssistant,
  onDuplicateAssistant,
  onDeleteAssistant,
  onNewAssistant,
}: SavedAssistantsListProps) {
  const sortedAssistants = [...savedAssistants].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div className="page__body" style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.5rem' }}>
      <div className="stack stack--row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="heading-2">Saved Assistants</h1>
          <p className="caption caption--muted" style={{ marginTop: '0.25rem' }}>
            {savedAssistants.length} saved assistant{savedAssistants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={onNewAssistant} className="btn btn--primary">
          + New Assistant
        </button>
      </div>

      {savedAssistants.length === 0 ? (
        <div className="stack" style={{ textAlign: 'center', padding: '4rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📦</div>
          <h3 className="heading-3">No saved assistants yet</h3>
          <p className="caption caption--muted" style={{ maxWidth: '28rem', margin: '0.5rem auto 0' }}>
            Create your first assistant and save it for quick access later.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {sortedAssistants.map(assistant => (
            <AssistantCard
              key={assistant.id}
              assistant={assistant}
              fields={fields}
              onLoad={() => onLoadAssistant?.(assistant.id)}
              onDuplicate={() => onDuplicateAssistant?.(assistant.id)}
              onDelete={() => onDeleteAssistant?.(assistant.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
