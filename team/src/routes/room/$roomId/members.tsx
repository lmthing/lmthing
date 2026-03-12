import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/room/$roomId/members')({
  component: Members,
})

function Members() {
  const { roomId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Members: {roomId}</h1>
    </div>
  )
}
