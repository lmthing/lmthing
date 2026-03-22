import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { provision, storeTokens } from '@/lib/cloud'

export const Route = createFileRoute('/callback')({
  component: Callback,
})

function Callback() {
  const navigate = useNavigate()
  const { setSessionFromOAuth } = useAuth()

  useEffect(() => {
    // Extract tokens from Supabase implicit OAuth redirect (#access_token=...)
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
        const storedRedirect = sessionStorage.getItem('login_redirect')
        if (storedRedirect) {
          sessionStorage.removeItem('login_redirect')
          window.location.href = storedRedirect
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
