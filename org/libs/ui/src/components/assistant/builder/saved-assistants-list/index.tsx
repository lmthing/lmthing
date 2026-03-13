import '@lmthing/css/components/assistant/builder/index.css'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Card, CardBody, CardFooter } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { PageBody } from '@lmthing/ui/elements/layouts/page'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'

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
        <Stack row className="saved-assistants-list__card-header">
          <div className="saved-assistants-list__card-content">
            <Label className="saved-assistants-list__card-name">{assistant.name}</Label>
            <Caption muted className="saved-assistants-list__card-description">
              {assistant.description}
            </Caption>
          </div>
          <Stack row gap="sm">
            <Button onClick={onDuplicate} variant="ghost" size="sm" title="Duplicate">⧉</Button>
            <Button onClick={onDelete} variant="ghost" size="sm" title="Delete">🗑</Button>
          </Stack>
        </Stack>
        <div className="saved-assistants-list__card-badges">
          {assistantFields.slice(0, 3).map(field => (
            <Badge key={field.id} variant="muted" className="saved-assistants-list__badge-sm">{field.name}</Badge>
          ))}
          {assistantFields.length > 3 && (
            <Badge variant="muted" className="saved-assistants-list__badge-sm">+{assistantFields.length - 3} more</Badge>
          )}
        </div>
        <CardFooter className="saved-assistants-list__card-footer">
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
    <PageBody className="saved-assistants-list">
      <Stack row className="saved-assistants-list__header">
        <div>
          <Heading level={2}>Saved Assistants</Heading>
          <Caption muted className="saved-assistants-list__subtitle">{savedAssistants.length} saved assistant{savedAssistants.length !== 1 ? 's' : ''}</Caption>
        </div>
        <Button onClick={onNewAssistant} variant="primary">+ New Assistant</Button>
      </Stack>

      {savedAssistants.length === 0 ? (
        <Stack className="saved-assistants-list__empty">
          <div className="saved-assistants-list__empty-icon">📦</div>
          <Heading level={3}>No saved assistants yet</Heading>
          <Caption muted className="saved-assistants-list__empty-caption">
            Create your first assistant and save it for quick access later.
          </Caption>
        </Stack>
      ) : (
        <div className="saved-assistants-list__grid">
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
