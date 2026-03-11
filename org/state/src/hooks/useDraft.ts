// src/hooks/useDraft.ts

import React, { useSyncExternalStore } from 'react'
import { useApp } from './studio/useApp'
import { useFile } from './fs/useFile'

/**
 * Get draft content for a specific path
 * @returns The draft content if exists, otherwise null
 */
export function useDraft(path: string): string | undefined {
  const { drafts } = useApp()

  return useSyncExternalStore(
    cb => drafts.onChange(path, cb),
    () => drafts.get(path),
  )
}

/**
 * Check if a path has unsaved changes
 * @returns true if there's a draft for this path
 */
export function useHasDraft(path: string): boolean {
  const { drafts } = useApp()

  return useSyncExternalStore(
    cb => drafts.onChange(path, cb),
    () => drafts.has(path),
  )
}

/**
 * Get all draft paths matching a pattern
 */
export function useDraftsByPattern(pattern: RegExp): string[] {
  const { drafts } = useApp()

  const getSnapshot = React.useCallback(() => {
    const paths = drafts.getPaths().filter(p => pattern.test(p))
    const key = paths.join('\0')
    if (key !== draftsByPatternCache.key) {
      draftsByPatternCache = { key, value: paths }
    }
    return draftsByPatternCache.value
  }, [drafts, pattern])

  return useSyncExternalStore(
    cb => drafts.subscribe(cb),
    getSnapshot,
  )
}

let draftsByPatternCache: { key: string; value: string[] } = { key: '', value: [] }

/**
 * Draft mutations hook
 * @returns Functions to modify drafts
 */
export function useDraftMutations() {
  const { drafts } = useApp()

  return {
    /**
     * Set or update a draft
     */
    set: (path: string, content: string) => {
      drafts.set(path, content)
    },

    /**
     * Delete a draft
     */
    delete: (path: string) => {
      drafts.delete(path)
    },

    /**
     * Clear all drafts
     */
    clearAll: () => {
      drafts.clear()
    },

    /**
     * Save a draft (write to actual file and clear draft)
     */
    save: async (path: string) => {
      const draftContent = drafts.get(path)
      if (draftContent === undefined) return

      const { useAppFS } = await import('./fs/useAppFS')
      const appFS = useAppFS()
      appFS.writeFile(path, draftContent)
      drafts.delete(path)
    }
  }
}

/**
 * Hook to get file content with draft overlay
 * Returns draft content if available, otherwise actual file content
 */
export function useFileWithDraft(path: string): string | null {
  const { drafts } = useApp()
  const fileContent = useFile(path)

  return useSyncExternalStore(
    cb => drafts.onChange(path, cb),
    () => drafts.get(path) ?? fileContent,
  )
}

/**
 * Hook to get all unsaved changes
 */
export function useUnsavedPaths(): string[] {
  const { drafts } = useApp()

  const getSnapshot = React.useCallback(() => {
    const paths = drafts.getPaths()
    const key = paths.join('\0')
    if (key !== unsavedPathsCache.key) {
      unsavedPathsCache = { key, value: paths }
    }
    return unsavedPathsCache.value
  }, [drafts])

  return useSyncExternalStore(
    cb => drafts.subscribe(cb),
    getSnapshot,
  )
}

let unsavedPathsCache: { key: string; value: string[] } = { key: '', value: [] }
