/**
 * AssistantForm - Form builder component for assistant configuration.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useState, useCallback } from 'react'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/forms/button/index.css'
import '@/css/elements/content/panel/index.css'
import { Stack } from '@/elements/layouts/stack'
import { Caption } from '@/elements/typography/caption'
import { Label } from '@/elements/typography/label'
import { Badge } from '@/elements/content/badge'
import { useAssistant } from '@/hooks/useAssistant'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'
import { useWorkflowList } from '@/hooks/useWorkflowList'

export interface AssistantFormProps {
  assistantId: string
  onSave?: () => void
}

export function AssistantForm({ assistantId, onSave }: AssistantFormProps) {
  const assistant = useAssistant(assistantId)
  const knowledgeFields = useKnowledgeFields()
  const workflowList = useWorkflowList()

  const [name, setName] = useState(assistant?.instruct?.name || '')
  const [description, setDescription] = useState(assistant?.instruct?.description || '')
  const [instructions, setInstructions] = useState(assistant?.instruct?.instructions || '')
  const [selectedFields, setSelectedFields] = useState<string[]>([])

  const toggleField = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldId) ? prev.filter(d => d !== fieldId) : [...prev, fieldId]
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Identity */}
      <div className="panel">
        <div className="panel__header"><Label>Identity</Label></div>
        <div className="panel__body">
          <Stack gap="md">
            <div>
              <Label compact>Name</Label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Assistant name" />
            </div>
            <div>
              <Label compact>Description</Label>
              <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this assistant do?" />
            </div>
          </Stack>
        </div>
      </div>

      {/* Instructions */}
      <div className="panel">
        <div className="panel__header"><Label>Instructions</Label></div>
        <div className="panel__body">
          <textarea
            className="input"
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            placeholder="Main instructions for this assistant..."
            style={{ minHeight: '160px', fontFamily: 'monospace', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Knowledge Selection */}
      <div className="panel">
        <div className="panel__header"><Label>Knowledge Fields ({knowledgeFields.length})</Label></div>
        <div className="panel__body">
          {knowledgeFields.length === 0 ? (
            <Caption muted>No knowledge fields available.</Caption>
          ) : (
            <Stack row gap="sm" style={{ flexWrap: 'wrap' }}>
              {knowledgeFields.map(field => (
                <button key={field.id} onClick={() => toggleField(field.id)} style={{ all: 'unset', cursor: 'pointer' }}>
                  <Badge variant={selectedFields.includes(field.id) ? 'primary' : 'muted'}>{field.id}</Badge>
                </button>
              ))}
            </Stack>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
        <button className="btn btn--primary" onClick={onSave}>Save Assistant</button>
      </div>
    </div>
  )
}
