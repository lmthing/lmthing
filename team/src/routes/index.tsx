import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Rooms,
})

function Rooms() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">lmthing team</h1>
    </div>
  )
}
