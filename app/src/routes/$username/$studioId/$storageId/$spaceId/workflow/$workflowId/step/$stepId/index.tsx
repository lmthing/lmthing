import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

function StepDetailPage() {
  const { workflowId, stepId } = Route.useParams()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Step: {stepId}</Heading>
      <Caption muted>Workflow: {workflowId}</Caption>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/workflow/$workflowId/step/$stepId/',
)({
  component: StepDetailPage,
})
