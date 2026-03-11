// src/hooks/useUIState.ts

import { useCallback, useSyncExternalStore } from 'react'
import { useApp } from './studio/useApp'

/**
 * Ephemeral UI state hook — replaces useState for view-level concerns
 * (expanded sections, open modals, sidebar collapsed, etc.)
 *
 * State lives in UIStore (in-memory, not persisted).
 * Shared across components using the same key.
 *
 * @param key - Unique key for this piece of UI state (e.g. 'studio-sidebar.collapsed')
 * @param initial - Default value when key doesn't exist yet
 */
export function useUIState<T>(key: string, initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const { ui } = useApp()

  // Initialize on first access
  if (!ui.has(key)) {
    ui.set(key, initial)
  }

  const value = useSyncExternalStore(
    cb => ui.subscribe(cb),
    () => {
      const v = ui.get<T>(key)
      return v !== undefined ? v : initial
    },
  )

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    if (typeof next === 'function') {
      const current = ui.get<T>(key) ?? initial
      ui.set(key, (next as (prev: T) => T)(current))
    } else {
      ui.set(key, next)
    }
  }, [ui, key, initial])

  return [value, setValue]
}

/**
 * Boolean toggle hook — convenience wrapper around useUIState
 *
 * @param key - Unique key for this toggle
 * @param initial - Default value (false by default)
 * @returns [value, toggle, setValue] — toggle() flips the boolean
 */
export function useToggle(key: string, initial = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useUIState(key, initial)

  const toggle = useCallback(() => {
    setValue(prev => !prev)
  }, [setValue])

  return [value, toggle, setValue]
}
