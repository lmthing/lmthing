import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useSpace } from '@/lib/SpaceContext'

export const Route = createFileRoute('/$spaceSlug/')({
  component: SpaceIndex,
})

function SpaceIndex() {
  const { spaceSlug } = Route.useParams()
  const { isOwner } = useSpace()

  // Owner → admin dashboard, Visitor → app
  if (isOwner) {
    return <Navigate to="/$spaceSlug/admin" params={{ spaceSlug }} />
  }

  return <Navigate to="/$spaceSlug/app" params={{ spaceSlug }} />
}
