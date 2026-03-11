import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useUIState, useToggle } from '@lmthing/state'
import { Octokit } from '@octokit/rest'
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device'
import { request } from '@octokit/request'

// Get Client ID from environment variables
const GITHUB_CLIENT_ID = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.VITE_GITHUB_CLIENT_ID
  : process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
const WORKSPACE_REPOS_GIST_FILENAME = 'lmthing-workspace-repos.json'
const WORKSPACE_REPOS_GIST_DESCRIPTION = 'lmthing workspace repository selection state'

interface WorkspaceReposStateFile {
    version: 1
    selectedRepos: string[]
    updatedAt: string
}

interface GithubUser {
    login: string
    avatar_url: string
    name: string | null
}

interface GithubContextType {
    octokit: Octokit | null
    user: GithubUser | null
    isAuthenticated: boolean
    isLoadingAuth: boolean
    isLoadingRepoSelections: boolean
    selectedWorkspaceRepos: string[]
    login: () => Promise<void>
    logout: () => void
    addSelectedWorkspaceRepo: (repoFullName: string) => Promise<string>
    removeSelectedWorkspaceRepo: (repoFullName: string) => Promise<void>
    deviceCodePrompt: { userCode: string; verificationUri: string } | null
}

const GithubContext = createContext<GithubContextType | undefined>(undefined)

