import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { listApiKeys, createApiKey, revokeApiKey } from '@/lib/cloud'

interface ApiKey {
  id: string
  prefix: string
  name: string
  created_at: string
  revoked_at: string | null
}

export const Route = createFileRoute('/account/keys')({
  component: ApiKeys,
})

function ApiKeys() {
  const { user, loading: authLoading } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [error, setError] = useState('')

  const fetchKeys = useCallback(async () => {
    try {
      const data = await listApiKeys()
      setKeys(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      window.location.href = '/login?redirect=/account/keys'
      return
    }
    if (user) fetchKeys()
  }, [user, authLoading, fetchKeys])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      const data = await createApiKey(newKeyName)
      setNewKeyValue(data.key)
      setNewKeyName('')
      fetchKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (keyId: string) => {
    setError('')
    try {
      await revokeApiKey(keyId)
      fetchKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke key')
    }
  }

  if (authLoading || loading) return null

  const activeKeys = keys.filter(k => !k.revoked_at)
  const revokedKeys = keys.filter(k => k.revoked_at)

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold">API keys</h1>

      {error && <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      {newKeyValue && (
        <div className="mb-6 rounded-md border border-primary bg-primary/5 p-4">
          <p className="mb-2 text-sm font-medium">New API key created. Copy it now — it won't be shown again.</p>
          <code className="block break-all rounded bg-muted px-3 py-2 text-sm">{newKeyValue}</code>
          <button onClick={() => { navigator.clipboard.writeText(newKeyValue); setNewKeyValue('') }} className="mt-2 text-sm text-primary hover:underline">
            Copy and dismiss
          </button>
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Create a new key</h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (optional)" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button type="submit" disabled={creating} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {creating ? 'Creating...' : 'Create key'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Active keys</h2>
        {activeKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active API keys.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeKeys.map(key => (
              <div key={key.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground"><code>{key.prefix}...</code> &middot; Created {new Date(key.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleRevoke(key.id)} className="text-sm text-destructive hover:underline">Revoke</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {revokedKeys.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-muted-foreground">Revoked keys</h2>
          <div className="flex flex-col gap-2">
            {revokedKeys.map(key => (
              <div key={key.id} className="flex items-center justify-between rounded-md border border-border bg-muted/50 p-3 opacity-60">
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground"><code>{key.prefix}...</code> &middot; Revoked {new Date(key.revoked_at!).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
