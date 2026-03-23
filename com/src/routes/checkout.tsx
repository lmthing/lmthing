import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createCheckout, getCheckoutStatus } from '@/lib/cloud'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export const Route = createFileRoute('/checkout')({
  component: Checkout,
})

function Checkout() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const tier = params.get('tier')
  const sessionId = params.get('session_id')

  // If returning from checkout, show status
  if (sessionId) {
    return <CheckoutReturn sessionId={sessionId} />
  }

  if (authLoading) return null
  if (!user) {
    window.location.href = `/login?redirect=/checkout?tier=${tier}`
    return null
  }
  if (!tier) {
    navigate({ to: '/pricing' })
    return null
  }

  return <CheckoutForm tier={tier} />
}

function CheckoutForm({ tier }: { tier: string }) {
  const fetchClientSecret = useCallback(async () => {
    const { client_secret } = await createCheckout(tier)
    return client_secret
  }, [tier])

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">Subscribe to {tier.charAt(0).toUpperCase() + tier.slice(1)}</h1>
      <div id="checkout">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  )
}

function CheckoutReturn({ sessionId }: { sessionId: string }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    getCheckoutStatus(sessionId)
      .then(data => setStatus(data.status))
      .catch(() => setStatus('error'))
  }, [sessionId])

  if (!status) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Verifying payment...</p>
      </div>
    )
  }

  if (status === 'complete') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-3 text-2xl font-bold">Subscription activated!</h1>
        <p className="mb-6 text-muted-foreground">Your API keys have been upgraded. The tier change may take a few seconds to propagate.</p>
        <button onClick={() => navigate({ to: '/billing/usage' })} className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          View usage
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-3 text-2xl font-bold">Something went wrong</h1>
      <p className="mb-6 text-muted-foreground">Payment was not completed. Please try again.</p>
      <button onClick={() => navigate({ to: '/pricing' })} className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Back to pricing
      </button>
    </div>
  )
}
