import type { Flow } from '@/../product/sections/flow-builder/types'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'

interface WorkflowCardProps {
  workflow: Flow
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

const STATUS_CONFIG = {
  active: { label: 'Active', variant: 'success' },
  draft: { label: 'Draft', variant: 'muted' },
  archived: { label: 'Archived', variant: 'default' },
} as const

function formatDate(isoString: string | null): string {
  if (!isoString) return 'Never'
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function WorkflowCard({ workflow, isSelected, onSelect, onDelete }: WorkflowCardProps) {
  const status = STATUS_CONFIG[workflow.status]

  return (
    <div
      onClick={onSelect}
      className={`
        relative group bg-card rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${isSelected
          ? 'border-brand-3 ring-2 ring-brand-3/20 shadow-lg shadow-brand-3/10'
          : 'border-border hover:border-brand-3/50 hover:shadow-md'
        }
      `}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Label>{workflow.name}</Label>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <Caption muted>{workflow.description}</Caption>
          </div>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </Button>
        </div>

        {/* Tags */}
        {workflow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {workflow.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="primary">{tag}</Badge>
            ))}
            {workflow.tags.length > 3 && (
              <Badge variant="muted">+{workflow.tags.length - 3}</Badge>
            )}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-4">
            <Caption muted>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <path d="M9 3v18" />
                  <path d="M15 3v18" />
                  <path d="M3 9h18" />
                  <path d="M3 15h18" />
                </svg>
                {workflow.taskCount} step{workflow.taskCount !== 1 ? 's' : ''}
              </span>
            </Caption>
            <Caption muted>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {formatDate(workflow.updatedAt)}
              </span>
            </Caption>
          </div>

          {/* Last run indicator */}
          {workflow.lastRunAt && (
            <Caption muted>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-2" />
                Ran {formatDate(workflow.lastRunAt)}
              </span>
            </Caption>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-brand-3 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
}

// Workflow list item (compact row version)
interface WorkflowListItemProps {
  workflow: Flow
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function WorkflowListItem({ workflow, isSelected, onSelect, onDelete }: WorkflowListItemProps) {
  const status = STATUS_CONFIG[workflow.status]

  return (
    <div
      onClick={onSelect}
      className={`
        group flex items-center gap-4 p-4 rounded-lg border transition-all duration-150 cursor-pointer
        ${isSelected
          ? 'bg-brand-3/10 border-brand-3'
          : 'bg-card border-border hover:border-brand-3/50 hover:bg-muted'
        }
      `}
    >
      {/* Status indicator */}
      <div className={`
        flex-shrink-0 w-2 h-2 rounded-full
        ${workflow.status === 'active' ? 'bg-brand-2' : workflow.status === 'draft' ? 'bg-brand-2' : 'bg-muted-foreground'}
      `} />

      {/* Workflow info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Label>{workflow.name}</Label>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <Caption muted>
          {workflow.taskCount} step{workflow.taskCount !== 1 ? 's' : ''} • {formatDate(workflow.updatedAt)}
        </Caption>
      </div>

      {/* Tags preview */}
      <div className="hidden sm:flex flex-wrap gap-1">
        {workflow.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="muted">{tag}</Badge>
        ))}
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </Button>

      {/* Chevron */}
      <svg className={`w-5 h-5 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )
}
