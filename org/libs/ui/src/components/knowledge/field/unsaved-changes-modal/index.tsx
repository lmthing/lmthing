import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Button } from '@/elements/forms/button'
import { X, AlertTriangle } from 'lucide-react'

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
        className="dialog"
        style={{ maxWidth: '24rem' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
      >
        <div className="dialog__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle style={{ width: '1.125rem', height: '1.125rem', color: '#f59e0b' }} />
            <Heading level={3}>Unsaved Changes</Heading>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X style={{ width: '1rem', height: '1rem' }} />
          </Button>
        </div>

        <div className="dialog__content">
          <div style={{ padding: '0 1.5rem' }}>
            <Caption muted>
              You have unsaved changes. Do you want to save them before switching files?
            </Caption>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            marginTop: '1rem',
          }}>
            <Button variant="destructive" onClick={onDiscard}>Discard</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={onSave}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
