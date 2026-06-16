import { useEffect, useState } from 'react'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_BASE_URL
  ?? (import.meta.env.DEV ? `${window.location.protocol}//cloud.test` : 'https://lmthing.cloud')
const COMPUTER_BASE_URL = import.meta.env.VITE_COMPUTER_BASE_URL
  ?? (import.meta.env.DEV ? `${window.location.protocol}//computer.test` : 'https://lmthing.computer')

export interface PodConfig {
  computerBaseUrl: string
  accessToken: string
}

const DEMO_USER = import.meta.env.VITE_DEMO_USER === 'true'

/**
 * Reads the stored access token and optionally calls POST /api/compute/ensure
 * so the pod is provisioned before we connect. Returns podConfig when ready.
 */
export function useTierDetection(): { podConfig: PodConfig | null; ensuring: boolean } {
  const [podConfig, setPodConfig] = useState<PodConfig | null>(null)
  const [ensuring, setEnsuring] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function ensurePod() {
      try {
        let accessToken: string

        if (DEMO_USER) {
          // In demo mode, fetch a short-lived token via the same origin (computer.test/api/*
          // is proxied to the gateway by nginx, so no cross-origin cert issues).
          const res = await fetch(`${COMPUTER_BASE_URL}/api/auth/demo-token`)
          if (!res.ok) { setEnsuring(false); return }
          const data = await res.json() as { access_token: string }
          accessToken = data.access_token
        } else {
          const raw = localStorage.getItem('lmthing-cloud-auth')
          if (!raw) { setEnsuring(false); return }
          const parsed = JSON.parse(raw) as { accessToken: string }
          if (!parsed.accessToken) { setEnsuring(false); return }
          accessToken = parsed.accessToken
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
  }, [])

  return { podConfig, ensuring }
}
