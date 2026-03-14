import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'

export const Route = createFileRoute('/reset-password')({
  component: ResetPassword,
})

function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    setError('')
    setLoading(true)
    try {
      await updatePassword(password)
      navigate({ to: '/login' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-bold">Set new password</h1>
      <p className="mb-6 text-sm text-muted-foreground">Enter your new password below</p>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">New password</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Confirm password</span>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <button type="submit" disabled={loading} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="text-foreground hover:underline">Back to sign in</Link>
      </p>
    </div>
  )
}
