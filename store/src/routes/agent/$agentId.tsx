import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/agent/$agentId')({
  component: AgentDetail,
})

function AgentDetail() {
  const { agentId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Agent: {agentId}</h1>
    </div>
  )
}
