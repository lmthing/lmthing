import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Separator } from '@lmthing/ui/elements/content/separator'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'

export interface RuntimeAssistant {
  id: string
  name: string
  description: string
  fields: string[]
  runtimeFields: Array<{ id: string; label: string }>
  enabledTools: Array<{ toolId: string; name: string; icon: string }>
  lastUsedAt: string | null
}

interface AssistantListProps {
  assistants: RuntimeAssistant[]
  selectedAssistantId?: string | null
  isLoading?: boolean
  onSelectAssistant?: (assistantId: string) => void
}

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return 'never'
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function AssistantCard({ assistant, onClick }: { assistant: RuntimeAssistant; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}>
      <Card interactive style={{ width: '100%', textAlign: 'left' }}>
        <CardBody>
          <Label style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{assistant.name}</Label>
          <Caption muted style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '1rem' }}>
            {assistant.description}
          </Caption>

          <Stack row style={{ justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <Stack row gap="sm">
              <Caption muted>Knowledge:</Caption>
              {assistant.fields.slice(0, 2).map(field => (
                <Badge key={field} variant="muted" style={{ fontSize: '0.625rem' }}>{field}</Badge>
              ))}
              {assistant.fields.length > 2 && <Caption muted>+{assistant.fields.length - 2}</Caption>}
            </Stack>
            <Caption muted>{formatTimestamp(assistant.lastUsedAt)}</Caption>
          </Stack>

          {assistant.runtimeFields.length > 0 && <Separator style={{ margin: '0.75rem 0' }} />}
          {assistant.runtimeFields.length > 0 && (
            <Caption style={{ color: 'var(--color-warning)' }}>
              {assistant.runtimeFields.length} field{assistant.runtimeFields.length > 1 ? 's' : ''} to configure
            </Caption>
          )}

          {assistant.enabledTools.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
              {assistant.enabledTools.slice(0, 4).map(tool => (
                <Badge key={tool.toolId} variant="muted" style={{ fontSize: '0.625rem' }} title={tool.name}>
                  {tool.icon} {tool.name}
                </Badge>
              ))}
              {assistant.enabledTools.length > 4 && <Caption muted>+{assistant.enabledTools.length - 4} more</Caption>}
            </div>
          )}
        </CardBody>
      </Card>
    </button>
  )
}

export function AssistantList({ assistants, isLoading = false, onSelectAssistant }: AssistantListProps) {
  return (
    <Page full>
      <PageHeader style={{ maxWidth: '72rem', margin: '0 auto' }}>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Heading level={2}>Assistant Runtime</Heading>
            <Caption muted>Select an assistant to configure and run conversations</Caption>
          </div>
          <Badge variant="muted">{assistants.length} assistant{assistants.length !== 1 ? 's' : ''} available</Badge>
        </Stack>
      </PageHeader>

      <PageBody style={{ maxWidth: '72rem', margin: '0 auto' }}>
        {isLoading ? (
          <Stack style={{ alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <Caption muted>Loading assistants...</Caption>
          </Stack>
        ) : assistants.length === 0 ? (
          <Stack style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤖</div>
            <Heading level={3}>No Assistants Yet</Heading>
            <Caption muted style={{ maxWidth: '24rem', margin: '0 auto' }}>
              Create and deploy assistants from the Assistant Builder to see them here.
            </Caption>
          </Stack>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
            {assistants.map(assistant => (
              <AssistantCard key={assistant.id} assistant={assistant} onClick={() => onSelectAssistant?.(assistant.id)} />
            ))}
          </div>
        )}
      </PageBody>
    </Page>
  )
}
