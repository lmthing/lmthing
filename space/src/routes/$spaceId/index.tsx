import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceId/')({
  component: SpaceDetail,
})

function SpaceDetail() {
  const { spaceId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Space: {spaceId}</h1>
    </div>
  )
}
