import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@lmthing/auth'

const CLOUD_BASE_URL =
  import.meta.env.VITE_CLOUD_URL ??
  (import.meta.env.DEV ? 'https://cloud.test' : 'https://lmthing.cloud')

async function ensurePod(
  cloudBaseUrl: string,
  accessToken: string,
): Promise<{ pod?: { computeTag?: string; ready?: boolean } }> {
  const res = await fetch(`${cloudBaseUrl}/api/compute/ensure`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`compute/ensure failed: ${res.status}`)
  return res.json() as Promise<{ pod?: { computeTag?: string; ready?: boolean } }>
}

async function fetchLatestTag(cloudBaseUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${cloudBaseUrl}/api/compute/version`)
    if (!res.ok) return null
    const data = (await res.json()) as { tag?: string | null }
    return data.tag ?? null
  } catch {
    return null
  }
}

async function upgradePod(cloudBaseUrl: string, accessToken: string): Promise<void> {
  await fetch(`${cloudBaseUrl}/api/compute/upgrade`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  })
}

async function pollUntilReady(
  cloudBaseUrl: string,
  accessToken: string,
  expectedTag: string,
): Promise<void> {
  return new Promise((resolve) => {
    const check = async () => {
      try {
        const res = await fetch(`${cloudBaseUrl}/api/compute/status`, {
          headers: { authorization: `Bearer ${accessToken}` },
        })
        if (res.ok) {
          const data = (await res.json()) as { pod?: { ready?: boolean; computeTag?: string } }
          if (data.pod?.ready && data.pod.computeTag === expectedTag) {
            resolve()
            return
          }
        }
      } catch { /* still restarting */ }
      setTimeout(check, 2000)
    }
    setTimeout(check, 3000)
  })
}

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  const { session } = useAuth()
  const [podError, setPodError] = useState<string | null>(null)
  const [upgradeAvailable, setUpgradeAvailable] = useState(false)
  const [latestTag, setLatestTag] = useState<string | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('access_token')) return
    if (!session?.accessToken || initRef.current) return
    initRef.current = true

    async function init() {
      try {
        const [ensureData, latest] = await Promise.all([
          ensurePod(CLOUD_BASE_URL, session!.accessToken),
          fetchLatestTag(CLOUD_BASE_URL),
        ])

        const current = ensureData.pod?.computeTag
        if (latest && (current == null || latest !== current)) {
          setLatestTag(latest)
          setUpgradeAvailable(true)
        } else {
          redirect()
        }
      } catch (err) {
        setPodError(err instanceof Error ? err.message : String(err))
      }
    }

    void init()
  }, [session])

  const redirect = () => {
    window.location.replace('/?access_token=' + encodeURIComponent(session!.accessToken))
  }

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      await upgradePod(CLOUD_BASE_URL, session!.accessToken)
      await pollUntilReady(CLOUD_BASE_URL, session!.accessToken, latestTag!)
      await new Promise((r) => setTimeout(r, 1500))
      redirect()
    } catch {
      setUpgrading(false)
      setPodError('Upgrade failed — please try again')
    }
  }

  const handleRetry = () => {
    initRef.current = false
    setPodError(null)
    setUpgradeAvailable(false)
  }

  if (!session) {
    return <div style={styles.center}>Signing in…</div>
  }

  if (podError) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#c00' }}>Failed to start compute pod: {podError}</p>
        <button onClick={handleRetry} style={styles.btn}>Retry</button>
      </div>
    )
  }

  if (upgradeAvailable) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <p style={styles.heading}>New version available</p>
          <p style={styles.sub}>
            Your compute pod is running an older version. Upgrade to get the
            latest features and fixes.
          </p>
          <div style={styles.actions}>
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              {upgrading ? 'Upgrading…' : 'Upgrade'}
            </button>
            <button onClick={redirect} style={styles.btn} disabled={upgrading}>
              Continue without upgrading
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <div style={styles.center}>Starting…</div>
}

const styles = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    color: '#6b7280',
    flexDirection: 'column' as const,
    gap: 12,
  } as React.CSSProperties,
  card: {
    background: 'var(--color-card, #1a1a1a)',
    border: '1px solid var(--color-border, #2a2a2a)',
    borderRadius: 12,
    padding: '32px 40px',
    maxWidth: 420,
    textAlign: 'center' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-foreground, #fff)',
    margin: 0,
  },
  sub: {
    fontSize: 14,
    color: 'var(--color-muted-foreground, #9ca3af)',
    margin: 0,
    lineHeight: 1.5,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    marginTop: 8,
  },
  btn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid var(--color-border, #2a2a2a)',
    background: 'transparent',
    color: 'var(--color-muted-foreground, #9ca3af)',
    cursor: 'pointer',
    fontSize: 14,
  } as React.CSSProperties,
  btnPrimary: {
    background: 'var(--color-brand, #6366f1)',
    color: '#fff',
    border: 'none',
    fontWeight: 500,
  } as React.CSSProperties,
}
