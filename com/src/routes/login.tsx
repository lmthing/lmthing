import { createFileRoute } from '@tanstack/react-router'
import { SignInPanel } from '@/lib/auth/SignInPanel'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  return (
    <SignInPanel
      heading="Sign in"
      subheading="Sign in with your email, or continue with GitHub."
    />
  )
}
