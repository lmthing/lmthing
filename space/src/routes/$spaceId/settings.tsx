import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceId/settings')({
  component: SpaceSettings,
})

function SpaceSettings() {
  const { spaceId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Settings: {spaceId}</h1>
    </div>
  )
}
