import { useCallback, useMemo, useRef } from 'react'
import { useUIState, useToggle, useSpaceFS, useGlob } from '@lmthing/state'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { TopicEditor } from '@lmthing/ui/components/knowledge/topic-detail/topic-editor'
import type { TopicEditorHandle } from '@lmthing/ui/components/knowledge/topic-detail/topic-editor'
import { FieldIndexPanel } from '@lmthing/ui/components/knowledge/field/directory-metadata-panel'
import { DeleteModal } from '@lmthing/ui/components/knowledge/field/delete-modal'
import { RenameModal } from '@lmthing/ui/components/knowledge/field/rename-modal'
import {
  ArrowLeft,
  FilePlus,
  FileText,
  BookOpen,
  Trash2,
  Edit3,
} from 'lucide-react'
import { cn } from '@lmthing/ui/lib/utils'

type PanelType = 'field-index' | 'option'

function FieldDetailPage() {
  const params = Route.useParams()
  const { projectId, spaceId, fieldId } = params
  const navigate = useNavigate()
  const spaceFS = useSpaceFS()

  // Decode domain and field from fieldId param (encoded as domain---field)
  const separatorIdx = fieldId.indexOf('---')
  const domain = separatorIdx >= 0 ? fieldId.slice(0, separatorIdx) : fieldId
  const field = separatorIdx >= 0 ? fieldId.slice(separatorIdx + 3) : ''

  const spacePath = `/${projectId}/${spaceId}`

  // Get all files in the field directory
  const fieldGlob = useGlob(field ? `knowledge/${domain}/${field}/*.md` : '')

  // Options = all .md files except index.md
  const optionPaths = useMemo(() => {
    return fieldGlob
      .filter(p => !p.endsWith('/index.md'))
      .sort()
  }, [fieldGlob])

  const [selectedPath, setSelectedPath] = useUIState<string | null>('field-detail.selected-path', null)
  const [panelType, setPanelType] = useUIState<PanelType>('field-detail.panel-type', 'field-index')
  const [_hasUnsavedChanges, , setHasUnsavedChanges] = useToggle('field-detail.has-unsaved-changes', false)

  // New option creation
  const [showNewOption, , setShowNewOption] = useToggle('field-detail.show-new-option', false)
  const [newOptionSlug, setNewOptionSlug] = useUIState<string>('field-detail.new-option-slug', '')

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useUIState<{ path: string; isDirectory: boolean } | null>('field-detail.delete-target', null)

  // Rename modal
  const [renameTarget, setRenameTarget] = useUIState<{ path: string; name: string; isDirectory: boolean } | null>('field-detail.rename-target', null)

  const topicEditorRef = useRef<TopicEditorHandle>(null)

  const selectFieldIndex = useCallback(() => {
    setSelectedPath(null)
    setPanelType('field-index')
  }, [])

  const selectOption = useCallback((path: string) => {
    setSelectedPath(path)
    setPanelType('option')
    setHasUnsavedChanges(false)
  }, [])

  const handleCreateOption = useCallback(() => {
    if (!spaceFS || !newOptionSlug.trim() || !field) return
    const slug = newOptionSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    const path = `knowledge/${domain}/${field}/${slug}.md`
    spaceFS.writeFile(path, '')
    setNewOptionSlug('')
    setShowNewOption(false)
    selectOption(path)
  }, [spaceFS, newOptionSlug, domain, field, selectOption])

  const handleConfirmDelete = useCallback(() => {
    if (!spaceFS || !deleteTarget) return
    spaceFS.deletePath(deleteTarget.path)
    if (selectedPath === deleteTarget.path) {
      setSelectedPath(null)
      setPanelType('field-index')
    }
    setDeleteTarget(null)
  }, [spaceFS, deleteTarget, selectedPath])

  const handleRenameConfirm = useCallback((newName: string) => {
    if (!renameTarget || !spaceFS) return
    const parts = renameTarget.path.split('/')
    parts[parts.length - 1] = newName.endsWith('.md') ? newName : `${newName}.md`
    const newPath = parts.join('/')
    spaceFS.duplicatePath(renameTarget.path, newPath)
    spaceFS.deletePath(renameTarget.path)
    if (selectedPath === renameTarget.path) {
      setSelectedPath(newPath)
    }
    setRenameTarget(null)
  }, [renameTarget, spaceFS, selectedPath])

  const optionSlugFromPath = (path: string) => {
    const filename = path.split('/').pop() || ''
    return filename.endsWith('.md') ? filename.slice(0, -3) : filename
  }

  if (!field) {
    return (
      <div style={{ padding: '2rem' }}>
        <Caption muted>Invalid field ID: {fieldId}</Caption>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
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
              {field}
            </Heading>
            <Caption muted style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {domain}
            </Caption>
          </div>
        </Stack>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNewOption(true)}
        >
          <FilePlus style={{ width: '1rem', height: '1rem', marginRight: '0.375rem' }} />
          New Option
        </Button>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left pane: options list */}
        <aside style={{
          width: '16rem',
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem 0' }}>
            {/* Field index entry */}
            <div
              className={cn(
                'field-tree-node',
                panelType === 'field-index' && !selectedPath && 'field-tree-node--selected',
              )}
              style={{ padding: '0.5rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={selectFieldIndex}
            >
              <BookOpen style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem' }}>index.md</span>
            </div>

            {/* Option entries */}
            {optionPaths.map(path => {
              const slug = optionSlugFromPath(path)
              const isSelected = selectedPath === path
              return (
                <div
                  key={path}
                  className={cn('field-tree-node', isSelected && 'field-tree-node--selected')}
                  style={{ padding: '0.5rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={() => selectOption(path)}
                >
                  <FileText style={{ width: '0.875rem', height: '0.875rem', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8125rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slug}</span>
                  <Stack row style={{ gap: '0.125rem', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      style={{ width: '1.5rem', height: '1.5rem' }}
                      onClick={() => setRenameTarget({ path, name: slug, isDirectory: false })}
                    >
                      <Edit3 style={{ width: '0.75rem', height: '0.75rem' }} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      style={{ width: '1.5rem', height: '1.5rem' }}
                      onClick={() => setDeleteTarget({ path, isDirectory: false })}
                    >
                      <Trash2 style={{ width: '0.75rem', height: '0.75rem' }} />
                    </Button>
                  </Stack>
                </div>
              )
            })}

            {/* New option inline form */}
            {showNewOption && (
              <div style={{ padding: '0.5rem 1rem' }}>
                <Input
                  type="text"
                  value={newOptionSlug}
                  onChange={e => setNewOptionSlug(e.target.value)}
                  placeholder="option-slug"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateOption()
                    if (e.key === 'Escape') { setShowNewOption(false); setNewOptionSlug('') }
                  }}
                  style={{ fontSize: '0.8125rem', marginBottom: '0.25rem' }}
                />
                <Stack row gap="sm">
                  <Button variant="primary" size="sm" onClick={handleCreateOption} disabled={!newOptionSlug.trim()}>
                    Add
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setShowNewOption(false); setNewOptionSlug('') }}>
                    Cancel
                  </Button>
                </Stack>
              </div>
            )}

            {optionPaths.length === 0 && !showNewOption && (
              <div style={{ padding: '1rem', textAlign: 'center' }}>
                <Caption muted>No options yet.</Caption>
              </div>
            )}
          </div>
        </aside>

        {/* Main content area */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex' }}>
          {panelType === 'field-index' && !selectedPath ? (
            <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
              <FieldIndexPanel domain={domain} field={field} />
            </div>
          ) : panelType === 'option' && selectedPath ? (
            <div style={{ padding: '1.5rem', flex: 1 }}>
              <TopicEditor
                ref={topicEditorRef}
                topicPath={selectedPath}
                onUnsavedChange={setHasUnsavedChanges}
              />
            </div>
          ) : (
            <Stack style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              flex: 1,
              color: 'var(--color-muted-foreground)',
            }}>
              <FileText style={{ width: '3rem', height: '3rem', strokeWidth: 1, marginBottom: '1rem' }} />
              <Heading level={3} style={{ color: 'var(--color-muted-foreground)' }}>No option selected</Heading>
              <Caption muted style={{ maxWidth: '24rem', textAlign: 'center' }}>
                Select an option from the list, or click index.md to edit field settings.
              </Caption>
            </Stack>
          )}
        </main>
      </div>

      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        nodePath={deleteTarget?.path || ''}
        isDirectory={deleteTarget?.isDirectory || false}
      />

      <RenameModal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={handleRenameConfirm}
        currentName={renameTarget?.name || ''}
        isDirectory={renameTarget?.isDirectory || false}
      />
    </div>
  )
}

export const Route = createFileRoute('/$projectId/$spaceId/knowledge/$fieldId/')({
  component: FieldDetailPage,
})
