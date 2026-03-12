import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceId/logs')({
  component: Logs,
})

function Logs() {
  const { spaceId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Logs: {spaceId}</h1>
    </div>
  )
}
