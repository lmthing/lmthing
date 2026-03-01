import { useState, useCallback } from 'react'
import { useWorkspaceData } from '@/hooks/useWorkspaceData'
import { ToolLibrary } from './components/ToolLibrary'
import type { ToolLibraryView } from '@/../product/sections/tool-library/types'

type ToolLibraryData = {
  tools: unknown[]
  packages: unknown[]
  environmentVariables: unknown[]
}

export default function ToolLibraryPreview() {
  const { data, loading, error } = useWorkspaceData<ToolLibraryData>('tool-library')
  const [currentView, setCurrentView] = useState<ToolLibraryView>('tools')

  const handleInstallPackage = useCallback((packageName: string) => {
    console.log('Install package:', packageName)
  }, [])

  const handleUninstallPackage = useCallback((packageName: string) => {
    console.log('Uninstall package:', packageName)
  }, [])

  const handleUpdatePackage = useCallback((packageName: string) => {
    console.log('Update package:', packageName)
  }, [])

  const handleSearchPackages = useCallback((query: string) => {
    console.log('Search packages:', query)
  }, [])

  const handleAddEnvVariable = useCallback((variable: unknown) => {
    console.log('Add env variable:', variable)
  }, [])

  const handleUpdateEnvVariable = useCallback((key: string, value: unknown) => {
    console.log('Update env variable:', key, value)
  }, [])

  const handleDeleteEnvVariable = useCallback((key: string) => {
    console.log('Delete env variable:', key)
  }, [])

  const handleToggleTool = useCallback((toolId: string) => {
    console.log('Toggle tool:', toolId)
  }, [])

  const handleChangeView = useCallback((view: ToolLibraryView) => {
    console.log('Change view:', view)
    setCurrentView(view)
  }, [])

  const handleSearchTools = useCallback((query: string) => {
    console.log('Search tools:', query)
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }
  if (error || !data) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error loading data</div>
  }

  return (
    <ToolLibrary
      tools={data.tools}
      packages={data.packages}
      environmentVariables={data.environmentVariables}
      currentView={currentView}
      onInstallPackage={handleInstallPackage}
      onUninstallPackage={handleUninstallPackage}
      onUpdatePackage={handleUpdatePackage}
      onSearchPackages={handleSearchPackages}
      onAddEnvVariable={handleAddEnvVariable}
      onUpdateEnvVariable={handleUpdateEnvVariable}
      onDeleteEnvVariable={handleDeleteEnvVariable}
      onToggleTool={handleToggleTool}
      onChangeView={handleChangeView}
      onSearchTools={handleSearchTools}
    />
  )
}
