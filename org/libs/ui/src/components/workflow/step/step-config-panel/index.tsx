import { useEffect } from 'react'
import { useUIState, useToggle } from '@lmthing/state'
import type { Task, TaskType, TaskConfig, PromptFragmentField, JSONSchema } from '@/../product/sections/flow-builder/types'
import { StepSchemaEditor } from '../step-schema-editor'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Code } from '@lmthing/ui/elements/typography/code'
import { cn } from '@lmthing/ui/lib/utils'
import '@lmthing/css/components/workflow/step-config-panel/index.css'

interface StepConfigPanelProps {
  step: Task | null
  availableTools: Array<{ id: string; name: string; description: string }>
  availablePromptFragments?: Array<{ id: string; name: string; description: string }>
  isOpen: boolean
  onClose: () => void
  onSave: (updates: { name: string; description: string; type: TaskType; config: TaskConfig }) => void
}

const STEP_TYPES: { type: TaskType; label: string; description: string; passesData: boolean }[] = [
  {
    type: 'updateFlowOutput',
    label: 'Update Workflow Output',
    description: 'Update a specific key in the workflow output with structured LLM output',
    passesData: true
  },
  {
    type: 'executeTask',
    label: 'Execute Step',
    description: 'Perform operations without adding structured output to the workflow state',
    passesData: false
  },
]

