import { useState, useMemo, useEffect } from 'react'
import { useWorkspaceData } from '@/hooks/useWorkspaceData'
import { PromptLibrary } from './components/PromptLibrary'
import type { Directory, PromptFragment, NewFileForm, NewFolderForm, UnsavedChangesAction, FileSystemNode } from '@/../product/sections/prompt-library/types'

// This is a preview wrapper for Design OS only
// It loads workspace-specific sample data and feeds it to the props-based component

// Helper to collect all folder paths from the file system
function collectAllFolderPaths(node: FileSystemNode, paths: string[] = []): string[] {
  if (node.type === 'directory') {
    paths.push(node.path)
    if (node.children) {
      node.children.forEach(child => collectAllFolderPaths(child, paths))
    }
  }
  return paths
}

type PromptLibraryData = {
  fileSystem: Directory
  selectedFile: PromptFragment | null
  expandedFolders: string[]
  unsavedChanges: boolean
}

export default function PromptLibraryPreview() {
  const { data, loading, error } = useWorkspaceData<PromptLibraryData>('prompt-library')

  // State for expanded folders - initialize with empty array
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])

  // Sync expanded folders when data loads
  useEffect(() => {
    if (data?.expandedFolders) {
      setExpandedFolders(data.expandedFolders)
    }
  }, [data])

  // Memoize all folder paths for expand/collapse all
  const allFolderPaths = useMemo(() => {
    if (!data?.fileSystem) return []
    return collectAllFolderPaths(data.fileSystem as FileSystemNode)
  }, [data])

  const handleToggleFolder = (path: string) => {
    setExpandedFolders(prev =>
      prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path]
    )
  }

  const handleExpandAll = () => {
    setExpandedFolders(allFolderPaths)
  }

  const handleCollapseAll = () => {
    setExpandedFolders([])
  }

  const handleSelectFile = (file: PromptFragment) => {
    console.log('Select file:', file.id)
  }

  const handleEditContent = (content: string) => {
    // console.log('Edit content, length:', content.length)
  }

  const handleSave = () => {
    console.log('Save changes')
  }

  const handleCreateFile = ({ filename, parentPath }: NewFileForm) => {
    console.log('Create file:', filename, 'in', parentPath)
  }

  const handleCreateFolder = ({ folderName, parentPath }: NewFolderForm) => {
    console.log('Create folder:', folderName, 'in', parentPath)
  }

  const handleRename = (nodeId: string, newName: string) => {
    console.log('Rename node:', nodeId, 'to', newName)
  }

  const handleMove = (nodeId: string, newParentPath: string) => {
    console.log('Move node:', nodeId, 'to', newParentPath)
  }

  const handleDelete = (nodeId: string) => {
    console.log('Delete node:', nodeId)
  }

  const handleDuplicate = (nodeId: string) => {
    console.log('Duplicate node:', nodeId)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }
  if (error || !data) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error loading data</div>
  }

  return (
    <PromptLibrary
      fileSystem={data.fileSystem as Directory}
      selectedFile={data.selectedFile as PromptFragment | null}
      expandedFolders={expandedFolders}
      unsavedChanges={data.unsavedChanges as boolean}
      onSelectFile={handleSelectFile}
      onToggleFolder={handleToggleFolder}
      onExpandAll={handleExpandAll}
      onCollapseAll={handleCollapseAll}
      onEditContent={handleEditContent}
      onSave={handleSave}
      onCreateFile={handleCreateFile}
      onCreateFolder={handleCreateFolder}
      onRename={handleRename}
      onMove={handleMove}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
    />
  )
}
