import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { listSpaces, createSpace } from '@/lib/api'
import type { Space } from '@/lib/types'

export const Route = createFileRoute('/')({
  component: SpacesDirectory,
})

function StatusBadge({ status }: { status: Space['status'] }) {
  const colors: Record<Space['status'], string> = {
    created: 'bg-gray-200 text-gray-700',
    provisioning: 'bg-yellow-200 text-yellow-800',
    running: 'bg-green-200 text-green-800',
    stopped: 'bg-gray-300 text-gray-700',
    failed: 'bg-red-200 text-red-800',
    destroyed: 'bg-red-100 text-red-600',
  }

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {status}
    </span>
  )
}

function CreateSpaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (space: Space) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug) return

    setSubmitting(true)
    setError(null)
    try {
      const space = await createSpace({ name: name.trim(), slug, description: description.trim() || undefined })
      onCreated(space)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create space')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold">Create Space</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
              placeholder="My App"
              autoFocus
            />
            {slug && <p className="mt-1 text-xs text-muted-foreground">slug: {slug}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
              placeholder="Optional description"
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">Cancel</button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !slug}
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SpacesDirectory() {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    listSpaces()
      .then(setSpaces)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Spaces</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Create Space
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : spaces.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="mb-2 text-lg font-medium">No spaces yet</p>
          <p className="mb-4 text-sm text-muted-foreground">Create your first space to get started.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Create Space
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map(space => (
            <Link
              key={space.id}
              to="/$spaceSlug"
              params={{ spaceSlug: space.slug }}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{space.name}</h3>
                <StatusBadge status={space.status} />
              </div>
              {space.description && (
                <p className="mb-2 text-sm text-muted-foreground line-clamp-2">{space.description}</p>
              )}
              <p className="text-xs text-muted-foreground">/{space.slug}</p>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSpaceModal
          onClose={() => setShowCreate(false)}
          onCreated={(space) => {
            setSpaces(prev => [space, ...prev])
            setShowCreate(false)
          }}
        />
      )}
    </div>
  )
}
