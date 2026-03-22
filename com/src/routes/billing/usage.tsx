import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { getUsage } from '@/lib/cloud'

interface UsageData {
  tier: string
  spend: number
  max_budget: number
  budget_duration: string
  budget_reset_at: string | null
  models: string[]
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
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-border p-6">
            <h2 className="mb-4 text-lg font-semibold">Budget</h2>
            <div className="mb-2 text-3xl font-bold">${usage.spend.toFixed(2)} <span className="text-lg text-muted-foreground">/ ${usage.max_budget}</span></div>
            <p className="text-sm text-muted-foreground">
              {usage.tier.charAt(0).toUpperCase() + usage.tier.slice(1)} tier &middot; Resets every {usage.budget_duration}
            </p>
            <div className="mt-4 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, (usage.spend / usage.max_budget) * 100)}%` }} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-6">
            <h2 className="mb-4 text-lg font-semibold">Available models</h2>
            {usage.models.length === 0 ? (
              <p className="text-sm text-muted-foreground">All models</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {usage.models.map(m => (
                  <span key={m} className="rounded-md bg-muted px-2 py-1 text-xs font-mono">{m}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
