import '@lmthing/css/components/agent/builder/index.css'
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

interface AgentConfigItem {
  id: string
  name: string
  description: string
  selectedFields: string[]
  enabledTools: string[]
  updatedAt: string
}

interface SavedAgentsListProps {
  fields: KnowledgeField[]
  savedAgents: AgentConfigItem[]
  onLoadAgent?: (assistantId: string) => void
  onDuplicateAgent?: (assistantId: string) => void
  onDeleteAgent?: (assistantId: string) => void
  onNewAgent?: () => void
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

function AgentCard({ assistant, fields, onLoad, onDuplicate, onDelete }: {
  assistant: AgentConfigItem; fields: KnowledgeField[]; onLoad?: () => void; onDuplicate?: () => void; onDelete?: () => void
}) {
  const agentFields = fields.filter(f => assistant.selectedFields.includes(f.id))
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
          {agentFields.slice(0, 3).map(field => (
            <Badge key={field.id} variant="muted" className="saved-assistants-list__badge-sm">{field.name}</Badge>
          ))}
          {agentFields.length > 3 && (
            <Badge variant="muted" className="saved-assistants-list__badge-sm">+{agentFields.length - 3} more</Badge>
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

export function SavedAgentsList({ fields, savedAgents, onLoadAgent, onDuplicateAgent, onDeleteAgent, onNewAgent }: SavedAgentsListProps) {
  const sortedAgents = [...savedAgents].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  return (
    <PageBody className="saved-assistants-list">
      <Stack row className="saved-assistants-list__header">
        <div>
          <Heading level={2}>Saved Agents</Heading>
          <Caption muted className="saved-assistants-list__subtitle">{savedAgents.length} saved agent{savedAgents.length !== 1 ? 's' : ''}</Caption>
        </div>
        <Button onClick={onNewAgent} variant="primary">+ New Agent</Button>
      </Stack>

      {savedAgents.length === 0 ? (
        <Stack className="saved-assistants-list__empty">
          <div className="saved-assistants-list__empty-icon">📦</div>
          <Heading level={3}>No saved agents yet</Heading>
          <Caption muted className="saved-assistants-list__empty-caption">
            Create your first assistant and save it for quick access later.
          </Caption>
        </Stack>
      ) : (
        <div className="saved-assistants-list__grid">
          {sortedAgents.map(assistant => (
            <AgentCard
              key={assistant.id}
              assistant={assistant}
              fields={fields}
              onLoad={() => onLoadAgent?.(assistant.id)}
              onDuplicate={() => onDuplicateAgent?.(assistant.id)}
              onDelete={() => onDeleteAgent?.(assistant.id)}
            />
          ))}
        </div>
      )}
    </PageBody>
  )
}
