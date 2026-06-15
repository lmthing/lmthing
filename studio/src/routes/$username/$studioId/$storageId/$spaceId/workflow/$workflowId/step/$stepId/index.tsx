/**
 * Step detail route — the form-based editor no longer has a per-step page.
 * Redirect to the tasklist editor which handles all tasks inline.
 */
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'

function StepRedirectPage() {
  const params = useParams({ strict: false }) as {
    username?: string; studioId?: string; storageId?: string; spaceId?: string; workflowId?: string
  }
  const { username, studioId, storageId, spaceId, workflowId } = params
  const navigate = useNavigate()

  useEffect(() => {
    const spacePath = username && studioId && storageId && spaceId
      ? `/${username}/${studioId}/${storageId}/${spaceId}`
      : ''
    if (workflowId) {
      navigate({ to: `${spacePath}/workflow/${encodeURIComponent(workflowId)}` })
    } else {
      navigate({ to: `${spacePath}/workflow` })
    }
  }, [username, studioId, storageId, spaceId, workflowId, navigate])

  return null
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/workflow/$workflowId/step/$stepId/',
)({
  component: StepRedirectPage,
})
