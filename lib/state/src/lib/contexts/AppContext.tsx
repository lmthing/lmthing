// src/lib/contexts/AppContext.tsx

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AppFS } from '../fs/AppFS'
import { DraftStore } from '../fs/DraftStore'
import { UIStore } from '../fs/UIStore'
import type { AppData, StudioData, StudioConfig, FileTree, Unsubscribe } from '../../types/studio'

const APP_STORAGE_KEY = 'lmthing-app'
const STUDIO_STORAGE_PREFIX = 'lmthing-studio:'

interface AppContextValue {
  appFS: AppFS
  drafts: DraftStore
  ui: UIStore
  studios: Array<{ username: string; studioId: string; name: string }>
  currentStudioKey: string | null
  isLoading: boolean
  error: string | null

  setCurrentStudio(username: string, studioId: string): void
  createStudio(username: string, studioId: string, name: string): void
  deleteStudio(username: string, studioId: string): void
  importStudio(username: string, studioId: string, files: FileTree): void
}

const AppContext = createContext<AppContextValue | null>(null)

interface AppProviderProps {
  children: ReactNode
  /** Optional AppFS instance for testing. If not provided, creates a new one. */
  appFS?: AppFS
  /** Optional DraftStore instance for testing. If not provided, creates a new one. */
  draftStore?: DraftStore
  /** Optional UIStore instance for testing. If not provided, creates a new one. */
  uiStore?: UIStore
  /** Optional initial studio key for testing. */
  initialStudioKey?: string | null
  /** Skip loading from localStorage (useful for testing). */
  skipStorage?: boolean
}

