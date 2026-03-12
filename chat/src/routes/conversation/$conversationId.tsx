import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/conversation/$conversationId')({
  component: ConversationDetail,
})

function ConversationDetail() {
  const { conversationId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Conversation: {conversationId}</h1>
    </div>
  )
}
