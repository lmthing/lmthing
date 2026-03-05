import { Button } from '@/elements/forms/button'
import { Card, CardBody, CardFooter } from '@/elements/content/card'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { PageBody } from '@/elements/layouts/page'
import { Heading } from '@/elements/typography/heading'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'

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
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString()
}

function AssistantCard({ assistant, fields, onLoad, onDuplicate, onDelete }: {
  assistant: AssistantConfigItem; fields: KnowledgeField[]; onLoad?: () => void; onDuplicate?: () => void; onDelete?: () => void
}) {
  const assistantFields = fields.filter(f => assistant.selectedFields.includes(f.id))
  return (
    <Card interactive>
      <CardBody>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Label style={{ fontWeight: 600 }}>{assistant.name}</Label>
            <Caption muted style={{ marginTop: '0.25rem', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {assistant.description}
            </Caption>
          </div>
          <Stack row gap="sm">
            <Button onClick={onDuplicate} variant="ghost" size="sm" title="Duplicate">⧉</Button>
            <Button onClick={onDelete} variant="ghost" size="sm" title="Delete">🗑</Button>
          </Stack>
        </Stack>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
          {assistantFields.slice(0, 3).map(field => (
            <Badge key={field.id} variant="muted" style={{ fontSize: '0.625rem' }}>{field.name}</Badge>
          ))}
          {assistantFields.length > 3 && (
            <Badge variant="muted" style={{ fontSize: '0.625rem' }}>+{assistantFields.length - 3} more</Badge>
          )}
        </div>
        <CardFooter style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack row gap="sm">
            <Caption muted>🔧 {assistant.enabledTools.length} tools</Caption>
            <Caption muted>🕐 {formatDate(assistant.updatedAt)}</Caption>
          </Stack>
          <Button onClick={onLoad} variant="ghost" size="sm">Load →</Button>
        </CardFooter>
      </CardBody>
    </Card>
  )
}

export function SavedAssistantsList({ fields, savedAssistants, onLoadAssistant, onDuplicateAssistant, onDeleteAssistant, onNewAssistant }: SavedAssistantsListProps) {
  const sortedAssistants = [...savedAssistants].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return (
    <PageBody style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.5rem' }}>
      <Stack row style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <Heading level={2}>Saved Assistants</Heading>
          <Caption muted style={{ marginTop: '0.25rem' }}>{savedAssistants.length} saved assistant{savedAssistants.length !== 1 ? 's' : ''}</Caption>
        </div>
        <Button onClick={onNewAssistant} variant="primary">+ New Assistant</Button>
      </Stack>

      {savedAssistants.length === 0 ? (
        <Stack style={{ textAlign: 'center', padding: '4rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📦</div>
          <Heading level={3}>No saved assistants yet</Heading>
          <Caption muted style={{ maxWidth: '28rem', margin: '0.5rem auto 0' }}>
            Create your first assistant and save it for quick access later.
          </Caption>
        </Stack>
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
    </PageBody>
  )
}
