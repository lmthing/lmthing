import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/explore/$explorationId')({
  component: ExplorationDetail,
})

function ExplorationDetail() {
  const { explorationId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Exploration: {explorationId}</h1>
    </div>
  )
}
