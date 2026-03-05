import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'

interface GithubDeploymentStatusProps {
  repo: string
  workflowName: string
  branch?: string
  hideWhenSuccess?: boolean
}

interface WorkflowRun {
  id: number
  status: string
  conclusion: string | null
  html_url: string
  created_at: string
}

interface WorkflowRunsResponse {
  workflow_runs: WorkflowRun[]
}

interface WorkflowDefinition {
  id: number
  name: string
  path: string
}

interface WorkflowsResponse {
  workflows?: WorkflowDefinition[]
}

export function GithubDeploymentStatus({
  repo,
  workflowName,
  branch = 'main',
  hideWhenSuccess = false,
}: GithubDeploymentStatusProps) {
  const workflowsUrl = `https://github.com/${repo}/actions/`

  const { data, isLoading, error } = useQuery<WorkflowRun | null>({
    queryKey: ['github-deployment-status', repo, workflowName, branch],
    queryFn: async () => {
      const workflowsResponse = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows`
      )

      if (!workflowsResponse.ok) {
        throw new Error('Failed to fetch workflows')
      }

      const workflowsData: WorkflowsResponse = await workflowsResponse.json()
      const workflow = workflowsData.workflows?.find(
        (workflowItem) => workflowItem.name === workflowName || workflowItem.path.includes(workflowName)
      )

      if (!workflow) {
        return null
      }

      const runsResponse = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflow.id}/runs?branch=${branch}&per_page=1`
      )

      if (!runsResponse.ok) {
        throw new Error('Failed to fetch workflow runs')
      }

      const runsData: WorkflowRunsResponse = await runsResponse.json()
      return runsData.workflow_runs[0] || null
    },
    staleTime: 1000 * 60 * 2,
    retry: 2,
  })

  if (isLoading) {
    return (
      <div className="badge badge--muted">
        <Clock className="size-4 animate-spin" />
        <span>Loading...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <a
        href={workflowsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="badge badge--muted"
        title="Deployment status unavailable. Open GitHub Actions workflows."
      >
        <AlertCircle className="size-4" />
      </a>
    )
  }

  const getStatusInfo = () => {
    if (data.status === 'completed') {
      if (data.conclusion === 'success') {
        return {
          icon: <CheckCircle2 className="size-4" />,
          label: 'Deployed',
          badgeClass: 'badge badge--success',
        }
      } else if (data.conclusion === 'failure') {
        return {
          icon: <XCircle className="size-4" />,
          label: 'Failed',
          badgeClass: 'badge badge--primary',
        }
      } else {
        return {
          icon: <AlertCircle className="size-4" />,
          label: data.conclusion || 'Unknown',
          badgeClass: 'badge badge--muted',
        }
      }
    } else {
      return {
        icon: <Clock className="size-4 animate-pulse" />,
        label: 'In Progress',
        badgeClass: 'badge badge--muted',
      }
    }
  }

  const statusInfo = getStatusInfo()

  if (hideWhenSuccess && data.status === 'completed' && data.conclusion === 'success') {
    return null
  }

  return (
    <a
      href={data.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className={statusInfo.badgeClass}
      title={`Last deployment: ${new Date(data.created_at).toLocaleString()}`}
    >
      {statusInfo.icon}
      <span>{statusInfo.label}</span>
    </a>
  )
}
