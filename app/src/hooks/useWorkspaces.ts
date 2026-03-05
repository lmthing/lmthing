// useWorkspaces — thin re-export backed by useSpace from @lmthing/state
import { useSpace } from '@lmthing/state'
import type { Space } from '@lmthing/state'

export function useWorkspaces() {
  const space = useSpace()
  return {
    data: space,
    isLoading: false,
    error: null,
  }
}

export type { Space }
