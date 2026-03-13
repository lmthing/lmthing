import '@lmthing/css/components/assistant/builder/index.css'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Card, CardBody, CardFooter } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { PanelHeader } from '@lmthing/ui/elements/content/panel'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Code } from '@lmthing/ui/elements/typography/code'

export interface AttachedWorkflow {
  workflowId: string
  workflowName: string
  stepCount: number
  slashAction: {
    id: string
    actionId: string
    name: string
    description: string
    enabled: boolean
  }
}

interface ActionsPanelProps {
  attachedWorkflows: AttachedWorkflow[]
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEditAction: (slashActionId: string) => void
  onDetachWorkflow: (slashActionId: string) => void
  onOpenWorkflowBuilder: () => void
}

export function ActionsPanel({
  attachedWorkflows,
  onToggleEnabled,
  onEditAction,
  onDetachWorkflow,
  onOpenWorkflowBuilder,
}: ActionsPanelProps) {
  return (
    <div className="actions-panel">
      <PanelHeader>
        <Stack row className="actions-panel__header-row">
          <div>
            <Label compact>Slash Actions</Label>
            <Caption muted>Attach workflows with custom triggers</Caption>
          </div>
          <Button onClick={onOpenWorkflowBuilder} variant="primary" size="sm">+ Attach Workflow</Button>
        </Stack>
      </PanelHeader>

      <div className="actions-panel__body">
        {attachedWorkflows.length === 0 ? (
          <Stack className="actions-panel__empty">
            <div className="actions-panel__empty-icon">⚡</div>
            <Label>No actions attached</Label>
            <Caption muted className="actions-panel__empty-caption">
              Attach workflows to give users quick access to multi-step tasks
            </Caption>
            <Button onClick={onOpenWorkflowBuilder} variant="ghost" size="sm">Attach Your First Workflow</Button>
          </Stack>
        ) : (
          <Stack gap="sm">
            {attachedWorkflows.map(workflow => (
              <SlashActionCard
                key={workflow.slashAction.id}
                workflow={workflow}
                onToggleEnabled={onToggleEnabled}
                onEdit={onEditAction}
                onDetach={onDetachWorkflow}
              />
            ))}
          </Stack>
        )}
      </div>

      <CardFooter>
        <Caption muted className="actions-panel__footer-caption">
          Actions are invoked with <Code>/action</Code>
        </Caption>
      </CardFooter>
    </div>
  )
}

function SlashActionCard({ workflow, onToggleEnabled, onEdit, onDetach }: {
  workflow: AttachedWorkflow
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEdit: (slashActionId: string) => void
  onDetach: (slashActionId: string) => void
}) {
  return (
    <Card interactive>
      <CardBody>
        <Stack row gap="sm" className="actions-panel__card-row">
          <div className="actions-panel__card-icon">⚡</div>
          <div className="actions-panel__card-content">
            <Stack row gap="sm" className="actions-panel__card-title-row">
              <Code>/{workflow.slashAction.actionId}</Code>
              <Badge variant={workflow.slashAction.enabled ? 'success' : 'muted'} className="actions-panel__badge-sm">
                {workflow.slashAction.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </Stack>
            <Label className="actions-panel__card-label">{workflow.slashAction.name}</Label>
            <Caption muted className="actions-panel__card-description">{workflow.slashAction.description}</Caption>
            <Stack row gap="sm" className="actions-panel__card-meta-row">
              <Badge variant="muted" className="actions-panel__badge-sm">{workflow.stepCount} step{workflow.stepCount > 1 ? 's' : ''}</Badge>
              <Caption muted>{workflow.workflowName}</Caption>
            </Stack>
          </div>
          <Stack gap="sm">
            <Button
              onClick={() => onToggleEnabled(workflow.slashAction.id, !workflow.slashAction.enabled)}
              variant="ghost"
              size="sm"
              title={workflow.slashAction.enabled ? 'Disable' : 'Enable'}
            >
              {workflow.slashAction.enabled ? '✓' : '○'}
            </Button>
            <Button onClick={() => onEdit(workflow.slashAction.id)} variant="ghost" size="sm" title="Edit">✎</Button>
            <Button onClick={() => onDetach(workflow.slashAction.id)} variant="ghost" size="sm" title="Detach">✕</Button>
          </Stack>
        </Stack>
      </CardBody>
    </Card>
  )
}
