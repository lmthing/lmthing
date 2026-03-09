// src/lib/contexts/StudioContext.tsx

import { createContext, useContext, useMemo, useState, useSyncExternalStore, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import { StudioFS } from '../fs/ScopedFS'
import { useApp } from './AppContext'
import type { StudioConfig, SpaceConfig, Unsubscribe } from '../../types/studio'

interface StudioContextValue {
  studioFS: StudioFS
  username: string
  studioId: string
  studioConfig: StudioConfig | null
  spaces: Array<{ id: string } & SpaceConfig>
  currentSpaceId: string | null

  setCurrentSpace(spaceId: string): void
  createSpace(spaceId: string, config: SpaceConfig): void
  deleteSpace(spaceId: string): void
  renameSpace(spaceId: string, newId: string): void
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function StudioProvider({ children }: { children: ReactNode }) {
  const { appFS, currentStudioKey } = useApp()

  const username = useMemo(() => {
    if (!currentStudioKey) return ''
    return currentStudioKey.split('/')[0]
  }, [currentStudioKey])

  const studioId = useMemo(() => {
    if (!currentStudioKey) return ''
    return currentStudioKey.split('/')[1]
  }, [currentStudioKey])

  const studioFS = useMemo(() => {
    if (!username || !studioId) return null
    return new StudioFS(appFS, username, studioId)
  }, [appFS, username, studioId])

  const configCacheRef = useRef<{ raw: string | null; parsed: StudioConfig | null }>({ raw: null, parsed: null })

  const subscribeToConfig = useCallback(
    (cb: () => void) => {
      if (!studioFS) return () => { }
      return studioFS.onFile('lmthing.json', cb)
    },
    [studioFS]
  )

  const getConfigSnapshot = useCallback(() => {
    if (!studioFS) return null
    const content = studioFS.readFile('lmthing.json')
    if (content === configCacheRef.current.raw) return configCacheRef.current.parsed
    configCacheRef.current.raw = content
    if (!content) {
      configCacheRef.current.parsed = null
      return null
    }
    try {
      const parsed = JSON.parse(content) as StudioConfig
      configCacheRef.current.parsed = parsed
      return parsed
    } catch {
      configCacheRef.current.parsed = null
      return null
    }
  }, [studioFS])

  const studioConfig = useSyncExternalStore(subscribeToConfig, getConfigSnapshot, () => null)

  const spaces = useMemo(() => {
    if (!studioConfig) return []
    return Object.entries(studioConfig.spaces).map(([id, config]) => ({
      id,
      ...(config as SpaceConfig)
    }))
  }, [studioConfig])

  const [currentSpaceId, setCurrentSpaceId] = useState<string | null>(null)

  function setCurrentSpace(spaceId: string): void {
    setCurrentSpaceId(spaceId)
  }

  function createSpace(spaceId: string, config: SpaceConfig): void {
    if (!studioFS || !studioConfig) return

    const updated: StudioConfig = {
      ...studioConfig,
      spaces: {
        ...studioConfig.spaces,
        [spaceId]: {
          ...config,
          createdAt: config.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    }

    studioFS.writeFile('lmthing.json', JSON.stringify(updated, null, 2))

    // Create package.json for the space
    const packageJson = {
      name: spaceId,
      version: '1.0.0',
      private: true
    }
    studioFS.writeFile(`${spaceId}/package.json`, JSON.stringify(packageJson, null, 2))
  }

  function deleteSpace(spaceId: string): void {
    if (!studioFS || !studioConfig) return

    const { [spaceId]: _removed, ...remainingSpaces } = studioConfig.spaces

    const updated: StudioConfig = {
      ...studioConfig,
      spaces: remainingSpaces
    }

    studioFS.writeFile('lmthing.json', JSON.stringify(updated, null, 2))
    studioFS.deletePath(spaceId)
  }

  function renameSpace(spaceId: string, newId: string): void {
    if (!studioFS || !studioConfig) return

    const spaceConfig = studioConfig.spaces[spaceId]
    if (!spaceConfig) return

    const { [spaceId]: _removed, ...remainingSpaces } = studioConfig.spaces

    const updated: StudioConfig = {
      ...studioConfig,
      spaces: {
        ...remainingSpaces,
        [newId]: {
          ...spaceConfig,
          updatedAt: new Date().toISOString()
        }
      }
    }

    studioFS.writeFile('lmthing.json', JSON.stringify(updated, null, 2))
    studioFS.renamePath(spaceId, newId)
  }

  // Handle null studioFS case (not yet loaded) — provide safe empty value
  if (!studioFS) {
    const emptyValue: StudioContextValue = {
      studioFS: null as any,
      username: '',
      studioId: '',
      studioConfig: null,
      spaces: [],
      currentSpaceId: null,
      setCurrentSpace: () => { },
      createSpace: () => { },
      deleteSpace: () => { },
      renameSpace: () => { },
    }
    return (
      <StudioContext.Provider value={emptyValue}>
        {children}
      </StudioContext.Provider>
    )
  }

  const value: StudioContextValue = {
    studioFS,
    username,
    studioId,
    studioConfig,
    spaces,
    currentSpaceId,
    setCurrentSpace,
    createSpace,
    deleteSpace,
    renameSpace
  }

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext)
  if (!context) {
    throw new Error('useStudio must be used within StudioProvider')
  }
  return context
}
