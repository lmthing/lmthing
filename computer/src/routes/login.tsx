import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Login</h1>
    </div>
  )
}
