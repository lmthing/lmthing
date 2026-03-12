import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/explore/')({
  component: ExploreList,
})

function ExploreList() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Explorations</h1>
    </div>
  )
}
