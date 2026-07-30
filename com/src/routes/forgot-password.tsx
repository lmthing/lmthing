import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPassword,
})

// There are no passwords to reset: sign-in is either a mailed one-time code or
// GitHub. Redirects to the sign-in page, which offers both.
function ForgotPassword() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: '/login' })
  }, [navigate])

  return null
}
