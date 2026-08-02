import { useEffect, useState } from 'react'
import { Countdown } from './Countdown'
import { codeInUrl, unlockAlpha, verifyInviteCode } from '@/lib/alpha'

/**
 * The private-alpha gate.
 *
 * Shown on the landing hero and in place of the sign-in panel on `/login` and
 * `/signup` while the alpha is active and the browser is not yet unlocked.
 *
 * A visitor with a code can type it here, or arrive via a `?code=` link. Both
 * paths are verified by hashing the value and comparing digests
 * ({@link verifyInviteCode}); the plaintext code is never compared and never
 * present in this component. On success the browser is marked unlocked and the
 * page reloads so every gated surface (nav button, hero CTAs, the sign-in
 * panel) flips at once.
 */
export function AlphaSplash() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // A `?code=` link: verify it by hash on mount and unlock if it matches.
  useEffect(() => {
    const fromUrl = codeInUrl()
    if (!fromUrl) return
    let cancelled = false
    void verifyInviteCode(fromUrl).then((ok) => {
      if (cancelled || !ok) return
      unlockAlpha()
      window.location.reload()
    })
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      if (await verifyInviteCode(code)) {
        unlockAlpha()
        window.location.reload()
      } else {
        setError('That invite code did not work.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center">
      <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Private alpha
      </span>

      <p className="text-base text-foreground sm:text-lg">
        The first <strong className="font-semibold text-foreground">5,000</strong> subscribers get{' '}
        <strong className="font-semibold text-foreground">$50</strong> in credits.
      </p>

      <Countdown />

      <p className="text-xs text-muted-foreground">Full public launch on 1 January 2027.</p>

      <form
        className="flex w-full flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label htmlFor="alpha-code" className="text-sm font-medium text-foreground">
          Have an invite code?
        </label>
        <input
          id="alpha-code"
          type="text"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter your invite code"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
        />
        {error && (
          <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</div>
        )}
        <button
          type="submit"
          disabled={busy || code.trim().length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Unlock access'}
        </button>
      </form>
    </div>
  )
}
