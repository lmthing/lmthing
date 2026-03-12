// src/hooks/useAsyncAction.ts

import { useCallback } from 'react'
import { useUIState } from './useUIState'

interface AsyncState<T> {
  isLoading: boolean
  error: Error | null
  data: T | null
}

interface AsyncAction<T> extends AsyncState<T> {
  execute: (fn: () => Promise<T>) => Promise<T | undefined>
  reset: () => void
}

/**
 * Track async operation state (loading, error, data).
 * State is stored in UIStore so it's shared and reactive.
 *
 * @param key - Unique key for this async operation
 */
export function useAsyncAction<T = unknown>(key: string): AsyncAction<T> {
  const [state, setState] = useUIState<AsyncState<T>>(key, {
    isLoading: false,
    error: null,
    data: null,
  })

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
    setState({ isLoading: true, error: null, data: null })
    try {
      const result = await fn()
      setState({ isLoading: false, error: null, data: result })
      return result
    } catch (err) {
      setState({ isLoading: false, error: err instanceof Error ? err : new Error(String(err)), data: null })
      return undefined
    }
  }, [setState])

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, data: null })
  }, [setState])

  return {
    ...state,
    execute,
    reset,
  }
}