export function GithubProvider({ children }: { children: ReactNode }) {
    const [octokit, setOctokit] = useUIState<Octokit | null>('github.octokit', null)
    const [user, setUser] = useUIState<GithubUser | null>('github.user', null)
    const [isLoadingAuth, , setIsLoadingAuth] = useToggle('github.isLoadingAuth', true)
    const [isLoadingRepoSelections, , setIsLoadingRepoSelections] = useToggle('github.isLoadingRepoSelections', false)
    const [selectedWorkspaceRepos, setSelectedWorkspaceRepos] = useUIState<string[]>('github.selectedWorkspaceRepos', [])
    const [workspaceReposGistId, setWorkspaceReposGistId] = useUIState<string | null>('github.workspaceReposGistId', null)
    const [deviceCodePrompt, setDeviceCodePrompt] = useUIState<{ userCode: string; verificationUri: string } | null>('github.deviceCodePrompt', null)

    const normalizeRepoFullName = (value: string): string | null => {
        const trimmed = value.trim()
        if (!trimmed) return null

        const withoutUrl = trimmed
            .replace(/^https?:\/\/github\.com\//i, '')
            .replace(/^github\.com\//i, '')
            .replace(/\.git$/i, '')
            .replace(/^\/+|\/+$/g, '')

        const parts = withoutUrl.split('/').filter(Boolean)
        if (parts.length !== 2) return null

        const [owner, repo] = parts
        if (!owner || !repo) return null

        return `${owner}/${repo}`
    }

    const parseWorkspaceReposFile = (content?: string): string[] => {
        if (!content) return []

        try {
            const parsed = JSON.parse(content) as Partial<WorkspaceReposStateFile>
            if (!Array.isArray(parsed.selectedRepos)) return []

            const deduped = new Set<string>()
            const result: string[] = []

            for (const entry of parsed.selectedRepos) {
                if (typeof entry !== 'string') continue
                const normalized = normalizeRepoFullName(entry)
                if (!normalized) continue

                const key = normalized.toLowerCase()
                if (deduped.has(key)) continue
                deduped.add(key)
                result.push(normalized)
            }

            return result
        } catch {
            return []
        }
    }

    const buildWorkspaceReposFileContent = (repos: string[]): string => {
        const payload: WorkspaceReposStateFile = {
            version: 1,
            selectedRepos: repos,
            updatedAt: new Date().toISOString(),
        }

        return JSON.stringify(payload, null, 2)
    }

    const ensureWorkspaceReposGist = async (client: Octokit): Promise<{ gistId: string; selectedRepos: string[] }> => {
        const { data: gists } = await client.rest.gists.list({ per_page: 100 })

        const existing = gists.find((gist) => Boolean(gist.files?.[WORKSPACE_REPOS_GIST_FILENAME]))
        if (existing?.id) {
            // list() does not reliably include file content for gist files.
            // Fetch the full gist payload to read persisted repo selection state.
            const { data: gistDetails } = await client.rest.gists.get({ gist_id: existing.id })
            const file = gistDetails.files?.[WORKSPACE_REPOS_GIST_FILENAME] as { content?: string } | undefined
            const selectedRepos = parseWorkspaceReposFile(file?.content)
            return { gistId: existing.id, selectedRepos }
        }

        const { data: created } = await client.rest.gists.create({
            description: WORKSPACE_REPOS_GIST_DESCRIPTION,
            public: false,
            files: {
                [WORKSPACE_REPOS_GIST_FILENAME]: {
                    content: buildWorkspaceReposFileContent([]),
                },
            },
        })

        if (!created.id) {
            throw new Error('Failed to create workspace selection gist.')
        }

        return {
            gistId: created.id,
            selectedRepos: [],
        }
    }

    const writeWorkspaceReposGist = async (
        client: Octokit,
        gistId: string,
        repos: string[]
    ): Promise<void> => {
        await client.rest.gists.update({
            gist_id: gistId,
            files: {
                [WORKSPACE_REPOS_GIST_FILENAME]: {
                    content: buildWorkspaceReposFileContent(repos),
                },
            },
        })
    }

    useEffect(() => {
        const token = localStorage.getItem('github_token')
        if (token) {
            initializeOctokit(token)
        } else {
            setIsLoadingAuth(false)
        }
    }, [])

    const initializeOctokit = async (token: string) => {
        try {
            setIsLoadingAuth(true)
            const client = new Octokit({ auth: token })
            const { data } = await client.rest.users.getAuthenticated()
            setOctokit(client)
            setUser({
                login: data.login,
                avatar_url: data.avatar_url,
                name: data.name
            })
            localStorage.setItem('github_token', token)

            try {
                setIsLoadingRepoSelections(true)
                const { gistId, selectedRepos } = await ensureWorkspaceReposGist(client)
                setWorkspaceReposGistId(gistId)
                setSelectedWorkspaceRepos(selectedRepos)
            } catch (gistError) {
                console.error('Failed to initialize workspace selection gist', gistError)
                setWorkspaceReposGistId(null)
                setSelectedWorkspaceRepos([])
            } finally {
                setIsLoadingRepoSelections(false)
            }
        } catch (error) {
            console.error('Failed to initialize Octokit', error)
            localStorage.removeItem('github_token')
            setOctokit(null)
            setUser(null)
            setWorkspaceReposGistId(null)
            setSelectedWorkspaceRepos([])
            setIsLoadingRepoSelections(false)
        } finally {
            setIsLoadingAuth(false)
        }
    }

    const login = async () => {
        try {
            if (!GITHUB_CLIENT_ID || GITHUB_CLIENT_ID === 'YOUR_GITHUB_CLIENT_ID') {
                const msg = 'Please set VITE_GITHUB_CLIENT_ID in your .env.local file with a valid GitHub OAuth App Client ID.'
                window.alert(msg)
                throw new Error(msg)
            }

            const customRequest = request.defaults({
                request: {
                    fetch: (url: any, options: any) => {
                        const urlStr = url.toString()
                        if (urlStr.startsWith('https://github.com')) {
                            return fetch(urlStr.replace('https://github.com', '/github-proxy'), options)
                        }
                        return fetch(url, options)
                    }
                }
            })

            const auth = createOAuthDeviceAuth({
                clientType: 'oauth-app',
                clientId: GITHUB_CLIENT_ID,
                scopes: ['repo', 'read:user', 'gist'],
                onVerification(verification) {
                    setDeviceCodePrompt({
                        userCode: verification.user_code,
                        verificationUri: verification.verification_uri
                    })
                },
                request: customRequest
            })

            const tokenAuthentication = await auth({ type: 'oauth' })
            setDeviceCodePrompt(null)
            await initializeOctokit(tokenAuthentication.token)
        } catch (error) {
            console.error('Login failed', error)
            setDeviceCodePrompt(null)
            throw error
        }
    }

    const logout = () => {
        localStorage.removeItem('github_token')
        setOctokit(null)
        setUser(null)
        setDeviceCodePrompt(null)
        setWorkspaceReposGistId(null)
        setSelectedWorkspaceRepos([])
        setIsLoadingRepoSelections(false)
    }

    const addSelectedWorkspaceRepo = async (repoFullName: string): Promise<string> => {
        if (!octokit) {
            throw new Error('You must be authenticated with GitHub.')
        }

        const normalized = normalizeRepoFullName(repoFullName)
        if (!normalized) {
            throw new Error('Repository must be in owner/repo format.')
        }

        const [owner, repo] = normalized.split('/')
        const { data } = await octokit.rest.repos.get({ owner, repo })
        const canonicalName = data.full_name

        const key = canonicalName.toLowerCase()
        const alreadySelected = selectedWorkspaceRepos.some((item) => item.toLowerCase() === key)
        if (alreadySelected) return canonicalName

        setIsLoadingRepoSelections(true)
        try {
            let gistId = workspaceReposGistId
            if (!gistId) {
                const ensured = await ensureWorkspaceReposGist(octokit)
                gistId = ensured.gistId
                setWorkspaceReposGistId(ensured.gistId)
                setSelectedWorkspaceRepos(ensured.selectedRepos)
            }

            const next = [...selectedWorkspaceRepos, canonicalName]
            await writeWorkspaceReposGist(octokit, gistId, next)
            setSelectedWorkspaceRepos(next)
            return canonicalName
        } finally {
            setIsLoadingRepoSelections(false)
        }
    }

    const removeSelectedWorkspaceRepo = async (repoFullName: string): Promise<void> => {
        if (!octokit) {
            throw new Error('You must be authenticated with GitHub.')
        }

        const normalized = normalizeRepoFullName(repoFullName)
        if (!normalized) return

        const target = normalized.toLowerCase()
        const next = selectedWorkspaceRepos.filter((repo) => repo.toLowerCase() !== target)
        if (next.length === selectedWorkspaceRepos.length) return

        setIsLoadingRepoSelections(true)
        try {
            let gistId = workspaceReposGistId
            if (!gistId) {
                const ensured = await ensureWorkspaceReposGist(octokit)
                gistId = ensured.gistId
                setWorkspaceReposGistId(ensured.gistId)
            }

            await writeWorkspaceReposGist(octokit, gistId, next)
            setSelectedWorkspaceRepos(next)
        } finally {
            setIsLoadingRepoSelections(false)
        }
    }

    return (
        <GithubContext.Provider
            value={{
                octokit,
                user,
                isAuthenticated: !!user,
                isLoadingAuth,
                isLoadingRepoSelections,
                selectedWorkspaceRepos,
                login,
                logout,
                addSelectedWorkspaceRepo,
                removeSelectedWorkspaceRepo,
                deviceCodePrompt
            }}
        >
            {children}
        </GithubContext.Provider>
    )
}

export function useGithub() {
    const context = useContext(GithubContext)
    if (context === undefined) {
        throw new Error('useGithub must be used within a GithubProvider')
    }
    return context
}
