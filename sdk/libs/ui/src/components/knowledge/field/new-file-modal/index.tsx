import { useCallback } from 'react'
import { useUIState } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { X } from 'lucide-react'
import type { KnowledgeNode } from '@/types/space-data'
import '@lmthing/css/components/knowledge/index.css'

interface NewFileModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (filename: string, location: string) => void
  folders: { path: string; label: string }[]
  defaultLocation: string
}

export function NewFileModal({ isOpen, onClose, onCreate, folders, defaultLocation }: NewFileModalProps) {
  const [filename, setFilename] = useUIState<string>('new-file-modal.filename', '')
  const [location, setLocation] = useUIState<string>('new-file-modal.location', defaultLocation)

  const handleCreate = useCallback(() => {
    if (!filename.trim()) return
    const name = filename.trim().endsWith('.md') ? filename.trim() : `${filename.trim()}.md`
    onCreate(name, location)
    setFilename('')
    setLocation(defaultLocation)
    onClose()
  }, [filename, location, onCreate, onClose, defaultLocation])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate()
  }, [onClose, handleCreate])

  if (!isOpen) return null

  return (
    <div className="dialog__backdrop" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className="dialog new-file-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog__header">
          <Heading level={3} className="new-file-modal__title">New Prompt Fragment</Heading>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="new-file-modal__close-icon" />
          </Button>
        </div>

        <div className="dialog__content">
          <Stack gap="md" className="new-file-modal__fields">
            <div>
              <Label>Filename</Label>
              <Input
                type="text"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                placeholder="my-prompt.md"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate()
                }}
              />
              <span className="new-file-modal__hint">
                .md extension will be added automatically
              </span>
            </div>

            <div>
              <Label>Location</Label>
              <select
                className="input new-file-modal__select"
                value={location}
                onChange={e => setLocation(e.target.value)}
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

          <div className="new-file-modal__footer">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!filename.trim()}
              className="new-file-modal__create-btn"
            >
              Create
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function collectFolders(nodes: KnowledgeNode[], prefix = ''): { path: string; label: string }[] {
  const result: { path: string; label: string }[] = []
  for (const node of nodes) {
    if (node.type === 'directory') {
      const name = node.path.split('/').pop() || node.path
      const label = prefix ? `${prefix} / ${name}` : name
      result.push({ path: node.path, label })
      if (node.children) {
        result.push(...collectFolders(node.children, label))
      }
    }
  }
  return result
}
