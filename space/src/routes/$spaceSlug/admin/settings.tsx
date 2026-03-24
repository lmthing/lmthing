import { createFileRoute } from '@tanstack/react-router'
import { useSpace } from '@/lib/SpaceContext'
import { updateSpace, deleteSpace } from '@/lib/api'
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin/settings')({
  component: Settings,
})

function Settings() {
  const { space } = useSpace()
  const router = useRouter()
  const [name, setName] = useState(space.name)
  const [description, setDescription] = useState(space.description || '')
  const [authEnabled, setAuthEnabled] = useState(space.auth_enabled)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateSpace(space.id, {
        name,
        description: description || undefined,
        auth_enabled: authEnabled,
      })
      router.invalidate()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete space "${space.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteSpace(space.id)
      router.navigate({ to: '/' })
    } catch (err) {
      console.error(err)
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full rounded border bg-background px-3 py-2 text-sm"
            rows={3}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="auth-enabled"
            checked={authEnabled}
            onChange={e => setAuthEnabled(e.target.checked)}
          />
          <label htmlFor="auth-enabled" className="text-sm">Require authentication for end-users</label>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="mt-12 rounded-lg border border-destructive/30 p-4">
        <h2 className="mb-2 text-lg font-semibold text-destructive">Danger Zone</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Deleting this space will destroy all associated data, including the database and compute pod.
        </p>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete Space'}
        </button>
      </div>
    </div>
  )
}
