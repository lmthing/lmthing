import { useQuery } from '@tanstack/react-query'
import { useGithub } from '@/lib/github/GithubContext'

export interface GithubWorkspace {
    id: number
    name: string // workspace name in format owner/repo
    ownerLogin: string
    repoName: string
    fullName: string
    description: string | null
    ownerAvatarUrl: string
    updatedAt: string
}

export function useWorkspaces() {
    const { octokit, isAuthenticated, selectedWorkspaceRepos, isLoadingRepoSelections } = useGithub()

    return useQuery({
        // Only run the query if we are authenticated and have an octokit instance
        enabled: isAuthenticated && !!octokit && !isLoadingRepoSelections,
        queryKey: ['github-workspaces', selectedWorkspaceRepos],
        queryFn: async (): Promise<GithubWorkspace[]> => {
            if (!octokit) throw new Error('Octokit not initialized')
            if (!selectedWorkspaceRepos.length) return []

            const settled = await Promise.allSettled(
                selectedWorkspaceRepos.map(async (fullName) => {
                    const [owner, ...repoParts] = fullName.split('/')
                    const repo = repoParts.join('/')

                    if (!owner || !repo) {
                        throw new Error(`Invalid repository reference: ${fullName}`)
                    }

                    const { data: repoData } = await octokit.rest.repos.get({ owner, repo })

                    return {
                        id: repoData.id,
                        name: `${repoData.owner.login}/${repoData.name}`,
                        ownerLogin: repoData.owner.login,
                        repoName: repoData.name,
                        fullName: repoData.full_name,
                        description: repoData.description,
                        ownerAvatarUrl: repoData.owner.avatar_url,
                        updatedAt: repoData.updated_at || new Date().toISOString()
                    } satisfies GithubWorkspace
                })
            )

            const availableRepos = settled
                .filter((result): result is PromiseFulfilledResult<GithubWorkspace> => result.status === 'fulfilled')
                .map((result) => result.value)

            return availableRepos.sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    })
}
