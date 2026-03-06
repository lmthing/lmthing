import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { StudioLayout } from '@/components/shell/studio-layout'
import { buildFullSpaceId } from '@/lib/space-url'

function SpaceLayout() {
  const { storageId, spaceId } = Route.useParams()
  const fullSpaceId = buildFullSpaceId(storageId, spaceId)
  return (
    <SpaceProvider spaceId={fullSpaceId}>
      <StudioLayout>
        <Outlet />
      </StudioLayout>
    </SpaceProvider>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId',
)({
  component: SpaceLayout,
})
