import type { Flow } from '@/../product/sections/flow-builder/types'

interface FlowCardProps {
  flow: Flow
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'emerald' },
  draft: { label: 'Draft', color: 'amber' },
  archived: { label: 'Archived', color: 'slate' },
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

export function FlowCard({ flow, isSelected, onSelect, onDelete }: FlowCardProps) {
  const status = STATUS_CONFIG[flow.status]

  return (
    <div
      onClick={onSelect}
      className={`
        relative group bg-white dark:bg-slate-900 rounded-xl border-2 transition-all duration-200 cursor-pointer
        ${isSelected
          ? 'border-violet-500 ring-2 ring-violet-500/20 shadow-lg shadow-violet-500/10'
          : 'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-md'
        }
      `}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {flow.name}
              </h3>
              <span className={`
                flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded-full
                bg-${status.color}-100 dark:bg-${status.color}-900/30
                text-${status.color}-700 dark:text-${status.color}-300
              `}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
              {flow.description}
            </p>
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="flex-shrink-0 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
            title="Delete flow"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>

        {/* Tags */}
        {flow.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {flow.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
              >
                {tag}
              </span>
            ))}
            {flow.tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                +{flow.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <path d="M9 3v18" />
                <path d="M15 3v18" />
                <path d="M3 9h18" />
                <path d="M3 15h18" />
              </svg>
              <span>{flow.taskCount} task{flow.taskCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>{formatDate(flow.updatedAt)}</span>
            </div>
          </div>

          {/* Last run indicator */}
          {flow.lastRunAt && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Ran {formatDate(flow.lastRunAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </div>
  )
}

// Flow list item (compact row version)
interface FlowListItemProps {
  flow: Flow
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
}

export function FlowListItem({ flow, isSelected, onSelect, onDelete }: FlowListItemProps) {
  const status = STATUS_CONFIG[flow.status]

  return (
    <div
      onClick={onSelect}
      className={`
        group flex items-center gap-4 p-4 rounded-lg border transition-all duration-150 cursor-pointer
        ${isSelected
          ? 'bg-violet-50 dark:bg-violet-950/30 border-violet-500'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-slate-50 dark:hover:bg-slate-800'
        }
      `}
    >
      {/* Status indicator */}
      <div className={`
        flex-shrink-0 w-2 h-2 rounded-full
        bg-${status.color}-500
      `} />

      {/* Flow info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={`
            font-medium truncate
            ${isSelected ? 'text-violet-700 dark:text-violet-300' : 'text-slate-900 dark:text-slate-100'}
          `}>
            {flow.name}
          </h3>
          <span className={`
            flex-shrink-0 px-1.5 py-0.5 text-xs font-medium rounded
            bg-${status.color}-100 dark:bg-${status.color}-900/30
            text-${status.color}-700 dark:text-${status.color}-300
          `}>
            {status.label}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
          {flow.taskCount} task{flow.taskCount !== 1 ? 's' : ''} • {formatDate(flow.updatedAt)}
        </p>
      </div>

      {/* Tags preview */}
      <div className="hidden sm:flex flex-wrap gap-1">
        {flow.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="flex-shrink-0 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
        title="Delete flow"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      </button>

      {/* Chevron */}
      <svg className={`w-5 h-5 text-slate-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </div>
  )
}
