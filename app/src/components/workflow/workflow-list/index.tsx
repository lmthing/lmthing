import { useState, useMemo } from 'react'
import type { Flow } from '@/../product/sections/flow-builder/types'
import { WorkflowCard, WorkflowListItem } from '../workflow-card'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { Page, PageHeader, PageBody } from '@/elements/layouts/page'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'

interface WorkflowListProps {
  workflows: Flow[]
  selectedWorkflowId: string | null
  onSelectWorkflow: (workflowId: string) => void
  onCreateWorkflow: () => void
  onDeleteWorkflow: (workflowId: string) => void
  activeTagFilter?: string | null
  onTagFilterChange?: (tag: string | null) => void
}

type ViewMode = 'grid' | 'list'

const EMPTY_STATE_TAGS = ['automation', 'analytics', 'processing', 'integration', 'ai']

export function WorkflowList({
  workflows,
  selectedWorkflowId,
  onSelectWorkflow,
  onCreateWorkflow,
  onDeleteWorkflow,
  activeTagFilter,
  onTagFilterChange,
}: WorkflowListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  // Extract all unique tags from workflows
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    workflows.forEach(wf => wf.tags.forEach(tag => tags.add(tag)))
    return Array.from(tags).sort()
  }, [workflows])

  // Filter workflows based on search and tag filter
  const filteredWorkflows = useMemo(() => {
    return workflows.filter(wf => {
      const matchesSearch = searchQuery === '' ||
        wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wf.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTag = !activeTagFilter || wf.tags.includes(activeTagFilter)
      return matchesSearch && matchesTag
    })
  }, [workflows, searchQuery, activeTagFilter])

  const workflowCount = workflows.length
  const activeCount = workflows.filter(f => f.status === 'active').length
  const draftCount = workflows.filter(f => f.status === 'draft').length

  return (
    <Page>
      <PageHeader>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Stack row gap="md" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <Heading level={1}>Workflow Builder</Heading>
              <Caption muted>Create sequential step flows for automated assistant workflows</Caption>
            </div>
            <Button variant="primary" onClick={onCreateWorkflow}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create Workflow
            </Button>
          </Stack>

          {/* Stats bar */}
          <Stack row gap="lg" style={{ marginBottom: '1.5rem' }}>
            <Stack row gap="sm" style={{ alignItems: 'center' }}>
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{workflowCount}</span>
              <Caption muted>total</Caption>
            </Stack>
            <Stack row gap="sm" style={{ alignItems: 'center' }}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <Caption muted>{activeCount} active</Caption>
            </Stack>
            <Stack row gap="sm" style={{ alignItems: 'center' }}>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <Caption muted>{draftCount} draft</Caption>
            </Stack>
          </Stack>

          {/* Search and filters */}
          <Stack row gap="md" style={{ flexWrap: 'wrap' }}>
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
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workflows..."
                style={{ paddingLeft: '2.5rem' }}
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
          </Stack>
        </div>
      </PageHeader>

      <PageBody>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {filteredWorkflows.length === 0 ? (
            workflows.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 p-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-500/25">
                  <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <Heading level={2}>Create your first workflow</Heading>
                <Caption muted style={{ marginBottom: '2rem', maxWidth: '28rem', marginInline: 'auto' }}>
                  Build sequential step flows to automate complex assistant workflows. Start with a simple workflow and add steps as you go.
                </Caption>
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                  {EMPTY_STATE_TAGS.map((tag) => (
                    <Badge key={tag} variant="primary">{tag}</Badge>
                  ))}
                </div>
                <Button variant="primary" onClick={onCreateWorkflow}>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Your First Workflow
                </Button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <Heading level={3}>No workflows match your filters</Heading>
                <Caption muted>Try adjusting your search or tag filter</Caption>
              </div>
            )
          ) : (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'space-y-2'
            }>
              {filteredWorkflows.map((wf) =>
                viewMode === 'grid' ? (
                  <WorkflowCard
                    key={wf.id}
                    workflow={wf}
                    isSelected={selectedWorkflowId === wf.id}
                    onSelect={() => onSelectWorkflow(wf.id)}
                    onDelete={() => onDeleteWorkflow(wf.id)}
                  />
                ) : (
                  <WorkflowListItem
                    key={wf.id}
                    workflow={wf}
                    isSelected={selectedWorkflowId === wf.id}
                    onSelect={() => onSelectWorkflow(wf.id)}
                    onDelete={() => onDeleteWorkflow(wf.id)}
                  />
                )
              )}
            </div>
          )}
        </div>
      </PageBody>
    </Page>
  )
}
