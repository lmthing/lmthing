// src/lib/contexts/AppContext.tsx

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AppFS } from '../fs/AppFS'
import { DraftStore } from '../fs/DraftStore'
import type { AppData, StudioData, FileTree, Unsubscribe } from '../types/studio'

const APP_STORAGE_KEY = 'lmthing-app'
const STUDIO_STORAGE_PREFIX = 'lmthing-studio:'

interface AppContextValue {
  appFS: AppFS
  drafts: DraftStore
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [appFS] = useState(() => new AppFS())
  const [drafts] = useState(() => new DraftStore())
  const [studios, setStudios] = useState<Array<{ username: string; studioId: string; name: string }>>([])
  const [currentStudioKey, setCurrentStudioKey] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const appDataJson = localStorage.getItem(APP_STORAGE_KEY)
      if (appDataJson) {
        const appData: AppData = JSON.parse(appDataJson)
        setCurrentStudioKey(appData.currentStudioKey)

        // Load each studio
        for (const [key, studioData] of Object.entries(appData.studios)) {
          loadStudio(key, studioData.files)
        }

        // Build studio list
        const studioList = Object.entries(appData.studios).map(([key, data]) => ({
          username: data.username,
          studioId: data.id,
          name: getStudioName(data.files)
        }))
        setStudios(studioList)
      }
    } catch (e) {
      console.error('Failed to load app data:', e)
      setError('Failed to load application data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Persist appFS changes to localStorage
  useEffect(() => {
    const unsubscribe = appFS.subscribe(() => {
      saveAppData()
    })
    return unsubscribe
  }, [appFS])

  function getStudioName(files: FileTree): string {
    const configContent = files['lmthing.json']
    if (configContent) {
      try {
        const config = JSON.parse(configContent)
        return config.name || 'Untitled Studio'
      } catch {
        return 'Untitled Studio'
      }
    }
    return 'Untitled Studio'
  }

  function loadStudio(key: string, files: FileTree): void {
    for (const [path, content] of Object.entries(files)) {
      appFS.writeFile(path, content)
    }
  }

  function saveAppData(): void {
    try {
      // Build current app data
      const currentFiles = appFS.export()
      const studioGroups = groupByStudio(currentFiles)

      const appData: AppData = {
        studios: studioGroups,
        currentStudioKey,
        currentSpaceId: null // TODO: track current space
      }

      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(appData))

      // Save each studio individually for easy import/export
      for (const [key, studioData] of Object.entries(studioGroups)) {
        localStorage.setItem(`${STUDIO_STORAGE_PREFIX}${key}`, JSON.stringify(studioData.files))
      }

      // Update studios list
      const studioList = Object.entries(studioGroups).map(([key, data]) => ({
        username: data.username,
        studioId: data.id,
        name: getStudioName(data.files)
      }))
      setStudios(studioList)
    } catch (e) {
      console.error('Failed to save app data:', e)
    }
  }

  function groupByStudio(files: FileTree): Record<string, StudioData> {
    const result: Record<string, StudioData> = {}

    for (const [path, content] of Object.entries(files)) {
      const segments = path.split('/')
      if (segments.length < 2) continue

      const [username, studioId] = segments
      const key = `${username}/${studioId}`

      if (!result[key]) {
        result[key] = {
          id: studioId,
          username,
          files: {}
        }
      }

      // Store path without username/studioId prefix
      const relativePath = segments.slice(2).join('/')
      result[key].files[relativePath] = content
    }

    return result
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
    appFS.deletePath(key)

    // Clear from localStorage
    localStorage.removeItem(`${STUDIO_STORAGE_PREFIX}${key}`)

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
