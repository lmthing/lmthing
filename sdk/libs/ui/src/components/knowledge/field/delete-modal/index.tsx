import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Button } from '@lmthing/ui/elements/forms/button'
import { X, AlertTriangle } from 'lucide-react'
import '@lmthing/css/components/knowledge/index.css'

interface DeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  nodePath: string
  isDirectory: boolean
}

export function DeleteModal({ isOpen, onClose, onConfirm, nodePath, isDirectory }: DeleteModalProps) {
  if (!isOpen) return null

  const name = nodePath.split('/').pop() || nodePath

  return (
    <div className="dialog__backdrop" onClick={onClose}>
      <div
        className="dialog delete-modal"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      >
        <div className="dialog__header delete-modal__header">
          <div className="delete-modal__header-content">
            <AlertTriangle className="delete-modal__warning-icon" />
            <Heading level={3} className="delete-modal__title">Delete {isDirectory ? 'Folder' : 'File'}</Heading>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="delete-modal__close-icon" />
          </Button>
        </div>

        <div className="dialog__content">
          <div className="delete-modal__body">
            <Caption>
              Are you sure you want to delete <strong>{name}</strong>?
            </Caption>
            {isDirectory && (
              <Caption muted className="delete-modal__note">
                This will permanently delete this folder and all of its contents. This action cannot be undone.
              </Caption>
            )}
            {!isDirectory && (
              <Caption muted className="delete-modal__note">
                This action cannot be undone.
              </Caption>
            )}
          </div>

          <div className="delete-modal__footer">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirm}>Delete</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
