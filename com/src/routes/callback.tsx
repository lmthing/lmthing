import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/callback')({
  component: Callback,
})

function Callback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate({ to: '/' })
      }
    })
  }, [navigate])

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <p className="text-sm text-muted-foreground">Completing sign in...</p>
    </div>
  )
}
