import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { provision, storeTokens } from '@/lib/cloud'

export const Route = createFileRoute('/callback')({
  component: Callback,
})

/**
 * Where to go once the session is stored, or null for the landing page.
 *
 * `?next=` comes first because the passwordless magic link can be opened in a
 * browser that never visited `/login` — the destination has to survive in the URL
 * rather than in this tab's `sessionStorage`, which the GitHub redirect relies on.
 *
 * Only a same-origin path is honoured. `next` arrives from a URL, so accepting an
 * absolute one would turn this page into an open redirect that fires immediately
 * after a session is minted. `//host` is rejected too — the browser reads it as
 * protocol-relative and leaves the origin.
 */
function postLoginDestination(): string | null {
  const next = new URLSearchParams(window.location.search).get('next')
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return sessionStorage.getItem('login_redirect')
}

function Callback() {
  const navigate = useNavigate()
  const { setSessionFromOAuth } = useAuth()

  useEffect(() => {
    // Extract tokens from the gateway's redirect fragment (#access_token=...), built
    // by cloud/gateway/src/routes/auth.ts — either after it resolves the Zitadel IDP
    // intent (GitHub) or after it consumes an email magic link. Both flows land here
    // with the same fragment, so this page does not need to know which one ran.
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const expiresAt = params.get('expires_at')

    if (!accessToken || !refreshToken || !expiresAt) {
      navigate({ to: '/login' })
      return
    }

    // Store tokens and update auth state
    storeTokens({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Number(expiresAt),
    })
    setSessionFromOAuth(accessToken, refreshToken, Number(expiresAt))

    // Provision LiteLLM user + API key (idempotent)
    provision()
      .then(() => {
        const onward = postLoginDestination()
        if (onward) {
          sessionStorage.removeItem('login_redirect')
          window.location.href = onward
        } else {
          navigate({ to: '/' })
        }
      })
      .catch(() => {
        // Provision failed but auth succeeded — navigate anyway
        navigate({ to: '/' })
      })
  }, [navigate, setSessionFromOAuth])

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Completing sign in...</p>
    </div>
  )
}
