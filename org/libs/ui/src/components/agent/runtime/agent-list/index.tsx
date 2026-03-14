import '@lmthing/css/components/agent/runtime/index.css'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Separator } from '@lmthing/ui/elements/content/separator'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'

export interface RuntimeAgent {
  id: string
  name: string
  description: string
  fields: string[]
  runtimeFields: Array<{ id: string; label: string }>
  enabledTools: Array<{ toolId: string; name: string; icon: string }>
  lastUsedAt: string | null
}

interface AgentListProps {
  agents: RuntimeAgent[]
  selectedAgentId?: string | null
  isLoading?: boolean
  onSelectAgent?: (agentId: string) => void
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

function AgentCard({ agent, onClick }: { agent: RuntimeAgent; onClick: () => void }) {
  return (
    <button onClick={onClick} className="agent-card__button">
      <Card interactive className="agent-card">
        <CardBody>
          <Label className="agent-card__name">{agent.name}</Label>
          <Caption muted className="agent-card__description">
            {agent.description}
          </Caption>

          <Stack row className="agent-card__meta-row">
            <Stack row gap="sm">
              <Caption muted>Knowledge:</Caption>
              {agent.fields.slice(0, 2).map(field => (
                <Badge key={field} variant="muted" className="agent-card__badge">{field}</Badge>
              ))}
              {agent.fields.length > 2 && <Caption muted>+{agent.fields.length - 2}</Caption>}
            </Stack>
            <Caption muted>{formatTimestamp(agent.lastUsedAt)}</Caption>
          </Stack>

          {agent.runtimeFields.length > 0 && <Separator className="agent-card__separator" />}
          {agent.runtimeFields.length > 0 && (
            <Caption className="agent-card__fields-warning">
              {agent.runtimeFields.length} field{agent.runtimeFields.length > 1 ? 's' : ''} to configure
            </Caption>
          )}

          {agent.enabledTools.length > 0 && (
            <div className="agent-card__tools">
              {agent.enabledTools.slice(0, 4).map(tool => (
                <Badge key={tool.toolId} variant="muted" className="agent-card__badge" title={tool.name}>
                  {tool.icon} {tool.name}
                </Badge>
              ))}
              {agent.enabledTools.length > 4 && <Caption muted>+{agent.enabledTools.length - 4} more</Caption>}
            </div>
          )}
        </CardBody>
      </Card>
    </button>
  )
}

export function AgentList({ assistants, isLoading = false, onSelectAgent }: AgentListProps) {
  return (
    <Page full>
      <PageHeader className="agent-list__header">
        <Stack row className="agent-list__header-row">
          <div>
            <Heading level={2}>Agent Runtime</Heading>
            <Caption muted>Select an agent to configure and run conversations</Caption>
          </div>
          <Badge variant="muted">{agents.length} agent{agents.length !== 1 ? 's' : ''} available</Badge>
        </Stack>
      </PageHeader>

      <PageBody className="agent-list__body">
        {isLoading ? (
          <Stack className="agent-list__loading">
            <Caption muted>Loading agents...</Caption>
          </Stack>
        ) : agents.length === 0 ? (
          <Stack className="agent-list__empty">
            <div className="agent-list__empty-icon">🤖</div>
            <Heading level={3}>No Agents Yet</Heading>
            <Caption muted className="agent-list__empty-caption">
              Create and deploy agents from the Agent Builder to see them here.
            </Caption>
          </Stack>
        ) : (
          <div className="agent-list__grid">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} onClick={() => onSelectAgent?.(agent.id)} />
            ))}
          </div>
        )}
      </PageBody>
    </Page>
  )
}
