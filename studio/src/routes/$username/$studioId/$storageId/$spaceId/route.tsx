import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { SpaceProvider } from '@/lib/contexts/SpaceContext'
import { StudioLayout } from '@lmthing/ui/components/shell/studio-layout'
import { buildFullSpaceId } from '@/lib/space-url'
import { useApp } from '@lmthing/state'
import { useAuth } from '@lmthing/auth'
import { savePodSpace, isRunnableSpaceFile } from '@/lib/pod/podSpaces'

/** Debounce delay (ms) between a VFS write and the pod PUT request. */
const POD_SAVE_DEBOUNCE_MS = 1500

/**
 * PodSaveSync — mounts inside a pod space and streams VFS changes back to
 * the pod via PUT /api/projects/:id/spaces/:spaceId/files.
 *
 * Listens to all AppFS events under the space prefix, collects the full
 * file map, and fires a debounced save so rapid edits coalesce.
 */
function PodSaveSync({
  username,
  studioId,
  podProjectId,
  podSpaceId,
}: {
  username: string
  studioId: string
  podProjectId: string
  podSpaceId: string
}) {
  const { appFS } = useApp()
  const { session } = useAuth()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!session?.accessToken) return

    const prefix = `${username}/${studioId}/pod/${podSpaceId}`

    const unsub = appFS.onPrefix(prefix, () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        // Collect all files under this space prefix and strip the prefix
        const snapshot = appFS.getSnapshot()
        const fileMap: Record<string, string> = {}
        const slashPrefix = `${prefix}/`
        for (const [path, content] of Object.entries(snapshot)) {
          if (path.startsWith(slashPrefix)) {
            const relPath = path.slice(slashPrefix.length)
            if (isRunnableSpaceFile(relPath)) {
              fileMap[relPath] = content
            }
          }
        }
        if (Object.keys(fileMap).length === 0) return
        void savePodSpace(podProjectId, podSpaceId, fileMap, session.accessToken).catch(
          (err: unknown) => {
            console.error('[PodSaveSync] failed to save to pod:', err)
          },
        )
      }, POD_SAVE_DEBOUNCE_MS)
    })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      unsub()
    }
  }, [appFS, session, username, studioId, podProjectId, podSpaceId])

  return null
}

function SpaceLayout() {
  const { username, studioId, storageId, spaceId } = Route.useParams()
  const fullSpaceId = buildFullSpaceId(storageId, spaceId)

  // For pod spaces, look up the podProjectId stored in lmthing.json during load.
  const { appFS } = useApp()
  let podProjectId: string | null = null
  if (storageId === 'pod') {
    const configRaw = appFS.readFile(`${username}/${studioId}/lmthing.json`)
    if (configRaw) {
      try {
        const config = JSON.parse(configRaw) as {
          spaces?: Record<string, { podProjectId?: string }>
        }
        podProjectId = config.spaces?.[`pod/${spaceId}`]?.podProjectId ?? 'user'
      } catch {
        podProjectId = 'user'
      }
    } else {
      podProjectId = 'user'
    }
  }

  return (
    <SpaceProvider spaceId={fullSpaceId}>
      {storageId === 'pod' && podProjectId !== null && (
        <PodSaveSync
          username={username}
          studioId={studioId}
          podProjectId={podProjectId}
          podSpaceId={spaceId}
        />
      )}
      <StudioLayout>
        <Outlet />
      </StudioLayout>
    </SpaceProvider>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId',
)({
  component: SpaceLayout,
})
