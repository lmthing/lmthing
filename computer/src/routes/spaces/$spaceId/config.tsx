import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/spaces/$spaceId/config')({
  component: SpaceConfig,
})

function SpaceConfig() {
  const { spaceId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Config: {spaceId}</h1>
    </div>
  )
}
