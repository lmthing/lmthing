import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { TasklistEditor } from '@lmthing/ui/components/workflow'

function TasklistEditorPage() {
  const params = useParams({ strict: false }) as {
    username?: string; studioId?: string; storageId?: string; spaceId?: string; workflowId?: string
  }
  const { username, studioId, storageId, spaceId, workflowId } = params
  const navigate = useNavigate()

  const spacePath = username && studioId && storageId && spaceId
    ? `/${username}/${studioId}/${storageId}/${spaceId}`
    : ''

  const handleBack = () => {
    navigate({ to: `${spacePath}/workflow` })
  }

  if (!workflowId) return null

  // workflowId is the tasklist name (directory under tasklists/)
  return <TasklistEditor name={workflowId} onBack={handleBack} />
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/workflow/$workflowId/',
)({
  component: TasklistEditorPage,
})
