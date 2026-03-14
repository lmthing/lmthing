import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Card, CardHeader, CardBody } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_BASE_URL ?? 'https://cloud.lmthing.org'
const CLOUD_AUTH_KEY = 'lmthing-cloud-auth'
const COMPUTER_PRICE_ID = import.meta.env.VITE_COMPUTER_PRICE_ID ?? ''

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function getAuthHeader(): string | null {
  try {
    const raw = localStorage.getItem(CLOUD_AUTH_KEY)
    if (!raw) return null
    const { accessToken } = JSON.parse(raw)
    return accessToken ? `Bearer ${accessToken}` : null
  } catch {
    return null
  }
}

async function openBillingPortal() {
  const authHeader = getAuthHeader()
  if (!authHeader) throw new Error('Not authenticated with cloud')

  const res = await fetch(`${CLOUD_BASE_URL}/functions/v1/billing-portal`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ return_url: window.location.href }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? 'Failed to open billing portal')
  }

  const { portal_url } = await res.json()
  window.location.href = portal_url
}

async function startCheckout() {
  const authHeader = getAuthHeader()
  if (!authHeader) throw new Error('Not authenticated with cloud')

  const res = await fetch(`${CLOUD_BASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_id: COMPUTER_PRICE_ID,
      success_url: `${window.location.origin}/settings?upgraded=1`,
      cancel_url: window.location.href,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message ?? 'Failed to start checkout')
  }

  const { checkout_url } = await res.json()
  window.location.href = checkout_url
}

function Settings() {
  const { username, logout } = useAuth()
  const { tier, status } = useComputer()
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)

  const hasCloudAuth = !!getAuthHeader()

  const handleBillingPortal = async () => {
    setBillingLoading(true)
    setBillingError(null)
    try {
      await openBillingPortal()
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setBillingLoading(false)
    }
  }

  const handleUpgrade = async () => {
    setBillingLoading(true)
    setBillingError(null)
    try {
      await startCheckout()
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Failed to start checkout')
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
            <Badge variant={tier === 'flyio' ? 'primary' : 'muted'}>
              {tier === 'flyio' ? 'Computer ($8/mo)' : 'Free (WebContainer)'}
            </Badge>
            <Caption muted>
              Status: {status}
            </Caption>
            {tier === 'webcontainer' && (
              <Caption muted>
                Upgrade to Computer tier for an always-on Fly.io node with full CPU/memory metrics, network monitoring, and persistent processes.
              </Caption>
            )}
            {tier === 'flyio' && (
              <Caption muted>
                1 core, 1 GB memory on Fly.io. Always-on with full metrics and terminal access.
              </Caption>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading level={4}>Billing</Heading>
          </CardHeader>
          <CardBody>
            {!hasCloudAuth && (
              <Caption muted>
                Sign in with your cloud account to manage billing.
              </Caption>
            )}
            {hasCloudAuth && tier === 'webcontainer' && COMPUTER_PRICE_ID && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpgrade}
                disabled={billingLoading}
              >
                {billingLoading ? 'Redirecting...' : 'Upgrade to Computer ($8/mo)'}
              </Button>
            )}
            {hasCloudAuth && tier === 'flyio' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBillingPortal}
                disabled={billingLoading}
              >
                {billingLoading ? 'Redirecting...' : 'Manage Subscription'}
              </Button>
            )}
            {hasCloudAuth && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBillingPortal}
                disabled={billingLoading}
              >
                {billingLoading ? 'Redirecting...' : 'Billing Portal'}
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
