import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useGithub } from '@/lib/github/GithubContext'
import {
  DEFAULT_WORKSPACE_SLUG,
  getNormalizedWorkspace,
  parseWorkspaceRepoRef,
} from '@/lib/workspaces'

/**
 * Hook to dynamically load workspace-specific data from GitHub.
 * This replaces the old Vite import.meta.glob loader.
 * 
 * @param path The path within the repository to fetch (e.g. 'agents', 'knowledge')
 */
export function useWorkspaceData<T>(path: string) {
  const { workspaceName = DEFAULT_WORKSPACE_SLUG } = useParams<{ workspaceName?: string }>()
  const { octokit, isAuthenticated, user } = useGithub()

  const normalizedWorkspaceName = getNormalizedWorkspace(workspaceName)
  const repoRef = parseWorkspaceRepoRef(normalizedWorkspaceName, user?.login)
  const isLocalWorkspace = repoRef?.owner === 'local'

  return useQuery({
    enabled: isAuthenticated && !!octokit && !!normalizedWorkspaceName && !isLocalWorkspace,
    queryKey: ['workspace-data', normalizedWorkspaceName, path],
    queryFn: async (): Promise<T> => {
      if (!octokit) throw new Error('Octokit not initialized')

      try {
        const repoRef = parseWorkspaceRepoRef(normalizedWorkspaceName, user?.login)
        if (!repoRef) {
          throw new Error(`Invalid workspace name format: ${normalizedWorkspaceName}`)
        }

        const owner = repoRef.owner
        const repo = repoRef.repo

        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
        })

        // GitHub API returns an array for directories, and an object for files
        if (Array.isArray(response.data)) {
          // It's a directory listing - we'll return the items
          // We might need to map this based on what the UI expects for T
          return response.data as unknown as T
        } else if (response.data.type === 'file' && 'content' in response.data) {
          // It's a file
          const decodedContent = atob(response.data.content.replace(/\n/g, ''))

          // If it's JSON, parse it
          if (response.data.name.endsWith('.json')) {
            return JSON.parse(decodedContent) as T
          }

          // Otherwise return raw string
          return decodedContent as unknown as T
        }

        throw new Error('Unsupported content type returned from GitHub')
      } catch (err: any) {
        if (err.status === 404) {
          // Data not found, might be a new workspace. Return empty form.
          console.warn(`Path not found in repo: ${path}`)
          return null as unknown as T
        }
        throw err
      }
    },
    staleTime: 60 * 1000,
  })
}
