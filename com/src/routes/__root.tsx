import { createRootRoute, Outlet, Link, useNavigate } from '@tanstack/react-router'
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider'
import '@/index.css'

function Nav() {
  const { user, signOut, loading } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-bold">lmthing</Link>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
          <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground">Docs</Link>
          <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
        </div>
        <div className="flex items-center gap-4">
          {loading ? null : user ? (
            <>
              <Link to="/account" className="text-sm text-muted-foreground hover:text-foreground">Account</Link>
              <Link to="/billing" className="text-sm text-muted-foreground hover:text-foreground">Billing</Link>
              <button onClick={handleSignOut} className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign in with GitHub</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

function RootComponent() {
  return (
    <AuthProvider>
      <Nav />
      <Outlet />
    </AuthProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
