import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

function AssistantChatPage() {
  const { assistantId } = Route.useParams()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Chat</Heading>
      <Caption muted>Conversation with assistant: {assistantId}</Caption>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/assistant/$assistantId/chat/',
)({
  component: AssistantChatPage,
})
