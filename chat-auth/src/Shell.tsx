import { useEffect } from 'react'
import { useAuth } from '@lmthing/auth'
import { LoginScreen } from '@lmthing/ui/components/auth/login-screen'

/**
 * Mirrors the access token into a same-origin cookie so Envoy's `chat-jwt` SecurityPolicy (cookie
 * source) can route the document navigation back to `/` to this user's pod — see
 * `sdk/org/apps/web/src/lib/pod-session.ts#setPodSessionCookie`, which this is a copy of (that
 * file's app is retired in Part C; this shell is the one remaining caller). `path=/` because dsh's
 * own document + assets + `/api/*` all live at the origin root, not under a sub-path.
 */
function setPodSessionCookie(token: string | null | undefined): void {
  if (!token) return
  const secure = location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `access_token=${encodeURIComponent(token)}; path=/; samesite=strict${secure}`
}

/**
 * The whole point of this app (Part B2, see dsh/PROGRESS.md): dsh serves UI *and* API from one
 * per-user pod, so — unlike the old unified web app's JWT-free static shell — the document route
 * itself needs a valid cookie before Envoy will even reach the pod. This page is what an
 * unauthenticated (or cookie-less) navigation to lmthing.chat gets redirected to instead of a bare
 * 401 (see chat-lua-routing's 401 branch in devops/argocd/envoy/chat-policies.yaml): it runs the
 * existing cross-domain SSO bridge (`@lmthing/auth`, identical to every other surface), and once a
 * session exists, sets the cookie and hands off with a real navigation back to `/` — which now
 * succeeds because the cookie is present.
 */
export function Shell() {
  const { isAuthenticated, isLoading, getAccessTokenSync } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return
    setPodSessionCookie(getAccessTokenSync())
    // A full navigation, not client-side routing — this app's only job is the handoff, and the
    // destination is a completely different server (the user's dsh pod), not a route in this SPA.
    window.location.href = '/'
  }, [isAuthenticated, getAccessTokenSync])

  if (isLoading || isAuthenticated) return null
  return <LoginScreen />
}
