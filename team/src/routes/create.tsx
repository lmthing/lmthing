import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/create')({
  component: CreateRoom,
})

function CreateRoom() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Create Room</h1>
    </div>
  )
}
