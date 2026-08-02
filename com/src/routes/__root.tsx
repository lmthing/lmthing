import { createRootRoute, Outlet, Link, useNavigate } from '@tanstack/react-router'
import { AuthProvider, useAuth } from '@/lib/auth/AuthProvider'
import { isAlphaActive, isAlphaUnlocked } from '@/lib/alpha'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'
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
          <Link to="/" className="text-lg font-bold"><CozyThingText text="lmthing" /></Link>
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
          ) : isAlphaActive() && !isAlphaUnlocked() ? (
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Private alpha</span>
          ) : (
            <>
              <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign in</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}

// Both stores require the privacy policy and the account-deletion page to be reachable
// by someone who is not signed in — a reviewer checking the listing is exactly that
// person — so they hang off every page rather than off /account, which redirects to
// /login.
function Footer() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Get launch updates</p>
            <p className="text-xs text-muted-foreground">No spam — just the milestones.</p>
          </div>
          <NewsletterSignup compact />
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">Privacy</Link>
          <Link to="/delete-account" className="text-sm text-muted-foreground hover:text-foreground">Delete account</Link>
          <a href="mailto:support@lmthing.org" className="text-sm text-muted-foreground hover:text-foreground">Support</a>
        </div>
      </div>
    </footer>
  )
}

function RootComponent() {
  return (
    <AuthProvider>
      <Nav />
      <Outlet />
      <Footer />
    </AuthProvider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
