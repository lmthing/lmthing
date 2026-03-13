import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/spaces/')({
  component: SpaceList,
})

function SpaceList() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Spaces</h1>
    </div>
  )
}
