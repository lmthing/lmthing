import '@lmthing/css/components/assistant/builder/index.css'
import type { AttachedFlow } from '@/../product/sections/agent-builder/types'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Heading } from '@lmthing/ui/elements/typography/heading'

interface SlashActionCardProps {
  attachedFlow: AttachedFlow
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEdit: (slashActionId: string) => void
  onDetach: (slashActionId: string) => void
}

export function SlashActionCard({ attachedFlow, onToggleEnabled, onEdit, onDetach }: SlashActionCardProps) {
  const { slashAction, flowName, flowDescription, taskCount } = attachedFlow

  return (
    <div className={`slash-action-card ${slashAction.enabled ? 'slash-action-card--enabled' : 'slash-action-card--disabled'}`}>
      <div className="slash-action-card__row">
        <div className="slash-action-card__content">
          {/* Action trigger */}
          <Stack row gap="sm" className="slash-action-card__trigger-row">
            <Badge variant={slashAction.enabled ? 'primary' : 'muted'}>
              /{slashAction.actionId}
            </Badge>
            <Caption muted>&rarr; {flowName}</Caption>
          </Stack>

          {/* Action name and description */}
          <Label>{slashAction.name}</Label>
          <Caption muted>{slashAction.description}</Caption>

          {/* Workflow metadata */}
          <Caption muted className="slash-action-card__meta">
            {taskCount} step{taskCount !== 1 ? 's' : ''} &middot; {flowDescription}
          </Caption>
        </div>

        {/* Actions */}
        <Stack row gap="sm" className="slash-action-card__actions">
          {/* Enable/disable toggle */}
          <button
            onClick={() => onToggleEnabled(slashAction.id, !slashAction.enabled)}
            className={`slash-action-card__toggle ${slashAction.enabled ? 'slash-action-card__toggle--on' : 'slash-action-card__toggle--off'}`}
            title={slashAction.enabled ? 'Disable action' : 'Enable action'}
          >
            <div className={`slash-action-card__toggle-knob ${slashAction.enabled ? 'slash-action-card__toggle-knob--on' : 'slash-action-card__toggle-knob--off'}`} />
          </button>

          {/* Edit button */}
          <Button variant="ghost" size="icon" onClick={() => onEdit(slashAction.id)}>
            <svg className="slash-action-card__btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </Button>

          {/* Detach button */}
          <Button variant="ghost" size="icon" onClick={() => onDetach(slashAction.id)}>
            <svg className="slash-action-card__btn-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </Stack>
      </div>
    </div>
  )
}

// Slash actions list panel
interface SlashActionsPanelProps {
  attachedFlows: AttachedFlow[]
  onToggleEnabled: (slashActionId: string, enabled: boolean) => void
  onEditAction: (slashActionId: string) => void
  onDetachFlow: (slashActionId: string) => void
  onAttachNewFlow: () => void
}

export function SlashActionsPanel({
  attachedFlows,
  onToggleEnabled,
  onEditAction,
  onDetachFlow,
  onAttachNewFlow,
}: SlashActionsPanelProps) {
  const enabledCount = attachedFlows.filter(f => f.slashAction.enabled).length

  return (
    <div className="slash-actions-panel">
      <Stack row gap="md" className="slash-actions-panel__header">
        <Heading level={4}>Slash Actions ({enabledCount}/{attachedFlows.length})</Heading>
        <Button variant="ghost" size="sm" onClick={onAttachNewFlow}>
          <svg className="slash-actions-panel__add-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Action
        </Button>
      </Stack>

      {attachedFlows.length === 0 ? (
        <div className="slash-actions-panel__empty">
          <div className="slash-actions-panel__empty-icon-wrap">
            <svg className="slash-actions-panel__empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <Caption muted>No slash actions</Caption>
          <Caption muted>Attach workflows to create custom actions</Caption>
        </div>
      ) : (
        <div className="slash-actions-panel__list">
          {attachedFlows.map((attachedFlow) => (
            <SlashActionCard
              key={attachedFlow.slashAction.id}
              attachedFlow={attachedFlow}
              onToggleEnabled={onToggleEnabled}
              onEdit={onEditAction}
              onDetach={onDetachFlow}
            />
          ))}
        </div>
      )}

      {/* Help text */}
      {attachedFlows.length > 0 && (
        <div className="slash-actions-panel__help">
          <svg className="slash-actions-panel__help-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <Caption muted>
            Type <span className="slash-actions-panel__help-code">/action</span> in chat to trigger a workflow
          </Caption>
        </div>
      )}
    </div>
  )
}
