// src/hooks/studio/useApp.ts

import { useApp as useAppContext } from '../../lib/contexts/AppContext'
import type { AppData, FileTree } from '../../types/studio'

export function useApp() {
  const {
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
  } = useAppContext()

  return {
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
}
