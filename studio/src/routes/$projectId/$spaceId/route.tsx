import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useCallback } from 'react'
import { SpaceProvider } from '@lmthing/state'
import { useAuth } from '@lmthing/auth'
import { StudioLayout } from '@lmthing/ui/components/shell/studio-layout'
import { AgentChatPanel } from '@lmthing/agent-ui'

const COMPUTER_BASE_URL =
  import.meta.env.VITE_COMPUTER_BASE_URL ??
  (import.meta.env.DEV ? 'https://computer.test' : window.location.origin)

const CLOUD_BASE_URL =
  import.meta.env.VITE_CLOUD_URL ??
  (import.meta.env.DEV ? 'https://cloud.test' : 'https://lmthing.cloud')

/** The always-on right-side THING chat (pod-backed `thing` agent). */
function ThingDock() {
  const { getAccessToken } = useAuth()
  const getToken = useCallback(async () => {
    const token = await getAccessToken()
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
    <AgentChatPanel
      computeBaseUrl={COMPUTER_BASE_URL}
      getAccessToken={getToken}
      target={{ mode: 'agentOnly', agentSlug: 'thing' }}
      style={{ flex: 1, minHeight: 0 }}
    />
  )
}

function SpaceLayout() {
  const { spaceId } = Route.useParams()

  return (
    <SpaceProvider spaceId={spaceId}>
      <StudioLayout rightPanel={<ThingDock />}>
        <Outlet />
      </StudioLayout>
    </SpaceProvider>
  )
}

export const Route = createFileRoute('/$projectId/$spaceId')({
  component: SpaceLayout,
})
