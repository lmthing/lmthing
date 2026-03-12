import { useEffect, useCallback, useRef } from 'react'
import { useUIState } from '@lmthing/state'
import { Heading } from '@/elements/typography/heading'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { X } from 'lucide-react'

interface RenameModalProps {
  isOpen: boolean
  onClose: () => void
  onRename: (newName: string) => void
  currentName: string
  isDirectory: boolean
}

export function RenameModal({ isOpen, onClose, onRename, currentName, isDirectory }: RenameModalProps) {
  const [name, setName] = useUIState<string>('rename-modal.name', currentName)
  const [error, setError] = useUIState<string>('rename-modal.error', '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      setError('')
      // Auto-select name portion (not extension) after mount
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const dotIndex = currentName.lastIndexOf('.')
          if (dotIndex > 0 && !isDirectory) {
            inputRef.current.setSelectionRange(0, dotIndex)
          } else {
            inputRef.current.select()
          }
        }
      })
    }
  }, [isOpen, currentName, isDirectory])

  const validate = useCallback((value: string): string => {
    if (!value.trim()) return 'Name cannot be empty'
    if (value.includes('/') || value.includes('\\')) return 'Name cannot contain / or \\'
    return ''
  }, [])

  const handleSubmit = useCallback(() => {
    const err = validate(name)
    if (err) {
      setError(err)
      return
    }
    if (name !== currentName) {
      onRename(name.trim())
    }
    onClose()
  }, [name, currentName, validate, onRename, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onClose()
  }, [handleSubmit, onClose])

  if (!isOpen) return null

  return (
    <div className="dialog__backdrop" onClick={onClose}>
      <div
        className="dialog"
        style={{ maxWidth: '24rem' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="dialog__header">
          <Heading level={3}>Rename {isDirectory ? 'Folder' : 'File'}</Heading>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X style={{ width: '1rem', height: '1rem' }} />
          </Button>
        </div>

        <div className="dialog__content">
          <div style={{ padding: '0 1.5rem' }}>
            <Label>New name</Label>
            <Input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              error={!!error}
              autoFocus
            />
            {error && (
              <Caption style={{ color: '#ef4444', marginTop: '0.25rem', display: 'block' }}>
                {error}
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
            <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>Rename</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
