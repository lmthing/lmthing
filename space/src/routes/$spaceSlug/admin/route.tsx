import { createFileRoute, Outlet, Link, useRouterState } from '@tanstack/react-router'
import { useSpace } from '@/lib/SpaceContext'
import { Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/admin')({
  component: AdminLayout,
})

const navItems = [
  { label: 'Overview', path: '' },
  { label: 'Builder', path: '/builder' },
  { label: 'Agents', path: '/agents' },
  { label: 'Pages', path: '/pages' },
  { label: 'Database', path: '/database' },
  { label: 'Users', path: '/users' },
  { label: 'Terminal', path: '/terminal' },
  { label: 'Logs', path: '/logs' },
  { label: 'Settings', path: '/settings' },
]

function AdminLayout() {
  const { spaceSlug } = Route.useParams()
  const { isOwner, space } = useSpace()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  if (!isOwner) {
    return <Navigate to="/$spaceSlug/app" params={{ spaceSlug }} />
  }

  return (
    <div className="flex h-screen">
      <aside className="flex w-56 flex-col border-r bg-muted/30">
        <div className="border-b p-4">
          <h2 className="truncate font-semibold">{space.name}</h2>
          <p className="truncate text-xs text-muted-foreground">/{space.slug}</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {navItems.map(item => {
            const href = `/${spaceSlug}/admin${item.path}`
            const isActive = item.path === ''
              ? currentPath === `/${spaceSlug}/admin` || currentPath === `/${spaceSlug}/admin/`
              : currentPath.startsWith(href)

            return (
              <Link
                key={item.path}
                to={href}
                className={`block rounded px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-2">
          <Link
            to="/$spaceSlug/app"
            params={{ spaceSlug }}
            className="block rounded px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            View App →
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
