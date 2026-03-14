import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { getUsage } from '@/lib/cloud'

interface UsageData {
  stripe_customer_id: string
  balance_cents: number
  balance_display: string
  has_credit: boolean
}

export const Route = createFileRoute('/billing/usage')({
  component: Usage,
})

function Usage() {
  const { user, loading: authLoading } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/login?redirect=/billing/usage'
      return
    }
    if (user) {
      getUsage()
        .then(setUsage)
        .catch(err => setError(err instanceof Error ? err.message : 'Failed to load usage'))
        .finally(() => setLoading(false))
    }
  }, [user, authLoading])

  if (authLoading || loading) return null

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">Usage</h1>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {usage && (
        <div className="rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-semibold">Account balance</h2>
          <div className="mb-2 text-3xl font-bold">{usage.balance_display}</div>
          <p className="text-sm text-muted-foreground">
            {usage.has_credit ? 'Credit remaining on your account' : 'Current balance'}
          </p>
        </div>
      )}
    </div>
  )
}
