import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'

interface GithubDeploymentStatusProps {
  repo: string // Format: "owner/repo"
  workflowName: string // The workflow name or filename
  branch?: string // Default: "main"
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
  const workflowsUrl = `https://github.com/${repo}/actions/workflows`

  const { data, isLoading, error } = useQuery<WorkflowRun | null>({
    queryKey: ['github-deployment-status', repo, workflowName, branch],
    queryFn: async () => {
      // First, get the workflows to find the workflow ID
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
      
      // Get the latest run for this workflow on the specified branch
      const runsResponse = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflow.id}/runs?branch=${branch}&per_page=1`
      )
      
      if (!runsResponse.ok) {
        throw new Error('Failed to fetch workflow runs')
      }
      
      const runsData: WorkflowRunsResponse = await runsResponse.json()
      return runsData.workflow_runs[0] || null
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    retry: 2,
  })

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <Clock className="size-4 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-500 dark:text-slate-400">Loading...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <a
        href={workflowsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 hover:shadow-md transition-all shadow-sm"
        title="Deployment status unavailable. Open GitHub Actions workflows."
      >
        <AlertCircle className="size-4 text-slate-500" />
      </a>
    )
  }

  const getStatusInfo = () => {
    if (data.status === 'completed') {
      if (data.conclusion === 'success') {
        return {
          icon: <CheckCircle2 className="size-4 text-green-500" />,
          label: 'Deployed',
          color: 'border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20',
          textColor: 'text-green-700 dark:text-green-300'
        }
      } else if (data.conclusion === 'failure') {
        return {
          icon: <XCircle className="size-4 text-red-500" />,
          label: 'Failed',
          color: 'border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20',
          textColor: 'text-red-700 dark:text-red-300'
        }
      } else {
        return {
          icon: <AlertCircle className="size-4 text-amber-500" />,
          label: data.conclusion || 'Unknown',
          color: 'border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20',
          textColor: 'text-amber-700 dark:text-amber-300'
        }
      }
    } else {
      return {
        icon: <Clock className="size-4 text-blue-500 animate-pulse" />,
        label: 'In Progress',
        color: 'border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/20',
        textColor: 'text-blue-700 dark:text-blue-300'
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
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusInfo.color} hover:shadow-md transition-all shadow-sm`}
      title={`Last deployment: ${new Date(data.created_at).toLocaleString()}`}
    >
      {statusInfo.icon}
      {/* <span className={`text-sm font-medium ${statusInfo.textColor}`}>
        {statusInfo.label}
      </span> */}
    </a>
  )
}
