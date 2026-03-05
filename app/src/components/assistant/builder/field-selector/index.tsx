interface KnowledgeField {
  id: string
  name: string
  icon?: string
  description?: string
}

interface FieldSelectorProps {
  fields: KnowledgeField[]
  selectedFieldIds: string[]
  onFieldsChange: (fieldIds: string[]) => void
}

export function FieldSelector({ fields, selectedFieldIds, onFieldsChange }: FieldSelectorProps) {
  const toggleField = (fieldId: string) => {
    const isSelected = selectedFieldIds.includes(fieldId)
    const newSelection = isSelected
      ? selectedFieldIds.filter(id => id !== fieldId)
      : [...selectedFieldIds, fieldId]
    onFieldsChange(newSelection)
  }

  return (
    <div style={{ margin: '2rem 0' }}>
      <div className="stack stack--row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <label className="label label--sm">Knowledge Areas</label>
        {selectedFieldIds.length > 0 && (
          <button
            onClick={() => onFieldsChange([])}
            className="caption caption--muted"
            style={{ cursor: 'pointer', border: 'none', background: 'none' }}
          >
            Clear all
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {fields.map(field => {
          const isSelected = selectedFieldIds.includes(field.id)
          return (
            <button
              key={field.id}
              onClick={() => toggleField(field.id)}
              aria-selected={isSelected}
              className={`badge ${isSelected ? 'badge--primary' : 'badge--muted'}`}
              style={{ cursor: 'pointer' }}
              title={field.description}
            >
              {field.icon && <span>{field.icon}</span>}
              <span>{field.name}</span>
              {isSelected && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
      {selectedFieldIds.length === 0 && (
        <p className="caption caption--muted" style={{ marginTop: '0.5rem' }}>
          Select knowledge areas to configure your assistant
        </p>
      )}
    </div>
  )
}
