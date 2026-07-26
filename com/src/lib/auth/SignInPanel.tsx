import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthProvider'

/**
 * The sign-in surface, shared by `/login` and `/signup`.
 *
 * Both routes render the same thing because on both paths there is nothing to
 * distinguish: an email address that has never been seen gets an account the
 * first time it receives a code, and one that already has an account (from a
 * password registration or a GitHub sign-in) resolves to that same account. The
 * only difference between the two routes is the heading.
 *
 * Two doors, side by side:
 *
 *   - **Email** — the gateway mails a 6-digit code plus a magic link. Typing the
 *     code finishes here; clicking the link finishes on `/callback`, which is
 *     what makes the flow work when mail is read on a different device.
 *   - **GitHub** — unchanged, and deliberately still first-class.
 *
 * `?redirect=` is preserved through both: the email step passes it to the gateway
 * as `?next=` on the callback URL (so the magic link keeps it even in a fresh
 * browser), and the GitHub step keeps using `sessionStorage`, which is enough
 * because that redirect always returns to the tab it left.
 */
export function SignInPanel({ heading, subheading }: { heading: string; subheading: string }) {
  const { signInWithGitHub, sendEmailCode, signInWithEmailCode } = useAuth()

  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [devLink, setDevLink] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const codeInput = useRef<HTMLInputElement>(null)
  const redirect = new URLSearchParams(window.location.search).get('redirect')

  useEffect(() => {
    if (step === 'code') codeInput.current?.focus()
  }, [step])

  const handleGitHub = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      // Store redirect so /callback can use it after auth
      if (redirect) sessionStorage.setItem('login_redirect', redirect)
      await signInWithGitHub()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      setBusy(false)
    }
  }, [redirect, signInWithGitHub])

  const requestCode = useCallback(
    async (resending = false) => {
      setError('')
      setNotice('')
      setBusy(true)
      try {
        const result = await sendEmailCode(email)
        setMaskedEmail(result.email)
        // Only ever present on a dev deployment with no mail transport, so the
        // whole flow can be exercised locally without a relay.
        setDevLink(result.dev_link ?? null)
        setStep('code')
        if (resending) {
          setCode('')
          setNotice('Sent a new code — the previous one no longer works.')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send the code')
      } finally {
        setBusy(false)
      }
    },
    [email, sendEmailCode],
  )

  const submitCode = useCallback(async () => {
    setError('')
    setBusy(true)
    try {
      await signInWithEmailCode(email, code)
      window.location.href = redirect && redirect.startsWith('/') ? redirect : '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work')
      setBusy(false)
    }
  }, [code, email, redirect, signInWithEmailCode])

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-bold">{heading}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {step === 'email' ? subheading : `Enter the 6-digit code we sent to ${maskedEmail}.`}
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}
      {notice && (
        <div className="mb-4 rounded-md border border-border p-3 text-sm text-muted-foreground">
          {notice}
        </div>
      )}

      {step === 'email' ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={e => {
            e.preventDefault()
            void requestCode()
          }}
        >
          <label className="text-sm font-medium" htmlFor="signin-email">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || email.trim().length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? 'Sending code…' : 'Continue with email'}
          </button>
          <p className="text-xs text-muted-foreground">
            No password needed — we&rsquo;ll email you a code and a sign-in link.
          </p>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={e => {
            e.preventDefault()
            void submitCode()
          }}
        >
          <label className="text-sm font-medium" htmlFor="signin-code">
            Sign-in code
          </label>
          <input
            id="signin-code"
            ref={codeInput}
            // `one-time-code` is what lets iOS/Android offer the code straight
            // from the notification, which is the whole point of putting it in
            // the subject line as well as the body.
            autoComplete="one-time-code"
            inputMode="numeric"
            // Spaces and dashes are stripped server-side, so a pasted "123 456"
            // works; the pattern only keeps the browser from blocking it.
            pattern="[0-9 \-]*"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="123456"
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-lg tracking-[0.3em]"
          />
          <button
            type="submit"
            disabled={busy || code.replace(/\D/g, '').length !== 6}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={busy}
              onClick={() => void requestCode(true)}
              className="text-muted-foreground underline hover:text-foreground disabled:opacity-50"
            >
              Send a new code
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setError('')
                setNotice('')
              }}
              className="text-muted-foreground underline hover:text-foreground"
            >
              Use a different email
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            The email also has a link you can open instead — handy if you read mail on another
            device.
          </p>
          {devLink && (
            <a href={devLink} className="text-xs underline">
              Dev only: open the sign-in link
            </a>
          )}
        </form>
      )}

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={() => void handleGitHub()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        Continue with GitHub
      </button>
    </div>
  )
}
