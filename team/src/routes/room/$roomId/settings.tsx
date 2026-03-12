import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/room/$roomId/settings')({
  component: RoomSettings,
})

function RoomSettings() {
  const { roomId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Room Settings: {roomId}</h1>
    </div>
  )
}
