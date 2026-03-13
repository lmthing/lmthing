import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Button } from '@lmthing/ui/elements/forms/button'
import { X, AlertTriangle } from 'lucide-react'
import '@lmthing/css/components/knowledge/index.css'

interface UnsavedChangesModalProps {
  isOpen: boolean
  onDiscard: () => void
  onCancel: () => void
  onSave: () => void
}

export function UnsavedChangesModal({ isOpen, onDiscard, onCancel, onSave }: UnsavedChangesModalProps) {
  if (!isOpen) return null

  return (
    <div className="dialog__backdrop" onClick={onCancel}>
      <div
        className="dialog unsaved-modal"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      >
        <div className="dialog__header">
          <div className="unsaved-modal__header-content">
            <AlertTriangle className="unsaved-modal__warning-icon" />
            <Heading level={3}>Unsaved Changes</Heading>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="unsaved-modal__close-icon" />
          </Button>
        </div>

        <div className="dialog__content">
          <div className="unsaved-modal__body">
            <Caption muted>
              You have unsaved changes. Do you want to save them before switching files?
            </Caption>
          </div>

          <div className="unsaved-modal__footer">
            <Button variant="destructive" onClick={onDiscard}>Discard</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={onSave}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
