import type { Tool, EnabledToolMapping, ToolConfigStatus, ToolSource } from '@/../product/sections/agent-builder/types'

interface ToolsPanelProps {
  toolLibrary: Tool[]
  enabledTools: EnabledToolMapping[]
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onAddTool: (toolId: string, config?: Record<string, unknown>) => void
  onRemoveTool: (toolId: string) => void
  onConfigureTool: (toolId: string, config: Record<string, unknown>) => void
}

const statusConfig: Record<
  ToolConfigStatus,
  { label: string; bg: string; text: string; darkBg: string; darkText: string; icon: string }
> = {
  installed: {
    label: 'Installed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-900/20',
    darkText: 'dark:text-emerald-400',
    icon: '✓',
  },
  'needs-config': {
    label: 'Needs Config',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    darkBg: 'dark:bg-amber-900/20',
    darkText: 'dark:text-amber-400',
    icon: '⚙',
  },
  ready: {
    label: 'Ready',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    darkBg: 'dark:bg-violet-900/20',
    darkText: 'dark:text-violet-400',
    icon: '●',
  },
}

const categoryIcons: Record<string, string> = {
  Curriculum: '📚',
  Teaching: '👨‍🏫',
  Assessment: '📝',
  'Special Education': '🧩',
  Communication: '💬',
  Collaboration: '🤝',
  Reporting: '📊',
}

export function ToolsPanel({
  toolLibrary,
  enabledTools,
  isOpen,
  onOpen,
  onClose,
  onAddTool,
  onRemoveTool,
  onConfigureTool,
}: ToolsPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Enabled Tools</h3>
          <button
            onClick={onOpen}
            className="text-xs px-3 py-1.5 bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white rounded-lg transition-all shadow-md shadow-violet-200/50 dark:shadow-violet-900/20 flex items-center gap-1.5 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tools
          </button>
        </div>
      </div>

      {/* Tools List */}
      <div className="flex-1 overflow-y-auto p-4">
        {enabledTools.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
              <span className="text-2xl">🔧</span>
            </div>
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No tools enabled</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] mx-auto">
              Add tools from the library to extend your agent's capabilities
            </p>
            <button
              onClick={onOpen}
              className="mt-4 text-xs px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors font-medium"
            >
              Browse Tool Library
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {enabledTools.map(mapping => (
              <ToolCard
                key={mapping.tool.id}
                mapping={mapping}
                onRemove={mapping.source === 'manual' ? () => onRemoveTool(mapping.tool.id) : undefined}
                onConfigure={() => onConfigureTool(mapping.tool.id, {})}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <p className="text-xs text-slate-400 dark:text-slate-600 text-center">
          Tools are manually enabled from the library
        </p>
      </div>
    </div>
  )
}

interface ToolCardProps {
  mapping: EnabledToolMapping
  onRemove?: () => void
  onConfigure?: () => void
}

function ToolCard({ mapping, onRemove, onConfigure }: ToolCardProps) {
  const status = statusConfig[mapping.status]
  const categoryIcon = categoryIcons[mapping.tool.category] || '📦'

  return (
    <div className="group p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700 transition-all duration-200">
      <div className="flex items-start gap-3">
        {/* Tool icon */}
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-900/20 dark:to-violet-800/20 flex items-center justify-center text-lg flex-shrink-0">
          {categoryIcon}
        </div>

        {/* Tool info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
              {mapping.tool.name}
            </h4>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${status.bg} ${status.text} ${status.darkBg} ${status.darkText} flex items-center gap-1`}
            >
              <span>{status.icon}</span>
              {status.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {mapping.tool.description}
          </p>

          {/* Tool metadata */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500">
              {mapping.tool.category}
            </span>
            <span className="text-[10px] text-slate-400">v{mapping.tool.version}</span>
            {mapping.tool.package && (
              <span className="text-[10px] text-slate-400 font-mono">
                {mapping.tool.package.split('/').pop()}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {mapping.tool.configRequired && mapping.status !== 'ready' && (
            <button
              onClick={onConfigure}
              className="p-2 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
              title="Configure tool"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          )}
          {mapping.source === 'manual' && onRemove && (
            <button
              onClick={onRemove}
              className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Remove tool"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
