import { useState } from 'react'

interface FlowBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  agentId: string
  availableFlows: Array<{ id: string; name: string; description: string; taskCount: number }>
  onAttachFlow: (flowId: string, actionId: string, name: string, description: string) => void
  onCreateNewFlow: () => void
}

export function FlowBuilderModal({
  isOpen,
  onClose,
  agentId: _agentId,
  availableFlows,
  onAttachFlow,
  onCreateNewFlow,
}: FlowBuilderModalProps) {
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [actionId, setActionId] = useState('')
  const [actionName, setActionName] = useState('')
  const [actionDescription, setActionDescription] = useState('')
  const [mode, setMode] = useState<'select' | 'create'>('select')

  if (!isOpen) return null

  const selectedFlow = availableFlows.find(f => f.id === selectedFlowId)

  const handleAttachFlow = () => {
    if (!selectedFlowId || !actionId.trim()) return

    onAttachFlow(
      selectedFlowId,
      actionId.trim().toLowerCase().replace(/\s+/g, '-'),
      actionName || selectedFlow?.name || actionId,
      actionDescription || selectedFlow?.description || ''
    )

    // Reset form
    setSelectedFlowId(null)
    setActionId('')
    setActionName('')
    setActionDescription('')
    setMode('select')
    onClose()
  }

  const handleCreateNewFlow = () => {
    onCreateNewFlow()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Attach Flow to Agent
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Select a flow and configure its slash action trigger
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mode === 'select' ? (
            <>
              {/* Mode toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setMode('select')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    mode === 'select'
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Select Existing Flow
                </button>
                <button
                  onClick={() => setMode('create')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    (mode as 'select' | 'create') === 'create'
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Create New Flow
                </button>
              </div>

              {/* Flow selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select a Flow
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableFlows.length === 0 ? (
                      <div className="text-center py-6 bg-slate-50 dark:bg-slate-950/50 rounded-lg">
                        <p className="text-sm text-slate-500 dark:text-slate-500">No flows available</p>
                        <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                          Create a flow first to attach it
                        </p>
                      </div>
                    ) : (
                      availableFlows.map((flow) => (
                        <button
                          key={flow.id}
                          onClick={() => setSelectedFlowId(flow.id)}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                            selectedFlowId === flow.id
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                              : 'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {flow.name}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-500 truncate">
                                {flow.description}
                              </p>
                            </div>
                            <div className="ml-2 text-xs text-slate-400">
                              {flow.taskCount} tasks
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Slash action configuration */}
                {selectedFlow && (
                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                      <p className="text-sm text-violet-700 dark:text-violet-400">
                        Selected: <span className="font-semibold">{selectedFlow?.name}</span>
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Action Trigger
                      </label>
                      <div className="flex items-center">
                        <span className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-r-0 border-slate-300 dark:border-slate-700 rounded-l-lg text-slate-500 font-mono">
                          /
                        </span>
                        <input
                          type="text"
                          value={actionId}
                          onChange={(e) => setActionId(e.target.value)}
                          placeholder="summarize"
                          className="flex-1 px-3 py-2.5 rounded-r-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        Users will type <span className="font-mono">/{actionId || 'action'}</span> to trigger this flow
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Action Name
                      </label>
                      <input
                        type="text"
                        value={actionName}
                        onChange={(e) => setActionName(e.target.value)}
                        placeholder={selectedFlow?.name}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Description
                      </label>
                      <textarea
                        value={actionDescription}
                        onChange={(e) => setActionDescription(e.target.value)}
                        placeholder={selectedFlow?.description}
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                      />
                    </div>

                    {/* Preview */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-xs text-slate-500 dark:text-slate-500 mb-2">Preview:</div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-violet-500 text-white text-sm font-mono">
                          /{actionId || 'action'}
                        </span>
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {actionName || selectedFlow?.name}
                        </span>
                      </div>
                      {actionDescription || selectedFlow?.description ? (
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 ml-1">
                          {actionDescription || selectedFlow?.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Create new flow mode */}
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-xl shadow-violet-500/25">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Create a New Flow
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                  Build a custom flow with tasks, then configure its slash action trigger for this agent.
                </p>
                <button
                  onClick={handleCreateNewFlow}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Open Flow Builder
                </button>
                <button
                  onClick={() => setMode('select')}
                  className="block mx-auto mt-4 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Or select an existing flow
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAttachFlow}
            disabled={!selectedFlowId || !actionId.trim()}
            className="px-5 py-2.5 rounded-lg font-medium bg-violet-500 text-white hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Attach Flow
          </button>
        </div>
      </div>
    </div>
  )
}
