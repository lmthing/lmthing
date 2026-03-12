/**
 * KnowledgePillBar - Horizontal pill/tag selection bar for knowledge areas.
 * US-202 / C5: Horizontal scrollable row, active (violet) / inactive (gray), clear all.
 */
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
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid',
        borderColor: selected ? 'var(--color-agent)' : 'var(--color-border)',
        backgroundColor: selected ? 'var(--color-agent)' : 'transparent',
        color: selected ? 'var(--color-agent-foreground)' : 'var(--color-foreground)',
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--color-agent)'
          e.currentTarget.style.color = 'var(--color-agent)'
        }
      }}
      onMouseLeave={e => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--color-border)'
          e.currentTarget.style.color = 'var(--color-foreground)'
        }
      }}
    >
      {selected ? (
        <Check style={{ width: '0.875rem', height: '0.875rem' }} />
      ) : (
        <Folder style={{ width: '0.875rem', height: '0.875rem', color: 'var(--color-knowledge)' }} />
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
    <div style={{
      padding: '0.625rem 1rem',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: '0.6875rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-muted-foreground)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        Knowledge ({selectedCount} selected)
      </span>

      {/* C5: Horizontal scrollable row of pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        flex: 1,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
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
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-muted-foreground)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-foreground)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted-foreground)' }}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
