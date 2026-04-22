import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'
import { Badge } from '@lmthing/ui/elements/content/badge'

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
      const workflowsResponse = await fetch(`https://api.github.com/repos/${repo}/actions/workflows`)
      if (!workflowsResponse.ok) throw new Error('Failed to fetch workflows')
      const workflowsData: WorkflowsResponse = await workflowsResponse.json()
      const workflow = workflowsData.workflows?.find(
        (workflowItem) => workflowItem.name === workflowName || workflowItem.path.includes(workflowName)
      )
      if (!workflow) return null
      const runsResponse = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow.id}/runs?branch=${branch}&per_page=1`)
      if (!runsResponse.ok) throw new Error('Failed to fetch workflow runs')
      const runsData: WorkflowRunsResponse = await runsResponse.json()
      return runsData.workflow_runs[0] || null
    },
    staleTime: 1000 * 60 * 2,
    retry: 2,
  })

  if (isLoading) {
    return (
      <Badge variant="muted">
        <Clock className="size-4 animate-spin" />
        <span>Loading...</span>
      </Badge>
    )
  }

  if (error || !data) {
    return (
      <a href={workflowsUrl} target="_blank" rel="noopener noreferrer" className="badge badge--muted" title="Deployment status unavailable. Open GitHub Actions workflows.">
        <AlertCircle className="size-4" />
      </a>
    )
  }

  const getStatusInfo = () => {
    if (data.status === 'completed') {
      if (data.conclusion === 'success') return { icon: <CheckCircle2 className="size-4" />, label: 'Deployed', variant: 'success' as const }
      if (data.conclusion === 'failure') return { icon: <XCircle className="size-4" />, label: 'Failed', variant: 'primary' as const }
      return { icon: <AlertCircle className="size-4" />, label: data.conclusion || 'Unknown', variant: 'muted' as const }
    }
    return { icon: <Clock className="size-4 animate-pulse" />, label: 'In Progress', variant: 'muted' as const }
  }

  const statusInfo = getStatusInfo()
  if (hideWhenSuccess && data.status === 'completed' && data.conclusion === 'success') return null

  return (
    <a
      href={data.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`badge ${statusInfo.variant === 'success' ? 'badge--success' : statusInfo.variant === 'primary' ? 'badge--primary' : 'badge--muted'}`}
      title={`Last deployment: ${new Date(data.created_at).toLocaleString()}`}
    >
      {statusInfo.icon}
      <span>{statusInfo.label}</span>
    </a>
  )
}
