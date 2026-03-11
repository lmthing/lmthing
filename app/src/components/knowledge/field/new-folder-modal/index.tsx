import { useCallback } from 'react'
import { useUIState } from '@lmthing/state'
import { Stack } from '@/elements/layouts/stack'
import { Heading } from '@/elements/typography/heading'
import { Label } from '@/elements/typography/label'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { X } from 'lucide-react'
import { collectFolders } from '../new-file-modal'

interface NewFolderModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (folderName: string, parentLocation: string) => void
  folders: { path: string; label: string }[]
  defaultLocation: string
}

export function NewFolderModal({ isOpen, onClose, onCreate, folders, defaultLocation }: NewFolderModalProps) {
  const [folderName, setFolderName] = useUIState<string>('new-folder-modal.folder-name', '')
  const [parentLocation, setParentLocation] = useUIState<string>('new-folder-modal.parent-location', defaultLocation)

  const handleCreate = useCallback(() => {
    if (!folderName.trim()) return
    onCreate(folderName.trim(), parentLocation)
    setFolderName('')
    setParentLocation(defaultLocation)
    onClose()
  }, [folderName, parentLocation, onCreate, onClose, defaultLocation])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate()
  }, [onClose, handleCreate])

  if (!isOpen) return null

  return (
    <div className="dialog__backdrop" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className="dialog"
        style={{ maxWidth: '28rem' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog__header">
          <Heading level={3} style={{ color: '#10b981' }}>New Folder</Heading>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X style={{ width: '1rem', height: '1rem' }} />
          </Button>
        </div>

        <div className="dialog__content">
          <Stack gap="md" style={{ padding: '0 1.5rem' }}>
            <div>
              <Label>Folder Name</Label>
              <Input
                type="text"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                placeholder="my-folder"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                }}
              />
            </div>

            <div>
              <Label>Parent Location</Label>
              <select
                className="input"
                value={parentLocation}
                onChange={e => setParentLocation(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value={defaultLocation}>/  (root)</option>
                {folders.map(f => (
                  <option key={f.path} value={f.path}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </Stack>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', marginTop: '1rem' }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!folderName.trim()}
              style={{ backgroundColor: '#10b981' }}
            >
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export { collectFolders }
