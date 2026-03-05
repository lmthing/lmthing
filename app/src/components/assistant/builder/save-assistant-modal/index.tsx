import { useState, useCallback, useEffect } from 'react'

interface SaveAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string, description: string) => void
}

export function SaveAssistantModal({ isOpen, onClose, onSave }: SaveAssistantModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (isOpen) {
      setName('')
      setDescription('')
    }
  }, [isOpen])

  const handleSave = useCallback(() => {
    if (name.trim()) {
      onSave(name.trim(), description.trim())
      setName('')
      setDescription('')
    }
  }, [name, description, onSave])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
    },
    [onClose, handleSave]
  )

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
          <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center' }}>
            <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg className="w-5 h-5" style={{ color: 'white' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            </div>
            <div>
              <h2 className="heading-3">Save Assistant</h2>
              <p className="caption caption--muted">Save this assistant configuration for future reuse</p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn--ghost btn--sm">✕</button>
        </div>

        <div className="stack stack--gap-md" style={{ padding: '1.5rem' }}>
          <div>
            <label className="label label--sm label--required">Assistant Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Security Auditor"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="label label--sm">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe what this assistant does..."
              rows={3}
              className="textarea"
            />
          </div>
          <p className="caption caption--muted">
            Saved assistants can be loaded from the Saved Assistants view
          </p>
        </div>

        <div className="card__footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button onClick={onClose} className="btn btn--ghost">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()} className="btn btn--primary">
            Save Assistant
          </button>
        </div>
      </div>
    </div>
  )
}
