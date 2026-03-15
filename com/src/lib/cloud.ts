import { supabase } from './supabase'

const CLOUD_URL = import.meta.env.VITE_CLOUD_URL || 'http://localhost:54321/functions/v1'

async function cloudFetch(fn: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const res = await fetch(`${CLOUD_URL}/${fn}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(body.error?.message || res.statusText)
  }

  return res.json()
}

export function createCheckout(priceId: string) {
  return cloudFetch('create-checkout', {
    method: 'POST',
    body: JSON.stringify({
      price_id: priceId,
      success_url: `${window.location.origin}/billing?success=true`,
      cancel_url: `${window.location.origin}/pricing`,
    }),
  })
}

export function billingPortal() {
  return cloudFetch('billing-portal', {
    method: 'POST',
    body: JSON.stringify({ return_url: `${window.location.origin}/billing` }),
  })
}

export function getUsage() {
  return cloudFetch('get-usage')
}

export function listApiKeys() {
  return cloudFetch('list-api-keys')
}

export function createApiKey(name?: string) {
  return cloudFetch('create-api-key', {
    method: 'POST',
    body: JSON.stringify({ name: name || 'Default' }),
  })
}

export function revokeApiKey(keyId: string) {
  return cloudFetch('revoke-api-key', {
    method: 'POST',
    body: JSON.stringify({ key_id: keyId }),
  })
}

export function createSsoCode(redirectUri: string, app: string) {
  return cloudFetch('create-sso-code', {
    method: 'POST',
    body: JSON.stringify({ redirect_uri: redirectUri, app }),
  })
}

export function getProfile() {
  return cloudFetch('get-profile')
}

export function updateProfile(updates: { github_repo?: string; github_username?: string; display_name?: string }) {
  return cloudFetch('update-profile', {
    method: 'POST',
    body: JSON.stringify(updates),
  })
}
