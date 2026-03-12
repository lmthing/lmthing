import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

function WorkflowDetailPage() {
  const { workflowId } = Route.useParams()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Workflow: {workflowId}</Heading>
      <Caption muted>Edit workflow steps and configuration.</Caption>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/workflow/$workflowId/',
)({
  component: WorkflowDetailPage,
})
