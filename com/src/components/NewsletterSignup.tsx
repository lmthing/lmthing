import { useState, type FormEvent } from 'react'
import { subscribeNewsletter } from '@/lib/cloud'

type Status = 'idle' | 'submitting' | 'subscribed' | 'error'

/**
 * Newsletter signup. Single opt-in — POSTs the email to the gateway, which adds
 * it as a Resend contact and sends a welcome mail. Public (no invite code), used
 * on the alpha gate (`AlphaSplash`) and in the footer. `compact` narrows the
 * layout for the footer row.
 */
export function NewsletterSignup({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('submitting')
    try {
      await subscribeNewsletter(email)
      setStatus('subscribed')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'subscribed') {
    return (
      <p className={`text-sm text-muted-foreground ${compact ? '' : 'text-center'}`}>
        You&rsquo;re on the list — watch your inbox ✓
      </p>
    )
  }

  return (
    <div className={`w-full ${compact ? 'max-w-sm' : 'mx-auto max-w-md'}`}>
      <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder="you@example.com"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        <button
          type="submit"
          disabled={status === 'submitting' || email.trim().length === 0}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {status === 'error' && (
        <p className="mt-2 text-xs text-destructive">Could not subscribe — please try again.</p>
      )}
    </div>
  )
}
