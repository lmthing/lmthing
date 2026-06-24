import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { TasklistEditor } from '@lmthing/ui/components/workflow'

function AgentTasklistPage() {
  const params = useParams({ strict: false }) as {
    projectId?: string; spaceId?: string
    agentId?: string; workflowId?: string
  }
  const { projectId, spaceId, agentId, workflowId } = params
  const navigate = useNavigate()

  const spacePath = projectId && spaceId
    ? `/${projectId}/${spaceId}`
    : ''

  const handleBack = () => {
    if (agentId) {
      navigate({ to: `${spacePath}/agent/${encodeURIComponent(agentId)}` })
    } else {
      navigate({ to: `${spacePath}/workflow` })
    }
  }

  if (!workflowId) return null

  return <TasklistEditor name={workflowId} onBack={handleBack} />
}

export const Route = createFileRoute(
  '/$projectId/$spaceId/agent/$agentId/workflow/$workflowId/',
)({
  component: AgentTasklistPage,
})
