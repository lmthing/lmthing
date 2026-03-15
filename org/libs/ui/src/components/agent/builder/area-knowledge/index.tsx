/**
 * AreaKnowledgeAccordion - Expandable cards showing attached knowledge area details.
 * US-204: Accordion cards styled with Semantic Colors - Knowledge (Emerald accents).
 * Uses Border Radius Medium (8px), subtle shadow at rest, deeper on hover.
 */
import '@lmthing/css/components/agent/builder/index.css'
import { useToggle } from '@lmthing/state'
import { useKnowledgeField } from '@lmthing/ui/hooks/useKnowledgeField'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Label } from '@lmthing/ui/elements/typography/label'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'

interface KnowledgeAccordionCardProps {
  fieldId: string
}

function KnowledgeAccordionCard({ fieldId }: KnowledgeAccordionCardProps) {
  const [expanded, toggleExpanded] = useToggle(`area-knowledge.${fieldId}.expanded`, false)
  const knowledge = useKnowledgeField(fieldId)
  const title = knowledge.config?.title || fieldId
  const description = knowledge.config?.description
  const entries = knowledge.entries

  return (
    <div className="area-knowledge__card">
      <button
        onClick={toggleExpanded}
        className="area-knowledge__card-header"
      >
        <Folder className="area-knowledge__card-folder-icon" />
        <div className="area-knowledge__card-title-wrap">
          <Label className="area-knowledge__card-title">{title}</Label>
          {description && (
            <Caption muted className="area-knowledge__card-description">{description}</Caption>
          )}
        </div>
        <Caption muted className="area-knowledge__card-count">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
        </Caption>
        {expanded ? (
          <ChevronDown className="area-knowledge__card-chevron" />
        ) : (
          <ChevronRight className="area-knowledge__card-chevron" />
        )}
      </button>

      {expanded && entries.length > 0 && (
        <div className="area-knowledge__entries">
          <div className="area-knowledge__entries-list">
            {entries.map(entry => {
              const name = entry.path.split('/').pop() || entry.path
              return (
                <div key={entry.path} className="area-knowledge__entry">
                  <span className="area-knowledge__entry-dot" />
                  {name}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {expanded && entries.length === 0 && (
        <div className="area-knowledge__empty-entries">
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
      <div className="area-knowledge__heading">
        Area Knowledge
      </div>
      <div className="area-knowledge__list">
        {selectedFieldIds.map(fieldId => (
          <KnowledgeAccordionCard key={fieldId} fieldId={fieldId} />
        ))}
      </div>
    </div>
  )
}
