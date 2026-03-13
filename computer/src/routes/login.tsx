import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/AuthContext'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/" />
  // LoginScreen is rendered by AuthGate in __root.tsx when not authenticated
  return null
}
