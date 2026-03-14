import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin/agents')({
  component: Agents,
})

function Agents() {
  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Agents</h1>
      <p className="text-muted-foreground">Agent management — coming soon.</p>
    </div>
  )
}
