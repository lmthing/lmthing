import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

function ConversationPage() {
  const { agentId, conversationId } = Route.useParams()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Conversation</Heading>
      <Caption muted>
        Agent: {agentId} / Conversation: {conversationId}
      </Caption>
    </div>
  )
}

export const Route = createFileRoute(
  '/$projectId/$spaceId/agent/$agentId/chat/$conversationId/',
)({
  component: ConversationPage,
})
