import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Stack } from '@/elements/layouts/stack'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { CardFooter } from '@/elements/content/card'
import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/layouts/stack/index.css'

interface SaveWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  workflowId?: string
}

export function SaveWorkflowModal({ isOpen, onClose, workflowId }: SaveWorkflowModalProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (isOpen) {
      setName('')
    }
  }, [isOpen])

  const handleSave = useCallback(() => {
    if (name.trim()) {
      // Save logic would go here, using workflowId if editing
      onClose()
    }
  }, [name, onClose])

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

  return (
    <div className="dialog__backdrop">
      <div className="dialog__content" style={{ maxWidth: '28rem' }}>
        <div className="dialog__header">
          <div>
            <Heading level={3}>{workflowId ? 'Update Workflow' : 'Save Workflow'}</Heading>
            <Caption muted>
              {workflowId ? 'Update this workflow configuration' : 'Save this workflow for future use'}
            </Caption>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">✕</Button>
        </div>

        <Stack gap="md" style={{ padding: '1.5rem' }}>
          <div>
            <label className="label">Workflow Name</label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Data Processing Pipeline"
              autoFocus
            />
          </div>
        </Stack>

        <CardFooter style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()} variant="primary">
            {workflowId ? 'Update' : 'Save'}
          </Button>
        </CardFooter>
      </div>
    </div>
  )
}
