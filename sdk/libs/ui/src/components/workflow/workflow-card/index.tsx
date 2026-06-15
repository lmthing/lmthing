/**
 * TasklistCard / TasklistListItem — card components for the tasklist list view.
 */
import type { TasklistListItem } from '@lmthing/state'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { cn } from '../../../lib/utils'

import '@lmthing/css/components/workflow/workflow-card/index.css'

// ─── Card (grid view) ─────────────────────────────────────────────────────────

interface TasklistCardProps {
  tasklist: TasklistListItem
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function TasklistCard({ tasklist, isSelected, onSelect, onDelete }: TasklistCardProps) {
  return (
    <div
      onClick={onSelect}
      className={cn('workflow-card', isSelected && 'workflow-card--selected')}
    >
      <div className="workflow-card__body">
        {/* Header row */}
        <div className="workflow-card__header">
          <div className="workflow-card__header-content">
            <div className="workflow-card__title-row">
              <Label>{tasklist.name}</Label>
            </div>
          </div>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            <svg className="workflow-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </Button>
        </div>

        {/* Footer */}
        <div className="workflow-card__footer">
          <Caption muted>{tasklist.path}</Caption>
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="workflow-card__check">
          <svg className="workflow-card__check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
}

// ─── List item (compact row view) ─────────────────────────────────────────────

interface TasklistListItemProps {
  tasklist: TasklistListItem
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function TasklistListItem({ tasklist, isSelected, onSelect, onDelete }: TasklistListItemProps) {
  return (
    <div
      onClick={onSelect}
      className={cn('workflow-list-item', isSelected && 'workflow-list-item--selected')}
    >
      {/* Workflow info */}
      <div className="workflow-list-item__content">
        <div className="workflow-list-item__title-row">
          <Label>{tasklist.name}</Label>
        </div>
        <Caption muted>{tasklist.path}</Caption>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
      >
        <svg className="workflow-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </Button>

      {/* Chevron */}
      <svg
        className={cn('workflow-list-item__chevron', isSelected && 'workflow-list-item__chevron--open')}
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )
}

// ─── Backward-compat aliases (old names) ──────────────────────────────────────
/** @deprecated Use TasklistCard */
const WorkflowCard = TasklistCard
export { WorkflowCard }
/** @deprecated Use TasklistListItem */
const WorkflowListItem = TasklistListItem
export { WorkflowListItem }
