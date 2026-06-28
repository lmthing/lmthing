import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useAuth } from '@lmthing/auth'
import { AgentChatPanel } from '@lmthing/agent-ui'

// In production the pod is reached through the studio origin (Envoy proxies
// /api/* to the user's compute pod); in dev it's the computer.test host.
const COMPUTER_BASE_URL =
  import.meta.env.VITE_COMPUTER_BASE_URL ??
  (import.meta.env.DEV ? 'https://computer.test' : window.location.origin)

const CLOUD_BASE_URL =
  import.meta.env.VITE_CLOUD_URL ??
  (import.meta.env.DEV ? 'https://cloud.test' : 'https://lmthing.cloud')

/**
 * THING chat — a full-page chat with the user's pod-backed `thing` agent
 * (the `user-thing` system space). No space authoring/sync is needed: the pod
 * merges the system spaces at session runtime, so we target the agent directly
 * with `mode: 'agentOnly'`.
 */
function ThingChatPage() {
  const { getAccessToken } = useAuth()

  // Wake the pod, then hand the bearer token to the panel.
  const getToken = useCallback(async () => {
    const token = await getAccessToken()
    // Best-effort pod wake; ignored if it fails (panel surfaces its own error).
    try {
      await fetch(`${CLOUD_BASE_URL}/api/compute/ensure`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      })
    } catch {
      /* non-fatal */
    }
    return token
  }, [getAccessToken])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AgentChatPanel
        computeBaseUrl={COMPUTER_BASE_URL}
        getAccessToken={getToken}
        target={{ mode: 'agentOnly', agentSlug: 'thing' }}
        style={{ flex: 1, minHeight: 0 }}
      />
    </div>
  )
}

export const Route = createFileRoute('/thing/')({
  component: ThingChatPage,
})
