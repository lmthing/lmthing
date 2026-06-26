import { useEffect, useState } from 'react'
import { useAuth } from '@lmthing/auth'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_BASE_URL
  ?? import.meta.env.VITE_CLOUD_URL
  ?? (import.meta.env.DEV ? `${window.location.protocol}//cloud.test` : 'https://lmthing.cloud')
const COMPUTER_BASE_URL = import.meta.env.VITE_COMPUTER_BASE_URL
  ?? (import.meta.env.DEV ? `${window.location.protocol}//computer.test` : 'https://lmthing.computer')

export interface PodConfig {
  computerBaseUrl: string
  accessToken: string
}

const DEMO_USER = import.meta.env.VITE_DEMO_USER === 'true'

/**
 * Reads the active session from @lmthing/auth and calls POST /api/compute/ensure
 * so the pod is provisioned before we connect. Returns podConfig when ready.
 */
export function useTierDetection(): { podConfig: PodConfig | null; ensuring: boolean } {
  const { session, isAuthenticated, isLoading, getAccessToken } = useAuth()
  const [podConfig, setPodConfig] = useState<PodConfig | null>(null)
  const [ensuring, setEnsuring] = useState(true)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated || !session) {
      setEnsuring(false)
      return
    }

    let cancelled = false

    async function ensurePod() {
      try {
        let accessToken = session!.accessToken

        if (accessToken === 'demo' || DEMO_USER) {
          // In demo mode, fetch a short-lived token via the same origin (computer.test/api/*
          // is proxied to the gateway by nginx, so no cross-origin cert issues).
          try {
            const res = await fetch(`${COMPUTER_BASE_URL}/api/auth/demo-token`)
            if (res.ok) {
              const data = await res.json() as { access_token: string }
              accessToken = data.access_token
            }
          } catch (e) {
            console.error('Failed to fetch demo token:', e)
          }
        } else {
          // Live token — refresh first if near expiry so compute/ensure and the
          // downstream podConfig carry a fresh JWT (not a stale 12h one).
          accessToken = await getAccessToken()
        }

        // Best-effort pod ensure — don't block the UI if the gateway is unreachable
        try {
          await fetch(`${CLOUD_BASE_URL}/api/compute/ensure`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        } catch {
          // ignore — pod may already be running
        }

        if (!cancelled) {
          setPodConfig({ computerBaseUrl: COMPUTER_BASE_URL, accessToken })
        }
      } catch {
        // ignore parse errors
      } finally {
        if (!cancelled) setEnsuring(false)
      }
    }

    ensurePod()
    return () => { cancelled = true }
  }, [session, isAuthenticated, isLoading, getAccessToken])

  return { podConfig, ensuring }
}

