import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

function AssistantWorkflowPage() {
  const { assistantId, workflowId } = Route.useParams()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Workflow Editor</Heading>
      <Caption muted>
        Assistant: {assistantId} / Workflow: {workflowId}
      </Caption>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/assistant/$assistantId/workflow/$workflowId/',
)({
  component: AssistantWorkflowPage,
})
