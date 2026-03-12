/**
 * AreaKnowledgeAccordion - Expandable cards showing attached knowledge area details.
 * US-204: Accordion cards styled with Semantic Colors - Knowledge (Emerald accents).
 * Uses Border Radius Medium (8px), subtle shadow at rest, deeper on hover.
 */
import { useToggle, useUIState } from '@lmthing/state'
import { useKnowledgeField } from '@/hooks/useKnowledgeField'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Label } from '@lmthing/ui/elements/typography/label'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'

interface KnowledgeAccordionCardProps {
  fieldId: string
}

function KnowledgeAccordionCard({ fieldId }: KnowledgeAccordionCardProps) {
  const [expanded, toggleExpanded] = useToggle(`area-knowledge.${fieldId}.expanded`, false)
  const [hovered, setHovered] = useUIState(`area-knowledge.${fieldId}.hovered`, false)
  const knowledge = useKnowledgeField(fieldId)
  const title = knowledge.config?.title || fieldId
  const description = knowledge.config?.description
  const entries = knowledge.entries

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: '1px solid',
        borderColor: hovered ? 'var(--color-knowledge)' : 'var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: hovered
          ? '0 2px 8px color-mix(in srgb, var(--color-knowledge) 12%, transparent)'
          : '0 1px 2px rgba(0, 0, 0, 0.04)',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <button
        onClick={toggleExpanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.75rem 1rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Folder style={{ width: '1rem', height: '1rem', color: 'var(--color-knowledge)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Label style={{ display: 'block' }}>{title}</Label>
          {description && (
            <Caption muted style={{ display: 'block', marginTop: '0.125rem' }}>{description}</Caption>
          )}
        </div>
        <Caption muted style={{ flexShrink: 0 }}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Caption>
        {expanded ? (
          <ChevronDown style={{ width: '1rem', height: '1rem', color: 'var(--color-muted-foreground)', flexShrink: 0 }} />
        ) : (
          <ChevronRight style={{ width: '1rem', height: '1rem', color: 'var(--color-muted-foreground)', flexShrink: 0 }} />
        )}
      </button>

      {expanded && entries.length > 0 && (
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '0.5rem 1rem 0.75rem',
          backgroundColor: 'var(--color-background)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {entries.map(entry => {
              const name = entry.path.split('/').pop() || entry.path
              return (
                <div key={entry.path} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0',
                  fontSize: '0.8125rem',
                  color: 'var(--color-muted-foreground)',
                }}>
                  <span style={{
                    width: '0.375rem',
                    height: '0.375rem',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-knowledge)',
                    flexShrink: 0,
                  }} />
                  {name}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {expanded && entries.length === 0 && (
        <div style={{
          borderTop: '1px solid var(--color-border)',
          padding: '1rem',
        }}>
          <Caption muted>No entries in this knowledge area yet.</Caption>
        </div>
      )}
    </div>
  )
}

export interface AreaKnowledgeAccordionProps {
  selectedFieldIds: string[]
}

export function AreaKnowledgeAccordion({ selectedFieldIds }: AreaKnowledgeAccordionProps) {
  if (selectedFieldIds.length === 0) return null

  return (
    <div>
      <div style={{
        fontSize: '0.625rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-muted-foreground)',
        marginBottom: '0.75rem',
      }}>
        Area Knowledge
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {selectedFieldIds.map(fieldId => (
          <KnowledgeAccordionCard key={fieldId} fieldId={fieldId} />
        ))}
      </div>
    </div>
  )
}
