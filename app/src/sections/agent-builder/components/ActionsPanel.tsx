import type { AttachedFlow } from '@/../product/sections/agent-builder/types'

interface ActionsPanelProps {
  attachedFlows: AttachedFlow[]
  availableFlows: Array<{ id: string; name: string; description: string; taskCount: number }>
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEditAction: (slashActionId: string) => void
  onDetachFlow: (slashActionId: string) => void
  onAttachFlow: (flowId: string, actionId: string, name: string, description: string) => void
  onOpenFlowBuilder: () => void
}

export function ActionsPanel({
  attachedFlows,
  availableFlows,
  onToggleEnabled,
  onEditAction,
  onDetachFlow,
  onAttachFlow,
  onOpenFlowBuilder,
}: ActionsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Slash Actions</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Attach flows with custom triggers
            </p>
          </div>
          <button
            onClick={onOpenFlowBuilder}
            className="text-xs px-3 py-1.5 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white rounded-lg transition-all shadow-md shadow-violet-200/50 dark:shadow-violet-900/20 flex items-center gap-1.5 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Attach Flow
          </button>
        </div>
      </div>

      {/* Actions List */}
      <div className="flex-1 overflow-y-auto p-4">
        {attachedFlows.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/30 dark:to-violet-800/30 flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No actions attached</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto mb-4">
              Attach flows to give users quick access to multi-step tasks
            </p>
            <button
              onClick={onOpenFlowBuilder}
              className="text-xs px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors font-medium"
            >
              Attach Your First Flow
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {attachedFlows.map(flow => (
              <SlashActionCard
                key={flow.slashAction.id}
                flow={flow}
                onToggleEnabled={onToggleEnabled}
                onEdit={onEditAction}
                onDetach={onDetachFlow}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs text-slate-400 dark:text-slate-600 text-center">
          Actions are invoked with <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-violet-600 dark:text-violet-400">/action</code>
        </p>
      </div>
    </div>
  )
}

interface SlashActionCardProps {
  flow: AttachedFlow
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEdit: (slashActionId: string) => void
  onDetach: (slashActionId: string) => void
}

function SlashActionCard({ flow, onToggleEnabled, onEdit, onDetach }: SlashActionCardProps) {
  return (
    <div className="group p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-all duration-200">
      <div className="flex items-start gap-3">
        {/* Action icon */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 flex items-center justify-center flex-shrink-0">
          <span className="text-lg">⚡</span>
        </div>

        {/* Action info */}
        <div className="flex-1 min-w-0">
          {/* Action trigger */}
          <div className="flex items-center gap-2 mb-1">
            <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300">
              /{flow.slashAction.actionId}
            </code>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                flow.slashAction.enabled
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500'
              }`}
            >
              {flow.slashAction.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>

          {/* Flow name */}
          <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {flow.slashAction.name}
          </h4>

          {/* Description */}
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
            {flow.slashAction.description}
          </p>

          {/* Flow metadata */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
              {flow.taskCount} step{flow.taskCount > 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{flow.flowName}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Enable toggle */}
          <button
            onClick={() => onToggleEnabled(flow.slashAction.id, !flow.slashAction.enabled)}
            className={`p-1.5 rounded-lg transition-colors ${
              flow.slashAction.enabled
                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                : 'text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
            title={flow.slashAction.enabled ? 'Disable action' : 'Enable action'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {flow.slashAction.enabled ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              )}
            </svg>
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(flow.slashAction.id)}
            className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
            title="Edit action"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>

          {/* Detach */}
          <button
            onClick={() => onDetach(flow.slashAction.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
