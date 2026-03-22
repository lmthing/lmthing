import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createCheckout } from '@/lib/cloud'
import { plans } from '@/config/plans'
import { useState } from 'react'

export const Route = createFileRoute('/pricing')({
  component: Pricing,
})

function Pricing() {
  const { user } = useAuth()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      window.location.href = `/signup?redirect=/pricing`
      return
    }

    setLoadingPlan(planId)
    try {
      const { url } = await createCheckout(planId)
      window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 text-center">
        <h1 className="mb-3 text-3xl font-bold">Simple, transparent pricing</h1>
        <p className="text-muted-foreground">Start free, scale as you grow. All plans include 10% token markup over provider costs.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {plans.map(plan => (
          <div key={plan.id} className={`flex flex-col rounded-lg border p-6 ${plan.highlighted ? 'border-primary ring-1 ring-primary' : 'border-border'}`}>
            <h2 className="text-lg font-bold">{plan.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
            <div className="mt-4">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-sm text-muted-foreground"> / {plan.period}</span>
            </div>
            <ul className="mt-6 flex flex-1 flex-col gap-2">
              {plan.features.map(feature => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {plan.id !== 'free' ? (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loadingPlan === plan.id}
                  className={`w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${plan.highlighted ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-input bg-background hover:bg-accent'}`}
                >
                  {loadingPlan === plan.id ? 'Redirecting...' : 'Subscribe'}
                </button>
              ) : (
                <button disabled className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground">
                  Current plan
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
