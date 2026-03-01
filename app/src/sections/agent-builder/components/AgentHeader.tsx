import type { AgentConfig } from '@/../product/sections/agent-builder/types'
import { useState } from 'react'

interface AgentHeaderProps {
  loadedAgentId: string | null
  savedAgentConfigs: AgentConfig[]
  isFormValid: boolean
  hasSelectedDomains: boolean
  isLoading: boolean
  onSave: (name: string, description: string) => void
  onNewAgent: () => void
}

/**
 * AgentHeader - Top bar with agent name, description, and save actions
 */
export function AgentHeader({
  loadedAgentId,
  savedAgentConfigs,
  isFormValid,
  hasSelectedDomains,
  isLoading,
  onSave,
  onNewAgent
}: AgentHeaderProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Load current agent data if editing
  const currentAgent = loadedAgentId ? savedAgentConfigs.find(a => a.id === loadedAgentId) : null

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), description.trim())
      setShowSaveDialog(false)
      setName('')
      setDescription('')
    }
  }

  const handleSaveAsNew = () => {
    setName(currentAgent?.name ?? 'New Agent')
    setDescription(currentAgent?.description ?? '')
    setShowSaveDialog(true)
  }

  return (
    <header className="h-16 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between px-6 backdrop-blur-sm">
      {/* Left side - Agent info */}
      <div className="flex items-center gap-4">
        {/* Logo/Icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>

        {/* Agent name/desc */}
        <div>
          {currentAgent ? (
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-200">
                  {currentAgent.name}
                </h1>
                <p className="text-sm text-slate-500">{currentAgent.description}</p>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                Editing
              </span>
            </div>
          ) : (
            <div>
              <h1 className="text-lg font-semibold text-slate-200">
                New Agent
              </h1>
              <p className="text-sm text-slate-500">
                Configure your specialized AI agent
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2 mr-4">
          <div className={`
            w-2 h-2 rounded-full transition-colors
            ${isFormValid && hasSelectedDomains ? 'bg-emerald-500' : 'bg-amber-500'}
          `} />
          <span className="text-xs text-slate-500">
            {isFormValid && hasSelectedDomains ? 'Ready' : 'Incomplete'}
          </span>
        </div>

        {/* New agent button */}
        <button
          onClick={onNewAgent}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          New Agent
        </button>

        {/* Save button */}
        {currentAgent ? (
          <>
            <button
              onClick={handleSaveAsNew}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Save As New
            </button>
            <button
              onClick={handleSave}
              disabled={!isFormValid || !hasSelectedDomains || isLoading}
              className={`
                px-5 py-2 rounded-lg text-sm font-medium transition-all
                ${isFormValid && hasSelectedDomains && !isLoading
                  ? 'bg-violet-500 text-white hover:bg-violet-400 shadow-lg shadow-violet-500/25'
                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }
              `}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              if (!name) setName('New Agent')
              setShowSaveDialog(true)
            }}
            disabled={!isFormValid || !hasSelectedDomains}
            className={`
              px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${isFormValid && hasSelectedDomains
                ? 'bg-violet-500 text-white hover:bg-violet-400 shadow-lg shadow-violet-500/25'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }
            `}
          >
            Save Agent
          </button>
        )}
      </div>

      {/* Save Dialog Modal */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-200 mb-4">
              Save Agent Configuration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Security Auditor"
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this agent do?"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setName('')
                  setDescription('')
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${name.trim()
                    ? 'bg-violet-500 text-white hover:bg-violet-400'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }
                `}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
