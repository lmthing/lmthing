import { useState, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSpaceFS } from '@lmthing/state'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { Button } from '@/elements/forms/button'
import { FieldTree } from '@/components/knowledge/field/field-tree'
import { TopicEditor } from '@/components/knowledge/topic-detail/topic-editor'
import { useKnowledgeTree } from '@/hooks/useKnowledgeTree'
import { useKnowledgeField } from '@/hooks/useKnowledgeField'
import { buildSpacePathFromParams } from '@/lib/space-url'
import { ArrowLeft } from 'lucide-react'

function FieldDetailPage() {
  const params = Route.useParams()
  const { username, studioId, storageId, spaceId, fieldId } = params
  const navigate = useNavigate()
  const spaceFS = useSpaceFS()

  const knowledge = useKnowledgeField(fieldId)
  const treeNodes = useKnowledgeTree(fieldId)
  const title = knowledge.config?.title || fieldId

  const spacePath = buildSpacePathFromParams(username, studioId, storageId, spaceId)

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

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
    // Create a folder by writing a placeholder config
    spaceFS.writeFile(`${parent}/new-folder/config.json`, '{}')
  }, [spaceFS, fieldId])

  const handleMove = useCallback((dragPath: string, targetPath: string, _index: number) => {
    if (!spaceFS || !targetPath) return
    const fileName = dragPath.split('/').pop() || ''
    const newPath = `${targetPath}/${fileName}`
    if (newPath !== dragPath) {
      spaceFS.duplicatePath(dragPath, newPath)
      spaceFS.deletePath(dragPath)
    }
  }, [spaceFS])

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar: Field Tree */}
      <aside style={{
        width: '18rem',
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
          <Stack row style={{ alignItems: 'center', gap: '0.5rem' }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ to: `${spacePath}/knowledge` })}
            >
              <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
            </Button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Heading level={4} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </Heading>
            </div>
          </Stack>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <FieldTree
            nodes={treeNodes}
            selectedFilePath={selectedFilePath}
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

      {/* Main content: Editor */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {selectedFilePath ? (
          <div style={{ padding: '1.5rem' }}>
            <TopicEditor topicPath={selectedFilePath} />
          </div>
        ) : (
          <Stack style={{ alignItems: 'center', justifyContent: 'center', padding: '3rem', height: '100%' }}>
            <Heading level={3}>Select a File</Heading>
            <Caption muted style={{ maxWidth: '24rem', textAlign: 'center' }}>
              Choose a file from the tree to view and edit its content.
            </Caption>
            {knowledge.entries.length > 0 && (
              <Caption muted style={{ marginTop: '0.5rem' }}>
                {knowledge.entries.length} {knowledge.entries.length === 1 ? 'entry' : 'entries'} in this field
              </Caption>
            )}
          </Stack>
        )}
      </main>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/knowledge/$fieldId/',
)({
  component: FieldDetailPage,
})
