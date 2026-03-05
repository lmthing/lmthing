import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'

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
      <Stack row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Label compact>Knowledge Areas</Label>
        {selectedFieldIds.length > 0 && (
          <button onClick={() => onFieldsChange([])} style={{ cursor: 'pointer', border: 'none', background: 'none' }}>
            <Caption muted>Clear all</Caption>
          </button>
        )}
      </Stack>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {fields.map(field => {
          const isSelected = selectedFieldIds.includes(field.id)
          return (
            <button
              key={field.id}
              onClick={() => toggleField(field.id)}
              aria-selected={isSelected}
              style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
              title={field.description}
            >
              <Badge variant={isSelected ? 'primary' : 'muted'}>
                {field.icon && <span>{field.icon}</span>}
                <span>{field.name}</span>
                {isSelected && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </Badge>
            </button>
          )
        })}
      </div>
      {selectedFieldIds.length === 0 && (
        <Caption muted style={{ marginTop: '0.5rem', display: 'block' }}>
          Select knowledge areas to configure your assistant
        </Caption>
      )}
    </div>
  )
}
