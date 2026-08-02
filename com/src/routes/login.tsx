import { createFileRoute } from '@tanstack/react-router'
import { SignInPanel } from '@/lib/auth/SignInPanel'
import { AlphaSplash } from '@/components/AlphaSplash'
import { isAlphaActive, isAlphaUnlocked } from '@/lib/alpha'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  if (isAlphaActive() && !isAlphaUnlocked()) return <AlphaSplash />
  return (
    <SignInPanel
      heading="Sign in"
      subheading="Sign in with your email, or continue with GitHub."
    />
  )
}
