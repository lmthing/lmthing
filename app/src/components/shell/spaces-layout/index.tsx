/**
 * SpacesLayout - Layout for the spaces (workspaces) listing page.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Plus,
  Github,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'
import '@/css/elements/nav/sidebar/index.css'
import '@/css/elements/layouts/split-pane/index.css'
import '@/css/elements/layouts/page/index.css'
import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/content/card/index.css'
import { PageHeader, PageBody } from '@/elements/layouts/page'
import { Card, CardBody } from '@/elements/content/card'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useWorkspaceData } from '@/lib/workspaceDataContext'
import { useGithub } from '@/lib/github/GithubContext'
import { toWorkspaceRouteParam, fromWorkspaceRouteParam } from '@/lib/workspaces'
import { workspaceToSlug } from '@/shell/components/WorkspaceSelector'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const WORKSPACE_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

type Workspace = { id: string; name: string; color: string }

function toLocalWorkspaceId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

export function SpacesLayout() {
  const navigate = useNavigate()
  const { data: githubWorkspaces, isLoading: isLoadingGithub } = useWorkspaces()
  const { workspaceIds, createWorkspace, setCurrentWorkspace, loadLocalDemoWorkspace } = useWorkspaceData()
  const { login, logout, isAuthenticated, isLoadingAuth, deviceCodePrompt } = useGithub()

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateLocalOpen, setIsCreateLocalOpen] = useState(false)
  const [newLocalWorkspaceName, setNewLocalWorkspaceName] = useState('')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [demoWorkspaces, setDemoWorkspaces] = useState<{ id: string; name: string; slug: string }[]>([])
  const lastLoadedRef = useRef<string | null>(null)
  const allWorkspacesRef = useRef<Workspace[]>([])

  useEffect(() => {
    let mounted = true
    fetch('/demos/index.json')
      .then(r => r.ok ? r.json() : [])
      .then((items: Array<{ name: string; subject_id?: string }>) => {
        if (!mounted) return
        setDemoWorkspaces(items.map(item => {
          const slug = item.subject_id || item.name
          return { id: slug, name: `local/${slug}`, slug }
        }))
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [])

  const localWorkspaces = useMemo<Workspace[]>(() => {
    const fromIds = workspaceIds.filter(id => !id.includes('/')).map((id, idx) => ({
      id: `local-${id}`, name: `local/${id}`, color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length],
    }))
    const names = new Set(fromIds.map(w => w.name))
    demoWorkspaces.forEach((d, idx) => {
      if (!names.has(d.name)) {
        fromIds.push({ id: d.id, name: d.name, color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length] })
        names.add(d.name)
      }
    })
    return fromIds
  }, [workspaceIds, demoWorkspaces])

  const githubWorkspaceList = useMemo<Workspace[]>(() => {
    if (!githubWorkspaces) return []
    return githubWorkspaces.map((repo, idx) => ({
      id: repo.id.toString(), name: repo.name, color: WORKSPACE_COLORS[(localWorkspaces.length + idx) % WORKSPACE_COLORS.length],
    }))
  }, [githubWorkspaces, localWorkspaces.length])

  const allWorkspaces = useMemo(() => [...localWorkspaces, ...githubWorkspaceList], [localWorkspaces, githubWorkspaceList])
  allWorkspacesRef.current = allWorkspaces

  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery) return allWorkspaces
    const q = searchQuery.toLowerCase()
    return allWorkspaces.filter(w => w.name.toLowerCase().includes(q))
  }, [allWorkspaces, searchQuery])

  const selectedWorkspace = useMemo(() => allWorkspaces.find(w => w.id === selectedWorkspaceId) ?? null, [allWorkspaces, selectedWorkspaceId])

  useEffect(() => {
    if (!selectedWorkspaceId || lastLoadedRef.current === selectedWorkspaceId) return
    lastLoadedRef.current = selectedWorkspaceId
    const ws = allWorkspacesRef.current.find(w => w.id === selectedWorkspaceId)
    if (!ws) return
    if (ws.name.startsWith('local/')) {
      const localId = ws.name.slice('local/'.length)
      void loadLocalDemoWorkspace(localId).catch(() => createWorkspace(localId, { setAsCurrent: false }))
      setCurrentWorkspace(`local/${localId}`)
    } else {
      setCurrentWorkspace(fromWorkspaceRouteParam(workspaceToSlug(ws.name)))
    }
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
    <div className="split-pane" style={{ height: '100vh' }}>
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`} style={{ width: isSidebarCollapsed ? '4rem' : '17.5rem' }}>
        <div style={{ padding: 0, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => navigate('/')} style={{ display: 'flex', width: '3rem', height: '3rem', flexShrink: 0, alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }} title="lmthing home" />
            {!isSidebarCollapsed && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Workspaces</span>}
          </div>
        </div>

        {!isSidebarCollapsed && (
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, opacity: 0.5 }} />
              <input className="input" style={{ paddingLeft: '2rem' }} placeholder="Search workspaces..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button className="btn btn--ghost btn--sm" style={{ width: '100%', border: '1px dashed var(--color-border)' }} onClick={() => setIsCreateLocalOpen(true)}>
              <Plus style={{ width: 14, height: 14 }} /> New workspace
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {filteredWorkspaces.map(workspace => (
            <button
              key={workspace.id}
              onClick={() => setSelectedWorkspaceId(workspace.id)}
              className={`sidebar__item ${selectedWorkspaceId === workspace.id ? 'sidebar__item--active' : ''}`}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <div style={{ width: '1.5rem', height: '1.5rem', flexShrink: 0, borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: workspace.color + '20' }}>
                <Building2 style={{ width: 14, height: 14, color: workspace.color }} />
              </div>
              {!isSidebarCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{workspace.name}</span>}
            </button>
          ))}
        </div>

        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => { if (isLoadingAuth) return; if (isAuthenticated) { logout(); return; } void login().catch(console.error) }} disabled={isLoadingAuth} className="sidebar__item" style={{ width: '100%' }}>
            <Github style={{ width: 20, height: 20, flexShrink: 0 }} />
            {!isSidebarCollapsed && <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{isLoadingAuth ? 'Loading...' : isAuthenticated ? 'Logout GitHub' : 'Login with GitHub'}</span>}
          </button>
          <button onClick={() => setIsSidebarCollapsed(p => !p)} className="sidebar__item" style={{ width: '100%' }}>
            {isSidebarCollapsed ? <ChevronRight style={{ width: 20, height: 20 }} /> : <><ChevronLeft style={{ width: 20, height: 20 }} /><span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="split-pane__primary">
        <PageHeader>
          <Heading level={2}>{selectedWorkspace ? selectedWorkspace.name : 'Workspaces'}</Heading>
        </PageHeader>
        <PageBody>
          {selectedWorkspace ? (
            <div style={{ maxWidth: '56rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: selectedWorkspace.color + '20' }}>
                  <Building2 style={{ width: '1.75rem', height: '1.75rem', color: selectedWorkspace.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <Heading level={2}>{selectedWorkspace.name}</Heading>
                  <Caption muted>{selectedWorkspace.name.startsWith('local/') ? 'Local workspace' : 'GitHub workspace'}</Caption>
                </div>
                <button className="btn btn--primary" onClick={() => navigate(`/studio/${workspaceToSlug(selectedWorkspace.name)}`)}>Open Studio</button>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '42rem' }}>
              <Heading level={2}>Your Workspaces</Heading>
              <Caption muted style={{ marginBottom: '2rem' }}>Select a workspace from the sidebar to view its details.</Caption>
              {allWorkspaces.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {allWorkspaces.map((workspace, idx) => (
                    <button key={workspace.id} onClick={() => setSelectedWorkspaceId(workspace.id)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                      <Card interactive style={{ padding: '1.25rem' }}>
                        <CardBody>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length] + '20' }}>
                              <Building2 style={{ width: 20, height: 20, color: WORKSPACE_COLORS[idx % WORKSPACE_COLORS.length] }} />
                            </div>
                          </div>
                          <Caption style={{ fontWeight: 600 }}>{workspace.name}</Caption>
                        </CardBody>
                      </Card>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                  <Building2 style={{ width: 32, height: 32, opacity: 0.3, margin: '0 auto 1rem' }} />
                  <Heading level={3}>No workspaces yet</Heading>
                  <button className="btn btn--primary" style={{ marginTop: '1.5rem' }} onClick={() => setIsCreateLocalOpen(true)}>
                    <Plus style={{ width: 16, height: 16 }} /> Create workspace
                  </button>
                </div>
              )}
            </div>
          )}
        </PageBody>
      </div>

      <Dialog open={isCreateLocalOpen} onOpenChange={setIsCreateLocalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Local Workspace</DialogTitle>
            <DialogDescription>Create a new local workspace and open it in Studio.</DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input className="input" autoFocus placeholder="Workspace name (e.g. customer-support)" value={newLocalWorkspaceName} onChange={e => setNewLocalWorkspaceName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateLocalWorkspace() }} />
            <button className="btn btn--primary" style={{ width: '100%' }} onClick={handleCreateLocalWorkspace} disabled={!toLocalWorkspaceId(newLocalWorkspaceName)}>Create Workspace</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { SpacesLayout as default }
