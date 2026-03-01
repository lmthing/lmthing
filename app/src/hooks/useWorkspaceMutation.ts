import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useGithub } from '@/lib/github/GithubContext'
import {
    DEFAULT_WORKSPACE_SLUG,
    getNormalizedWorkspace,
    parseWorkspaceRepoRef,
} from '@/lib/workspaces'

interface SaveFileArgs {
    path: string
    content: string | object
    message?: string
}

export function useWorkspaceMutation() {
    const { workspaceName = DEFAULT_WORKSPACE_SLUG } = useParams<{ workspaceName?: string }>()
    const { octokit, isAuthenticated, user } = useGithub()
    const queryClient = useQueryClient()

    const normalizedWorkspaceName = getNormalizedWorkspace(workspaceName)

    return useMutation({
        mutationFn: async ({ path, content, message }: SaveFileArgs) => {
            if (!isAuthenticated || !octokit || !user) throw new Error('Not authenticated')

            const repoRef = parseWorkspaceRepoRef(normalizedWorkspaceName, user.login)
            if (!repoRef) {
                throw new Error(`Invalid workspace name format: ${normalizedWorkspaceName}`)
            }

            if (repoRef.owner === 'local') {
                throw new Error('Local demo workspaces are not synced to GitHub.')
            }

            const owner = repoRef.owner
            const repo = repoRef.repo

            // Prepare content for GitHub API (must be base64 encoded)
            let stringContent = ''
            if (typeof content === 'string') {
                stringContent = content
            } else {
                stringContent = JSON.stringify(content, null, 2)
            }

            // using btoa for base64 encoding (browser standard)
            // Note: btoa doesn't handle Unicode nicely natively, so for robust markdown it might need a shim
            // but for basic ascii/json it's typically fine. Let's use standard encodeURIComponent workaround.
            const encodedContent = btoa(unescape(encodeURIComponent(stringContent)))

            let sha: string | undefined

            try {
                // We must fetch the current file SHA to update it
                const { data } = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path,
                })

                if (!Array.isArray(data) && data.type === 'file') {
                    sha = data.sha
                }
            } catch (err: any) {
                // If 404, file doesn't exist yet, which is fine for creation
                if (err.status !== 404) throw err
            }

            const defaultMessage = sha ? `Update ${path}` : `Create ${path}`

            // Create or update the file
            await octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path,
                message: message || defaultMessage,
                content: encodedContent,
                sha,
            })

            return true
        },
        onSuccess: (_, { path }) => {
            // Invalidate the query hook for this specific path so it re-fetches
            queryClient.invalidateQueries({
                queryKey: ['workspace-data', normalizedWorkspaceName, path]
            })
        },
    })
}
