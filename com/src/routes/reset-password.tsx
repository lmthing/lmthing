import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/reset-password')({
  component: ResetPassword,
})

// There are no passwords to reset: sign-in is either a mailed one-time code or
// GitHub. Redirects to the sign-in page, which offers both.
function ResetPassword() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate({ to: '/login' })
  }, [navigate])

  return null
}
