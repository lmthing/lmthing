import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { billingPortal } from '@/lib/cloud'

export const Route = createFileRoute('/billing')({
  component: Billing,
})

function Billing() {
  const { user, loading: authLoading } = useAuth()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  if (authLoading) return null
  if (!user) {
    window.location.href = '/login?redirect=/billing'
    return null
  }

  const handleManage = async () => {
    setError('')
    setOpening(true)
    try {
      const { url } = await billingPortal()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">Billing</h1>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Subscription</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Manage your subscription, payment methods, and invoices through the Stripe billing portal.
        </p>
        <button onClick={handleManage} disabled={opening} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {opening ? 'Opening...' : 'Manage subscription'}
        </button>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Usage</h2>
        <p className="mb-2 text-sm text-muted-foreground">View your token usage and balance.</p>
        <Link to="/billing/usage" className="text-sm text-primary hover:underline">View usage dashboard</Link>
      </section>
    </div>
  )
}
