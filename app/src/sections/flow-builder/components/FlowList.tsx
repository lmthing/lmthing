import { useState, useMemo } from 'react'
import type { Flow } from '@/../product/sections/flow-builder/types'
import { FlowCard, FlowListItem } from './FlowCard'

interface FlowListProps {
  flows: Flow[]
  selectedFlowId: string | null
  onSelectFlow: (flowId: string) => void
  onCreateFlow: () => void
  onDeleteFlow: (flowId: string) => void
  activeTagFilter?: string | null
  onTagFilterChange?: (tag: string | null) => void
}

type ViewMode = 'grid' | 'list'

const EMPTY_STATE_TAGS = ['automation', 'analytics', 'processing', 'integration', 'ai']

export function FlowList({
  flows,
  selectedFlowId,
  onSelectFlow,
  onCreateFlow,
  onDeleteFlow,
  activeTagFilter,
  onTagFilterChange,
}: FlowListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  // Extract all unique tags from flows
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    flows.forEach(flow => flow.tags.forEach(tag => tags.add(tag)))
    return Array.from(tags).sort()
  }, [flows])

  // Filter flows based on search and tag filter
  const filteredFlows = useMemo(() => {
    return flows.filter(flow => {
      const matchesSearch = searchQuery === '' ||
        flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flow.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTag = !activeTagFilter || flow.tags.includes(activeTagFilter)
      return matchesSearch && matchesTag
    })
  }, [flows, searchQuery, activeTagFilter])

  const flowCount = flows.length
  const activeCount = flows.filter(f => f.status === 'active').length
  const draftCount = flows.filter(f => f.status === 'draft').length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Flow Builder
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Create sequential task flows for automated agent workflows
              </p>
            </div>
            <button
              onClick={onCreateFlow}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create Flow
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex items-center gap-6 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{flowCount}</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">total</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {activeCount} active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {draftCount} draft
              </span>
            </div>
          </div>

          {/* Search and filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search flows..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Tag filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => onTagFilterChange?.(null)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${!activeTagFilter
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }
                `}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagFilterChange?.(tag)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                    ${activeTagFilter === tag
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`
                  p-2 rounded-md transition-all
                  ${viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }
                `}
                title="Grid view"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`
                  p-2 rounded-md transition-all
                  ${viewMode === 'list'
                    ? 'bg-white dark:bg-slate-700 text-violet-600 dark:text-violet-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }
                `}
                title="List view"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredFlows.length === 0 ? (
          /* Empty state */
          flows.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 p-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-500/25">
                <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Create your first flow
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                Build sequential task flows to automate complex agent workflows. Start with a simple flow and add tasks as you go.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {EMPTY_STATE_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <button
                onClick={onCreateFlow}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 text-white font-medium hover:bg-violet-600 transition-colors shadow-lg shadow-violet-500/25"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create Your First Flow
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                No flows match your filters
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Try adjusting your search or tag filter
              </p>
            </div>
          )
        ) : (
          /* Flow grid/list */
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-2'
          }>
            {filteredFlows.map((flow) =>
              viewMode === 'grid' ? (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  isSelected={selectedFlowId === flow.id}
                  onSelect={() => onSelectFlow(flow.id)}
                  onDelete={() => onDeleteFlow(flow.id)}
                />
              ) : (
                <FlowListItem
                  key={flow.id}
                  flow={flow}
                  isSelected={selectedFlowId === flow.id}
                  onSelect={() => onSelectFlow(flow.id)}
                  onDelete={() => onDeleteFlow(flow.id)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
