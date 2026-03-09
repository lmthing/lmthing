/**
 * StudiosLayout - Studios listing page for a user.
 * Shows all studios belonging to the authenticated user,
 * with ability to create new studios and access ThingPanel.
 */
import { useState, useMemo } from 'react'
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
import '@/css/elements/layouts/page/index.css'
import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/content/card/index.css'
import { PageHeader, PageBody } from '@/elements/layouts/page'
import { Card, CardBody } from '@/elements/content/card'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { useApp } from '@lmthing/state'
import CozyThingText from '@/CozyText'

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

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newStudioName, setNewStudioName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Top bar */}
      <div style={{
        borderBottom: '1px solid var(--color-border)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate({ to: '/' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.125rem', fontWeight: 600 }}
          >
            <CozyThingText text="lmthing" />
          </button>
          <span style={{ opacity: 0.3 }}>/</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{username}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button className="btn btn--ghost btn--sm" onClick={handleOpenThing}>
            <MessageSquare style={{ width: 16, height: 16 }} />
            ThingPanel
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => navigate({ to: '/marketplace' })}>
            <Store style={{ width: 16, height: 16 }} />
            Marketplace
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => setIsCreateOpen(true)}>
            <Plus style={{ width: 16, height: 16 }} />
            New Studio
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem' }}>
        <PageHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Heading level={2}>Studios</Heading>
              <Caption muted>Manage your studios and their spaces.</Caption>
            </div>
          </div>
        </PageHeader>

        <PageBody>
          {userStudios.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
              marginTop: '1.5rem',
            }}>
              {userStudios.map((studio, idx) => (
                <Card
                  key={`${studio.username}/${studio.studioId}`}
                  interactive
                  style={{ padding: '1.5rem', cursor: 'pointer', position: 'relative' }}
                  onClick={() => handleOpenStudio(studio.studioId)}
                >
                  <CardBody>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{
                        width: '3rem',
                        height: '3rem',
                        borderRadius: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: STUDIO_COLORS[idx % STUDIO_COLORS.length] + '20',
                        marginBottom: '1rem',
                      }}>
                        <Layers style={{ width: 24, height: 24, color: STUDIO_COLORS[idx % STUDIO_COLORS.length] }} />
                      </div>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete(studio.studioId)
                        }}
                        style={{ opacity: 0.5 }}
                        title="Delete studio"
                      >
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    <Heading level={4}>{studio.name}</Heading>
                    <Caption muted style={{ marginTop: '0.25rem' }}>{studio.studioId}</Caption>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      marginTop: '1rem',
                      opacity: 0.5,
                    }}>
                      <ArrowRight style={{ width: 16, height: 16 }} />
                    </div>
                  </CardBody>
                </Card>
              ))}

              {/* Create new card */}
              <button
                onClick={() => setIsCreateOpen(true)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '10rem',
                  borderRadius: '0.75rem',
                  border: '2px dashed var(--color-border)',
                  opacity: 0.6,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
              >
                <div style={{ textAlign: 'center' }}>
                  <Plus style={{ width: 24, height: 24, margin: '0 auto 0.5rem' }} />
                  <Caption>New Studio</Caption>
                </div>
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <Layers style={{ width: 48, height: 48, opacity: 0.2, margin: '0 auto 1.5rem' }} />
              <Heading level={3}>No studios yet</Heading>
              <Caption muted style={{ marginTop: '0.5rem', maxWidth: '24rem', margin: '0.5rem auto 0' }}>
                Studios group your spaces together. Create your first studio to get started.
              </Caption>
              <button
                className="btn btn--primary"
                style={{ marginTop: '1.5rem' }}
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus style={{ width: 16, height: 16 }} /> Create Studio
              </button>
            </div>
          )}
        </PageBody>
      </div>

      {/* Create studio modal */}
      {isCreateOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{
            background: 'var(--color-bg)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '28rem',
            width: '100%',
            border: '1px solid var(--color-border)',
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Create New Studio</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '1rem' }}>
              A studio groups related spaces together.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost" onClick={() => { setIsCreateOpen(false); setNewStudioName('') }}>Cancel</button>
                <button className="btn btn--primary" onClick={handleCreate} disabled={!toStudioId(newStudioName)}>Create Studio</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}>
          <div style={{
            background: 'var(--color-bg)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '24rem',
            width: '100%',
            border: '1px solid var(--color-border)',
          }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Delete Studio</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.7, marginBottom: '1.5rem' }}>
              Are you sure you want to delete <strong>{confirmDelete}</strong>? This will remove all spaces and data within it.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn"
                style={{ backgroundColor: '#ef4444', color: 'white' }}
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
