import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin/users')({
  component: Users,
})

function Users() {
  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Users</h1>
      <p className="text-muted-foreground">End-user management — coming soon.</p>
    </div>
  )
}
