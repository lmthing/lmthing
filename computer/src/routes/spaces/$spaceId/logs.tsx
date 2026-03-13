import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/spaces/$spaceId/logs')({
  component: SpaceLogs,
})

function SpaceLogs() {
  const { spaceId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Logs: {spaceId}</h1>
    </div>
  )
}
