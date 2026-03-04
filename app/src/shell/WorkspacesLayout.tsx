import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
    Building2,
    Plus,
    Settings,
    Github,
    ChevronLeft,
    ChevronRight,
    Search,
    Loader2,
    Folder,
    Bot,
    ArrowRight,
} from 'lucide-react'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import { useKnowledgeSections, useAgents } from '@/lib/workspaceContext'
import { useGithub } from '@/lib/github/GithubContext'
import { workspaceToSlug } from './components/WorkspaceSelector'
import type { Workspace } from './components/WorkspaceSelector'
import logo from '@/assets/logo.png'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toWorkspaceRouteParam, fromWorkspaceRouteParam } from '@/lib/workspaces'

const WORKSPACE_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

type DemoWorkspaceIndexItem = {
    name: string
    description?: string
    subject_id?: string
}

function toLocalWorkspaceId(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) return ''
    return trimmed
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
}

// Inner component that reads knowledge/agents from context (set by WorkspacesLayout)
function WorkspaceDetail({ workspace }: { workspace: Workspace }) {
    const navigate = useNavigate()
    const knowledgeSections = useKnowledgeSections()
    const { agents: agentsMap } = useAgents()
    const { isLoading } = useWorkspaceData()

    const studioPath = `/studio/${workspaceToSlug(workspace.name)}`

    const agents = useMemo(
        () => Object.values(agentsMap).map((a) => ({
            id: a.id,
            name: a.frontmatter.name || a.id,
            description: a.frontmatter.description || '',
            selectedDomains: a.frontmatter.selectedDomains || [],
        })),
        [agentsMap]
    )

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">Loading workspace...</span>
            </div>
        )
    }

    return (
        <div className="max-w-4xl">
            {/* Workspace header */}
            <div className="flex items-center gap-4 mb-8">
                <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: workspace.color + '20' }}
                >
                    <Building2 className="w-7 h-7" style={{ color: workspace.color }} />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                        {workspace.name}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {workspace.name.startsWith('local/') ? 'Local workspace' : 'GitHub workspace'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => navigate(studioPath)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                >
                    <Settings className="w-4 h-4" />
                    Open Studio
                </button>
            </div>

            {/* Knowledge */}
            <section className="mb-10">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Folder className="w-4 h-4 text-emerald-500" />
                        Knowledge
                        <span className="text-sm font-normal text-slate-400">({knowledgeSections.length})</span>
                    </h3>
                    <button
                        type="button"
                        onClick={() => navigate(studioPath)}
                        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                        + Add knowledge
                    </button>
                </div>

                {knowledgeSections.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
                        <Folder className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No knowledge areas yet</p>
                        <button
                            type="button"
                            onClick={() => navigate(studioPath)}
                            className="mt-3 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                            Add knowledge in Studio →
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {knowledgeSections.map((section) => {
                            const domainId = section.path.replace(/\//g, '-')
                            return (
                                <Link
                                    key={section.path}
                                    to={`${studioPath}/knowledge/${domainId}`}
                                    className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all bg-white dark:bg-slate-900"
                                >
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: (section.color || '#10b981') + '20' }}
                                    >
                                        <Folder
                                            className="w-4 h-4"
                                            style={{ color: section.color || '#10b981' }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 dark:text-slate-100 truncate text-sm">
                                            {section.label || section.path}
                                        </p>
                                        {section.description && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                {section.description}
                                            </p>
                                        )}
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 transition-colors shrink-0 mt-0.5" />
                                </Link>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Assistants */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Bot className="w-4 h-4 text-violet-500" />
                        Assistants
                        <span className="text-sm font-normal text-slate-400">({agents.length})</span>
                    </h3>
                    <button
                        type="button"
                        onClick={() => navigate(studioPath)}
                        className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
                    >
                        + Add assistant
                    </button>
                </div>

                {agents.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
                        <Bot className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">No assistants yet</p>
                        <button
                            type="button"
                            onClick={() => navigate(studioPath)}
                            className="mt-3 text-sm text-violet-600 dark:text-violet-400 hover:underline"
                        >
                            Create an assistant in Studio →
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {agents.map((agent) => (
                            <Link
                                key={agent.id}
                                to={`${studioPath}/assistant/${agent.id}`}
                                className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-md transition-all bg-white dark:bg-slate-900"
                            >
                                <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate text-sm">
                                        {agent.name}
                                    </p>
                                    {agent.description && (
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                            {agent.description}
                                        </p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-1">
                                        {agent.selectedDomains.length} knowledge area{agent.selectedDomains.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-violet-500 transition-colors shrink-0 mt-0.5" />
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

export default function WorkspacesLayout() {
    const navigate = useNavigate()
    const { data: githubWorkspaces, isLoading: isLoadingGithub } = useWorkspaces()
    const { workspaceIds, createWorkspace, setCurrentWorkspace, loadLocalDemoWorkspace } = useWorkspaceData()
    const { login, logout, isAuthenticated, isLoadingAuth, deviceCodePrompt } = useGithub()

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isCreateLocalOpen, setIsCreateLocalOpen] = useState(false)
    const [newLocalWorkspaceName, setNewLocalWorkspaceName] = useState('')
    const [demoWorkspaces, setDemoWorkspaces] = useState<{ id: string; name: string; slug: string }[]>([])
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
    const lastLoadedWorkspaceIdRef = useRef<string | null>(null)
    const allWorkspacesRef = useRef<Workspace[]>([])

    // Load demo workspaces index
    useEffect(() => {
        let isMounted = true
        const load = async () => {
            try {
                const res = await fetch('/demos/index.json')
                if (!res.ok) return
                const items = (await res.json()) as DemoWorkspaceIndexItem[]
                if (!isMounted) return
                setDemoWorkspaces(
                    items.map((item) => {
                        const slug = item.subject_id || item.name
                        return { id: slug, name: `local/${slug}`, slug }
                    })
                )
            } catch { /* silent */ }
        }
        void load()
        return () => { isMounted = false }
    }, [])

    const localWorkspaces = useMemo<Workspace[]>(() => {
        const fromIds = workspaceIds
            .filter((id) => !id.includes('/'))
            .map((id, idx) => ({
                id: `local-${id}`,
                name: `local/${id}`,
                color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
            }))

        // Merge demo workspaces (no duplicates)
        const names = new Set(fromIds.map((w) => w.name))
        demoWorkspaces.forEach((d, idx) => {
            if (!names.has(d.name)) {
                fromIds.push({
                    id: d.id,
                    name: d.name,
                    color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
                })
                names.add(d.name)
            }
        })

        return fromIds
    }, [workspaceIds, demoWorkspaces])

    const githubWorkspaceList = useMemo<Workspace[]>(() => {
        if (!githubWorkspaces) return []
        return githubWorkspaces.map((repo, idx) => ({
            id: repo.id.toString(),
            name: repo.name,
            color: WORKSPACE_COLORS[(localWorkspaces.length + idx) % WORKSPACE_COLORS.length],
        }))
    }, [githubWorkspaces, localWorkspaces.length])

    const allWorkspaces = useMemo(
        () => [...localWorkspaces, ...githubWorkspaceList],
        [localWorkspaces, githubWorkspaceList]
    )

    // Keep a ref in sync so the load effect can look up the workspace name
    // without having allWorkspaces as a reactive dependency (which would cause loops)
    allWorkspacesRef.current = allWorkspaces

    const filteredWorkspaces = useMemo(() => {
        if (!searchQuery) return allWorkspaces
        const q = searchQuery.toLowerCase()
        return allWorkspaces.filter((w) => w.name.toLowerCase().includes(q))
    }, [allWorkspaces, searchQuery])

    const selectedWorkspace = useMemo(
        () => allWorkspaces.find((w) => w.id === selectedWorkspaceId) ?? null,
        [allWorkspaces, selectedWorkspaceId]
    )

    // When a workspace selection changes, load its data into context.
    // We depend only on selectedWorkspaceId (stable string) — NOT on selectedWorkspace
    // (object reference) to avoid re-triggering the effect on every loading state change.
    useEffect(() => {
        if (!selectedWorkspaceId) return
        // Guard: skip if we already loaded this workspace
        if (lastLoadedWorkspaceIdRef.current === selectedWorkspaceId) return
        lastLoadedWorkspaceIdRef.current = selectedWorkspaceId

        const ws = allWorkspacesRef.current.find((w) => w.id === selectedWorkspaceId)
        if (!ws) return

        const name = ws.name
        if (name.startsWith('local/')) {
            const localId = name.slice('local/'.length)
            void loadLocalDemoWorkspace(localId).catch(() => {
                createWorkspace(localId, { setAsCurrent: false })
            })
            setCurrentWorkspace(`local/${localId}`)
        } else {
            setCurrentWorkspace(fromWorkspaceRouteParam(workspaceToSlug(name)))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWorkspaceId])

    const handleCreateLocalWorkspace = () => {
        const localId = toLocalWorkspaceId(newLocalWorkspaceName)
        if (!localId) return
        createWorkspace(localId, { setAsCurrent: false })
        setIsCreateLocalOpen(false)
        setNewLocalWorkspaceName('')
        navigate(`/studio/${toWorkspaceRouteParam(`local/${localId}`)}`)
    }

    return (
        <div className="flex h-screen bg-white dark:bg-slate-950">
            {/* ─── Sidebar ─── */}
            <aside
                className={`
          flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800
          transition-all duration-200 ease-in-out shrink-0
          ${isSidebarCollapsed ? 'w-16' : 'w-[280px]'}
        `}
            >
                {/* Logo */}
                <div className="p-0 border-b border-slate-200 dark:border-slate-800">
                    <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="flex h-12 w-12 shrink-0 items-center justify-center"
                            title="lmthing home"
                        >
                            <img src={logo} alt="lmthing" className="h-12 w-12 rounded-md object-contain" />
                        </button>
                        {!isSidebarCollapsed && (
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate flex-1">
                                Workspaces
                            </span>
                        )}
                    </div>
                </div>

                {/* Search + Create */}
                {!isSidebarCollapsed && (
                    <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search workspaces..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/50"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCreateLocalOpen(true)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New workspace
                        </button>
                    </div>
                )}

                {/* Workspace list */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
                    {(isLoadingGithub) && !isSidebarCollapsed && filteredWorkspaces.length === 0 && (
                        <div className="flex items-center justify-center py-6 text-slate-400">
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            <span className="text-sm">Loading...</span>
                        </div>
                    )}

                    {!isLoadingGithub && filteredWorkspaces.length === 0 && !isSidebarCollapsed && (
                        <div className="py-6 text-center text-sm text-slate-400">No workspaces found</div>
                    )}

                    {/* Local workspaces */}
                    {!isSidebarCollapsed && localWorkspaces.length > 0 && (
                        <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Local</p>
                    )}
                    <div className="space-y-0.5 mb-3">
                        {filteredWorkspaces
                            .filter((w) => w.name.startsWith('local/'))
                            .map((workspace) => (
                                <WorkspaceSidebarItem
                                    key={workspace.id}
                                    workspace={workspace}
                                    isActive={selectedWorkspaceId === workspace.id}
                                    isCollapsed={isSidebarCollapsed}
                                    onSelect={() => setSelectedWorkspaceId(workspace.id)}
                                />
                            ))}
                    </div>

                    {/* GitHub workspaces */}
                    {!isSidebarCollapsed && githubWorkspaceList.filter(w =>
                        !searchQuery || w.name.toLowerCase().includes(searchQuery.toLowerCase())
                    ).length > 0 && (
                            <p className="px-3 mb-1 mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">GitHub</p>
                        )}
                    <div className="space-y-0.5">
                        {filteredWorkspaces
                            .filter((w) => !w.name.startsWith('local/'))
                            .map((workspace) => (
                                <WorkspaceSidebarItem
                                    key={workspace.id}
                                    workspace={workspace}
                                    isActive={selectedWorkspaceId === workspace.id}
                                    isCollapsed={isSidebarCollapsed}
                                    onSelect={() => setSelectedWorkspaceId(workspace.id)}
                                />
                            ))}
                    </div>
                </div>

                {/* Bottom controls */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex flex-col gap-1">
                        <button
                            type="button"
                            onClick={() => {
                                if (isLoadingAuth) return
                                if (isAuthenticated) { logout(); return }
                                void login().catch(console.error)
                            }}
                            disabled={isLoadingAuth}
                            className={`
                flex items-center gap-3 text-slate-600 dark:text-slate-400
                hover:text-slate-900 dark:hover:text-slate-200
                hover:bg-slate-100 dark:hover:bg-slate-800
                rounded-lg transition-colors disabled:opacity-60
                ${isSidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}
              `}
                            title={isSidebarCollapsed ? (isAuthenticated ? 'Logout GitHub' : 'Login with GitHub') : ''}
                        >
                            <Github className="w-5 h-5 flex-shrink-0" />
                            {!isSidebarCollapsed && (
                                <span className="text-sm font-medium">
                                    {isLoadingAuth ? 'GitHub Auth Loading...' : isAuthenticated ? 'Logout GitHub' : 'Login with GitHub'}
                                </span>
                            )}
                        </button>

                        {!isSidebarCollapsed && deviceCodePrompt && (
                            <div className="mx-3 mt-1 rounded-md border border-violet-200 bg-violet-50 p-2.5 dark:border-violet-900/50 dark:bg-violet-950/30">
                                <p className="text-xs text-violet-800 dark:text-violet-200">Authorize GitHub:</p>
                                <a href={deviceCodePrompt.verificationUri} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-violet-700 underline">
                                    {deviceCodePrompt.verificationUri}
                                </a>
                                <p className="mt-1 text-xs text-violet-800 dark:text-violet-200">Code:</p>
                                <div className="mt-1 rounded border border-violet-200 bg-white px-2 py-1 text-center font-mono text-sm tracking-widest">
                                    {deviceCodePrompt.userCode}
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsSidebarCollapsed((p) => !p)}
                            className={`
                flex items-center gap-3 text-slate-600 dark:text-slate-400
                hover:text-slate-900 dark:hover:text-slate-200
                hover:bg-slate-100 dark:hover:bg-slate-800
                rounded-lg transition-colors
                ${isSidebarCollapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'}
              `}
                        >
                            {isSidebarCollapsed ? (
                                <ChevronRight className="w-5 h-5 flex-shrink-0" />
                            ) : (
                                <>
                                    <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-sm font-medium">Collapse</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            {/* ─── Main content ─── */}
            <div className="flex-1 min-w-0 flex flex-col">
                {/* Header */}
                <header className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 bg-white dark:bg-slate-900 shrink-0 gap-3">
                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        {selectedWorkspace ? selectedWorkspace.name : 'Workspaces'}
                    </h1>
                </header>

                {/* Body */}
                <div className="flex-1 overflow-auto p-6">
                    {selectedWorkspace ? (
                        <WorkspaceDetail workspace={selectedWorkspace} />
                    ) : (
                        /* Empty-state overview */
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                                Your Workspaces
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8">
                                Select a workspace from the sidebar to view its knowledge and assistants.
                            </p>

                            {allWorkspaces.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {allWorkspaces.map((workspace, idx) => (
                                        <button
                                            key={workspace.id}
                                            type="button"
                                            onClick={() => setSelectedWorkspaceId(workspace.id)}
                                            className="group text-left p-5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:shadow-lg transition-all bg-white dark:bg-slate-900"
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                    style={{ backgroundColor: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length] + '20' }}
                                                >
                                                    <Building2
                                                        className="w-5 h-5"
                                                        style={{ color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length] }}
                                                    />
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-primary ml-auto transition-colors" />
                                            </div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm">
                                                {workspace.name}
                                            </p>
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateLocalOpen(true)}
                                        className="text-left p-5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-all flex items-center justify-center"
                                    >
                                        <div className="text-center">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                                                <Plus className="w-5 h-5 text-slate-400" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-500">New workspace</p>
                                        </div>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                                        <Building2 className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No workspaces yet</h3>
                                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
                                        Create your first workspace to get started.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateLocalOpen(true)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Create workspace
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Local Workspace Dialog */}
            <Dialog open={isCreateLocalOpen} onOpenChange={setIsCreateLocalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Local Workspace</DialogTitle>
                        <DialogDescription>Create a new local workspace and open it in Studio.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            autoFocus
                            placeholder="Workspace name (e.g. customer-support)"
                            value={newLocalWorkspaceName}
                            onChange={(e) => setNewLocalWorkspaceName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateLocalWorkspace() }}
                        />
                        <button
                            type="button"
                            onClick={handleCreateLocalWorkspace}
                            disabled={!toLocalWorkspaceId(newLocalWorkspaceName)}
                            className="w-full px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Create Workspace
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ─── Sidebar item ───────────────────────────────────────────────────────────

function WorkspaceSidebarItem({
    workspace,
    isActive,
    isCollapsed,
    onSelect,
}: {
    workspace: Workspace
    isActive: boolean
    isCollapsed: boolean
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            title={workspace.name}
            className={`
        flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors text-left
        ${isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
      `}
        >
            <div
                className="flex w-6 h-6 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: workspace.color + '20' }}
            >
                <Building2 className="w-3.5 h-3.5" style={{ color: workspace.color }} />
            </div>
            {!isCollapsed && (
                <span className="truncate flex-1">{workspace.name}</span>
            )}
        </button>
    )
}
