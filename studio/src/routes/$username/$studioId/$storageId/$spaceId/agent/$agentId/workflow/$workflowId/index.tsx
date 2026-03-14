import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

function AgentWorkflowPage() {
  const { agentId, workflowId } = Route.useParams()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Workflow Editor</Heading>
      <Caption muted>
        Agent: {agentId} / Workflow: {workflowId}
      </Caption>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/agent/$agentId/workflow/$workflowId/',
)({
  component: AgentWorkflowPage,
})
