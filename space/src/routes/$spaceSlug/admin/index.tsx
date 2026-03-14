import { createFileRoute } from '@tanstack/react-router'
import { useSpace } from '@/lib/SpaceContext'

export const Route = createFileRoute('/$spaceSlug/admin/')({
  component: AdminOverview,
})

function AdminOverview() {
  const { space } = useSpace()

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="mt-1 font-semibold capitalize">{space.status}</p>
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
