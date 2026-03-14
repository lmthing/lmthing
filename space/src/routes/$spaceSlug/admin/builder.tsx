import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin/builder')({
  component: Builder,
})

function Builder() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-xl font-semibold">Builder</h1>
        <p className="text-sm text-muted-foreground">THING builder chat — coming soon.</p>
      </div>
    </div>
  )
}
