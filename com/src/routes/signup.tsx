import { createFileRoute } from '@tanstack/react-router'
import { SignInPanel } from '@/lib/auth/SignInPanel'
import { AlphaSplash } from '@/components/AlphaSplash'
import { isAlphaActive, isAlphaUnlocked } from '@/lib/alpha'

export const Route = createFileRoute('/signup')({
  component: Signup,
})

function Signup() {
  if (isAlphaActive() && !isAlphaUnlocked()) return <AlphaSplash />
  return (
    <SignInPanel
      heading="Create an account"
      subheading="Enter your email to get started, or continue with GitHub."
    />
  )
}
