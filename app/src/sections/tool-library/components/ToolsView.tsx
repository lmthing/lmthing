import type { Tool, ToolParameter, UsageReference } from '@/../product/sections/tool-library/types'
import { useState } from 'react'

interface ToolsViewProps {
  tools: Tool[]
  onToggleTool?: (toolId: string) => void
  onSearchTools?: (query: string) => void
}

export function ToolsView({ tools, onToggleTool, onSearchTools }: ToolsViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [filterSource, setFilterSource] = useState<'all' | 'builtin' | 'package'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all')

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    onSearchTools?.(value)
  }

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSource = filterSource === 'all' || tool.source === filterSource
    const matchesStatus = filterStatus === 'all' || tool.status === filterStatus
    return matchesSearch && matchesSource && matchesStatus
  })

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white font-['Space_Grotesk']">
              Tools
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Browse and manage available function-calling tools
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search tools by name or description..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 transition-all"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>

          <div className="flex gap-2">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as any)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 cursor-pointer"
            >
              <option value="all">All Sources</option>
              <option value="builtin">Built-in</option>
              <option value="package">Packages</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-violet-500 dark:focus:ring-violet-400 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tools Grid - hidden when detail panel is open */}
        {selectedTool ? null : (
          <div className="flex-1 overflow-auto p-8">
            {filteredTools.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                <span className="text-4xl mb-4">🔍</span>
                <p className="text-lg font-medium">No tools found</p>
                <p className="text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTools.map((tool) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    isSelected={selectedTool?.id === tool.id}
                    onClick={() => setSelectedTool(tool)}
                    onToggle={() => onToggleTool?.(tool.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Detail Panel - full width when open */}
        {selectedTool && (
          <ToolDetailPanel
            tool={selectedTool}
            onClose={() => setSelectedTool(null)}
            onToggle={() => {
              onToggleTool?.(selectedTool.id)
            }}
          />
        )}
      </div>
    </div>
  )
}

interface ToolCardProps {
  tool: Tool
  isSelected: boolean
  onClick: () => void
  onToggle: () => void
}

function ToolCard({ tool, isSelected, onClick, onToggle }: ToolCardProps) {
  const isEnabled = tool.status === 'enabled'

  return (
    <div
      onClick={onClick}
      className={`
        group relative bg-white dark:bg-slate-900 rounded-xl p-5 cursor-pointer
        border-2 transition-all duration-200 hover:shadow-lg
        ${isSelected
          ? 'border-violet-500 dark:border-violet-400 shadow-lg shadow-violet-500/10'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }
      `}
    >
      {/* Status Indicator */}
      <div className="absolute top-4 right-4">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center transition-all
            ${isEnabled
              ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
            }
          `}
          title={isEnabled ? 'Click to disable' : 'Click to enable'}
        >
          {isEnabled ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>

      {/* Tool Icon & Badge */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`
          w-12 h-12 rounded-xl flex items-center justify-center text-2xl
          ${tool.source === 'builtin'
            ? 'bg-amber-100 dark:bg-amber-950/50'
            : 'bg-violet-100 dark:bg-violet-950/50'
          }
        `}>
          {getToolIcon(tool.id)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate font-['Space_Grotesk']">
              {tool.name}
            </h3>
            <span className={`
              text-xs px-2 py-0.5 rounded-full font-medium shrink-0
              ${tool.source === 'builtin'
                ? 'bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                : 'bg-violet-200 dark:bg-violet-900/50 text-violet-800 dark:text-violet-300'
              }
            `}>
              {tool.source === 'builtin' ? 'Built-in' : tool.packageName}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
        {tool.description}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-500">
        <span className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          {tool.parameters.length} params
        </span>
        {tool.usageReferences.length > 0 && (
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {tool.usageReferences.length} used
          </span>
        )}
      </div>
    </div>
  )
}

interface ToolDetailPanelProps {
  tool: Tool
  onClose: () => void
  onToggle: () => void
}

function ToolDetailPanel({ tool, onClose, onToggle }: ToolDetailPanelProps) {
  const isEnabled = tool.status === 'enabled'

  return (
    <div className="flex-1 bg-white dark:bg-slate-900 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-white font-['Space_Grotesk']">
          Tool Details
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${isEnabled
                ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }
            `}
          >
            {isEnabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        {/* Tool Header */}
        <div className="flex items-center gap-4">
          <div className={`
            w-16 h-16 rounded-2xl flex items-center justify-center text-3xl
            ${tool.source === 'builtin'
              ? 'bg-amber-100 dark:bg-amber-950/50'
              : 'bg-violet-100 dark:bg-violet-950/50'
            }
          `}>
            {getToolIcon(tool.id)}
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900 dark:text-white font-['Space_Grotesk']">
              {tool.name}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">{tool.packageName}</p>
          </div>
        </div>

        {/* Description */}
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Description
          </h5>
          <p className="text-sm text-slate-700 dark:text-slate-300">{tool.description}</p>
        </div>

        {/* Parameters */}
        {tool.parameters.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Parameters
            </h5>
            <div className="space-y-2">
              {tool.parameters.map((param, i) => (
                <ParameterItem key={i} parameter={param} />
              ))}
            </div>
          </div>
        )}

        {/* Environment Requirements */}
        {tool.envRequirements.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Environment Variables Required
            </h5>
            <div className="flex flex-wrap gap-2">
              {tool.envRequirements.map((envVar) => (
                <code
                  key={envVar}
                  className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-sm rounded-md font-['JetBrains_Mono']"
                >
                  {envVar}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Usage References */}
        {tool.usageReferences.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Used In
            </h5>
            <div className="space-y-2">
              {tool.usageReferences.map((ref, i) => (
                <UsageReferenceItem key={i} reference={ref} />
              ))}
            </div>
          </div>
        )}

        {/* Documentation */}
        <div>
          <h5 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Documentation
          </h5>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {tool.documentation}
          </p>
        </div>
      </div>
    </div>
  )
}

function ParameterItem({ parameter }: { parameter: ToolParameter }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm font-['JetBrains_Mono'] text-slate-900 dark:text-white">
            {parameter.name}
          </code>
          <span className={`
            text-xs px-1.5 py-0.5 rounded
            ${parameter.required
              ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
            }
          `}>
            {parameter.type}
          </span>
          {parameter.required && (
            <span className="text-xs text-red-500 dark:text-red-400 font-medium">required</span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{parameter.description}</p>
      </div>
    </div>
  )
}

function UsageReferenceItem({ reference }: { reference: UsageReference }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <span className={`
        text-lg
        ${reference.type === 'directory' ? '📁' : '📄'}
      `} />
      <div className="flex-1 min-w-0">
        <code className="text-sm font-['JetBrains_Mono'] text-slate-700 dark:text-slate-300 block truncate">
          {reference.path}
        </code>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          via {reference.source}
        </span>
      </div>
    </div>
  )
}

function getToolIcon(toolId: string): string {
  const icons: Record<string, string> = {
    'web-search': '🌐',
    'file-read': '📄',
    'http-request': '🌍',
    'database-query': '🗃️',
    'date-calculator': '📅',
    'code-execution': '⚡',
    'email-send': '✉️',
    'json-validator': '✓',
    'openai-chat': '🤖',
    'anthropic-chat': '🧠',
    'huggingface-inference': '🎨',
    'vector-search': '🔎',
    'google-sheets-read': '📊',
    'google-sheets-write': '📊',
    'excel-parse': '📈'
  }
  return icons[toolId] || '🔧'
}
