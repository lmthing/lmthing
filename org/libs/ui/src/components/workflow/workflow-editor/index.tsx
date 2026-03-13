import { useToggle, useUIState } from '@lmthing/state'
import type { Flow, Task } from '@/../product/sections/flow-builder/types'
import { StepCard } from '../step/step-card'
import { StepConfigPanel } from '../step/step-config-panel'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Code } from '@lmthing/ui/elements/typography/code'
import { cn } from '@lmthing/ui/lib/utils'

import '@lmthing/css/components/workflow/workflow-editor/index.css'

interface WorkflowEditorProps {
  workflow: Flow
  steps: Task[]
  availableTools?: Array<{ id: string; name: string; description: string }>
  onUpdateWorkflow?: (updates: Partial<Flow>) => void
  onAddStep?: (step: Omit<Task, 'id'>) => void
  onUpdateStep?: (stepId: string, updates: Partial<Task>) => void
  onDeleteStep?: (stepId: string) => void
  onDuplicateStep?: (stepId: string) => void
  onReorderSteps?: (stepIds: string[]) => void
  onBack?: () => void
}

const AVAILABLE_TOOLS: Array<{ id: string; name: string; description: string }> = []

export function WorkflowEditor({
  workflow,
  steps,
  availableTools = AVAILABLE_TOOLS,
  onUpdateWorkflow,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onDuplicateStep,
  onReorderSteps: _onReorderSteps,
  onBack,
}: WorkflowEditorProps) {
  const [isEditingMeta, toggleIsEditingMeta, setIsEditingMeta] = useToggle('workflow-editor.is-editing-meta', false)
  const [expandedStepId, setExpandedStepId] = useUIState<string | null>('workflow-editor.expanded-step', null)
  const [isConfigPanelOpen, , setIsConfigPanelOpen] = useToggle('workflow-editor.is-config-panel-open', false)
  const [editingStepId, setEditingStepId] = useUIState<string | null>('workflow-editor.editing-step', null)

  // Sort steps by order
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order)

  const allTags = Array.from(new Set([...workflow.tags, 'automation', 'analytics', 'processing', 'integration']))

  return (
    <div className="workflow-editor">
      {/* Header */}
      <div className="workflow-editor__header">
        <div className="workflow-editor__header-inner">
          <Stack row gap="md" className="workflow-editor__header-top">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <svg className="workflow-editor__back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Button>
            <div className="workflow-editor__title-area">
              <Stack row gap="md" className="workflow-editor__title-row">
                <div className="workflow-editor__icon-box">
                  <svg className="workflow-editor__icon-box-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <Heading level={2}>{workflow.name}</Heading>
                  <Caption muted>{steps.length} step{steps.length !== 1 ? 's' : ''} &bull; {workflow.status}</Caption>
                </div>
              </Stack>
            </div>
            <Button variant="outline" onClick={toggleIsEditingMeta}>
              {isEditingMeta ? 'Done' : 'Edit'}
            </Button>
          </Stack>

          {/* Editable metadata */}
          {isEditingMeta && (
            <div className="workflow-editor__meta-form">
              <div>
                <Label compact required>Workflow Name</Label>
                <Input
                  type="text"
                  value={workflow.name}
                  onChange={(e) => onUpdateWorkflow?.({ name: e.target.value })}
                />
              </div>
              <div>
                <Label compact>Status</Label>
                <Select
                  value={workflow.status}
                  onChange={(e) => onUpdateWorkflow?.({ status: e.target.value as Flow['status'] })}
                >
                  <SelectOption value="draft">Draft</SelectOption>
                  <SelectOption value="active">Active</SelectOption>
                  <SelectOption value="archived">Archived</SelectOption>
                </Select>
              </div>
              <div className="workflow-editor__meta-full">
                <Label compact>Description</Label>
                <Textarea
                  value={workflow.description}
                  onChange={(e) => onUpdateWorkflow?.({ description: e.target.value })}
                  compact
                />
              </div>
              <div className="workflow-editor__meta-full">
                <Label compact>Tags</Label>
                <div className="workflow-editor__tag-list">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        const nextTags = workflow.tags.includes(tag)
                          ? workflow.tags.filter((t) => t !== tag)
                          : [...workflow.tags, tag]
                        onUpdateWorkflow?.({ tags: nextTags })
                      }}
                      className={cn(
                        'workflow-editor__tag-btn',
                        workflow.tags.includes(tag)
                          ? 'workflow-editor__tag-btn--active'
                          : 'workflow-editor__tag-btn--inactive'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="workflow-editor__main">
        {/* Workflow stats */}
        <div className="workflow-editor__stats">
          <Card>
            <CardBody>
              <Caption muted>Last Run</Caption>
              <Label>
                {workflow.lastRunAt
                  ? new Date(workflow.lastRunAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'Never'
                }
              </Label>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Caption muted>Total Steps</Caption>
              <Label>{steps.length}</Label>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Caption muted>Valid Steps</Caption>
              <Label>
                {steps.filter(t => t.status === 'valid').length} / {steps.length}
              </Label>
            </CardBody>
          </Card>
        </div>

        {/* Steps list */}
        <div className="workflow-editor__steps-section">
          <Stack row gap="md" className="workflow-editor__steps-header">
            <Heading level={3}>Steps</Heading>
            <Button variant="primary" onClick={() => { setEditingStepId(null); setIsConfigPanelOpen(true); }}>
              <svg className="workflow-editor__add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Step
            </Button>
          </Stack>

          {sortedSteps.length === 0 ? (
            <div className="workflow-editor__empty">
              <div className="workflow-editor__empty-icon-wrapper">
                <svg className="workflow-editor__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <Heading level={3}>No steps yet</Heading>
              <Caption muted className="workflow-editor__empty-caption">
                Start building your workflow by adding your first step.
              </Caption>
              <Button variant="primary" onClick={() => setIsConfigPanelOpen(true)}>
                <svg className="workflow-editor__add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Your First Step
              </Button>
            </div>
          ) : (
            <div className="workflow-editor__steps-list">
              {sortedSteps.map((step, index) => (
                <div key={step.id} className="workflow-editor__step-wrapper">
                  {index > 0 && (
                    <div className="workflow-editor__insert-btn-wrapper">
                      <button
                        onClick={() => { setEditingStepId(null); setIsConfigPanelOpen(true); }}
                        className="workflow-editor__insert-btn"
                        title="Add step here"
                      >
                        <svg className="workflow-editor__insert-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="group">
                    <StepCard
                      step={step}
                      isExpanded={expandedStepId === step.id}
                      isDraggable={true}
                      onClick={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
                      onEdit={() => { setEditingStepId(step.id); setIsConfigPanelOpen(true); }}
                      onDelete={() => onDeleteStep?.(step.id)}
                      onDuplicate={() => onDuplicateStep?.(step.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workflow output info */}
        {sortedSteps.length > 0 && (
          <div className="workflow-editor__output-panel">
            <Heading level={3}>Workflow Output State</Heading>
            <Caption muted className="workflow-editor__output-caption">
              All steps share a mutable workflow output object that accumulates data across execution.
            </Caption>
            <Code block>
              <span className="text-muted-foreground">// Accumulated workflow state</span><br />
              <span className="text-brand-5">{`{`}</span><br />
              {sortedSteps
                .filter(t => t.type === 'updateFlowOutput' && t.config?.targetFieldName)
                .map((t, i) => (
                  <span key={t.id} className="workflow-editor__output-field">
                    <span className="text-brand-1">{t.config?.targetFieldName}</span>
                    {t.config?.isPushable && <span className="text-muted-foreground">[]</span>}
                    <span className="text-muted-foreground">: </span>
                    <span className="text-muted-foreground italic">{`/* ${t.name} */`}</span>
                    {i < sortedSteps.filter(x => x.type === 'updateFlowOutput' && x.config?.targetFieldName).length - 1 && <span className="text-muted-foreground">,</span>}
                    <br />
                  </span>
                ))}
              <span className="text-brand-5">{`}`}</span>
            </Code>
          </div>
        )}
      </div>

      {/* Step Config Panel */}
      <StepConfigPanel
        step={editingStepId ? steps.find(t => t.id === editingStepId) || null : null}
        availableTools={availableTools}
        isOpen={isConfigPanelOpen}
        onClose={() => { setIsConfigPanelOpen(false); setEditingStepId(null); }}
        onSave={({ name, description, type, config }) => {
          if (editingStepId) {
            onUpdateStep?.(editingStepId, { name, description, type, config })
          } else {
            onAddStep?.({
              flowId: workflow.id,
              type,
              order: steps.length + 1,
              name,
              description,
              config,
              status: 'pending',
            })
          }
          setIsConfigPanelOpen(false)
          setEditingStepId(null)
        }}
      />
    </div>
  )
}
