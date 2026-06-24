/**
 * Step detail route — the form-based editor no longer has a per-step page.
 * Redirect to the tasklist editor which handles all tasks inline.
 */
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'

function StepRedirectPage() {
  const params = useParams({ strict: false }) as {
    projectId?: string; spaceId?: string; workflowId?: string
  }
  const { projectId, spaceId, workflowId } = params
  const navigate = useNavigate()

  useEffect(() => {
    const spacePath = projectId && spaceId
      ? `/${projectId}/${spaceId}`
      : ''
    if (workflowId) {
      navigate({ to: `${spacePath}/workflow/${encodeURIComponent(workflowId)}` })
    } else {
      navigate({ to: `${spacePath}/workflow` })
    }
  }, [projectId, spaceId, workflowId, navigate])

  return null
}

export const Route = createFileRoute(
  '/$projectId/$spaceId/workflow/$workflowId/step/$stepId/',
)({
  component: StepRedirectPage,
})
