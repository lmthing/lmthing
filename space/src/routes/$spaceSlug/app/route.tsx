import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useSpace } from '@/lib/SpaceContext'

export const Route = createFileRoute('/$spaceSlug/app')({
  component: AppLayout,
})

function AppLayout() {
  const { space } = useSpace()
  const appConfig = space.app_config as { name?: string; theme?: Record<string, unknown> }

  return (
    <div className="min-h-screen">
      <header className="border-b px-6 py-3">
        <h1 className="font-semibold">{appConfig.name || space.name}</h1>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
