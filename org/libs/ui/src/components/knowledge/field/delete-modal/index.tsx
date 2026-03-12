import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Button } from '@lmthing/ui/elements/forms/button'
import { X, AlertTriangle } from 'lucide-react'

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
        className="dialog"
        style={{ maxWidth: '24rem' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      >
        <div className="dialog__header" style={{ borderBottom: '2px solid #ef4444' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle style={{ width: '1.125rem', height: '1.125rem', color: '#ef4444' }} />
            <Heading level={3} style={{ color: '#ef4444' }}>Delete {isDirectory ? 'Folder' : 'File'}</Heading>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X style={{ width: '1rem', height: '1rem' }} />
          </Button>
        </div>

        <div className="dialog__content">
          <div style={{ padding: '0 1.5rem' }}>
            <Caption>
              Are you sure you want to delete <strong>{name}</strong>?
            </Caption>
            {isDirectory && (
              <Caption muted style={{ marginTop: '0.5rem', display: 'block' }}>
                This will permanently delete this folder and all of its contents. This action cannot be undone.
              </Caption>
            )}
            {!isDirectory && (
              <Caption muted style={{ marginTop: '0.5rem', display: 'block' }}>
                This action cannot be undone.
              </Caption>
            )}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            marginTop: '1rem',
          }}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="destructive" onClick={onConfirm}>Delete</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
