import type { Tool, ToolCategory, EnabledTool } from '@/../product/sections/agent-builder/types'
import { useState, useMemo } from 'react'

interface ToolLibraryModalProps {
  toolLibrary: Tool[]
  enabledTools: EnabledTool[]
  enabledToolIds?: Set<string>
  isOpen: boolean
  onClose: () => void
  onAddTool: (toolId: string, config?: Record<string, unknown>) => void
  onRemoveTool: (toolId: string) => void
  onConfigureTool?: (toolId: string, config: Record<string, unknown>) => void
}

const categories: Array<{ value: ToolCategory; label: string; icon: string }> = [
  { value: 'Curriculum', label: 'Curriculum', icon: '📚' },
  { value: 'Teaching', label: 'Teaching', icon: '👨‍🏫' },
  { value: 'Assessment', label: 'Assessment', icon: '📝' },
  { value: 'Special Education', label: 'Special Ed', icon: '🧩' },
  { value: 'Communication', label: 'Communication', icon: '💬' },
  { value: 'Collaboration', label: 'Collaboration', icon: '🤝' },
  { value: 'Reporting', label: 'Reporting', icon: '📊' }
]

// Helper component for tool card in the modal
interface ToolCardProps {
  tool: Tool
  isEnabled: boolean
  onToggle: () => void
  onConfigure?: () => void
}

function ToolCard({ tool, isEnabled, onToggle, onConfigure }: ToolCardProps) {
  const [showConfig, setShowConfig] = useState(false)
  const [configValues, setConfigValues] = useState<Record<string, unknown>>(tool.config || {})

  const handleConfigChange = (key: string, value: unknown) => {
    setConfigValues(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveConfig = () => {
    onConfigure?.()
    setShowConfig(false)
  }

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      isEnabled
        ? 'border-violet-300 bg-violet-50/50 dark:bg-violet-900/10 dark:border-violet-700'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-semibold ${isEnabled ? 'text-violet-700 dark:text-violet-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {tool.name}
            </h4>
            {tool.installed ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Installed
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Available
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-2 mb-2">{tool.description}</p>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{tool.package}</span>
            <span>v{tool.version}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {tool.configRequired && isEnabled && (
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Config
            </button>
          )}

          <button
            onClick={onToggle}
            className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${
              isEnabled
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {isEnabled ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Configuration panel */}
      {showConfig && tool.configRequired && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tool Configuration</h5>
          {Object.entries(tool.config).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <label className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-500">{key}</label>
              {typeof value === 'boolean' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configValues[key] as boolean || false}
                    onChange={(e) => handleConfigChange(key, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400">{value ? 'Enabled' : 'Disabled'}</span>
                </label>
              ) : (
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  value={configValues[key] as string || ''}
                  onChange={(e) => handleConfigChange(key, e.target.value)}
                  placeholder={String(value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={handleSaveConfig}
              className="flex-1 px-3 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors font-medium"
            >
              Save Configuration
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ToolLibraryModal({
  toolLibrary,
  enabledTools,
  enabledToolIds = new Set(enabledTools.map(t => t.toolId)),
  isOpen,
  onClose,
  onAddTool,
  onRemoveTool,
  onConfigureTool
}: ToolLibraryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter tools based on category and search
  const filteredTools = useMemo(() => {
    return toolLibrary.filter(tool => {
      const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory
      const matchesSearch = searchQuery === '' ||
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.package.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [toolLibrary, selectedCategory, searchQuery])

  const isToolEnabled = (toolId: string) => enabledToolIds.has(toolId)

  const handleToggleTool = (tool: Tool) => {
    if (isToolEnabled(tool.id)) {
      onRemoveTool(tool.id)
    } else {
      if (!tool.configRequired) {
        onAddTool(tool.id)
      } else {
        // For tools requiring config, add with default config
        onAddTool(tool.id, tool.config)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-['Space_Grotesk']">Tool Library</h2>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              Browse and add tools to your agent • {enabledToolIds.size} enabled
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search and Category Filter */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 space-y-4">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools by name, description, or package..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                selectedCategory === 'all'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All ({toolLibrary.length})
            </button>
            {categories.map(cat => {
              const count = toolLibrary.filter(t => t.category === cat.value).length
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all flex items-center gap-1.5 ${
                    selectedCategory === cat.value
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 dark:shadow-violet-900/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Tools Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTools.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">No tools found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTools.map(tool => (
                <ToolCard
                  key={tool.id}
                  tool={tool}
                  isEnabled={isToolEnabled(tool.id)}
                  onToggle={() => handleToggleTool(tool)}
                  onConfigure={() => onConfigureTool?.(tool.id, tool.config)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="text-sm text-slate-500 dark:text-slate-500">
            {enabledToolIds.size} tool{enabledToolIds.size !== 1 ? 's' : ''} enabled
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors shadow-lg shadow-violet-200 dark:shadow-violet-900/20 font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
