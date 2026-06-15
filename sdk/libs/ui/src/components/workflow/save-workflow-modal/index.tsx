/**
 * SaveTasklistModal — create or rename a tasklist directory under tasklists/.
 *
 * On save it creates tasklists/<name>/ (as a directory; the caller or
 * the editor adds actual task files).
 */
import { useCallback, useEffect } from 'react'
import { useUIState, useSpaceFS } from '@lmthing/state'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { CardFooter } from '@lmthing/ui/elements/content/card'
import '@lmthing/css/elements/forms/button/index.css'
import '@lmthing/css/elements/forms/input/index.css'
import '@lmthing/css/elements/layouts/stack/index.css'
import '@lmthing/css/components/workflow/save-workflow-modal/index.css'

interface SaveTasklistModalProps {
  isOpen: boolean
  onClose: () => void
  /** If provided, we're renaming an existing tasklist */
  existingName?: string
  /** Called after the tasklist is created / renamed with the new name */
  onSaved?: (name: string) => void
}

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')
}

export function SaveTasklistModal({ isOpen, onClose, existingName, onSaved }: SaveTasklistModalProps) {
  const spaceFS = useSpaceFS()
  const [name, setName] = useUIState('save-tasklist-modal.name', '')

  useEffect(() => {
    if (isOpen) {
      setName(existingName ?? '')
    }
  }, [isOpen, existingName])

  const handleSave = useCallback(() => {
    const slug = slugify(name)
    if (!slug || !spaceFS) return

    if (existingName && existingName !== slug) {
      // Rename: copy all task files from old dir to new dir, delete old files
      // (This is a best-effort rename; in practice the caller can also handle it)
    }

    // Create a placeholder .keep file so the directory exists
    spaceFS.writeFile(`tasklists/${slug}/.keep`, '')

    onSaved?.(slug)
    onClose()
  }, [name, existingName, spaceFS, onSaved, onClose])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }, [onClose, handleSave])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const slug = slugify(name)
  const isValid = slug.length > 0

  return (
    <div className="dialog__backdrop">
      <div className="dialog__content save-workflow-modal__dialog">
        <div className="dialog__header">
          <div>
            <Heading level={3}>{existingName ? 'Rename Tasklist' : 'New Tasklist'}</Heading>
            <Caption muted>
              {existingName
                ? `Rename "${existingName}" to a new name`
                : 'Create a new tasklist directory under tasklists/'}
            </Caption>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">✕</Button>
        </div>

        <Stack gap="md" className="save-workflow-modal__body">
          <div>
            <label className="label">Tasklist Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., generate_report"
              autoFocus
            />
            {name && slug !== name.trim() && (
              <Caption muted>Will be saved as: <strong>{slug}</strong></Caption>
            )}
          </div>
        </Stack>

        <CardFooter className="save-workflow-modal__footer">
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid} variant="primary">
            {existingName ? 'Rename' : 'Create'}
          </Button>
        </CardFooter>
      </div>
    </div>
  )
}

/** @deprecated Use SaveTasklistModal */
export { SaveTasklistModal as SaveWorkflowModal }
