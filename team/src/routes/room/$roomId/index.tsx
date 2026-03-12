import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/room/$roomId/')({
  component: RoomDetail,
})

function RoomDetail() {
  const { roomId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Room: {roomId}</h1>
    </div>
  )
}
