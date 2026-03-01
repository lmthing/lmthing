import { useCallback } from 'react'
import { useFlowList } from '@/lib/workspaceContext'
import { FlowList } from './components'

export default function FlowListPreview() {
  const flows = useFlowList()
  const { isLoading, error } = useFlowList()

  const handleSelectFlow = useCallback((flowId: string) => {
    console.log('Select flow:', flowId)
  }, [])

  const handleCreateFlow = useCallback(() => {
    console.log('Create new flow')
  }, [])

  const handleDeleteFlow = useCallback((flowId: string) => {
    console.log('Delete flow:', flowId)
  }, [])

  const handleTagFilterChange = useCallback((tag: string | null) => {
    console.log('Filter by tag:', tag)
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }
  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error loading data</div>
  }

  return (
    <FlowList
      flows={flows}
      selectedFlowId={null}
      onSelectFlow={handleSelectFlow}
      onCreateFlow={handleCreateFlow}
      onDeleteFlow={handleDeleteFlow}
      activeTagFilter={null}
      onTagFilterChange={handleTagFilterChange}
    />
  )
}
