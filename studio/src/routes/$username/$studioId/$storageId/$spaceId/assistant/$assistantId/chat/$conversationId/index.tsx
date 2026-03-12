import { createFileRoute } from '@tanstack/react-router'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

function ConversationPage() {
  const { assistantId, conversationId } = Route.useParams()
  return (
    <div style={{ padding: '2rem' }}>
      <Heading level={2}>Conversation</Heading>
      <Caption muted>
        Assistant: {assistantId} / Conversation: {conversationId}
      </Caption>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/assistant/$assistantId/chat/$conversationId/',
)({
  component: ConversationPage,
})
