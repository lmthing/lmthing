import { createFileRoute } from '@tanstack/react-router'
import { useSpace } from '@/lib/SpaceContext'

export const Route = createFileRoute('/$spaceSlug/app/')({
  component: AppHome,
})

function AppHome() {
  const { space } = useSpace()

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">{space.name}</h1>
      {space.description && <p className="text-muted-foreground">{space.description}</p>}
    </div>
  )
}
