import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SpaceProvider } from '@lmthing/state'
import { StudioLayout } from '@lmthing/ui/components/shell/studio-layout'

function SpaceLayout() {
  const { spaceId } = Route.useParams()

  return (
    <SpaceProvider spaceId={spaceId}>
      <StudioLayout>
        <Outlet />
      </StudioLayout>
    </SpaceProvider>
  )
}

export const Route = createFileRoute('/$projectId/$spaceId')({
  component: SpaceLayout,
})
