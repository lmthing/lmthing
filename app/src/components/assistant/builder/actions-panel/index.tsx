import { Button } from '@/elements/forms/button'
import { Card, CardBody, CardFooter } from '@/elements/content/card'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { PanelHeader } from '@/elements/content/panel'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'
import { Code } from '@/elements/typography/code'

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelHeader>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Label compact>Slash Actions</Label>
            <Caption muted>Attach workflows with custom triggers</Caption>
          </div>
          <Button onClick={onOpenWorkflowBuilder} variant="primary" size="sm">+ Attach Workflow</Button>
        </Stack>
      </PanelHeader>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {attachedWorkflows.length === 0 ? (
          <Stack style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚡</div>
            <Label>No actions attached</Label>
            <Caption muted style={{ maxWidth: '200px', margin: '0 auto 1rem' }}>
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
        <Caption muted style={{ textAlign: 'center', display: 'block' }}>
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
        <Stack row gap="sm" style={{ alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Stack row gap="sm" style={{ alignItems: 'center', marginBottom: '0.25rem' }}>
              <Code>/{workflow.slashAction.actionId}</Code>
              <Badge variant={workflow.slashAction.enabled ? 'success' : 'muted'} style={{ fontSize: '0.625rem' }}>
                {workflow.slashAction.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </Stack>
            <Label style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{workflow.slashAction.name}</Label>
            <Caption muted style={{ marginTop: '0.125rem' }}>{workflow.slashAction.description}</Caption>
            <Stack row gap="sm" style={{ marginTop: '0.5rem' }}>
              <Badge variant="muted" style={{ fontSize: '0.625rem' }}>{workflow.stepCount} step{workflow.stepCount > 1 ? 's' : ''}</Badge>
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
