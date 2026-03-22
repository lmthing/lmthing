import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'

export const Route = createFileRoute('/signup')({
  component: Signup,
})

function Signup() {
  const { signInWithGitHub } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGitHubSignup = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithGitHub()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-bold">Create an account</h1>
      <p className="mb-6 text-sm text-muted-foreground">Get started with lmthing using your GitHub account</p>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="flex flex-col gap-3">
        <button onClick={handleGitHubSignup} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50">
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
          {loading ? 'Redirecting to GitHub...' : 'Sign up with GitHub'}
        </button>
      </div>
    </div>
  )
}
