import { useEffect, useMemo, useState } from 'react'
import type { RuntimeTier } from './types'

const CLOUD_BASE_URL = import.meta.env.VITE_CLOUD_BASE_URL
  ?? (import.meta.env.DEV ? `${window.location.protocol}//cloud.local` : 'https://lmthing.cloud')
const COMPUTER_BASE_URL = import.meta.env.VITE_COMPUTER_BASE_URL
  ?? (import.meta.env.DEV ? `${window.location.protocol}//computer.local` : 'https://lmthing.computer')
const CLOUD_AUTH_KEY = 'lmthing-cloud-auth'

interface CloudAuth {
  accessToken: string
}

export interface TierDetectionResult {
  tier: RuntimeTier
  podConfig?: {
    computerBaseUrl: string
    accessToken: string
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
 * Detects the user's runtime tier by checking their subscription via /api/auth/me.
 * Pro and Max tiers get a dedicated K8s compute pod. Others use WebContainer.
 */
export function useTierDetection(): TierDetectionResult {
  const [tier, setTier] = useState<RuntimeTier>('webcontainer')
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const cloudAuth = getCloudAuth()
    if (!cloudAuth?.accessToken) {
      setTier('webcontainer')
      return
    }

    // Check user tier via gateway
    fetch(`${CLOUD_BASE_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${cloudAuth.accessToken}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          setTier('webcontainer')
          return
        }
        const data = await res.json()
        const userTier = data.tier as string
        if (userTier === 'pro' || userTier === 'max') {
          setTier('pod')
          setAccessToken(cloudAuth.accessToken)
        } else {
          setTier('webcontainer')
        }
      })
      .catch(() => {
        setTier('webcontainer')
      })
  }, [])

  const podConfig = useMemo(() => {
    if (tier !== 'pod' || !accessToken) return undefined
    return { computerBaseUrl: COMPUTER_BASE_URL, accessToken }
  }, [tier, accessToken])

  return { tier, podConfig }
}
