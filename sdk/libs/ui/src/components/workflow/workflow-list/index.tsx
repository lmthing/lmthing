import { useMemo } from 'react'
import { useUIState } from '@lmthing/state'
import type { Flow } from '@/../product/sections/flow-builder/types'
import { WorkflowCard, WorkflowListItem } from '../workflow-card'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { cn } from '@lmthing/ui/lib/utils'
import '@lmthing/css/components/workflow/workflow-list/index.css'

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
  const [viewMode, setViewMode] = useUIState<ViewMode>('workflow-list.view-mode', 'grid')
  const [searchQuery, setSearchQuery] = useUIState('workflow-list.search-query', '')

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
        <div className="workflow-list__header-inner">
          <div className="workflow-list__title-row">
            <div>
              <Heading level={1}>Workflow Builder</Heading>
              <Caption muted>Create sequential step flows for automated agent workflows</Caption>
            </div>
            <Button variant="primary" onClick={onCreateWorkflow}>
              <svg className="workflow-list__create-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Create Workflow
            </Button>
          </div>

          {/* Stats bar */}
          <Stack row gap="lg" className="workflow-list__stats">
            <Stack row gap="sm" className="workflow-list__stat-row">
              <span className="workflow-list__stat-count">{workflowCount}</span>
              <Caption muted>total</Caption>
            </Stack>
            <Stack row gap="sm" className="workflow-list__stat-row">
              <span className="workflow-list__stat-dot" />
              <Caption muted>{activeCount} active</Caption>
            </Stack>
            <Stack row gap="sm" className="workflow-list__stat-row">
              <span className="workflow-list__stat-dot" />
              <Caption muted>{draftCount} draft</Caption>
            </Stack>
          </Stack>

          {/* Search and filters */}
          <Stack row gap="md" className="workflow-list__filters">
            <div className="workflow-list__search-wrapper">
              <svg
                className="workflow-list__search-icon"
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
                className="workflow-list__search-input"
              />
            </div>

            {/* Tag filter */}
            <div className="workflow-list__tag-filters">
              <button
                onClick={() => onTagFilterChange?.(null)}
                className={cn(
                  'workflow-list__tag-btn',
                  !activeTagFilter ? 'workflow-list__tag-btn--active' : 'workflow-list__tag-btn--inactive'
                )}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagFilterChange?.(tag)}
                  className={cn(
                    'workflow-list__tag-btn',
                    activeTagFilter === tag ? 'workflow-list__tag-btn--active' : 'workflow-list__tag-btn--inactive'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="workflow-list__view-toggle">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'workflow-list__view-btn',
                  viewMode === 'grid' ? 'workflow-list__view-btn--active' : 'workflow-list__view-btn--inactive'
                )}
                title="Grid view"
              >
                <svg className="workflow-list__view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'workflow-list__view-btn',
                  viewMode === 'list' ? 'workflow-list__view-btn--active' : 'workflow-list__view-btn--inactive'
                )}
                title="List view"
              >
                <svg className="workflow-list__view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
              </button>
            </div>
          </Stack>
        </div>
      </PageHeader>

      <PageBody>
        <div className="workflow-list__body-inner">
          {filteredWorkflows.length === 0 ? (
            workflows.length === 0 ? (
              <div className="workflow-list__empty-first">
                <div className="workflow-list__empty-first-icon-wrapper">
                  <svg className="workflow-list__empty-first-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <Heading level={2}>Create your first workflow</Heading>
                <Caption muted className="workflow-list__empty-first-caption">
                  Build sequential step flows to automate complex agent workflows. Start with a simple workflow and add steps as you go.
                </Caption>
                <div className="workflow-list__empty-first-tags">
                  {EMPTY_STATE_TAGS.map((tag) => (
                    <Badge key={tag} variant="primary">{tag}</Badge>
                  ))}
                </div>
                <Button variant="primary" onClick={onCreateWorkflow}>
                  <svg className="workflow-list__create-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Your First Workflow
                </Button>
              </div>
            ) : (
              <div className="workflow-list__empty-no-match">
                <div className="workflow-list__empty-no-match-icon-wrapper">
                  <svg className="workflow-list__empty-no-match-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </div>
                <Heading level={3}>No workflows match your filters</Heading>
                <Caption muted>Try adjusting your search or tag filter</Caption>
              </div>
            )
          ) : (
            <div className={viewMode === 'grid' ? 'workflow-list__grid' : 'workflow-list__list'}>
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
