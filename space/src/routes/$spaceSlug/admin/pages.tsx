import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin/pages')({
  component: Pages,
})

function Pages() {
  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Pages</h1>
      <p className="text-muted-foreground">Page & component manager — coming soon.</p>
    </div>
  )
}
