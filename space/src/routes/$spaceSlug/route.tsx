import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SpaceProvider, useSpace } from '@/lib/SpaceContext'
import { useAuth } from '@lmthing/auth'
import { getSpace } from '@/lib/api'
import type { Space } from '@/lib/types'

export const Route = createFileRoute('/$spaceSlug')({
  loader: async ({ params }): Promise<Space> => {
    return getSpace(params.spaceSlug)
  },
  component: SpaceLayout,
  errorComponent: SpaceError,
})

function SpaceLayout() {
  const space = Route.useLoaderData()

  return (
    <SpaceProvider space={space}>
      <SpaceRoleGate>
        <Outlet />
      </SpaceRoleGate>
    </SpaceProvider>
  )
}

function SpaceRoleGate({ children }: { children: React.ReactNode }) {
  const { space, isOwner } = useSpace()
  const { isAuthenticated } = useAuth()

  // Owner always gets access
  if (isOwner) return <>{children}</>

  // Visitor: check if auth is required
  if (space.auth_enabled && !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 text-xl font-semibold">Access Required</h1>
          <p className="text-muted-foreground">This space requires authentication.</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function SpaceError() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="mb-2 text-2xl font-bold">Space not found</h1>
        <p className="text-muted-foreground">This space doesn't exist or has been removed.</p>
      </div>
    </div>
  )
}
