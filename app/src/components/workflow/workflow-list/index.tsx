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
              <span className="text-2xl font-bold text-foreground">{workflowCount}</span>
              <Caption muted>total</Caption>
            </Stack>
            <Stack row gap="sm" style={{ alignItems: 'center' }}>
              <span className="w-2 h-2 rounded-full bg-brand-2" />
              <Caption muted>{activeCount} active</Caption>
            </Stack>
            <Stack row gap="sm" style={{ alignItems: 'center' }}>
              <span className="w-2 h-2 rounded-full bg-brand-2" />
              <Caption muted>{draftCount} draft</Caption>
            </Stack>
          </Stack>

          {/* Search and filters */}
          <Stack row gap="md" style={{ flexWrap: 'wrap' }}>
            <div className="relative flex-1 max-w-md">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
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
                    ? 'bg-brand-3/15 text-brand-3 ring-1 ring-brand-3/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
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
                      ? 'bg-brand-3/15 text-brand-3 ring-1 ring-brand-3/30'
                      : 'bg-muted text-muted-foreground hover:bg-muted'
                    }
                  `}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`
                  p-2 rounded-md transition-all
                  ${viewMode === 'grid'
                    ? 'bg-card text-brand-3 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
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
                    ? 'bg-card text-brand-3 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
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
              <div className="bg-card rounded-2xl border-2 border-dashed border-border p-16 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-3 to-brand-3 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-3/25">
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
              <div className="bg-card rounded-xl p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
