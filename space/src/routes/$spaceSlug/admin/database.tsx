import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin/database')({
  component: Database,
})

function Database() {
  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Database</h1>
      <p className="text-muted-foreground">Database viewer — coming soon.</p>
    </div>
  )
}
