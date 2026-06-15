/**
 * TasklistList — list view for all tasklists in the current space.
 */
import { useMemo } from 'react'
import { useUIState } from '@lmthing/state'
import type { TasklistListItem as TLItem } from '@lmthing/state'
import { TasklistCard, TasklistListItem } from '../workflow-card'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { cn } from '@lmthing/ui/lib/utils'
import '@lmthing/css/components/workflow/workflow-list/index.css'

interface TasklistListProps {
  tasklists: TLItem[]
  selectedName: string | null
  onSelectTasklist: (name: string) => void
  onCreateTasklist: () => void
  onDeleteTasklist: (name: string) => void
}

type ViewMode = 'grid' | 'list'

export function TasklistList({
  tasklists,
  selectedName,
  onSelectTasklist,
  onCreateTasklist,
  onDeleteTasklist,
}: TasklistListProps) {
  const [viewMode, setViewMode] = useUIState<ViewMode>('tasklist-list.view-mode', 'grid')
  const [searchQuery, setSearchQuery] = useUIState('tasklist-list.search-query', '')

  const filteredTasklists = useMemo(() => {
    if (!searchQuery) return tasklists
    const q = searchQuery.toLowerCase()
    return tasklists.filter((tl) => tl.name.toLowerCase().includes(q))
  }, [tasklists, searchQuery])

  return (
    <Page>
      <PageHeader>
        <div className="workflow-list__header-inner">
          <div className="workflow-list__title-row">
            <div>
              <Heading level={1}>Tasklists</Heading>
              <Caption muted>Define ordered task DAGs for agent action flows</Caption>
            </div>
            <Button variant="primary" onClick={onCreateTasklist}>
              <svg className="workflow-list__create-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Tasklist
            </Button>
          </div>

          {/* Stats */}
          <Stack row gap="lg" className="workflow-list__stats">
            <Stack row gap="sm" className="workflow-list__stat-row">
              <span className="workflow-list__stat-count">{tasklists.length}</span>
              <Caption muted>total</Caption>
            </Stack>
          </Stack>

          {/* Search + view toggle */}
          <Stack row gap="md" className="workflow-list__filters">
            <div className="workflow-list__search-wrapper">
              <svg
                className="workflow-list__search-icon"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasklists…"
                className="workflow-list__search-input"
              />
            </div>

            {/* View toggle */}
            <div className="workflow-list__view-toggle">
              <button
                onClick={() => setViewMode('grid')}
                className={cn('workflow-list__view-btn', viewMode === 'grid' && 'workflow-list__view-btn--active')}
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
                className={cn('workflow-list__view-btn', viewMode === 'list' && 'workflow-list__view-btn--active')}
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
          {filteredTasklists.length === 0 ? (
            tasklists.length === 0 ? (
              <div className="workflow-list__empty-first">
                <div className="workflow-list__empty-first-icon-wrapper">
                  <svg className="workflow-list__empty-first-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <rect x="9" y="3" width="6" height="4" rx="1" />
                    <path d="M9 12h6M9 16h4" />
                  </svg>
                </div>
                <Heading level={2}>Create your first tasklist</Heading>
                <Caption muted className="workflow-list__empty-first-caption">
                  Tasklists define the ordered steps agents execute when a slash action is triggered.
                </Caption>
                <Button variant="primary" onClick={onCreateTasklist}>
                  <svg className="workflow-list__create-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Tasklist
                </Button>
              </div>
            ) : (
              <div className="workflow-list__empty-no-match">
                <Heading level={3}>No tasklists match your search</Heading>
                <Caption muted>Try a different name</Caption>
              </div>
            )
          ) : (
            <div className={viewMode === 'grid' ? 'workflow-list__grid' : 'workflow-list__list'}>
              {filteredTasklists.map((tl) =>
                viewMode === 'grid' ? (
                  <TasklistCard
                    key={tl.name}
                    tasklist={tl}
                    isSelected={selectedName === tl.name}
                    onSelect={() => onSelectTasklist(tl.name)}
                    onDelete={() => onDeleteTasklist(tl.name)}
                  />
                ) : (
                  <TasklistListItem
                    key={tl.name}
                    tasklist={tl}
                    isSelected={selectedName === tl.name}
                    onSelect={() => onSelectTasklist(tl.name)}
                    onDelete={() => onDeleteTasklist(tl.name)}
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

/** @deprecated Use TasklistList */
export { TasklistList as WorkflowList }