export function AppProvider({ children, appFS: providedAppFS, draftStore: providedDraftStore, uiStore: providedUIStore, initialStudioKey, skipStorage = false }: AppProviderProps) {
  const [appFS] = useState(() => providedAppFS ?? new AppFS())
  const [drafts] = useState(() => providedDraftStore ?? new DraftStore())
  const [ui] = useState(() => providedUIStore ?? new UIStore())
  const [studios, setStudios] = useState<Array<{ username: string; studioId: string; name: string }>>([])
  const [currentStudioKey, setCurrentStudioKey] = useState<string | null>(initialStudioKey ?? null)
  const [isLoading, setIsLoading] = useState(skipStorage ? false : true)
  const [error, setError] = useState<string | null>(null)

  // Load from localStorage on mount (skip if skipStorage is true)
  useEffect(() => {
    if (skipStorage || providedAppFS) {
      setIsLoading(false)
      return
    }

    try {
      const appDataJson = localStorage.getItem(APP_STORAGE_KEY)
      if (appDataJson) {
        const appData: AppData = JSON.parse(appDataJson)
        setCurrentStudioKey(appData.currentStudioKey)

        // Load each studio's spaces from individual storage keys
        for (const [studioKey, studioData] of Object.entries(appData.studios)) {
          // Write studio-level config into AppFS
          appFS.writeFile(`${studioKey}/lmthing.json`, JSON.stringify(studioData.config, null, 2))

          // Load each space's files
          for (const spaceId of Object.keys(studioData.config.spaces)) {
            const spaceStorageKey = `${STUDIO_STORAGE_PREFIX}${studioKey}/${spaceId}`
            const spaceJson = localStorage.getItem(spaceStorageKey)
            if (spaceJson) {
              const spaceFiles: FileTree = JSON.parse(spaceJson)
              for (const [relativePath, content] of Object.entries(spaceFiles)) {
                appFS.writeFile(`${studioKey}/${spaceId}/${relativePath}`, content)
              }
            }
          }
        }

        // Build studio list
        const studioList = Object.entries(appData.studios).map(([_key, data]) => ({
          username: data.username,
          studioId: data.id,
          name: data.config.name || 'Untitled Studio'
        }))
        setStudios(studioList)
      }
    } catch (e) {
      console.error('Failed to load app data:', e)
      setError('Failed to load application data')
    } finally {
      setIsLoading(false)
    }
  }, [skipStorage, providedAppFS])

  // Persist appFS changes to localStorage
  useEffect(() => {
    const unsubscribe = appFS.subscribe(() => {
      saveAppData()
    })
    return unsubscribe
  }, [appFS])

  function parseStudioConfig(files: FileTree): StudioConfig | null {
    const configContent = files['lmthing.json']
    if (!configContent) return null
    try {
      return JSON.parse(configContent) as StudioConfig
    } catch {
      return null
    }
  }

  function saveAppData(): void {
    try {
      const currentFiles = appFS.export()

      // Group files by studio (username/studioId)
      const studioFiles: Record<string, FileTree> = {}
      for (const [path, content] of Object.entries(currentFiles)) {
        const segments = path.split('/')
        if (segments.length < 2) continue
        const studioKey = `${segments[0]}/${segments[1]}`
        if (!studioFiles[studioKey]) studioFiles[studioKey] = {}
        const relativePath = segments.slice(2).join('/')
        studioFiles[studioKey][relativePath] = content
      }

      // Build AppData (metadata only) and persist space files separately
      const studioDataMap: Record<string, StudioData> = {}

      for (const [studioKey, files] of Object.entries(studioFiles)) {
        const [username, studioId] = studioKey.split('/')
        const config = parseStudioConfig(files)
        if (!config) continue

        studioDataMap[studioKey] = { id: studioId, username, config }

        // Save each space's files under its own localStorage key
        for (const spaceId of Object.keys(config.spaces)) {
          const spacePrefix = `${spaceId}/`
          const spaceFiles: FileTree = {}
          for (const [relativePath, content] of Object.entries(files)) {
            if (relativePath.startsWith(spacePrefix)) {
              spaceFiles[relativePath.slice(spacePrefix.length)] = content
            }
          }
          localStorage.setItem(
            `${STUDIO_STORAGE_PREFIX}${studioKey}/${spaceId}`,
            JSON.stringify(spaceFiles)
          )
        }
      }

      const appData: AppData = {
        studios: studioDataMap,
        currentStudioKey,
        currentSpaceId: null
      }

      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(appData))

      // Update studios list
      const studioList = Object.entries(studioDataMap).map(([_key, data]) => ({
        username: data.username,
        studioId: data.id,
        name: data.config.name || 'Untitled Studio'
      }))
      setStudios(studioList)
    } catch (e) {
      console.error('Failed to save app data:', e)
    }
  }

  function setCurrentStudio(username: string, studioId: string): void {
    const key = `${username}/${studioId}`
    setCurrentStudioKey(key)
    saveAppData()
  }

  function createStudio(username: string, studioId: string, name: string): void {
    const key = `${username}/${studioId}`

    // Create lmthing.json
    const config = {
      id: studioId,
      name,
      version: '1.0.0',
      spaces: {},
      settings: {}
    }

    appFS.writeFile(`${key}/lmthing.json`, JSON.stringify(config, null, 2))
    saveAppData()
  }

  function deleteStudio(username: string, studioId: string): void {
    const key = `${username}/${studioId}`

    // Read config to find space keys to clean up
    const configContent = appFS.readFile(`${key}/lmthing.json`)
    if (configContent) {
      try {
        const config = JSON.parse(configContent) as StudioConfig
        for (const spaceId of Object.keys(config.spaces)) {
          localStorage.removeItem(`${STUDIO_STORAGE_PREFIX}${key}/${spaceId}`)
        }
      } catch { /* ignore parse errors during cleanup */ }
    }

    appFS.deletePath(key)

    if (currentStudioKey === key) {
      setCurrentStudioKey(null)
    }

    saveAppData()
  }

  function importStudio(username: string, studioId: string, files: FileTree): void {
    const key = `${username}/${studioId}`

    for (const [relativePath, content] of Object.entries(files)) {
      appFS.writeFile(`${key}/${relativePath}`, content)
    }

    saveAppData()
  }

  const value: AppContextValue = {
    appFS,
    drafts,
    ui,
    studios,
    currentStudioKey,
    isLoading,
    error,
    setCurrentStudio,
    createStudio,
    deleteStudio,
    importStudio
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
