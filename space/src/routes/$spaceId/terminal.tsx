import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceId/terminal')({
  component: Terminal,
})

function Terminal() {
  const { spaceId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Terminal: {spaceId}</h1>
    </div>
  )
}
