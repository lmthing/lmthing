import type { Task, TaskType, TaskConfig } from '@/../product/sections/flow-builder/types'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Code } from '@lmthing/ui/elements/typography/code'
import '@lmthing/css/components/workflow/step-card/index.css'

interface StepCardProps {
  step: Task
  isExpanded: boolean
  isDraggable: boolean
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
}

const STEP_TYPE_CONFIG: Record<TaskType, { label: string; icon: string; color: string; passesData: boolean }> = {
  'updateFlowOutput': { label: 'Update Output', icon: '↗', color: 'violet', passesData: true },
  'executeTask': { label: 'Execute', icon: '⚡', color: 'amber', passesData: false },
}

export function StepCard({ step, isExpanded, isDraggable, onClick, onEdit, onDelete, onDuplicate }: StepCardProps) {
  const config = STEP_TYPE_CONFIG[step.type]
  const isValid = step.status === 'valid'

  return (
    <div className={`step-card ${isExpanded ? 'step-card--expanded' : ''}`}>
      {/* Connector line from above */}
      <div className="step-card__connector-top" />

      {/* Main card */}
      <div
        onClick={onClick}
        className={`step-card__body ${!isValid ? 'step-card__body--invalid' : ''}`}
      >
        <div className="step-card__inner">
          <div className="step-card__content">
            {/* Drag handle */}
            {isDraggable && (
              <div className="step-card__drag-handle">
                <svg className="step-card__drag-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="6" r="1.5" />
                  <circle cx="15" cy="6" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" />
                  <circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="18" r="1.5" />
                  <circle cx="15" cy="18" r="1.5" />
                </svg>
              </div>
            )}

            {/* Step type indicator */}
            <div className="step-card__type-indicator">
              {config.icon}
            </div>

            {/* Step info */}
            <div className="step-card__info">
              <div className="step-card__title-row">
                <Label>{step.name}</Label>
                <Badge variant={config.color === 'violet' ? 'primary' : 'muted'}>{config.label}</Badge>
                {config.passesData && (
                  <Badge variant="success">
                    <svg className="step-card__passes-data-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 17L17 7M7 7h10v10" />
                    </svg>
                    Passes Data
                  </Badge>
                )}
                {!isValid && (
                  <Badge variant="primary">Invalid</Badge>
                )}
              </div>
              <Caption muted>{step.description}</Caption>
            </div>

            {/* Action buttons */}
            <div className="step-card__actions">
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                <svg className="step-card__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}>
                <svg className="step-card__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
                <svg className="step-card__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </Button>
            </div>
          </div>

          {/* Expanded content */}
          {isExpanded && (
            <div className="step-card__expanded-content">
              <StepConfigPreview step={step} />
            </div>
          )}
        </div>

        {/* Order badge */}
        <div className="step-card__order-badge">
          {step.order}
        </div>
      </div>

      {/* Connector line to below - only show if this step passes data to next */}
      {config.passesData && (
        <div className="step-card__connector-bottom" />
      )}
    </div>
  )
}

function StepConfigPreview({ step }: { step: Task }) {
  const config = step.config as TaskConfig

  const hasTargetFieldName = config.targetFieldName !== undefined
  const hasOutputSchema = config.outputSchema !== undefined
  const hasPromptFragments = config.promptFragmentFields && config.promptFragmentFields.length > 0
  const hasTools = config.enabledTools && config.enabledTools.length > 0
  const hasInstructions = config.taskInstructions && config.taskInstructions.length > 0
  const hasModel = config.model !== undefined
  const isPushable = config.isPushable === true

  return (
    <div className="step-preview">
      {/* Target Field Name (updateFlowOutput only) */}
      {step.type === 'updateFlowOutput' && hasTargetFieldName && (
        <div className="step-preview__section">
          <div className="step-preview__field-header">
            <Label compact>
              <svg className="step-preview__field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Target Field
            </Label>
            {isPushable && (
              <Badge variant="success">Add to Existing List</Badge>
            )}
          </div>
          <div className="step-preview__field-value">
            <Code>{config.targetFieldName}</Code>
            {isPushable && <Caption muted>[]</Caption>}
          </div>
        </div>
      )}

      {/* Output Schema (updateFlowOutput only) */}
      {step.type === 'updateFlowOutput' && hasOutputSchema && (
        <div className="step-preview__section">
          <Label compact>
            <svg className="step-preview__field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
            </svg>
            Expected Output Format
          </Label>
          <Code block>
            <div className="text-brand-3">{`{`}</div>
            {config.outputSchema?.properties && Object.entries(config.outputSchema.properties).map(([key, value]: [string, any]) => (
              <div key={key} className="ml-4 text-foreground">
                <span className="text-brand-1">{key}</span>
                {config.outputSchema?.required?.includes(key) && <span className="text-brand-2">*</span>}
                <span className="text-muted-foreground">: </span>
                <span className="text-brand-2">{value.type}</span>
                {value.enum && <span className="text-muted-foreground ml-2">enum: [{value.enum.join(', ')}]</span>}
              </div>
            ))}
            <div className="text-brand-3">{`}`}</div>
          </Code>
        </div>
      )}

      {/* Prompt Fragment Fields */}
      {hasPromptFragments && (
        <div className="step-preview__section">
          <Label compact>Prompt Fragments ({config.promptFragmentFields!.length})</Label>
          <div className="step-preview__tag-list">
            {config.promptFragmentFields!.map((pf, i) => (
              <Badge key={i} variant="primary">{pf.fragmentId}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Enabled Tools */}
      {hasTools && (
        <div className="step-preview__section">
          <Label compact>Enabled Tools ({config.enabledTools!.length})</Label>
          <div className="step-preview__tag-list">
            {config.enabledTools!.map((tool, i) => (
              <Badge key={i} variant="muted">{tool}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Step Instructions */}
      {hasInstructions && (
        <div className="step-preview__section">
          <Label compact>Step Instructions</Label>
          <div className="step-preview__instructions">
            <Caption>{config.taskInstructions}</Caption>
          </div>
        </div>
      )}

      {/* Model Settings */}
      {hasModel && (
        <div className="step-preview__model-info">
          <Caption muted>
            <svg className="step-preview__model-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <Code>{config.model}</Code>
          </Caption>
          {config.temperature !== undefined && (
            <Caption muted>
              Temperature: {config.temperature}
            </Caption>
          )}
        </div>
      )}

      {/* No configuration */}
      {!hasTargetFieldName && !hasOutputSchema && !hasPromptFragments && !hasTools && !hasInstructions && !hasModel && (
        <Caption muted>No configuration set</Caption>
      )}
    </div>
  )
}
