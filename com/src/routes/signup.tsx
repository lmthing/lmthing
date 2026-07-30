import { createFileRoute } from '@tanstack/react-router'
import { SignInPanel } from '@/lib/auth/SignInPanel'

export const Route = createFileRoute('/signup')({
  component: Signup,
})

function Signup() {
  return (
    <SignInPanel
      heading="Create an account"
      subheading="Enter your email to get started, or continue with GitHub."
    />
  )
}
