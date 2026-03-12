/**
 * FieldSelector - Rich knowledge field selector with metadata.
 * Phase 5: Shows each field as a toggleable card with title, description, entry count.
 */
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { useKnowledgeField } from '@/hooks/useKnowledgeField'
import type { DomainMeta } from '@/hooks/useKnowledgeFields'

export interface FieldSelectorProps {
  fields: DomainMeta[]
  selectedIds: string[]
  onToggle: (fieldId: string) => void
}

function FieldCard({ field, selected, onToggle }: {
  field: DomainMeta
  selected: boolean
  onToggle: () => void
}) {
  const knowledge = useKnowledgeField(field.id)
  const title = knowledge.config?.title || field.id
  const description = knowledge.config?.description
  const entryCount = knowledge.entries.length

  return (
    <Card
      interactive
      onClick={onToggle}
      style={{ cursor: 'pointer' }}
    >
      <CardBody>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Label>{title}</Label>
            {description && (
              <Caption muted style={{ marginTop: '0.125rem' }}>{description}</Caption>
            )}
            <Caption muted style={{ marginTop: '0.125rem' }}>
              {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            </Caption>
          </div>
          <Badge variant={selected ? 'primary' : 'muted'}>
            {selected ? 'Selected' : 'Add'}
          </Badge>
        </Stack>
      </CardBody>
    </Card>
  )
}

export function FieldSelector({ fields, selectedIds, onToggle }: FieldSelectorProps) {
  if (fields.length === 0) {
    return <Caption muted>No knowledge fields available.</Caption>
  }

  return (
    <Stack gap="sm">
      {fields.map(field => (
        <FieldCard
          key={field.id}
          field={field}
          selected={selectedIds.includes(field.id)}
          onToggle={() => onToggle(field.id)}
        />
      ))}
    </Stack>
  )
}
