import type { AttachedFlow } from '@/../product/sections/agent-builder/types'

interface SlashActionCardProps {
  attachedFlow: AttachedFlow
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEdit: (slashActionId: string) => void
  onDetach: (slashActionId: string) => void
}

export function SlashActionCard({ attachedFlow, onToggleEnabled, onEdit, onDetach }: SlashActionCardProps) {
  const { slashAction, flowName, flowDescription, taskCount } = attachedFlow

  return (
    <div className={`
      group p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 transition-all
      ${slashAction.enabled
        ? 'border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20'
        : 'border-slate-200 dark:border-slate-800 opacity-60'
      }
    `}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Action trigger */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`
              px-2 py-0.5 rounded-lg font-mono text-sm font-medium
              ${slashAction.enabled
                ? 'bg-violet-500 text-white'
                : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }
            `}>
              /{slashAction.actionId}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              → {flowName}
            </span>
          </div>

          {/* Action name and description */}
          <h4 className={`text-sm font-medium ${slashAction.enabled ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
            {slashAction.name}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-2 mt-0.5">
            {slashAction.description}
          </p>

          {/* Flow metadata */}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-500">
            <span>{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span className="truncate max-w-[150px]">{flowDescription}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Enable/disable toggle */}
          <button
            onClick={() => onToggleEnabled(slashAction.id, !slashAction.enabled)}
            className={`
              relative w-10 h-5 rounded-full transition-colors
              ${slashAction.enabled
                ? 'bg-violet-500'
                : 'bg-slate-300 dark:bg-slate-700'
              }
            `}
            title={slashAction.enabled ? 'Disable action' : 'Enable action'}
          >
            <div className={`
              absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
              ${slashAction.enabled ? 'left-5' : 'left-0.5'}
            `} />
          </button>

          {/* Edit button */}
          <button
            onClick={() => onEdit(slashAction.id)}
            className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Edit action"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>

          {/* Detach button */}
          <button
            onClick={() => onDetach(slashAction.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
            title="Detach flow"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// Slash actions list panel
interface SlashActionsPanelProps {
  attachedFlows: AttachedFlow[]
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEditAction: (slashActionId: string) => void
  onDetachFlow: (slashActionId: string) => void
  onAttachNewFlow: () => void
}

export function SlashActionsPanel({
  attachedFlows,
  onToggleEnabled,
  onEditAction,
  onDetachFlow,
  onAttachNewFlow,
}: SlashActionsPanelProps) {
  const enabledCount = attachedFlows.filter(f => f.slashAction.enabled).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Slash Actions ({enabledCount}/{attachedFlows.length})
        </h3>
        <button
          onClick={onAttachNewFlow}
          className="text-xs px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Action
        </button>
      </div>

      {attachedFlows.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-500">No slash actions</p>
          <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
            Attach flows to create custom actions
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachedFlows.map((attachedFlow) => (
            <SlashActionCard
              key={attachedFlow.slashAction.id}
              attachedFlow={attachedFlow}
              onToggleEnabled={onToggleEnabled}
              onEdit={onEditAction}
              onDetach={onDetachFlow}
            />
          ))}
        </div>
      )}

      {/* Help text */}
      {attachedFlows.length > 0 && (
        <div className="flex items-start gap-2 p-2 bg-sky-50 dark:bg-sky-950/30 rounded-lg">
          <svg className="w-4 h-4 text-sky-600 dark:text-sky-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-sky-700 dark:text-sky-400">
            Type <span className="font-mono font-semibold">/action</span> in chat to trigger a flow
          </p>
        </div>
      )}
    </div>
  )
}
