import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPassword,
})

// Password reset is not available with GitHub-only authentication.
// Redirects to login page.
function ForgotPassword() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: '/login' })
  }, [navigate])

  return null
}
