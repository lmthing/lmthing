/**
 * StudiosLayout - Studios listing page for a user.
 * Shows all studios belonging to the authenticated user,
 * with ability to create new studios and access ThingPanel.
 */
import { useMemo } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  Building2,
  Plus,
  Trash2,
  ArrowRight,
  Layers,
  MessageSquare,
  Store,
} from 'lucide-react'
import '@lmthing/css/elements/layouts/page/index.css'
import '@lmthing/css/elements/forms/button/index.css'
import '@lmthing/css/elements/forms/input/index.css'
import '@lmthing/css/elements/content/card/index.css'
import '@lmthing/css/components/shell/index.css'
import { PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { useApp, useToggle, useUIState } from '@lmthing/state'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

const STUDIO_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#ec4899']

function toStudioId(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function StudiosLayout() {
  const navigate = useNavigate()
  const { username } = useParams({ strict: false }) as { username: string }
  const { studios, createStudio, deleteStudio } = useApp()

  const [isCreateOpen, , setIsCreateOpen] = useToggle('studios-layout.create-open', false)
  const [newStudioName, setNewStudioName] = useUIState('studios-layout.new-studio-name', '')
  const [confirmDelete, setConfirmDelete] = useUIState<string | null>('studios-layout.confirm-delete', null)

  const userStudios = useMemo(
    () => studios.filter(s => s.username === username),
    [studios, username]
  )

  const handleCreate = () => {
    const id = toStudioId(newStudioName)
    if (!id || !username) return
    createStudio(username, id, newStudioName.trim())
    setIsCreateOpen(false)
    setNewStudioName('')
    navigate({ to: `/${encodeURIComponent(username)}/${encodeURIComponent(id)}` })
  }

  const handleDelete = (studioId: string) => {
    if (!username) return
    deleteStudio(username, studioId)
    setConfirmDelete(null)
  }

  const handleOpenStudio = (studioId: string) => {
    if (!username) return
    navigate({ to: `/${encodeURIComponent(username)}/${encodeURIComponent(studioId)}` })
  }

  const handleOpenThing = () => {
    if (!username) return
    navigate({ to: `/${encodeURIComponent(username)}/thing` })
  }

  return (
    <div className="studios-layout">
      {/* Top bar */}
      <div className="studios-layout__topbar">
        <div className="studios-layout__topbar-left">
          <button
            onClick={() => navigate({ to: '/' })}
            className="studios-layout__home-btn"
          >
            <CozyThingText text="lmthing" />
          </button>
          <span className="studios-layout__breadcrumb-sep">/</span>
          <span className="studios-layout__username">{username}</span>
        </div>
        <div className="studios-layout__topbar-right">
          <button className="btn btn--ghost btn--sm" onClick={handleOpenThing}>
            <MessageSquare className="studios-layout__topbar-icon" />
            ThingPanel
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate({ to: '/marketplace' })}>
            <Store className="studios-layout__topbar-icon" />
            Marketplace
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="studios-layout__topbar-icon" />
            New Studio
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="studios-layout__content">
        <PageHeader>
          <div className="studios-layout__header-row">
            <div>
              <Heading level={2}>Studios</Heading>
              <Caption muted>Manage your studios and their spaces.</Caption>
            </div>
          </div>
        </PageHeader>

        <PageBody>
          {userStudios.length > 0 ? (
            <div className="studios-layout__grid">
              {userStudios.map((studio, idx) => (
                <Card
                  key={`${studio.username}/${studio.studioId}`}
                  interactive
                  className="studios-layout__card"
                  onClick={() => handleOpenStudio(studio.studioId)}
                >
                  <CardBody>
                    <div className="studios-layout__card-header">
                      <div className="studios-layout__card-icon-wrapper" style={{ backgroundColor: STUDIO_COLORS[idx % STUDIO_COLORS.length] + '20' }}>
                        <Layers className="studios-layout__card-icon" style={{ color: STUDIO_COLORS[idx % STUDIO_COLORS.length] }} />
                      </div>
                      <button
                        className="btn btn--ghost btn--sm studios-layout__card-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete(studio.studioId)
                        }}
                        title="Delete studio"
                      >
                        <Trash2 className="studios-layout__card-delete-icon" />
                      </button>
                    </div>
                    <Heading level={4}>{studio.name}</Heading>
                    <Caption muted className="studios-layout__card-id">{studio.studioId}</Caption>
                    <div className="studios-layout__card-arrow">
                      <ArrowRight className="studios-layout__card-arrow-icon" />
                    </div>
                  </CardBody>
                </Card>
              ))}

              {/* Create new card */}
              <button
                onClick={() => setIsCreateOpen(true)}
                className="studios-layout__create-card"
              >
                <div className="studios-layout__create-card-inner">
                  <Plus className="studios-layout__create-card-icon" />
                  <Caption>New Studio</Caption>
                </div>
              </button>
            </div>
          ) : (
            <div className="studios-layout__empty">
              <Layers className="studios-layout__empty-icon" />
              <Heading level={3}>No studios yet</Heading>
              <Caption muted className="studios-layout__empty-caption">
                Studios group your spaces together. Create your first studio to get started.
              </Caption>
              <button
                className="btn btn--primary studios-layout__empty-create-btn"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="studios-layout__empty-create-icon" /> Create Studio
              </button>
            </div>
          )}
        </PageBody>
      </div>

      {/* Create studio modal */}
      {isCreateOpen && (
        <div className="studios-layout__modal-backdrop">
          <div className="studios-layout__modal">
            <h3 className="studios-layout__modal-title">Create New Studio</h3>
            <p className="studios-layout__modal-desc">
              A studio groups related spaces together.
            </p>
            <div className="studios-layout__modal-fields">
              <input
                className="input"
                autoFocus
                placeholder="Studio name (e.g. my-project)"
                value={newStudioName}
                onChange={e => setNewStudioName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
              />
              {newStudioName.trim() && (
                <Caption muted>ID: {toStudioId(newStudioName)}</Caption>
              )}
              <div className="studios-layout__modal-actions">
                <button className="btn btn--ghost" onClick={() => { setIsCreateOpen(false); setNewStudioName('') }}>Cancel</button>
                <button className="btn btn--primary" onClick={handleCreate} disabled={!toStudioId(newStudioName)}>Create Studio</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="studios-layout__modal-backdrop">
          <div className="studios-layout__modal studios-layout__modal--sm">
            <h3 className="studios-layout__modal-title">Delete Studio</h3>
            <p className="studios-layout__modal-desc studios-layout__modal-desc--lg">
              Are you sure you want to delete <strong>{confirmDelete}</strong>? This will remove all spaces and data within it.
            </p>
            <div className="studios-layout__modal-actions">
              <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn studios-layout__delete-btn"
                onClick={() => handleDelete(confirmDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { StudiosLayout as default }
