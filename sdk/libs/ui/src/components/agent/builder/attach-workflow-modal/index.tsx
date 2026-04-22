/**
 * AttachWorkflowModal - Modal for searching and attaching workflows to an agent.
 * US-206: Searchable workflow selection modal.
 */
import '@lmthing/css/components/agent/builder/index.css'
import { useMemo } from 'react'
import { useUIState } from '@lmthing/state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@lmthing/ui/elements/overlays/dialog'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Search, Zap } from 'lucide-react'
import type { WorkflowListItem } from '@lmthing/ui/hooks/useWorkflowList'

export interface AttachWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  workflows: WorkflowListItem[]
  alreadyAttachedIds: string[]
  onAttach: (workflowId: string) => void
}

export function AttachWorkflowModal({
  isOpen,
  onClose,
  workflows,
  alreadyAttachedIds,
  onAttach,
}: AttachWorkflowModalProps) {
  const [search, setSearch] = useUIState('attach-workflow-modal.search', '')

  const filtered = useMemo(() => {
    if (!search.trim()) return workflows
    const q = search.toLowerCase()
    return workflows.filter(w => w.id.toLowerCase().includes(q))
  }, [workflows, search])

  const handleAttach = (workflowId: string) => {
    onAttach(workflowId)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach Workflow</DialogTitle>
          <DialogDescription>
            Select a workflow to attach as an action to this agent.
          </DialogDescription>
        </DialogHeader>

        <div className="attach-workflow-modal__body">
          <div className="attach-workflow-modal__search-wrap">
            <Search className="attach-workflow-modal__search-icon" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workflows..."
              className="attach-workflow-modal__search-input"
            />
          </div>

          <div className="attach-workflow-modal__list">
            {filtered.length === 0 ? (
              <div className="attach-workflow-modal__empty">
                <Caption muted>
                  {workflows.length === 0 ? 'No workflows available. Create a workflow first.' : 'No workflows match your search.'}
                </Caption>
              </div>
            ) : (
              filtered.map(wf => {
                const isAttached = alreadyAttachedIds.includes(wf.id)
                return (
                  <Card key={wf.id} interactive={!isAttached}>
                    <CardBody>
                      <Stack row className="attach-workflow-modal__card-row">
                        <Stack row gap="sm" className="attach-workflow-modal__card-left">
                          <Zap className="attach-workflow-modal__card-icon" />
                          <div className="attach-workflow-modal__card-name-wrap">
                            <Label className="attach-workflow-modal__card-name">{wf.id}</Label>
                          </div>
                        </Stack>
                        {isAttached ? (
                          <Badge variant="muted">Attached</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAttach(wf.id)}
                          >
                            Select
                          </Button>
                        )}
                      </Stack>
                    </CardBody>
                  </Card>
                )
              })
            )}
          </div>
        </div>

        <Stack row gap="sm" className="attach-workflow-modal__footer">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
