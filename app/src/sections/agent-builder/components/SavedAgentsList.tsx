import type { AgentConfig, Domain, Tool } from '@/../product/sections/agent-builder/types'

interface SavedAgentsListProps {
  domains: Domain[]
  toolLibrary: Tool[]
  savedAgentConfigs: AgentConfig[]
  onLoadAgent?: (agentId: string) => void
  onDuplicateAgent?: (agentId: string) => void
  onDeleteAgent?: (agentId: string) => void
  onNewAgent?: () => void
}

// Helper component for agent card
interface AgentCardProps {
  agent: AgentConfig
  domains: Domain[]
  toolCount: number
  onLoad?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

function AgentCard({ agent, domains, toolCount, onLoad, onDuplicate, onDelete }: AgentCardProps) {
  const agentDomains = domains.filter(d => agent.selectedDomains.includes(d.id))
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  const categoryColors: Record<string, string> = {
    'Security': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Infrastructure': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Compliance': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Development': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  }

  return (
    <div className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-all overflow-hidden">
      {/* Header with gradient accent */}
      <div className="h-1.5 bg-gradient-to-r from-violet-500 to-violet-600" />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate">{agent.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-500 line-clamp-2 mt-1">{agent.description}</p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onDuplicate}
              className="p-2 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
              title="Duplicate"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Domain badges */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {agentDomains.slice(0, 3).map(domain => (
            <span
              key={domain.id}
              className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColors[domain.category] || 'bg-slate-100 text-slate-600'}`}
            >
              {domain.name}
            </span>
          ))}
          {agentDomains.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              +{agentDomains.length - 3} more
            </span>
          )}
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {toolCount} tools
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDate(agent.updatedAt)}
            </span>
          </div>
          <button
            onClick={onLoad}
            className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors flex items-center gap-1"
          >
            Load
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export function SavedAgentsList({
  domains,
  toolLibrary,
  savedAgentConfigs,
  onLoadAgent,
  onDuplicateAgent,
  onDeleteAgent,
  onNewAgent
}: SavedAgentsListProps) {
  // Calculate tool count for each agent
  const getToolCount = (agent: AgentConfig) => {
    return agent.enabledTools.length
  }

  // Sort agents by updated date
  const sortedAgents = [...savedAgentConfigs].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-['Space_Grotesk']">Saved Agents</h1>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
            {savedAgentConfigs.length} saved agent{savedAgentConfigs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onNewAgent}
          className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors shadow-lg shadow-violet-200 dark:shadow-violet-900/20 font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Agent
        </button>
      </div>

      {/* Agents Grid */}
      {savedAgentConfigs.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/30 dark:to-violet-800/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">No saved agents yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-500 max-w-md mx-auto">
            Create your first agent and save it for quick access later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              domains={domains}
              toolCount={getToolCount(agent)}
              onLoad={() => onLoadAgent?.(agent.id)}
              onDuplicate={() => onDuplicateAgent?.(agent.id)}
              onDelete={() => onDeleteAgent?.(agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
