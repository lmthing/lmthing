import { useState } from 'react'
import { Bot, X } from 'lucide-react'

interface CreateAssistantInlineProps {
  onSubmit: (name: string, description: string) => void
  onCancel: () => void
}

export function CreateAssistantInline({ onSubmit, onCancel }: CreateAssistantInlineProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSubmit(name.trim(), description.trim())
      setName('')
      setDescription('')
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div className="card__header">
        <div className="stack stack--row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="stack stack--row stack--gap-sm" style={{ alignItems: 'center' }}>
            <div style={{ padding: '0.5rem', background: '#8b5cf6', borderRadius: '0.5rem' }}>
              <Bot className="w-5 h-5" style={{ color: 'white' }} />
            </div>
            <div>
              <h3 className="label">Create New Assistant</h3>
              <p className="caption caption--muted">Define a new AI assistant</p>
            </div>
          </div>
          <button onClick={onCancel} className="btn btn--ghost btn--sm">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="card__body">
        <form onSubmit={handleSubmit} className="stack stack--gap-sm">
          <div>
            <label className="label label--sm label--required">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Assessment Assistant"
              className="input"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="label label--sm">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this assistant does"
              className="textarea textarea--sm"
            />
          </div>
          <div className="stack stack--row stack--gap-sm" style={{ paddingTop: '0.25rem' }}>
            <button type="button" onClick={onCancel} className="btn btn--ghost" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()} className="btn btn--primary" style={{ flex: 1 }}>
              Create Assistant
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
