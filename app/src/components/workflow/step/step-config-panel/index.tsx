import { useEffect, useState } from 'react'
import type { Task, TaskType, TaskConfig, PromptFragmentField, JSONSchema } from '@/../product/sections/flow-builder/types'
import { StepSchemaEditor } from '../step-schema-editor'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Textarea } from '@/elements/forms/textarea'
import { Select, SelectOption } from '@/elements/forms/select'
import { Stack } from '@/elements/layouts/stack'
import { Badge } from '@/elements/content/badge'
import { Heading } from '@/elements/typography/heading'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'
import { Code } from '@/elements/typography/code'

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
  const [selectedType, setSelectedType] = useState<TaskType>(step?.type || 'updateFlowOutput')
  const [stepName, setStepName] = useState(step?.name || '')
  const [stepDescription, setStepDescription] = useState(step?.description || '')

  // Config states for updateFlowOutput
  const [outputSchema, setOutputSchema] = useState<JSONSchema | null>(
    step?.config?.outputSchema || null
  )
  const [targetFieldName, setTargetFieldName] = useState(step?.config?.targetFieldName || '')
  const [isPushable, setIsPushable] = useState(step?.config?.isPushable ?? false)

  // Prompt fragment fields
  const [promptFragmentFields, setPromptFragmentFields] = useState<PromptFragmentField[]>(
    step?.config?.promptFragmentFields || []
  )

  // Shared config states
  const [enabledTools, setEnabledTools] = useState<string[]>(step?.config?.enabledTools || [])
  const [stepInstructions, setStepInstructions] = useState(step?.config?.taskInstructions || '')
  const [model, setModel] = useState(step?.config?.model || 'claude-3-5-sonnet')
  const [temperature, setTemperature] = useState(step?.config?.temperature ?? 0.7)

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <Heading level={2}>{isEditMode ? 'Edit Step' : 'Add Step'}</Heading>
            <Caption muted>Configure step settings and behavior</Caption>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Step Type Selector */}
          {!isEditMode && (
            <div>
              <Label compact>Step Type</Label>
              <div className="grid grid-cols-1 gap-3 mt-2">
                {STEP_TYPES.map(({ type, label, description, passesData }) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`
                      p-4 rounded-xl border-2 text-left transition-all
                      ${selectedType === type
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 ring-2 ring-violet-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-700'
                      }
                    `}
                  >
                    <Stack row gap="md" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Label>{label}</Label>
                        <Caption muted>{description}</Caption>
                      </div>
                      {passesData && (
                        <Badge variant="success">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7 17L17 7M7 7h10v10" />
                          </svg>
                          Passes Data
                        </Badge>
                      )}
                    </Stack>
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
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-6">
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
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl">
                  <button
                    onClick={() => setIsPushable(!isPushable)}
                    className={`
                      relative w-12 h-6 rounded-full transition-colors
                      ${isPushable ? 'bg-violet-500' : 'bg-slate-300 dark:bg-slate-700'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
                        ${isPushable ? 'translate-x-7' : 'translate-x-1'}
                      `}
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
                <div className="space-y-2">
                  {promptFragmentFields.map((pf, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg">
                      <Code>{pf.fragmentId}</Code>
                      <Button variant="ghost" size="icon" onClick={() => setPromptFragmentFields(prev => prev.filter((_, i) => i !== index))}>
                        <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                      className="w-full p-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-violet-500 hover:text-violet-500 transition-colors text-sm"
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
              <div className="grid grid-cols-2 gap-2 mt-2">
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
                    className={`
                      p-3 rounded-lg text-left text-sm transition-all
                      ${enabledTools.includes(tool.id)
                        ? 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }
                    `}
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
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4">
                <Textarea
                  value={stepInstructions}
                  onChange={(e) => setStepInstructions(e.target.value)}
                  placeholder="Describe what this step should do..."
                  compact
                />
              </div>
              <div className="mt-2 p-2 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                <Caption muted>
                  <span className="font-semibold">Template variables:</span>
                </Caption>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  <Code>{`{{input}}`}</Code>
                  <Code>{`{{previousStep.stepId.field}}`}</Code>
                  <Code>{`{{workflow.output.field}}`}</Code>
                  <Code>{`{{now}}`}</Code>
                  <Code>{`{{assistant.name}}`}</Code>
                </div>
              </div>
            </div>

            {/* Model Settings */}
            <div className="grid grid-cols-2 gap-4">
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
                  className="w-full mt-3 accent-violet-500"
                />
                <div className="flex justify-between">
                  <Caption muted>Precise</Caption>
                  <Caption muted>Creative</Caption>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 rounded-b-2xl">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>
            {isEditMode ? 'Save Changes' : 'Add Step'}
          </Button>
        </div>
      </div>
    </div>
  )
}
