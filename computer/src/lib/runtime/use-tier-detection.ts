import { useEffect, useMemo, useState } from 'react'
import type { RuntimeTier } from './types'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_BASE_URL ?? 'https://cloud.lmthing.org'
const FLYIO_APP_HOST_KEY = 'lmthing-computer:flyio-app-host'
const CLOUD_AUTH_KEY = 'lmthing-cloud-auth'

interface CloudAuth {
  accessToken: string
  appHost?: string
}

interface TierDetectionResult {
  tier: RuntimeTier
  flyioConfig?: {
    appHost: string
    cloudBaseUrl: string
    authHeader: string
  }
}

function getCloudAuth(): CloudAuth | null {
  try {
    const raw = localStorage.getItem(CLOUD_AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CloudAuth
  } catch {
    return null
  }
}

/**
 * Detects the user's runtime tier by checking for a cloud auth session
 * with a Computer tier subscription. Falls back to webcontainer (free tier).
 */
export function useTierDetection(): TierDetectionResult {
  const [tier, setTier] = useState<RuntimeTier>('webcontainer')
  const [appHost, setAppHost] = useState<string | null>(null)
  const [authHeader, setAuthHeader] = useState<string | null>(null)

  useEffect(() => {
    const cloudAuth = getCloudAuth()
    if (!cloudAuth?.accessToken) {
      setTier('webcontainer')
      return
    }

    const header = `Bearer ${cloudAuth.accessToken}`
    const storedHost = cloudAuth.appHost ?? localStorage.getItem(FLYIO_APP_HOST_KEY)

    // Try to issue a computer token — if it succeeds, user has Computer tier
    fetch(`${CLOUD_BASE_URL}/functions/v1/issue-computer-token`, {
      method: 'POST',
      headers: {
        'Authorization': header,
        'Content-Type': 'application/json',
      },
    })
      .then(async (res) => {
        if (res.ok && storedHost) {
          setTier('flyio')
          setAppHost(storedHost)
          setAuthHeader(header)
        } else {
          setTier('webcontainer')
        }
      })
      .catch(() => {
        setTier('webcontainer')
      })
  }, [])

  const flyioConfig = useMemo(() => {
    if (tier !== 'flyio' || !appHost || !authHeader) return undefined
    return { appHost, cloudBaseUrl: CLOUD_BASE_URL, authHeader }
  }, [tier, appHost, authHeader])

  return { tier, flyioConfig }
}
