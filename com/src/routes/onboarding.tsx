import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { updateProfile } from '@/lib/cloud'

export const Route = createFileRoute('/onboarding')({
  component: Onboarding,
})

function Onboarding() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [repoName, setRepoName] = useState('')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const githubUsername = user?.user_metadata?.user_name || user?.user_metadata?.preferred_username || ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!repoName.trim()) {
      setError('Please enter a repository name')
      return
    }

    if (pin.length < 4) {
      setError('PIN must be at least 4 characters')
      return
    }

    if (pin !== confirmPin) {
      setError('PINs do not match')
      return
    }

    setLoading(true)
    try {
      const fullRepo = githubUsername ? `${githubUsername}/${repoName.trim()}` : repoName.trim()

      // Create the private GitHub repo using the provider token from OAuth
      const githubToken = sessionStorage.getItem('github_provider_token')
      if (githubToken) {
        const createRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: repoName.trim(),
            private: true,
            description: 'lmthing workspace — agents, flows, and knowledge',
            auto_init: true,
          }),
        })
        // 422 means repo already exists, which is fine
        if (!createRes.ok && createRes.status !== 422) {
          const errBody = await createRes.json().catch(() => ({}))
          throw new Error(errBody.message || `Failed to create GitHub repo (${createRes.status})`)
        }
        sessionStorage.removeItem('github_provider_token')
      }

      await updateProfile({
        github_repo: fullRepo,
        github_username: githubUsername,
      })

      // Store the PIN hash in localStorage for client-side encryption
      const pinHash = await hashPin(pin)
      localStorage.setItem('lmthing_pin_hash', pinHash)
      // Store an indicator that the PIN has been set (not the PIN itself)
      localStorage.setItem('lmthing_pin_set', 'true')

      // Check for post-onboarding redirect (from SSO flow)
      const postRedirect = sessionStorage.getItem('post_onboarding_redirect')
      if (postRedirect) {
        sessionStorage.removeItem('post_onboarding_redirect')
        window.location.href = postRedirect
      } else {
        navigate({ to: '/' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-bold">Welcome to lmthing</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Set up your workspace. Your spaces, agents, and knowledge files will be stored in a private GitHub repo.
      </p>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="repo-name" className="text-sm font-medium">Private repository name</label>
          <p className="text-xs text-muted-foreground mb-1">
            A new private repo will be created at <strong>{githubUsername || 'your-username'}/{repoName || 'my-studio'}</strong> to store your workspace files.
          </p>
          <div className="flex items-center gap-2">
            {githubUsername && (
              <span className="text-sm text-muted-foreground">{githubUsername}/</span>
            )}
            <input
              id="repo-name"
              type="text"
              value={repoName}
              onChange={e => setRepoName(e.target.value)}
              required
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="my-studio"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pin" className="text-sm font-medium">Encryption PIN</label>
          <p className="text-xs text-muted-foreground mb-1">
            Used to encrypt environment variables and sensitive data stored in your browser. You'll need this PIN when signing in on a new device.
          </p>
          <input
            id="pin"
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            required
            minLength={4}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="At least 4 characters"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirm-pin" className="text-sm font-medium">Confirm PIN</label>
          <input
            id="confirm-pin"
            type="password"
            value={confirmPin}
            onChange={e => setConfirmPin(e.target.value)}
            required
            minLength={4}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Re-enter your PIN"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? 'Setting up...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
