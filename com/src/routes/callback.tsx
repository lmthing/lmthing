import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/callback')({
  component: Callback,
})

function Callback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check if user needs onboarding (no github_repo set)
        const { data: profile } = await supabase
          .from('profiles')
          .select('github_repo')
          .eq('id', session.user.id)
          .single()

        // Preserve the original redirect from the login page
        const storedRedirect = sessionStorage.getItem('login_redirect')

        if (!profile?.github_repo) {
          // Store redirect for after onboarding
          if (storedRedirect) {
            sessionStorage.setItem('post_onboarding_redirect', storedRedirect)
          }
          sessionStorage.removeItem('login_redirect')
          navigate({ to: '/onboarding' })
        } else if (storedRedirect) {
          sessionStorage.removeItem('login_redirect')
          window.location.href = storedRedirect
        } else {
          navigate({ to: '/' })
        }
      }
    })
  }, [navigate])

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Completing sign in...</p>
    </div>
  )
}
