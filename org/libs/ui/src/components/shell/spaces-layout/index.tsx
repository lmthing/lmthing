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
import '@lmthing/css/elements/nav/sidebar/index.css'
import '@lmthing/css/elements/layouts/split-pane/index.css'
import '@lmthing/css/elements/layouts/page/index.css'
import '@lmthing/css/elements/forms/button/index.css'
import '@lmthing/css/elements/forms/input/index.css'
import '@lmthing/css/elements/content/card/index.css'
import '@lmthing/css/components/shell/index.css'
import { PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
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
  const { login: connectGithub, logout: disconnectGithub, isAuthenticated: isGithubConnected, isLoadingAuth: isGithubLoading } = useGithub()

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
    <div className="split-pane spaces-layout">
      <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`} style={{ width: isSidebarCollapsed ? '4rem' : '17.5rem' }}>
        <div className="spaces-layout__sidebar-header">
          <div className="spaces-layout__sidebar-header-inner">
            <button onClick={() => navigate({ to: '/' })} className="spaces-layout__home-btn" title="lmthing home" />
            {!isSidebarCollapsed && <span className="spaces-layout__sidebar-title">Spaces</span>}
          </div>
        </div>

        {!isSidebarCollapsed && (
          <div className="spaces-layout__sidebar-search-section">
            <div className="spaces-layout__search-wrapper">
              <Search className="spaces-layout__search-icon" />
              <input className="input spaces-layout__search-input" placeholder="Search spaces..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button className="btn btn--ghost btn--sm spaces-layout__new-space-btn" onClick={() => setIsCreateLocalOpen(true)}>
              <Plus className="spaces-layout__icon-sm" /> New space
            </button>
          </div>
        )}

        <div className="spaces-layout__sidebar-list">
          {filteredSpaces.map(space => (
            <button
              key={space.id}
              onClick={() => setSelectedSpaceId(space.id)}
              className={`sidebar__item ${selectedSpaceId === space.id ? 'sidebar__item--active' : ''} spaces-layout__space-btn`}
            >
              <div className="spaces-layout__space-icon-wrapper" style={{ backgroundColor: space.color + '20' }}>
                <Building2 className="spaces-layout__icon-sm" style={{ color: space.color }} />
              </div>
              {!isSidebarCollapsed && <span className="spaces-layout__space-name">{space.name}</span>}
            </button>
          ))}
        </div>

        <div className="spaces-layout__sidebar-footer">
          <button onClick={() => { if (isGithubLoading) return; if (isGithubConnected) { disconnectGithub(); return; } void connectGithub().catch(console.error) }} disabled={isGithubLoading} className="sidebar__item spaces-layout__footer-btn">
            <Github className="spaces-layout__github-icon" />
            {!isSidebarCollapsed && <span className="spaces-layout__footer-label">{isGithubLoading ? 'Loading...' : isGithubConnected ? 'Disconnect GitHub' : 'Connect GitHub'}</span>}
          </button>
          <button onClick={() => toggleSidebarCollapsed()} className="sidebar__item spaces-layout__footer-btn">
            {isSidebarCollapsed ? <ChevronRight className="spaces-layout__collapse-icon" /> : <><ChevronLeft className="spaces-layout__collapse-icon" /><span className="spaces-layout__footer-label">Collapse</span></>}
          </button>
        </div>
      </aside>

      <div className="split-pane__primary">
        <PageHeader>
          <Heading level={2}>{selectedSpace ? selectedSpace.name : 'Spaces'}</Heading>
        </PageHeader>
        <PageBody>
          {selectedSpace ? (
            <div className="spaces-layout__detail">
              <div className="spaces-layout__detail-header">
                <div className="spaces-layout__detail-icon-wrapper" style={{ backgroundColor: selectedSpace.color + '20' }}>
                  <Building2 className="spaces-layout__detail-icon" style={{ color: selectedSpace.color }} />
                </div>
                <div className="spaces-layout__detail-info">
                  <Heading level={2}>{selectedSpace.name}</Heading>
                  <Caption muted>{selectedSpace.name.startsWith('local/') ? 'Local space' : 'GitHub space'}</Caption>
                </div>
                <button className="btn btn--primary" onClick={() => navigate({ to: buildSpacePath(username, studioId, selectedSpace.id) })}>Open Space</button>
              </div>
            </div>
          ) : (
            <div className="spaces-layout__grid-container">
              <Heading level={2}>Your Spaces</Heading>
              <Caption muted className="spaces-layout__grid-caption">Select a space from the sidebar to view its details.</Caption>
              {allSpaces.length > 0 ? (
                <div className="spaces-layout__grid">
                  {allSpaces.map((space, idx) => (
                    <button key={space.id} onClick={() => setSelectedSpaceId(space.id)} className="spaces-layout__grid-btn">
                      <Card interactive className="spaces-layout__grid-card">
                        <CardBody>
                          <div className="spaces-layout__grid-card-header">
                            <div className="spaces-layout__grid-icon-wrapper" style={{ backgroundColor: SPACE_COLORS[idx % SPACE_COLORS.length] + '20' }}>
                              <Building2 className="spaces-layout__grid-icon" style={{ color: SPACE_COLORS[idx % SPACE_COLORS.length] }} />
                            </div>
                          </div>
                          <Caption className="spaces-layout__grid-name">{space.name}</Caption>
                        </CardBody>
                      </Card>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="spaces-layout__empty">
                  <Building2 className="spaces-layout__empty-icon" />
                  <Heading level={3}>No spaces yet</Heading>
                  <button className="btn btn--primary spaces-layout__empty-create-btn" onClick={() => setIsCreateLocalOpen(true)}>
                    <Plus className="spaces-layout__empty-create-icon" /> Create space
                  </button>
                </div>
              )}
            </div>
          )}
        </PageBody>
      </div>

      {isCreateLocalOpen && (
        <div className="spaces-layout__modal-backdrop">
          <div className="spaces-layout__modal">
            <h3 className="spaces-layout__modal-title">Create New Space</h3>
            <p className="spaces-layout__modal-desc">Create a new space and open it in Studio.</p>
            <div className="spaces-layout__modal-fields">
              <input className="input" autoFocus placeholder="Space name (e.g. customer-support)" value={newLocalSpaceName} onChange={e => setNewLocalSpaceName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreateLocalSpace() }} />
              <div className="spaces-layout__modal-actions">
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
