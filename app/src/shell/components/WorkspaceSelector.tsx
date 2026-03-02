/* eslint-disable react-refresh/only-export-components */
import { Check, ChevronDown, Building2, Loader2, Plus } from 'lucide-react'
import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useGithub } from '@/lib/github/GithubContext'
import { useQueryClient } from '@tanstack/react-query'
import { toWorkspaceName, toWorkspaceRouteParam } from '@/lib/workspaces'
import { useWorkspaceData } from '@/lib/workspaceDataContext'

export type Workspace = {
  id: string
  name: string
  color: string
}

type AvailableGithubRepo = {
  id: number
  fullName: string
  description: string | null
}

// Helper to convert workspace name to route-safe value
export function workspaceToSlug(name: string): string {
  return toWorkspaceRouteParam(name)
}

const WORKSPACE_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

const FALLBACK_WORKSPACE: Workspace = {
  id: 'workspace-default',
  name: 'No Workspaces',
  color: WORKSPACE_COLORS[0],
}

export interface WorkspaceSelectorProps {
  currentWorkspace?: Workspace
  onWorkspaceChange?: (workspace: Workspace) => void
  isCollapsed?: boolean
}

function toLocalWorkspaceId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const withoutLocalPrefix = trimmed.startsWith('local/')
    ? trimmed.slice('local/'.length)
    : trimmed

  const rawName = withoutLocalPrefix.includes('%')
    ? withoutLocalPrefix.split('%').slice(1).join('%').trim()
    : withoutLocalPrefix.includes('/')
      ? withoutLocalPrefix.split('/').slice(1).join('/').trim()
      : withoutLocalPrefix

  return rawName
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function WorkspaceSelector({
  currentWorkspace,
  onWorkspaceChange,
  isCollapsed = false,
}: WorkspaceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [repoSearchQuery, setRepoSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingAvailableRepos, setIsLoadingAvailableRepos] = useState(false)
  const [isAddingRepoFullName, setIsAddingRepoFullName] = useState<string | null>(null)
  const [availableGithubRepos, setAvailableGithubRepos] = useState<AvailableGithubRepo[]>([])

  const navigate = useNavigate()
  const location = useLocation()

  const {
    octokit,
    user,
    isAuthenticated,
    addSelectedWorkspaceRepo,
    isLoadingRepoSelections,
    selectedWorkspaceRepos,
  } = useGithub()

  const queryClient = useQueryClient()
  const { workspaceIds, createWorkspace } = useWorkspaceData()
  const { data: githubWorkspaces, isLoading } = useWorkspaces()

  const localWorkspaces = useMemo<Workspace[]>(() => {
    return workspaceIds
      .filter((workspaceId) => !workspaceId.includes('/'))
      .map((workspaceId, idx) => ({
        id: `local-${workspaceId}`,
        name: `local/${workspaceId}`,
        color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
      }))
  }, [workspaceIds])

  const mappedWorkspaces = useMemo<Workspace[]>(() => {
    if (!githubWorkspaces) return []
    return githubWorkspaces.map((repo, idx) => ({
      id: repo.id.toString(),
      name: repo.name,
      color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
    }))
  }, [githubWorkspaces])

  const allWorkspaces = useMemo(
    () => [...localWorkspaces, ...mappedWorkspaces],
    [localWorkspaces, mappedWorkspaces]
  )

  const activeWorkspace = currentWorkspace || allWorkspaces[0] || FALLBACK_WORKSPACE

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery) {
      return {
        local: localWorkspaces,
        github: mappedWorkspaces.slice(0, 5),
      }
    }

    const query = searchQuery.toLowerCase()
    const local = localWorkspaces.filter((w) => w.name.toLowerCase().includes(query))
    const github = mappedWorkspaces.filter((w) => w.name.toLowerCase().includes(query))

    return { local, github }
  }, [localWorkspaces, mappedWorkspaces, searchQuery])

  const derivedRepoName = useMemo(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) return ''

    if (trimmed.includes('%')) {
      const parts = trimmed.split('%')
      return parts.slice(1).join('%').trim()
    }

    if (trimmed.includes('/')) {
      const parts = trimmed.split('/')
      return parts.slice(1).join('/').trim()
    }

    return trimmed
  }, [searchQuery])

  const derivedLocalWorkspaceId = useMemo(
    () => toLocalWorkspaceId(searchQuery),
    [searchQuery]
  )

  const loadAvailableGithubRepos = useCallback(async () => {
    if (!octokit || !isAuthenticated) {
      setAvailableGithubRepos([])
      return
    }

    setIsLoadingAvailableRepos(true)
    try {
      const response = await octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      })

      setAvailableGithubRepos(
        response.data.map((repo) => ({
          id: repo.id,
          fullName: repo.full_name,
          description: repo.description,
        }))
      )
    } catch (error) {
      console.error(error)
      alert('Failed to load your GitHub repositories.')
    } finally {
      setIsLoadingAvailableRepos(false)
    }
  }, [octokit, isAuthenticated])

  const handleOpenAddRepoModal = useCallback(async () => {
    if (!isAuthenticated) return

    setRepoSearchQuery('')
    setIsRepoModalOpen(true)
    await loadAvailableGithubRepos()
  }, [isAuthenticated, loadAvailableGithubRepos])

  const handleAddRepoFromModal = useCallback(
    async (repoFullName: string) => {
      if (!isAuthenticated) return

      setIsAddingRepoFullName(repoFullName)
      try {
        await addSelectedWorkspaceRepo(repoFullName)
        await queryClient.invalidateQueries({ queryKey: ['github-workspaces'] })
      } catch (error) {
        console.error(error)
        alert('Failed to add repository. Make sure it exists and you have access.')
      } finally {
        setIsAddingRepoFullName(null)
      }
    },
    [addSelectedWorkspaceRepo, isAuthenticated, queryClient]
  )

  const selectedRepoSet = useMemo(
    () => new Set(selectedWorkspaceRepos.map((repo) => repo.toLowerCase())),
    [selectedWorkspaceRepos]
  )

  const filteredAvailableRepos = useMemo(() => {
    if (!repoSearchQuery) return availableGithubRepos

    const query = repoSearchQuery.toLowerCase().trim()
    return availableGithubRepos.filter((repo) => repo.fullName.toLowerCase().includes(query))
  }, [availableGithubRepos, repoSearchQuery])

  const hasExactGithubWorkspaceMatch = useMemo(
    () => filteredWorkspaces.github.some((w) => w.name.toLowerCase() === searchQuery.toLowerCase()),
    [filteredWorkspaces.github, searchQuery]
  )

  const hasExactLocalWorkspaceMatch = useMemo(
    () => localWorkspaces.some((w) => w.name.toLowerCase() === `local/${derivedLocalWorkspaceId}`),
    [localWorkspaces, derivedLocalWorkspaceId]
  )

  const handleCreateWorkspace = async () => {
    if (!octokit || !user || !derivedRepoName) return

    setIsCreating(true)
    try {
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name: derivedRepoName,
        private: true,
        auto_init: true,
      })

      const workspaceName = toWorkspaceName(data.owner.login, data.name)
      await addSelectedWorkspaceRepo(workspaceName)
      await queryClient.invalidateQueries({ queryKey: ['github-workspaces'] })
      handleSelect({ id: data.id.toString(), name: workspaceName, color: WORKSPACE_COLORS[0] })
    } catch (e) {
      console.error(e)
      alert("Failed to create repository. It might already exist or you don't have permissions.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleCreateLocalWorkspace = () => {
    if (!derivedLocalWorkspaceId) return

    createWorkspace(derivedLocalWorkspaceId, { setAsCurrent: false })
    handleSelect({
      id: `local-${derivedLocalWorkspaceId}`,
      name: `local/${derivedLocalWorkspaceId}`,
      color: WORKSPACE_COLORS[localWorkspaces.length % WORKSPACE_COLORS.length],
    })
  }

  const handleSelect = useCallback(
    (workspace: Workspace) => {
      setSearchQuery('')
      onWorkspaceChange?.(workspace)
      setIsOpen(false)

      const pathParts = location.pathname.split('/')
      const workspaceIdx = pathParts.indexOf('workspace')

      if (workspaceIdx !== -1 && pathParts.length > workspaceIdx + 1) {
        pathParts[workspaceIdx + 1] = workspaceToSlug(workspace.name)
        navigate(pathParts.join('/'))
      } else {
        navigate(`/workspace/${workspaceToSlug(workspace.name)}/studio`)
      }
    },
    [navigate, location.pathname, onWorkspaceChange]
  )

  if (isCollapsed) {
    if (isLoading) {
      return (
        <div className="w-8 h-8 rounded-md flex items-center justify-center bg-slate-100">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      )
    }

    return (
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center"
        style={{ backgroundColor: activeWorkspace.color + '20' }}
      >
        <Building2 className="w-4 h-4" style={{ color: activeWorkspace.color }} />
      </div>
    )
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="flex min-w-0 items-center gap-2 px-2 py-1.5 w-full rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
            aria-label="Select workspace"
            disabled={isLoading}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: activeWorkspace.color + '20' }}
            >
              {isLoading ? (
                <Loader2
                  className="w-3.5 h-3.5 animate-spin"
                  style={{ color: activeWorkspace.color }}
                />
              ) : (
                <Building2 className="w-3.5 h-3.5" style={{ color: activeWorkspace.color }} />
              )}
            </div>

            <span
              className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate text-left flex-1"
              title={activeWorkspace.name}
            >
              {isLoading ? 'Loading repos...' : activeWorkspace.name}
            </span>

            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden flex flex-col max-h-[400px]"
          side="bottom"
        >
          <DropdownMenuLabel>Repositories (Workspaces)</DropdownMenuLabel>

          <div className="px-2 pb-2">
            <Input
              placeholder="Search or create repo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-8"
            />
          </div>

          <DropdownMenuSeparator />

          <div className="overflow-y-auto flex-1 p-1">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Local
            </div>
            {filteredWorkspaces.local.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleSelect(workspace)}
                className="w-full flex items-center gap-3 cursor-pointer"
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: workspace.color + '20' }}
                >
                  <Building2 className="w-3 h-3" style={{ color: workspace.color }} />
                </div>

                <span className="flex-1 truncate" title={workspace.name}>
                  {workspace.name}
                </span>

                {workspace.id === activeWorkspace.id && (
                  <Check className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}

            <div className="mt-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              GitHub Repositories
            </div>
            {filteredWorkspaces.github.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                onClick={() => handleSelect(workspace)}
                className="w-full flex items-center gap-3 cursor-pointer"
              >
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: workspace.color + '20' }}
                >
                  <Building2 className="w-3 h-3" style={{ color: workspace.color }} />
                </div>

                <span className="flex-1 truncate" title={workspace.name}>
                  {workspace.name}
                </span>

                {workspace.id === activeWorkspace.id && (
                  <Check className="w-4 h-4 text-slate-500 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}

            {filteredWorkspaces.local.length + filteredWorkspaces.github.length === 0 &&
              !isLoading &&
              !searchQuery && (
                <div className="px-2 py-3 text-sm text-slate-500 text-center">No workspaces found</div>
              )}

            {filteredWorkspaces.local.length + filteredWorkspaces.github.length === 0 &&
              searchQuery && (
                <div className="px-2 py-3 text-sm text-slate-500 text-center">
                  No workspaces match "{searchQuery}"
                </div>
              )}
          </div>

          {!searchQuery && mappedWorkspaces.length > 5 && (
            <p className="px-2 py-1.5 text-xs text-center text-slate-400">
              Showing 5 of {mappedWorkspaces.length} repos. Type to search.
            </p>
          )}

          {searchQuery && (!hasExactLocalWorkspaceMatch || (!hasExactGithubWorkspaceMatch && isAuthenticated)) && (
            <div className="p-2 border-t space-y-2">
              {!hasExactLocalWorkspaceMatch && (
                <button
                  onClick={handleCreateLocalWorkspace}
                  disabled={!derivedLocalWorkspaceId}
                  className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {derivedLocalWorkspaceId
                    ? `Create local/${derivedLocalWorkspaceId}`
                    : 'Create local workspace'}
                </button>
              )}

              {!hasExactGithubWorkspaceMatch && isAuthenticated && (
                <button
                  onClick={handleCreateWorkspace}
                  disabled={isCreating || !derivedRepoName}
                  className="w-full px-2 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:bg-primary/50"
                >
                  {isCreating ? 'Creating...' : `Create GitHub repo "${derivedRepoName}"`}
                </button>
              )}
            </div>
          )}

          <DropdownMenuSeparator />

          <div className="p-2">
            <button
              type="button"
              onClick={() => {
                void handleOpenAddRepoModal()
              }}
              disabled={!isAuthenticated || isLoadingRepoSelections}
              className="w-full flex items-center justify-center gap-2 px-2 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingRepoSelections ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add GitHub Repo
            </button>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => queryClient.invalidateQueries({ queryKey: ['github-workspaces'] })}
            className="flex items-center gap-3 cursor-pointer text-slate-500"
          >
            <div className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold">↻</span>
            </div>
            <span>Refresh Repositories</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isRepoModalOpen} onOpenChange={setIsRepoModalOpen}>
        <DialogContent className="w-[95vw] sm:w-[42rem] max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>Add GitHub Repository</DialogTitle>
            <DialogDescription>
              Select one of your GitHub repositories to add as a workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="Search repositories..."
              value={repoSearchQuery}
              onChange={(event) => setRepoSearchQuery(event.target.value)}
            />

            <div className="w-full max-h-[420px] overflow-y-auto border rounded-md">
              {isLoadingAvailableRepos ? (
                <div className="p-6 text-sm text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading repositories...
                </div>
              ) : filteredAvailableRepos.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 text-center">No repositories found.</div>
              ) : (
                <div className="w-full divide-y">
                  {filteredAvailableRepos.map((repo) => {
                    const isAlreadyAdded = selectedRepoSet.has(repo.fullName.toLowerCase())
                    const isAdding = isAddingRepoFullName === repo.fullName

                    return (
                      <div
                        key={repo.id}
                        className="w-full max-w-full p-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{repo.fullName}</p>
                          {repo.description && (
                            <p className="text-xs text-slate-500 truncate">{repo.description}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            void handleAddRepoFromModal(repo.fullName)
                          }}
                          disabled={isAlreadyAdded || isAdding || !!isAddingRepoFullName}
                          className="w-[76px] flex-none px-2.5 py-1.5 text-xs text-center rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isAdding ? 'Adding...' : isAlreadyAdded ? 'Added' : 'Add'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void loadAvailableGithubRepos()
                }}
                disabled={isLoadingAvailableRepos}
                className="px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                Refresh List
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
