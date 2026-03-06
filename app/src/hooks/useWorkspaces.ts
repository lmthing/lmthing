// useWorkspaces — thin re-export backed by useStudio from @lmthing/state
import { useStudio } from '@lmthing/state'

export function useWorkspaces() {
  const { spaces } = useStudio()
  return {
    data: spaces,
    isLoading: false,
    error: null,
  }
}
