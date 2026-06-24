import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useAgentList } from '@lmthing/state'
import { AgentCard } from '@lmthing/ui/components/agent/agent-card'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

export const Route = createFileRoute('/$projectId/$spaceId/agent/')({
  component: AgentListPage,
})

function AgentListPage() {
  const params = useParams({ strict: false }) as {
    projectId?: string; spaceId?: string
  }
  const { projectId, spaceId } = params
  const navigate = useNavigate()
  const agents = useAgentList()

  const spacePath = projectId && spaceId
    ? `/${projectId}/${spaceId}`
    : ''

  return (
    <div className="agent-list-page" style={{ padding: '1.5rem' }}>
      <Stack gap="lg">
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Heading level={2}>Agents</Heading>
            <Caption muted>{agents.length} agent{agents.length !== 1 ? 's' : ''}</Caption>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate({ to: `${spacePath}/agent/new` })}
          >
            + New Agent
          </Button>
        </Stack>

        {agents.length === 0 ? (
          <Stack style={{ alignItems: 'center', padding: '3rem 0' }}>
            <Caption muted>No agents yet. Create your first agent.</Caption>
          </Stack>
        ) : (
          <Stack gap="sm">
            {agents.map(a => (
              <div
                key={a.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate({ to: `${spacePath}/agent/${encodeURIComponent(a.id)}` })}
              >
                <AgentCard id={a.id} />
              </div>
            ))}
          </Stack>
        )}
      </Stack>
    </div>
  )
}
