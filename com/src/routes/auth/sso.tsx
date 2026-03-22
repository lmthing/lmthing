import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createSsoCode } from '@/lib/cloud'

export const Route = createFileRoute('/auth/sso')({
  component: SsoHandler,
})

function SsoHandler() {
  const { user, loading } = useAuth()
  const [error, setError] = useState('')

  const params = new URLSearchParams(window.location.search)
  const redirect_uri = params.get('redirect_uri')
  const app = params.get('app')
  const state = params.get('state')

  useEffect(() => {
    if (loading) return

    if (!redirect_uri || !app) {
      setError('Missing required parameters: redirect_uri and app')
      return
    }

    if (!user) {
      const ssoParams = new URLSearchParams({ redirect_uri, app, ...(state ? { state } : {}) })
      window.location.href = `/login?redirect=${encodeURIComponent(`/auth/sso?${ssoParams.toString()}`)}`
      return
    }

    createSsoCode(redirect_uri, app)
      .then(({ code }) => {
        const url = new URL(redirect_uri)
        url.searchParams.set('code', code)
        if (state) url.searchParams.set('state', state)
        window.location.href = url.toString()
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to generate SSO code')
      })
  }, [user, loading, redirect_uri, app, state])

  if (error) {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
        <h1 className="mb-2 text-2xl font-bold">SSO Error</h1>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Authenticating...</p>
    </div>
  )
}
