import '@lmthing/css/components/assistant/builder/index.css'
import { useCallback, useEffect } from 'react'
import { useUIState } from '@lmthing/state'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { CardFooter } from '@lmthing/ui/elements/content/card'

interface SaveAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string, description: string) => void
}

export function SaveAssistantModal({ isOpen, onClose, onSave }: SaveAssistantModalProps) {
  const [name, setName] = useUIState('save-modal.name', '')
  const [description, setDescription] = useUIState('save-modal.description', '')

  useEffect(() => { if (isOpen) { setName(''); setDescription('') } }, [isOpen])

  const handleSave = useCallback(() => {
    if (name.trim()) { onSave(name.trim(), description.trim()); setName(''); setDescription('') }
  }, [name, description, onSave])

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
      <div className="dialog__content save-assistant-modal__content">
        <div className="dialog__header">
          <Stack row gap="sm" className="save-assistant-modal__header-row">
            <div className="save-assistant-modal__icon-wrap">
              <svg className="save-assistant-modal__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </div>
            <div>
              <Heading level={3}>Save Assistant</Heading>
              <Caption muted>Save this assistant configuration for future reuse</Caption>
            </div>
          </Stack>
          <Button onClick={onClose} variant="ghost" size="sm">✕</Button>
        </div>

        <Stack gap="md" className="save-assistant-modal__form">
          <div>
            <Label compact required>Assistant Name</Label>
            <Input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Security Auditor" autoFocus />
          </div>
          <div>
            <Label compact>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Briefly describe what this assistant does..." rows={3} />
          </div>
          <Caption muted>Saved assistants can be loaded from the Saved Assistants view</Caption>
        </Stack>

        <CardFooter className="save-assistant-modal__footer">
          <Button onClick={onClose} variant="ghost">Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()} variant="primary">Save Assistant</Button>
        </CardFooter>
      </div>
    </div>
  )
}
