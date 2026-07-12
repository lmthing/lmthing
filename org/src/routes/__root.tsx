import { useState } from 'react'
import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { Menu, X, Github } from 'lucide-react'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'
import { Sidebar } from '@/components/sidebar'
import '@/index.css'

function RootComponent() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isLanding = pathname === '/'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur">
        {!isLanding && (
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle navigation"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <CozyThingText text="lmthing.org" />
        </Link>
        <span className="hidden text-sm text-muted-foreground sm:inline">docs</span>
        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/docs"
            className="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-block"
          >
            Docs
          </Link>
          <a
            href="https://github.com/lmthing"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="GitHub"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </header>

      {isLanding ? (
        <main className="flex-1">
          <Outlet />
        </main>
      ) : (
        <div className="flex flex-1">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      )}
    </div>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
