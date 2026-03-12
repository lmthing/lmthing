import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/conversation/')({
  component: ConversationList,
})

function ConversationList() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Conversations</h1>
    </div>
  )
}
