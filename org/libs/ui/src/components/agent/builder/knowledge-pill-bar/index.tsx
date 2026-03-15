/**
 * KnowledgePillBar - Horizontal pill/tag selection bar for knowledge areas.
 * US-202 / C5: Horizontal scrollable row, active (violet) / inactive (gray), clear all.
 */
import '@lmthing/css/components/agent/builder/index.css'
import { useKnowledgeField } from '@lmthing/ui/hooks/useKnowledgeField'
import type { DomainMeta } from '@lmthing/ui/hooks/useKnowledgeFields'
import { Check, Folder } from 'lucide-react'

interface KnowledgePillProps {
  field: DomainMeta
  selected: boolean
  onToggle: () => void
}

function KnowledgePill({ field, selected, onToggle }: KnowledgePillProps) {
  const knowledge = useKnowledgeField(field.id)
  const title = knowledge.config?.title || field.id

  return (
    <button
      onClick={onToggle}
      className={`knowledge-pill ${selected ? 'knowledge-pill--selected' : ''}`}
    >
      {selected ? (
        <Check className="knowledge-pill__icon" />
      ) : (
        <Folder className="knowledge-pill__folder-icon" />
      )}
      {title}
    </button>
  )
}

export interface KnowledgePillBarProps {
  fields: DomainMeta[]
  selectedIds: string[]
  onToggle: (fieldId: string) => void
  onClearAll: () => void
}

export function KnowledgePillBar({ fields, selectedIds, onToggle, onClearAll }: KnowledgePillBarProps) {
  if (fields.length === 0) return null

  const selectedCount = selectedIds.length

  return (
    <div className="knowledge-pill-bar">
      <span className="knowledge-pill-bar__label">
        Knowledge ({selectedCount} selected)
      </span>

      {/* C5: Horizontal scrollable row of pills */}
      <div className="knowledge-pill-bar__scroll">
        {fields.map(field => (
          <KnowledgePill
            key={field.id}
            field={field}
            selected={selectedIds.includes(field.id)}
            onToggle={() => onToggle(field.id)}
          />
        ))}
      </div>

      {selectedCount > 0 && (
        <button
          onClick={onClearAll}
          className="knowledge-pill-bar__clear"
        >
          Clear all
        </button>
      )}
    </div>
  )
}
