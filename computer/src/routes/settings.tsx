import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Card, CardHeader, CardBody } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_BASE_URL ?? 'https://cloud.lmthing.org'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

async function openBillingPortal(authFetch: (url: string, options?: RequestInit) => Promise<Response>) {
  const res = await authFetch(`${CLOUD_BASE_URL}/api/billing/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ return_url: window.location.href }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? 'Failed to open billing portal')
  }

  const { portal_url } = await res.json()
  window.location.href = portal_url
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

function EnvVars() {
  const { authFetch, isAuthenticated } = useAuth()
  const [vars, setVars] = useState<Record<string, string>>({})
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return }
    let cancelled = false
    authFetch(`${CLOUD_BASE_URL}/api/compute/env`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.vars) setVars(d.vars) })
      .catch(() => { if (!cancelled) setError('Failed to load env vars') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [authFetch, isAuthenticated])

  const addVar = () => {
    const k = newKey.trim()
    const v = newVal
    if (!k) return
    if (!KEY_RE.test(k)) { setError(`Invalid key "${k}"`); return }
    setVars(prev => ({ ...prev, [k]: v }))
    setNewKey('')
    setNewVal('')
    setError(null)
  }

  const removeVar = (key: string) => {
    setVars(prev => { const next = { ...prev }; delete next[key]; return next })
  }

  const save = async () => {
    if (!isAuthenticated) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await authFetch(`${CLOUD_BASE_URL}/api/compute/env`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vars }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Caption muted>Loading...</Caption>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Object.entries(vars).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Input value={k} readOnly style={{ flex: '0 0 40%', fontFamily: 'monospace' }} />
          <Input
            value={v}
            onChange={e => setVars(prev => ({ ...prev, [k]: e.target.value }))}
            style={{ flex: 1, fontFamily: 'monospace' }}
          />
          <Button variant="ghost" size="sm" onClick={() => removeVar(k)}>Remove</Button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <Input
          placeholder="KEY"
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          style={{ flex: '0 0 40%', fontFamily: 'monospace' }}
          onKeyDown={e => e.key === 'Enter' && addVar()}
        />
        <Input
          placeholder="value"
          value={newVal}
          onChange={e => setNewVal(e.target.value)}
          style={{ flex: 1, fontFamily: 'monospace' }}
          onKeyDown={e => e.key === 'Enter' && addVar()}
        />
        <Button variant="secondary" size="sm" onClick={addVar}>Add</Button>
      </div>
      {error && <Caption className="text-destructive">{error}</Caption>}
      {saved && <Caption muted>Saved. Pod is restarting to apply changes.</Caption>}
      <Button variant="primary" size="sm" onClick={save} disabled={saving}>
        {saving ? 'Saving...' : 'Save & Restart Pod'}
      </Button>
    </div>
  )
}

function Settings() {
  const { username, logout, authFetch, isAuthenticated } = useAuth()
  const { status } = useComputer()
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  const handleBillingPortal = async () => {
    setBillingLoading(true)
    setBillingError(null)
    try {
      await openBillingPortal(authFetch)
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setBillingLoading(false)
    }
  }

  return (
    <Page>
      <PageHeader>
        <Heading level={2}>Settings</Heading>
      </PageHeader>
      <PageBody>
        <Card>
          <CardHeader>
            <Heading level={4}>Account</Heading>
          </CardHeader>
          <CardBody>
            <Caption muted>Logged in as</Caption>
            <Caption>{username}</Caption>
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading level={4}>Runtime</Heading>
          </CardHeader>
          <CardBody>
            <Badge variant="primary">Dedicated Pod</Badge>
            <Caption muted>Status: {status}</Caption>
            <Caption muted>
              0.5 CPU, 1 GB memory. Always-on with full metrics and terminal access.
            </Caption>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading level={4}>Environment Variables</Heading>
          </CardHeader>
          <CardBody>
            <Caption muted>
              Variables are injected into your compute pod at startup. Saving will restart your pod.
            </Caption>
            <EnvVars />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading level={4}>Billing</Heading>
          </CardHeader>
          <CardBody>
            {!isAuthenticated && (
              <Caption muted>
                Sign in with your cloud account to manage billing.
              </Caption>
            )}
            {isAuthenticated && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBillingPortal}
                disabled={billingLoading}
              >
                {billingLoading ? 'Redirecting...' : 'Manage Subscription'}
              </Button>
            )}
            {billingError && (
              <Caption className="text-destructive">{billingError}</Caption>
            )}
          </CardBody>
        </Card>
      </PageBody>
    </Page>
  )
}
