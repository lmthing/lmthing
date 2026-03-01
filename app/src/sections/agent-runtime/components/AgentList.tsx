import type { Agent, AgentListProps } from '@/../product/sections/agent-runtime/types'

export type { AgentListProps } from '@/../product/sections/agent-runtime/types'

// Format timestamp for display
function formatTimestamp(isoString: string | null): string {
  if (!isoString) return 'never'
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Agent card component
interface AgentCardProps {
  agent: Agent
  onClick: () => void
}

function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 rounded-2xl bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        hover:border-violet-300 dark:hover:border-violet-700
        hover:shadow-md hover:shadow-violet-500/5 hover:-translate-y-0.5
        transition-all duration-200 group"
    >
      {/* Header: Name */}
      <div className="mb-3">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors truncate">
          {agent.name}
        </h3>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
        {agent.description}
      </p>

      {/* Footer: Domains, Last Used */}
      <div className="flex items-center justify-between text-xs">
        {/* Domains */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">Knowledge:</span>
          <div className="flex items-center gap-1">
            {agent.domains.slice(0, 2).map((domain) => (
              <span
                key={domain}
                className="px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/50
                  text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
              >
                {domain}
              </span>
            ))}
            {agent.domains.length > 2 && (
              <span className="text-slate-500 dark:text-slate-400">
                +{agent.domains.length - 2}
              </span>
            )}
          </div>
        </div>

        {/* Last Used */}
        <span className="text-slate-400 dark:text-slate-500">
          {formatTimestamp(agent.lastUsedAt)}
        </span>
      </div>

      {/* Runtime Fields Badge (if any) */}
      {agent.runtimeFields.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{agent.runtimeFields.length} field{agent.runtimeFields.length > 1 ? 's' : ''} to configure</span>
          </div>
        </div>
      )}

      {/* Tools Badge (if any) */}
      {agent.enabledTools.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {agent.enabledTools.slice(0, 4).map((tool) => (
            <span
              key={tool.toolId}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md
                bg-slate-100 dark:bg-slate-800
                text-slate-600 dark:text-slate-400
                text-xs"
              title={tool.name}
            >
              <span>{tool.icon}</span>
              <span className="truncate max-w-[80px]">{tool.name}</span>
            </span>
          ))}
          {agent.enabledTools.length > 4 && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              +{agent.enabledTools.length - 4} more
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// Empty state when no agents
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-amber-100
        dark:from-violet-900/30 dark:to-amber-900/30 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
        No Agents Yet
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
        Create and deploy agents from the Agent Builder to see them here.
      </p>
    </div>
  )
}

// Main Agent List component
export function AgentList({
  agents,
  selectedAgentId = null,
  isLoading = false,
  onSelectAgent
}: AgentListProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Agent Runtime
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Select an agent to configure and run conversations
            </p>
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} available
          </span>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="max-w-6xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
              <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading agents...</span>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => onSelectAgent?.(agent.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
