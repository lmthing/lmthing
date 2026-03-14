import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin/logs')({
  component: Logs,
})

function Logs() {
  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Logs</h1>
      <p className="text-muted-foreground">Activity logs — coming soon.</p>
    </div>
  )
}
