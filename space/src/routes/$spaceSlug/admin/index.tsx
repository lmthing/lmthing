import { createFileRoute } from '@tanstack/react-router'
import { useSpace } from '@/lib/SpaceContext'
import { startSpace, stopSpace } from '@/lib/api'
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin/')({
  component: AdminOverview,
})

const STATUS_COLORS: Record<string, string> = {
  running: 'text-green-600',
  stopped: 'text-yellow-600',
  provisioning: 'text-blue-600',
  failed: 'text-destructive',
  destroyed: 'text-muted-foreground',
  created: 'text-muted-foreground',
}

function AdminOverview() {
  const { space } = useSpace()
  const router = useRouter()
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canStart = space.status === 'stopped' && !!space.fly_machine_id
  const canStop = space.status === 'running' && !!space.fly_machine_id

  async function handleStart() {
    setActing(true)
    setError(null)
    try {
      await startSpace(space.id)
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start space')
    } finally {
      setActing(false)
    }
  }

  async function handleStop() {
    setActing(true)
    setError(null)
    try {
      await stopSpace(space.id)
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop space')
    } finally {
      setActing(false)
    }
  }

  async function handleRestart() {
    setActing(true)
    setError(null)
    try {
      await stopSpace(space.id)
      await startSpace(space.id)
      router.invalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart space')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className={`mt-1 font-semibold capitalize ${STATUS_COLORS[space.status] ?? ''}`}>
            {space.status}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Region</p>
          <p className="mt-1 font-semibold">{space.region}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Auth</p>
          <p className="mt-1 font-semibold">{space.auth_enabled ? 'Enabled' : 'Public'}</p>
        </div>
      </div>

      {/* Machine controls */}
      {space.fly_machine_id && (
        <div className="mt-6 rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Machine Controls</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStart}
              disabled={!canStart || acting}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {acting && canStart ? 'Starting...' : 'Start'}
            </button>
            <button
              onClick={handleStop}
              disabled={!canStop || acting}
              className="rounded bg-yellow-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {acting && canStop ? 'Stopping...' : 'Stop'}
            </button>
            <button
              onClick={handleRestart}
              disabled={!canStop || acting}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-40"
            >
              {acting ? 'Restarting...' : 'Restart'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          )}
          <div className="mt-3 text-xs text-muted-foreground">
            <p>Machine: {space.fly_machine_id}</p>
            {space.fly_app_name && <p>App: {space.fly_app_name}.fly.dev</p>}
          </div>
        </div>
      )}

      {/* Provisioning state */}
      {space.status === 'provisioning' && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Your space is being provisioned. This usually takes 30-60 seconds.
          </p>
        </div>
      )}

      {space.status === 'failed' && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            Provisioning failed. Try deleting this space and creating a new one.
          </p>
        </div>
      )}

      {space.description && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Description</h2>
          <p>{space.description}</p>
        </div>
      )}

      <div className="mt-6 text-xs text-muted-foreground">
        <p>Created: {new Date(space.created_at).toLocaleDateString()}</p>
        <p>Last updated: {new Date(space.updated_at).toLocaleDateString()}</p>
        {space.custom_domain && <p>Custom domain: {space.custom_domain}</p>}
      </div>
    </div>
  )
}
