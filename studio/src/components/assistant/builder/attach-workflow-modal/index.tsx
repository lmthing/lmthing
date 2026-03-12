/**
 * AttachWorkflowModal - Modal for searching and attaching workflows to an agent.
 * US-206: Searchable workflow selection modal.
 */
import { useMemo } from 'react'
import { useUIState } from '@lmthing/state'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/elements/overlays/dialog'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Stack } from '@/elements/layouts/stack'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { Card, CardBody } from '@/elements/content/card'
import { Search, Zap } from 'lucide-react'
import type { WorkflowListItem } from '@/hooks/useWorkflowList'

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

        <div style={{ marginTop: '1rem' }}>
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <Search style={{
              position: 'absolute',
              left: '0.625rem',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '0.875rem',
              height: '0.875rem',
              color: 'var(--color-muted-foreground)',
              pointerEvents: 'none',
            }} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workflows..."
              style={{ paddingLeft: '2rem' }}
            />
          </div>

          <div style={{
            maxHeight: '20rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
          }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
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
                      <Stack row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Stack row gap="sm" style={{ alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <Zap style={{ width: '1rem', height: '1rem', color: 'var(--color-agent)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <Label style={{ display: 'block' }}>{wf.id}</Label>
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

        <Stack row gap="sm" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