export function StepConfigPanel({ step, availableTools, availablePromptFragments = [], isOpen, onClose, onSave }: StepConfigPanelProps) {
  const [selectedType, setSelectedType] = useUIState<TaskType>('step-config-panel.selected-type', step?.type || 'updateFlowOutput')
  const [stepName, setStepName] = useUIState('step-config-panel.step-name', step?.name || '')
  const [stepDescription, setStepDescription] = useUIState('step-config-panel.step-description', step?.description || '')

  // Config states for updateFlowOutput
  const [outputSchema, setOutputSchema] = useUIState<JSONSchema | null>(
    'step-config-panel.output-schema', step?.config?.outputSchema || null
  )
  const [targetFieldName, setTargetFieldName] = useUIState('step-config-panel.target-field-name', step?.config?.targetFieldName || '')
  const [isPushable, toggleIsPushable, setIsPushable] = useToggle('step-config-panel.is-pushable', step?.config?.isPushable ?? false)

  // Prompt fragment fields
  const [promptFragmentFields, setPromptFragmentFields] = useUIState<PromptFragmentField[]>(
    'step-config-panel.prompt-fragment-fields', step?.config?.promptFragmentFields || []
  )

  // Shared config states
  const [enabledTools, setEnabledTools] = useUIState<string[]>('step-config-panel.enabled-tools', step?.config?.enabledTools || [])
  const [stepInstructions, setStepInstructions] = useUIState('step-config-panel.step-instructions', step?.config?.taskInstructions || '')
  const [model, setModel] = useUIState('step-config-panel.model', step?.config?.model || 'claude-3-5-sonnet')
  const [temperature, setTemperature] = useUIState('step-config-panel.temperature', step?.config?.temperature ?? 0.7)

  // Sync form state with step prop when it changes
  useEffect(() => {
    if (step) {
      setSelectedType(step.type)
      setStepName(step.name)
      setStepDescription(step.description)
      setOutputSchema(step.config?.outputSchema || null)
      setTargetFieldName(step.config?.targetFieldName || '')
      setIsPushable(step.config?.isPushable ?? false)
      setPromptFragmentFields(step.config?.promptFragmentFields || [])
      setEnabledTools(step.config?.enabledTools || [])
      setStepInstructions(step.config?.taskInstructions || '')
      setModel(step.config?.model || 'claude-3-5-sonnet')
      setTemperature(step.config?.temperature ?? 0.7)
    } else {
      setSelectedType('updateFlowOutput')
      setStepName('')
      setStepDescription('')
      setOutputSchema(null)
      setTargetFieldName('')
      setIsPushable(false)
      setPromptFragmentFields([])
      setEnabledTools([])
      setStepInstructions('')
      setModel('claude-3-5-sonnet')
      setTemperature(0.7)
    }
  }, [step?.id, isOpen])

  if (!isOpen) return null

  const isEditMode = step !== null

  const handleSave = () => {
    const config: TaskConfig = {
      model,
      temperature,
    }

    if (selectedType === 'updateFlowOutput') {
      if (!targetFieldName.trim()) return
      config.targetFieldName = targetFieldName.trim()
      if (isPushable) config.isPushable = true
      if (outputSchema) config.outputSchema = outputSchema
    }

    if (promptFragmentFields.length > 0) config.promptFragmentFields = promptFragmentFields
    if (enabledTools.length > 0) config.enabledTools = enabledTools
    if (stepInstructions.trim()) config.taskInstructions = stepInstructions.trim()

    onSave({
      name: stepName.trim() || 'New Step',
      description: stepDescription.trim(),
      type: selectedType,
      config,
    })
  }

  return (
    <div className="step-config-panel__overlay">
      {/* Backdrop */}
      <div
        className="step-config-panel__backdrop"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="step-config-panel__panel">
        {/* Header */}
        <div className="step-config-panel__header">
          <div>
            <Heading level={2}>{isEditMode ? 'Edit Step' : 'Add Step'}</Heading>
            <Caption muted>Configure step settings and behavior</Caption>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <svg className="step-config-panel__close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="step-config-panel__content">
          <div className="step-config-panel__content-sections">
            {/* Step Type Selector */}
            {!isEditMode && (
              <div>
                <Label compact>Step Type</Label>
                <div className="step-config-panel__type-grid">
                  {STEP_TYPES.map(({ type, label, description, passesData }) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        'step-config-panel__type-btn',
                        selectedType === type && 'step-config-panel__type-btn--selected'
                      )}
                    >
                      <div className="step-config-panel__type-btn-content">
                        <div>
                          <Label>{label}</Label>
                          <Caption muted>{description}</Caption>
                        </div>
                        {passesData && (
                          <Badge variant="success">
                            <svg className="step-config-panel__passes-data-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M7 17L17 7M7 7h10v10" />
                            </svg>
                            Passes Data
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Name & Description */}
            <Stack gap="md">
              <div>
                <Label compact>Step Name</Label>
                <Input
                  type="text"
                  value={stepName}
                  onChange={(e) => setStepName(e.target.value)}
                  placeholder="e.g., Extract Customer Data"
                />
              </div>
              <div>
                <Label compact>Description</Label>
                <Textarea
                  value={stepDescription}
                  onChange={(e) => setStepDescription(e.target.value)}
                  placeholder="Briefly describe what this step does..."
                  compact
                />
              </div>
            </Stack>

            {/* Step Configuration */}
            <div className="step-config-panel__config-section">
              {/* updateFlowOutput specific fields */}
              {selectedType === 'updateFlowOutput' && (
                <>
                  {/* Target Field Name */}
                  <div>
                    <Label compact required>Target Field Name</Label>
                    <Input
                      type="text"
                      value={targetFieldName}
                      onChange={(e) => setTargetFieldName(e.target.value)}
                      placeholder="e.g., customerAnalysis, extractedData"
                    />
                    <Caption muted>
                      The key in the workflow output object where this step's LLM output will be stored
                    </Caption>
                  </div>

                  {/* Is Pushable */}
                  <div className="step-config-panel__pushable-row">
                    <button
                      onClick={toggleIsPushable}
                      className={cn(
                        'step-config-panel__toggle',
                        isPushable ? 'step-config-panel__toggle--on' : 'step-config-panel__toggle--off'
                      )}
                    >
                      <span
                        className={cn(
                          'step-config-panel__toggle-knob',
                          isPushable ? 'step-config-panel__toggle-knob--on' : 'step-config-panel__toggle-knob--off'
                        )}
                      />
                    </button>
                    <div>
                      <Label>Add to Existing List</Label>
                      <Caption muted>
                        Turn this on if you want the AI to add new items to a list you started in a previous step, rather than replacing it.
                      </Caption>
                    </div>
                  </div>

                  {/* Output Schema */}
                  <div>
                    <Label compact>Expected Output Format</Label>
                    <StepSchemaEditor
                      value={outputSchema}
                      onChange={setOutputSchema}
                    />
                    <Caption muted>
                      Tell the AI exactly how to format its answer so you can use it in the next step.
                    </Caption>
                  </div>
                </>
              )}

              {/* Prompt Fragment Fields */}
              {(availablePromptFragments.length > 0 || promptFragmentFields.length > 0) && (
                <div>
                  <Label compact>Prompt Fragments</Label>
                  <div className="step-config-panel__fragment-list">
                    {promptFragmentFields.map((pf, index) => (
                      <div key={index} className="step-config-panel__fragment-item">
                        <Code>{pf.fragmentId}</Code>
                        <Button variant="ghost" size="icon" onClick={() => setPromptFragmentFields(prev => prev.filter((_, i) => i !== index))}>
                          <svg className="step-config-panel__fragment-remove-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                    ))}
                    {availablePromptFragments.length > 0 && (
                      <button
                        onClick={() => {
                          const fragment = availablePromptFragments[0]
                          if (fragment) {
                            setPromptFragmentFields(prev => [
                              ...prev,
                              { fragmentId: fragment.id, fieldValues: {} }
                            ])
                          }
                        }}
                        className="step-config-panel__add-fragment-btn"
                      >
                        + Add Prompt Fragment
                      </button>
                    )}
                  </div>
                  <Caption muted>Enable specific prompt fragments based on field values</Caption>
                </div>
              )}

              {/* Enabled Tools */}
              <div>
                <Label compact>Enabled Tools</Label>
                <div className="step-config-panel__tools-grid">
                  {availableTools.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => {
                        setEnabledTools(prev =>
                          prev.includes(tool.id)
                            ? prev.filter(id => id !== tool.id)
                            : [...prev, tool.id]
                        )
                      }}
                      className={cn(
                        'step-config-panel__tool-btn',
                        enabledTools.includes(tool.id) && 'step-config-panel__tool-btn--selected'
                      )}
                    >
                      <Label compact>{tool.name}</Label>
                      <Caption muted>{tool.description}</Caption>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step Instructions */}
              <div>
                <Label compact>Step Instructions</Label>
                <div className="step-config-panel__instructions-wrapper">
                  <Textarea
                    value={stepInstructions}
                    onChange={(e) => setStepInstructions(e.target.value)}
                    placeholder="Describe what this step should do..."
                    compact
                  />
                </div>
                <div className="step-config-panel__template-vars">
                  <Caption muted>
                    <strong>Template variables:</strong>
                  </Caption>
                  <div className="step-config-panel__template-vars-list">
                    <Code>{`{{input}}`}</Code>
                    <Code>{`{{previousStep.stepId.field}}`}</Code>
                    <Code>{`{{workflow.output.field}}`}</Code>
                    <Code>{`{{now}}`}</Code>
                    <Code>{`{{assistant.name}}`}</Code>
                  </div>
                </div>
              </div>

              {/* Model Settings */}
              <div className="step-config-panel__model-grid">
                <div>
                  <Label compact>Model</Label>
                  <Select value={model} onChange={(e) => setModel(e.target.value)}>
                    <SelectOption value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectOption>
                    <SelectOption value="claude-3-opus">Claude 3 Opus</SelectOption>
                    <SelectOption value="claude-3-haiku">Claude 3 Haiku</SelectOption>
                  </Select>
                </div>
                <div>
                  <Label compact>Temperature: {temperature}</Label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="step-config-panel__range-input"
                  />
                  <div className="step-config-panel__range-labels">
                    <Caption muted>Precise</Caption>
                    <Caption muted>Creative</Caption>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="step-config-panel__footer">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            {isEditMode ? 'Save Changes' : 'Add Step'}
          </Button>
        </div>
      </div>
    </div>
  )
}
