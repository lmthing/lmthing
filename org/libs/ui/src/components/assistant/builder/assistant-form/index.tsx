/**
 * AssistantForm - Controlled form for assistant configuration.
 * Phase 2: Receives all state as props, no internal state for form values.
 */
import '@lmthing/css/components/assistant/builder/index.css'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { FieldSelector } from '../field-selector'
import type { DomainMeta } from '@lmthing/ui/hooks/useKnowledgeFields'
import type { WorkflowListItem } from '@lmthing/ui/hooks/useWorkflowList'

export interface AssistantFormProps {
  name: string
  description: string
  instructions: string
  selectedFieldIds: string[]
  selectedWorkflowIds: string[]
  knowledgeFields: DomainMeta[]
  workflowList: WorkflowListItem[]
  onNameChange: (name: string) => void
  onDescriptionChange: (desc: string) => void
  onInstructionsChange: (text: string) => void
  onFieldToggle: (fieldId: string) => void
  onWorkflowToggle: (workflowId: string) => void
}

function WorkflowCard({ workflow, selected, onToggle }: {
  workflow: WorkflowListItem
  selected: boolean
  onToggle: () => void
}) {
  return (
    <Card
      interactive
      onClick={onToggle}
      className="assistant-form__workflow-card"
    >
      <CardBody>
        <Stack row className="assistant-form__workflow-row">
          <Label>{workflow.id}</Label>
          <Badge variant={selected ? 'primary' : 'muted'}>
            {selected ? 'Attached' : 'Add'}
          </Badge>
        </Stack>
      </CardBody>
    </Card>
  )
}

export function AssistantForm({
  name,
  description,
  instructions,
  selectedFieldIds,
  selectedWorkflowIds,
  knowledgeFields,
  workflowList,
  onNameChange,
  onDescriptionChange,
  onInstructionsChange,
  onFieldToggle,
  onWorkflowToggle,
}: AssistantFormProps) {
  return (
    <Stack gap="lg">
      {/* Identity */}
      <div className="panel">
        <div className="panel__header"><Label>Identity</Label></div>
        <div className="panel__body">
          <Stack gap="md">
            <div>
              <Label compact>Name</Label>
              <input
                className="input"
                value={name}
                onChange={e => onNameChange(e.target.value)}
                placeholder="Assistant name"
              />
            </div>
            <div>
              <Label compact>Description</Label>
              <input
                className="input"
                value={description}
                onChange={e => onDescriptionChange(e.target.value)}
                placeholder="What does this assistant do?"
              />
            </div>
          </Stack>
        </div>
      </div>

      {/* Instructions */}
      <div className="panel">
        <div className="panel__header"><Label>Instructions</Label></div>
        <div className="panel__body">
          <textarea
            className="input assistant-form__instructions-textarea"
            value={instructions}
            onChange={e => onInstructionsChange(e.target.value)}
            placeholder="Main instructions for this assistant..."
          />
        </div>
      </div>

      {/* Knowledge Fields */}
      <div className="panel">
        <div className="panel__header">
          <Label>Knowledge Fields ({selectedFieldIds.length}/{knowledgeFields.length})</Label>
        </div>
        <div className="panel__body">
          <FieldSelector
            fields={knowledgeFields}
            selectedIds={selectedFieldIds}
            onToggle={onFieldToggle}
          />
        </div>
      </div>

      {/* Workflows */}
      <div className="panel">
        <div className="panel__header">
          <Label>Workflows ({selectedWorkflowIds.length}/{workflowList.length})</Label>
        </div>
        <div className="panel__body">
          {workflowList.length === 0 ? (
            <Caption muted>No workflows available.</Caption>
          ) : (
            <Stack gap="sm">
              {workflowList.map(wf => (
                <WorkflowCard
                  key={wf.id}
                  workflow={wf}
                  selected={selectedWorkflowIds.includes(wf.id)}
                  onToggle={() => onWorkflowToggle(wf.id)}
                />
              ))}
            </Stack>
          )}
        </div>
      </div>
    </Stack>
  )
}
