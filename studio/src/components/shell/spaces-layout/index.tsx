/**
 * SpacesLayout - Layout for the spaces listing page within a studio.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useMemo } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
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
import { useStudio, useToggle, useUIState } from '@lmthing/state'
import { useGithub } from '@/lib/github/GithubContext'
import { buildSpacePath } from '@/lib/space-url'

const SPACE_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

type Space = { id: string; name: string; color: string }

function toLocalSpaceId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

export function SpacesLayout() {
  const navigate = useNavigate()
  const { username, studioId } = useParams({ strict: false }) as { username: string; studioId: string }
  const { spaces, createSpace } = useStudio()
  const { login, logout, isAuthenticated, isLoadingAuth } = useGithub()

  const [isSidebarCollapsed, toggleSidebarCollapsed] = useToggle('spaces-layout.sidebar-collapsed', false)
  const [searchQuery, setSearchQuery] = useUIState('spaces-layout.search-query', '')
  const [isCreateLocalOpen, , setIsCreateLocalOpen] = useToggle('spaces-layout.create-local-open', false)
  const [newLocalSpaceName, setNewLocalSpaceName] = useUIState('spaces-layout.new-local-space-name', '')
  const [selectedSpaceId, setSelectedSpaceId] = useUIState<string | null>('spaces-layout.selected-space-id', null)

  const studioPath = username && studioId
    ? `/${encodeURIComponent(username)}/${encodeURIComponent(studioId)}`
    : '/'

  const allSpaces = useMemo<Space[]>(() => {
    return spaces.map((s, idx) => ({
      id: s.id,
      name: s.name || s.id,
      color: SPACE_COLORS[idx % SPACE_COLORS.length],
    }))
  }, [spaces])

  const filteredSpaces = useMemo(() => {
    if (!searchQuery) return allSpaces
    const q = searchQuery.toLowerCase()
    return allSpaces.filter(s => s.name.toLowerCase().includes(q))
  }, [allSpaces, searchQuery])

  const selectedSpace = useMemo(() => allSpaces.find(s => s.id === selectedSpaceId) ?? null, [allSpaces, selectedSpaceId])

  const handleCreateLocalSpace = () => {
    const slug = toLocalSpaceId(newLocalSpaceName)
    if (!slug) return
    const localId = `local/${slug}`
    createSpace(localId, { name: localId })
    setIsCreateLocalOpen(false)
    setNewLocalSpaceName('')
    navigate({ to: buildSpacePath(username, studioId, localId) })
  }

  return (
    <div className="split-pane" style={{ height: '100vh' }}>
      <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`} style={{ width: isSidebarCollapsed ? '4rem' : '17.5rem' }}>
        <div style={{ padding: 0, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => navigate({ to: '/' })} style={{ display: 'flex', width: '3rem', height: '3rem', flexShrink: 0, alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }} title="lmthing home" />
            {!isSidebarCollapsed && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Spaces</span>}
          </div>
        </div>

        {!isSidebarCollapsed && (
          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, opacity: 0.5 }} />
              <input className="input" style={{ paddingLeft: '2rem' }} placeholder="Search spaces..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button className="btn btn--ghost btn--sm" style={{ width: '100%', border: '1px dashed var(--color-border)' }} onClick={() => setIsCreateLocalOpen(true)}>
              <Plus style={{ width: 14, height: 14 }} /> New space
            </button>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
          {filteredSpaces.map(space => (
            <button
              key={space.id}
              onClick={() => setSelectedSpaceId(space.id)}
              className={`sidebar__item ${selectedSpaceId === space.id ? 'sidebar__item--active' : ''}`}
              style={{ width: '100%', textAlign: 'left' }}
            >
              <div style={{ width: '1.5rem', height: '1.5rem', flexShrink: 0, borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: space.color + '20' }}>
                <Building2 style={{ width: 14, height: 14, color: space.color }} />
              </div>
              {!isSidebarCollapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{space.name}</span>}
            </button>
          ))}
        </div>

        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => { if (isLoadingAuth) return; if (isAuthenticated) { logout(); return; } void login().catch(console.error) }} disabled={isLoadingAuth} className="sidebar__item" style={{ width: '100%' }}>
            <Github style={{ width: 20, height: 20, flexShrink: 0 }} />
            {!isSidebarCollapsed && <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{isLoadingAuth ? 'Loading...' : isAuthenticated ? 'Logout GitHub' : 'Login with GitHub'}</span>}
          </button>
          <button onClick={() => toggleSidebarCollapsed()} className="sidebar__item" style={{ width: '100%' }}>
            {isSidebarCollapsed ? <ChevronRight style={{ width: 20, height: 20 }} /> : <><ChevronLeft style={{ width: 20, height: 20 }} /><span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Collapse</span></>}
          </button>
        </div>
      </aside>

      <div className="split-pane__primary">
        <PageHeader>
          <Heading level={2}>{selectedSpace ? selectedSpace.name : 'Spaces'}</Heading>
        </PageHeader>
        <PageBody>
          {selectedSpace ? (
            <div style={{ maxWidth: '56rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: selectedSpace.color + '20' }}>
                  <Building2 style={{ width: '1.75rem', height: '1.75rem', color: selectedSpace.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <Heading level={2}>{selectedSpace.name}</Heading>
                  <Caption muted>{selectedSpace.name.startsWith('local/') ? 'Local space' : 'GitHub space'}</Caption>
                </div>
                <button className="btn btn--primary" onClick={() => navigate({ to: buildSpacePath(username, studioId, selectedSpace.id) })}>Open Space</button>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: '42rem' }}>
              <Heading level={2}>Your Spaces</Heading>
              <Caption muted style={{ marginBottom: '2rem' }}>Select a space from the sidebar to view its details.</Caption>
              {allSpaces.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {allSpaces.map((space, idx) => (
                    <button key={space.id} onClick={() => setSelectedSpaceId(space.id)} style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>
                      <Card interactive style={{ padding: '1.25rem' }}>
                        <CardBody>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: SPACE_COLORS[idx % SPACE_COLORS.length] + '20' }}>
                              <Building2 style={{ width: 20, height: 20, color: SPACE_COLORS[idx % SPACE_COLORS.length] }} />
                            </div>
                          </div>
                          <Caption style={{ fontWeight: 600 }}>{space.name}</Caption>
                        </CardBody>
                      </Card>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '5rem 0' }}>
                  <Building2 style={{ width: 32, height: 32, opacity: 0.3, margin: '0 auto 1rem' }} />
                  <Heading level={3}>No spaces yet</Heading>
                  <button className="btn btn--primary" style={{ marginTop: '1.5rem' }} onClick={() => setIsCreateLocalOpen(true)}>
                    <Plus style={{ width: 16, height: 16 }} /> Create space
                  </button>
                </div>
              )}
            </div>
          )}
        </PageBody>
      </div>

      {isCreateLocalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div style={{ background: 'var(--color-bg)', borderRadius: '0.5rem', padding: '1.5rem', maxWidth: '28rem', width: '100%', border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Create New Space</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '1rem' }}>Create a new space and open it in Studio.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="input" autoFocus placeholder="Space name (e.g. customer-support)" value={newLocalSpaceName} onChange={e => setNewLocalSpaceName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateLocalSpace() }} />
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost" onClick={() => setIsCreateLocalOpen(false)}>Cancel</button>
                <button className="btn btn--primary" onClick={handleCreateLocalSpace} disabled={!toLocalSpaceId(newLocalSpaceName)}>Create Space</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { SpacesLayout as default }
