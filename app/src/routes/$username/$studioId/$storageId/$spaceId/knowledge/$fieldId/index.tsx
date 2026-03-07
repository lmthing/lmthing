import { useState, useCallback, useRef, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSpaceFS } from '@lmthing/state'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Stack } from '@/elements/layouts/stack'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { FieldTree } from '@/components/knowledge/field/field-tree'
import type { FieldTreeHandle } from '@/components/knowledge/field/field-tree'
import { TopicEditor } from '@/components/knowledge/topic-detail/topic-editor'
import { NewFileModal, collectFolders } from '@/components/knowledge/field/new-file-modal'
import { NewFolderModal } from '@/components/knowledge/field/new-folder-modal'
import { useKnowledgeTree } from '@/hooks/useKnowledgeTree'
import { useKnowledgeField } from '@/hooks/useKnowledgeField'
import { buildSpacePathFromParams } from '@/lib/space-url'
import {
  ArrowLeft,
  Search,
  ChevronsUpDown,
  ChevronsDownUp,
  FilePlus,
  FolderPlus,
  Download,
  FileText,
  Bot,
  X,
} from 'lucide-react'

function FieldDetailPage() {
  const params = Route.useParams()
  const { username, studioId, storageId, spaceId, fieldId } = params
  const navigate = useNavigate()
  const spaceFS = useSpaceFS()

  const knowledge = useKnowledgeField(fieldId)
  const treeNodes = useKnowledgeTree(fieldId)
  const title = knowledge.config?.title || fieldId
  const description = knowledge.config?.description || ''

  const spacePath = buildSpacePathFromParams(username, studioId, storageId, spaceId)

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false)
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false)
  const [isThingOpen, setIsThingOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const treeRef = useRef<FieldTreeHandle>(null)

  const folders = useMemo(() => collectFolders(treeNodes), [treeNodes])
  const defaultLocation = `knowledge/${fieldId}`

  const handleFileSelect = useCallback((path: string) => {
    setSelectedFilePath(path)
  }, [])

  const handleDirectorySelect = useCallback((_path: string) => {
    // Selecting a directory doesn't change the editor
  }, [])

  const handleRenameNode = useCallback((oldPath: string, newPath: string) => {
    if (!spaceFS) return
    spaceFS.duplicatePath(oldPath, newPath)
    spaceFS.deletePath(oldPath)
  }, [spaceFS])

  const handleDeleteNode = useCallback((path: string) => {
    if (!spaceFS) return
    spaceFS.deletePath(path)
    if (selectedFilePath === path) {
      setSelectedFilePath(null)
    }
  }, [spaceFS, selectedFilePath])

  const handleDuplicateNode = useCallback((path: string) => {
    if (!spaceFS) return
    const ext = path.lastIndexOf('.')
    const copyPath = ext > 0
      ? `${path.slice(0, ext)}-copy${path.slice(ext)}`
      : `${path}-copy`
    spaceFS.duplicatePath(path, copyPath)
  }, [spaceFS])

  const handleCreateFile = useCallback((parentPath: string | null) => {
    if (!spaceFS) return
    const parent = parentPath || `knowledge/${fieldId}`
    spaceFS.writeFile(`${parent}/untitled.md`, '')
  }, [spaceFS, fieldId])

  const handleCreateFolder = useCallback((parentPath: string | null) => {
    if (!spaceFS) return
    const parent = parentPath || `knowledge/${fieldId}`
    spaceFS.writeFile(`${parent}/new-folder/config.json`, '{}')
  }, [spaceFS, fieldId])

  const handleCreateFileModal = useCallback((filename: string, location: string) => {
    if (!spaceFS) return
    spaceFS.writeFile(`${location}/${filename}`, '')
    setSelectedFilePath(`${location}/${filename}`)
  }, [spaceFS])

  const handleCreateFolderModal = useCallback((folderName: string, parentLocation: string) => {
    if (!spaceFS) return
    spaceFS.writeFile(`${parentLocation}/${folderName}/config.json`, '{}')
  }, [spaceFS])

  const handleMove = useCallback((dragPath: string, targetPath: string, _index: number) => {
    if (!spaceFS || !targetPath) return
    const fileName = dragPath.split('/').pop() || ''
    const newPath = `${targetPath}/${fileName}`
    if (newPath !== dragPath) {
      spaceFS.duplicatePath(dragPath, newPath)
      spaceFS.deletePath(dragPath)
    }
  }, [spaceFS])

  const handleExport = useCallback(() => {
    if (!spaceFS || isExporting) return
    setIsExporting(true)
    // Simulate export - in production this would bundle files
    setTimeout(() => setIsExporting(false), 1500)
  }, [spaceFS, isExporting])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* US-301: Application Header */}
      <header style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <Stack row style={{ alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: `${spacePath}/knowledge` })}
          >
            <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
          </Button>
          <div style={{ minWidth: 0 }}>
            <Heading level={3} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </Heading>
            {description && (
              <Caption muted style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {description}
              </Caption>
            )}
          </div>
        </Stack>
        <Stack row gap="sm" style={{ alignItems: 'center', flexShrink: 0 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsThingOpen(prev => !prev)}
          >
            <Bot style={{ width: '1rem', height: '1rem', marginRight: '0.375rem' }} />
            {isThingOpen ? 'Hide Thing' : 'Thing'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download style={{ width: '1rem', height: '1rem', marginRight: '0.375rem' }} />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </Stack>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left pane: Tree Explorer */}
        <aside style={{
          width: '18rem',
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Tree header with Knowledge Base label */}
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
            <Stack row style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <Stack row style={{ alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'inline-block',
                }} />
                <span style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-muted-foreground)',
                }}>
                  Knowledge Base
                </span>
              </Stack>
              <Stack row style={{ gap: '0.125rem' }}>
                {/* US-304: Expand/Collapse all */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => treeRef.current?.expandAll()}
                  title="Expand all"
                  style={{ width: '1.5rem', height: '1.5rem' }}
                >
                  <ChevronsUpDown style={{ width: '0.75rem', height: '0.75rem' }} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => treeRef.current?.collapseAll()}
                  title="Collapse all"
                  style={{ width: '1.5rem', height: '1.5rem' }}
                >
                  <ChevronsDownUp style={{ width: '0.75rem', height: '0.75rem' }} />
                </Button>
                {/* US-305/306: New File/Folder buttons */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsNewFileModalOpen(true)}
                  title="New file"
                  style={{ width: '1.5rem', height: '1.5rem' }}
                >
                  <FilePlus style={{ width: '0.75rem', height: '0.75rem' }} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsNewFolderModalOpen(true)}
                  title="New folder"
                  style={{ width: '1.5rem', height: '1.5rem' }}
                >
                  <FolderPlus style={{ width: '0.75rem', height: '0.75rem' }} />
                </Button>
              </Stack>
            </Stack>

            {/* US-303: Search input */}
            <div style={{ position: 'relative' }}>
              <Search style={{
                position: 'absolute',
                left: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '0.875rem',
                height: '0.875rem',
                color: 'var(--color-muted-foreground)',
                pointerEvents: 'none',
              }} />
              <Input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                style={{ paddingLeft: '2rem', fontSize: '0.8125rem' }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.375rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.125rem',
                    color: 'var(--color-muted-foreground)',
                    display: 'flex',
                  }}
                >
                  <X style={{ width: '0.75rem', height: '0.75rem' }} />
                </button>
              )}
            </div>
          </div>

          {/* Tree content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <FieldTree
              ref={treeRef}
              nodes={treeNodes}
              selectedFilePath={selectedFilePath}
              searchQuery={searchQuery}
              onFileSelect={handleFileSelect}
              onDirectorySelect={handleDirectorySelect}
              onRenameNode={handleRenameNode}
              onDeleteNode={handleDeleteNode}
              onDuplicateNode={handleDuplicateNode}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onMove={handleMove}
            />
          </div>
        </aside>

        {/* Right pane: Editor or Empty State */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
          {selectedFilePath ? (
            <div style={{ padding: '1.5rem', flex: 1 }}>
              <TopicEditor topicPath={selectedFilePath} />
            </div>
          ) : (
            /* US-309: Empty state with document icon */
            <Stack style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              flex: 1,
              color: 'var(--color-muted-foreground)',
            }}>
              <FileText style={{ width: '3rem', height: '3rem', strokeWidth: 1, marginBottom: '1rem' }} />
              <Heading level={3} style={{ color: 'var(--color-muted-foreground)' }}>No file selected</Heading>
              <Caption muted style={{ maxWidth: '24rem', textAlign: 'center' }}>
                Select a file from the tree to view and edit its content, or create a new prompt fragment.
              </Caption>
              {knowledge.entries.length > 0 && (
                <Caption muted style={{ marginTop: '0.5rem' }}>
                  {knowledge.entries.length} {knowledge.entries.length === 1 ? 'entry' : 'entries'} in this field
                </Caption>
              )}
            </Stack>
          )}

          {/* US-316: Thing sliding panel */}
          {isThingOpen && (
            <aside style={{
              width: '22rem',
              flexShrink: 0,
              borderLeft: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backgroundColor: 'var(--color-background)',
            }}>
              <div style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <Stack row style={{ alignItems: 'center', gap: '0.5rem' }}>
                  <Bot style={{ width: '1rem', height: '1rem', color: '#8b5cf6' }} />
                  <Heading level={4}>Thing</Heading>
                </Stack>
                <Button variant="ghost" size="icon" onClick={() => setIsThingOpen(false)}>
                  <X style={{ width: '0.875rem', height: '0.875rem' }} />
                </Button>
              </div>
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                color: 'var(--color-muted-foreground)',
              }}>
                <Bot style={{ width: '2.5rem', height: '2.5rem', strokeWidth: 1, marginBottom: '1rem' }} />
                <Caption muted style={{ textAlign: 'center', maxWidth: '16rem' }}>
                  Thing can help you generate content, organize structure, and summarize knowledge.
                </Caption>
              </div>
            </aside>
          )}
        </main>
      </div>

      {/* US-305: New File Modal */}
      <NewFileModal
        isOpen={isNewFileModalOpen}
        onClose={() => setIsNewFileModalOpen(false)}
        onCreate={handleCreateFileModal}
        folders={folders}
        defaultLocation={defaultLocation}
      />

      {/* US-306: New Folder Modal */}
      <NewFolderModal
        isOpen={isNewFolderModalOpen}
        onClose={() => setIsNewFolderModalOpen(false)}
        onCreate={handleCreateFolderModal}
        folders={folders}
        defaultLocation={defaultLocation}
      />
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/knowledge/$fieldId/',
)({
  component: FieldDetailPage,
})
