import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/AuthProvider'

export const Route = createFileRoute('/account')({
  component: Account,
})

function Account() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) {
    window.location.href = '/login?redirect=/account'
    return null
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">Account settings</h1>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Profile</h2>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Email</span>
          <input type="email" value={user.email || ''} disabled className="rounded-md border border-input bg-muted px-3 py-2 text-sm" />
        </label>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">API keys</h2>
        <p className="mb-2 text-sm text-muted-foreground">Manage your API keys for programmatic access.</p>
        <Link to="/account/keys" className="text-sm text-primary hover:underline">Manage API keys</Link>
      </section>
    </div>
  )
}
