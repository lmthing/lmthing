/**
 * SpacesLayout - Spaces listing page for a project.
 *
 * Lists the spaces in the current project (from `useProject().spaces`, which
 * reads `GET /api/projects/:id/spaces`). Opening a space navigates to
 * `/$projectId/$spaceId` (SpaceProvider hydrates files on enter).
 *
 * Removed under the pod-backed architecture: the "New local space" creator
 * and all GitHub connect/disconnect UI. Search is retained.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
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
import { useProject, useApp, useToggle, useUIState } from '@lmthing/state'
import { serializeAgentInstruct } from '@lmthing/state'
import { buildSpacePath } from '@lmthing/ui/lib/space-path'

/** Derive a slug from a space name. */
function toSlug(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const SPACE_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16']

type Space = { id: string; name: string; color: string }

export interface SpacesLayoutProps {
  /** Override the destination when a space is opened. Defaults to `/$projectId/$spaceId`. */
  onOpenSpace?: (projectId: string, spaceId: string) => void
  /** Override the home destination. Defaults to `/`. */
  onGoHome?: () => void
}

export function SpacesLayout({ onOpenSpace, onGoHome }: SpacesLayoutProps) {
  const navigate = useNavigate()
  const { projectId, spaces, isLoadingSpaces, spacesError, refreshSpaces } = useProject()
  const { transport } = useApp()

  const isSystemProject = projectId === 'system'

  const [isSidebarCollapsed, toggleSidebarCollapsed] = useToggle('spaces-layout.sidebar-collapsed', false)
  const [searchQuery, setSearchQuery] = useUIState('spaces-layout.search-query', '')
  const [selectedSpaceId, setSelectedSpaceId] = useUIState<string | null>('spaces-layout.selected-space-id', null)

  // New space modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newSpaceName, setNewSpaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const handleCreateSpace = async () => {
    const slug = toSlug(newSpaceName)
    if (!slug || !projectId || !transport) return
    setIsCreating(true)
    setCreateError(null)
    try {
      // Seed a minimal valid space file: agents/<slug>/instruct.md
      const instructContent = serializeAgentInstruct({
        title: newSpaceName.trim(),
        knowledge: [],
        functions: [],
        components: [],
        actions: [],
        canDelegateTo: [],
        body: `You are ${newSpaceName.trim()}, a helpful assistant.`,
      })
      const files: Record<string, string> = {
        [`agents/${slug}/instruct.md`]: instructContent,
      }
      await transport.saveSpaceFiles(projectId, slug, files)
      await refreshSpaces()
      setIsCreateOpen(false)
      setNewSpaceName('')
      if (onOpenSpace) {
        onOpenSpace(projectId, slug)
      } else {
        navigate({ to: buildSpacePath(projectId, slug) })
      }
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create space')
    } finally {
      setIsCreating(false)
    }
  }

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

  const selectedSpace = useMemo(
    () => allSpaces.find(s => s.id === selectedSpaceId) ?? null,
    [allSpaces, selectedSpaceId],
  )

  const openSpace = (spaceId: string) => {
    if (!projectId) return
    if (onOpenSpace) {
      onOpenSpace(projectId, spaceId)
      return
    }
    navigate({ to: buildSpacePath(projectId, spaceId) })
  }

  const goHome = () => {
    if (onGoHome) {
      onGoHome()
      return
    }
    navigate({ to: '/' })
  }

  return (
    <div className="split-pane spaces-layout">
      <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`} style={{ width: isSidebarCollapsed ? '4rem' : '17.5rem' }}>
        <div className="spaces-layout__sidebar-header">
          <div className="spaces-layout__sidebar-header-inner">
            <button onClick={goHome} className="spaces-layout__home-btn" title="lmthing home" />
            {!isSidebarCollapsed && <span className="spaces-layout__sidebar-title">Spaces</span>}
          </div>
          {!isSidebarCollapsed && !isSystemProject && (
            <button
              className="btn btn--primary btn--sm spaces-layout__new-space-btn"
              onClick={() => setIsCreateOpen(true)}
              title="New Space"
            >
              <Plus className="spaces-layout__new-space-icon" />
              New Space
            </button>
          )}
        </div>

        {!isSidebarCollapsed && (
          <div className="spaces-layout__sidebar-search-section">
            <div className="spaces-layout__search-wrapper">
              <Search className="spaces-layout__search-icon" />
              <input
                className="input spaces-layout__search-input"
                placeholder="Search spaces..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="spaces-layout__sidebar-list">
          {isLoadingSpaces && (
            <Caption muted className="spaces-layout__loading">Loading spaces…</Caption>
          )}
          {spacesError && (
            <Caption className="spaces-layout__error">Failed to load spaces.</Caption>
          )}
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
          <button onClick={() => toggleSidebarCollapsed()} className="sidebar__item spaces-layout__footer-btn">
            {isSidebarCollapsed ? (
              <ChevronRight className="spaces-layout__collapse-icon" />
            ) : (
              <>
                <ChevronLeft className="spaces-layout__collapse-icon" />
                <span className="spaces-layout__footer-label">Collapse</span>
              </>
            )}
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
                  <Caption muted>Space</Caption>
                </div>
                <button className="btn btn--primary" onClick={() => openSpace(selectedSpace.id)}>Open Space</button>
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
                  <Heading level={3}>No spaces in this project</Heading>
                  {isSystemProject ? (
                    <span className="caption caption--muted spaces-layout__grid-caption">
                      System spaces are platform-provided and cannot be created here.
                    </span>
                  ) : (
                    <>
                      <span className="caption caption--muted spaces-layout__grid-caption">
                        Create a new space to get started.
                      </span>
                      <button
                        className="btn btn--primary spaces-layout__empty-create-btn"
                        onClick={() => setIsCreateOpen(true)}
                      >
                        <Plus className="spaces-layout__empty-create-icon" /> New Space
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </PageBody>
      </div>
      {/* Create space modal */}
      {isCreateOpen && !isSystemProject && (
        <div className="projects-layout__modal-backdrop">
          <div className="projects-layout__modal">
            <h3 className="projects-layout__modal-title">Create New Space</h3>
            <p className="projects-layout__modal-desc">
              A space holds agents, knowledge, and tasklists. Enter a name to create one.
            </p>
            <div className="projects-layout__modal-fields">
              <input
                className="input"
                autoFocus
                placeholder="Space name (e.g. my-space)"
                value={newSpaceName}
                onChange={e => setNewSpaceName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleCreateSpace() }}
                disabled={isCreating}
              />
              {newSpaceName.trim() && (
                <span className="caption caption--muted">{`Space id: ${toSlug(newSpaceName)}`}</span>
              )}
              {createError && (
                <span className="caption spaces-layout__create-error">{createError}</span>
              )}
              <div className="projects-layout__modal-actions">
                <button
                  className="btn btn--ghost"
                  onClick={() => { setIsCreateOpen(false); setNewSpaceName(''); setCreateError(null) }}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={() => void handleCreateSpace()}
                  disabled={!toSlug(newSpaceName) || isCreating}
                >
                  {isCreating ? 'Creating…' : 'Create Space'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { SpacesLayout as default }
