// src/hooks/useUnsavedChanges.ts

import { useSyncExternalStore } from 'react'
import { useApp } from './studio/useApp'

export function useUnsavedChanges(): number {
  const { drafts } = useApp()

  return useSyncExternalStore(
    cb => drafts.subscribe(cb),
    () => drafts.getCount(),
  )
}

export function useHasUnsavedChanges(): boolean {
  const count = useUnsavedChanges()
  return count > 0
}

export function useDraftPaths(): string[] {
  const { drafts } = useApp()

  return useSyncExternalStore(
    cb => drafts.subscribe(cb),
    () => drafts.getPaths(),
  )
}
