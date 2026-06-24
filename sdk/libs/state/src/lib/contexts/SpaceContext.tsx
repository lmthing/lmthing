// src/lib/contexts/SpaceContext.tsx

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { SpaceFS } from '../fs/ScopedFS'
import { useApp } from './AppContext'
import { useProject } from './ProjectContext'
import { isRunnableSpaceFile } from '../pod/transport'

interface SpaceContextValue {
  spaceFS: SpaceFS | null
  spaceId: string | null
  /** True while the initial file hydration from the pod is in flight. */
  isLoading: boolean
  /** Error from the initial hydration, if any. */
  error: string | null
}

const SpaceContext = createContext<SpaceContextValue | null>(null)

interface SpaceProviderProps {
  children: ReactNode
  spaceId?: string
  /** Debounce window for coalescing write-backs to the pod (ms). Default 1500. */
  saveDebounceMs?: number
}

const SAVE_DEBOUNCE_MS = 1500

export function SpaceProvider({
  children,
  spaceId: spaceIdProp,
  saveDebounceMs = SAVE_DEBOUNCE_MS,
}: SpaceProviderProps) {
  const { appFS, transport } = useApp()
  const { projectId, currentSpaceId, setCurrentSpace } = useProject()

  // Sync the provided spaceId prop into ProjectContext.
  useEffect(() => {
    if (spaceIdProp && spaceIdProp !== currentSpaceId) {
      setCurrentSpace(spaceIdProp)
    }
  }, [spaceIdProp, currentSpaceId, setCurrentSpace])

  const activeSpaceId = spaceIdProp ?? currentSpaceId

  const spaceFS = useMemo(() => {
    if (!projectId || !activeSpaceId) return null
    return new SpaceFS(appFS, projectId, activeSpaceId)
  }, [appFS, projectId, activeSpaceId])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track which prefixes we've already hydrated so we don't re-fetch on every
  // re-render and so a cached space isn't wiped when navigating back to it.
  const hydratedRef = useRef<Set<string>>(new Set())

  // ── Hydrate on entry ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId || !activeSpaceId || !transport) return
    const prefix = `${projectId}/${activeSpaceId}`
    if (hydratedRef.current.has(prefix)) return

    // If the cache already holds files under this prefix (e.g. a pre-seeded
    // test AppFS, or navigation back to a previously-visited space), treat the
    // space as already hydrated and skip the network load. The hydrate fetch
    // resolves asynchronously; if it landed it could race with concurrent
    // optimistic edits and clobber them with a stale pod snapshot. The pod
    // remains the source of truth via the debounced write-back below.
    const base = `${prefix}/`
    const alreadyCached = Object.keys(appFS.getSnapshot()).some(
      (p) => p.startsWith(base),
    )
    if (alreadyCached) {
      hydratedRef.current.add(prefix)
      return
    }
    hydratedRef.current.add(prefix)

    let cancelled = false
    setIsLoading(true)
    setError(null)
    transport
      .loadSpaceFiles(projectId, activeSpaceId)
      .then((files) => {
        if (cancelled) return
        // Merge pod files into the cache for the first-entry (cold) case. We
        // skip any path already present (defence-in-depth against concurrent
        // writes) and never wipe — a stale snapshot must not overwrite a newer
        // local edit.
        for (const [relPath, content] of Object.entries(files)) {
          const fullPath = `${prefix}/${relPath}`
          if (!appFS.has(fullPath)) {
            appFS.writeFile(fullPath, content)
          }
        }
      })
      .catch((e) => {
        if (cancelled) return
        // Allow a retry by clearing the hydrated marker on failure.
        hydratedRef.current.delete(prefix)
        console.error('Failed to hydrate space:', e)
        setError(e instanceof Error ? e.message : 'Failed to load space')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [projectId, activeSpaceId, appFS, transport])

  // ── Debounced write-back ─────────────────────────────────────────────────
  // Subscribe to every change under the space prefix and coalesce them into a
  // single `saveSpaceFiles` PUT after the debounce window. This absorbs the old
  // studio `PodSaveSync`.
  useEffect(() => {
    if (!projectId || !activeSpaceId) return
    const prefix = `${projectId}/${activeSpaceId}`
    let timer: ReturnType<typeof setTimeout> | null = null
    let dirty = false

    const flush = () => {
      timer = null
      if (!dirty) return
      dirty = false
      // Collect the current space file map from the cache, filtering runtime
      // files (conversations/, .env*) defensively before sending to the pod.
      const snapshot = appFS.getSnapshot()
      const files: Record<string, string> = {}
      const base = `${prefix}/`
      for (const [fullPath, content] of Object.entries(snapshot)) {
        if (fullPath.startsWith(base)) {
          const relPath = fullPath.slice(base.length)
          if (relPath && isRunnableSpaceFile(relPath)) {
            files[relPath] = content
          }
        }
      }
      // Fire-and-forget; errors are logged but don't block the editor.
      transport
        .saveSpaceFiles(projectId, activeSpaceId, files)
        .catch((e) => console.error('Failed to save space:', e))
    }

    const unsubscribe = appFS.onPrefix(prefix, () => {
      dirty = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, saveDebounceMs)
    })

    return () => {
      unsubscribe()
      if (timer) {
        clearTimeout(timer)
        // Best-effort flush on unmount so trailing edits aren't lost.
        flush()
      }
    }
  }, [projectId, activeSpaceId, appFS, transport, saveDebounceMs])

  const value: SpaceContextValue = {
    spaceFS,
    spaceId: activeSpaceId,
    isLoading,
    error,
  }

  return <SpaceContext.Provider value={value}>{children}</SpaceContext.Provider>
}

export function useSpaceContext(): SpaceContextValue {
  const context = useContext(SpaceContext)
  if (!context) {
    throw new Error('useSpaceContext must be used within SpaceProvider')
  }
  return context
}
