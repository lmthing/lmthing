/**
 * AssistantBuilder - Main agent configuration view.
 * L2: Three-Column Dashboard Layout with header, knowledge bar, main content, and right panel.
 *
 * US-201: Header with back button, name, Thing/Export buttons
 * US-202: Knowledge pill selection bar
 * US-203: Main instructions editor
 * US-204: Area knowledge accordion
 * US-205: Actions/Tools tabbed right panel
 * US-206: Attach workflow modal
 * US-207: Attached action cards
 * US-208: Floating chat button
 * US-209: Toggle action status
 * US-210: Detach action
 * US-212: Export agent config
 * US-213: Thing sliding panel
 */
import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useSpaceFS, P, serializeAgentInstruct, serializeAgentConfig, serializeAgentValues, useUIState, useToggle } from '@lmthing/state'
import type { AgentConfig, AgentValues } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { TabBar } from '@lmthing/ui/elements/nav/tab-bar'
import { useAssistant } from '@lmthing/ui/hooks/useAssistant'
import { useKnowledgeFields } from '@lmthing/ui/hooks/useKnowledgeFields'
import { useWorkflowList } from '@lmthing/ui/hooks/useWorkflowList'
import { buildSpacePathFromParams } from '@/lib/space-url'
import { AssistantHeader } from '../assistant-header'
import { KnowledgePillBar } from '../knowledge-pill-bar'
import { ActionsPanel } from '../actions-panel'
import type { AttachedWorkflow } from '../actions-panel'
import { ToolsPanel } from '../tools-panel'
import { PromptPreviewPanel } from '../prompt-preview'
import { AttachWorkflowModal } from '../attach-workflow-modal'
import { ChatFAB } from '../chat-fab'
import { ThingPanel } from '../thing-panel'
import { ConfigurationForm } from '../configuration-form'
import type { FormValues } from '../configuration-form'
import { useFieldSchema } from '@lmthing/ui/hooks/useFieldSchema'

function getFormFieldValue(
  values: FormValues, fieldId: string, variableName?: string
): string | string[] | boolean | undefined {
  if (values[fieldId] !== undefined) return values[fieldId]
  if (variableName && values[variableName] !== undefined) return values[variableName]
  const lastSegment = fieldId.split('/').pop()
  if (lastSegment && values[lastSegment] !== undefined) return values[lastSegment]
  return undefined
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'untitled'
}

export function AssistantBuilder() {
  const params = useParams({ strict: false }) as {
    username?: string
    studioId?: string
    storageId?: string
    spaceId?: string
    assistantId?: string
  }
  const { username, studioId, storageId, spaceId, assistantId } = params
  const navigate = useNavigate()
  const spaceFS = useSpaceFS()

  const [rightTab, setRightTab] = useUIState<'actions' | 'tools'>('assistant-builder.right-tab', 'actions')
  const [isThingOpen, toggleThing, setIsThingOpen] = useToggle('assistant-builder.thing-open', false)
  const [isExporting, , setIsExporting] = useToggle('assistant-builder.exporting', false)
  const [isAttachModalOpen, , setIsAttachModalOpen] = useToggle('assistant-builder.attach-modal-open', false)

  const assistant = useAssistant(assistantId || '')
  const knowledgeFields = useKnowledgeFields()
  const workflowList = useWorkflowList()

  // Draft state
  const [draftName, setDraftName] = useUIState('assistant-builder.draft-name', '')
  const [draftDescription, setDraftDescription] = useUIState('assistant-builder.draft-description', '')
  const [draftInstructions, setDraftInstructions] = useUIState('assistant-builder.draft-instructions', '')
  const [selectedFieldIds, setSelectedFieldIds] = useUIState<string[]>('assistant-builder.selected-field-ids', [])
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useUIState<string[]>('assistant-builder.selected-workflow-ids', [])
  const [formValues, setFormValues] = useUIState<FormValues>('assistant-builder.form-values', {})
  const [askAtRuntimeIds, setAskAtRuntimeIds] = useUIState<string[]>('assistant-builder.ask-at-runtime-ids', [])

  const fieldSchemas = useFieldSchema(selectedFieldIds)

  const runtimeFieldEntries = useMemo(() => {
    return fieldSchemas.flatMap(schema =>
      schema.sections.filter(field => askAtRuntimeIds.includes(field.id))
        .map(field => ({ fieldId: schema.fieldId, field }))
    )
  }, [fieldSchemas, askAtRuntimeIds])

  const resolvedFormValues = useMemo(() => {
    const resolved: FormValues = { ...formValues }
    for (const schema of fieldSchemas) {
      for (const field of schema.sections) {
        if (resolved[field.id] === undefined) {
          const found = getFormFieldValue(formValues, field.id, field.variableName)
          if (found !== undefined) resolved[field.id] = found
        }
      }
    }
    return resolved
  }, [formValues, fieldSchemas])

  const enabledFilePaths = useMemo(() => {
    const paths: string[] = []
    for (const schema of fieldSchemas) {
      for (const field of schema.sections) {
        if (askAtRuntimeIds.includes(field.id)) continue
        const value = formValues[field.id] ?? field.default
        if (!value) continue
        if (field.fieldType === 'select' && typeof value === 'string' && value)
          paths.push(`knowledge/${field.id}/${value}.md`)
        else if (field.fieldType === 'multiselect' && Array.isArray(value))
          value.forEach(v => paths.push(`knowledge/${field.id}/${v}.md`))
      }
    }
    return paths
  }, [fieldSchemas, formValues, askAtRuntimeIds])

  // Sync draft state when assistant data loads or assistantId changes.
  const syncKey = `${assistantId}::${assistant.instruct?.name ?? ''}`
  const lastSyncKey = useRef(syncKey)
  useEffect(() => {
    if (lastSyncKey.current === syncKey) return
    lastSyncKey.current = syncKey
    const instruct = assistant.instruct
    const cfg = assistant.config as AgentConfig & { domains?: string[]; flows?: string[] } | null
    if (assistantId && instruct) {
      setDraftName(instruct.name || '')
      setDraftDescription(instruct.description || '')
      setDraftInstructions(instruct.instructions || '')
      setSelectedFieldIds(cfg?.domains || [])
      setSelectedWorkflowIds(cfg?.flows || [])
      setFormValues((assistant.values as FormValues) || {})
      setAskAtRuntimeIds((cfg?.askAtRuntime as string[]) || [])
    } else if (!assistantId) {
      setDraftName('')
      setDraftDescription('')
      setDraftInstructions('')
      setSelectedFieldIds([])
      setSelectedWorkflowIds([])
      setFormValues({})
      setAskAtRuntimeIds([])
    }
  }) // intentionally no deps — we use the ref to control when sync happens

  const spacePath = username && studioId && storageId && spaceId
    ? buildSpacePathFromParams(username, studioId, storageId, spaceId)
    : ''

  const isNew = !assistantId
  const isValid = draftName.trim().length > 0

  const hasUnsavedChanges = assistantId
    ? (draftName !== (assistant.instruct?.name || '') ||
       draftDescription !== (assistant.instruct?.description || '') ||
       draftInstructions !== (assistant.instruct?.instructions || ''))
    : draftName.trim().length > 0

  // Build attached workflows from selectedWorkflowIds
  const attachedWorkflows: AttachedWorkflow[] = useMemo(() => {
    return selectedWorkflowIds.map(wfId => ({
      workflowId: wfId,
      workflowName: wfId,
      stepCount: 0,
      slashAction: {
        id: `sa_${wfId}`,
        actionId: wfId,
        name: wfId,
        description: '',
        enabled: true,
      },
    }))
  }, [selectedWorkflowIds])

  const handleSave = useCallback(() => {
    if (!spaceFS || !isValid) return

    const id = assistantId || slugify(draftName)

    spaceFS.writeFile(
      P.instruct(id),
      serializeAgentInstruct({
        name: draftName,
        description: draftDescription || undefined,
        instructions: draftInstructions,
      })
    )

    const existingConfig = (assistant.config || {}) as AgentConfig & { domains?: string[]; flows?: string[] }
    const config = {
      ...existingConfig,
      domains: selectedFieldIds,
      flows: selectedWorkflowIds,
      askAtRuntime: askAtRuntimeIds,
      enabledFilePaths,
      runtimeFieldIds: runtimeFieldEntries.map(e => e.field.id),
    }
    spaceFS.writeFile(P.agentConfig(id), serializeAgentConfig(config))

    if (Object.keys(formValues).length > 0) {
      spaceFS.writeFile(P.agentValues(id), serializeAgentValues(formValues as AgentValues))
    }

    if (!assistantId) {
      navigate({ to: `${spacePath}/assistant/${encodeURIComponent(id)}` })
    }
  }, [spaceFS, isValid, assistantId, draftName, draftDescription, draftInstructions, selectedFieldIds, selectedWorkflowIds, formValues, askAtRuntimeIds, assistant.config, navigate, spacePath])

  const handleBack = useCallback(() => {
    navigate({ to: `${spacePath}/assistant` })
  }, [navigate, spacePath])

  const handleFieldToggle = useCallback((fieldId: string) => {
    setSelectedFieldIds(prev =>
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    )
  }, [])

  const handleClearAllFields = useCallback(() => {
    setSelectedFieldIds([])
  }, [])

  const handleFormValueChange = useCallback((fieldId: string, value: string | string[] | boolean) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }))
  }, [])

  const handleToggleAskAtRuntime = useCallback((fieldId: string) => {
    setAskAtRuntimeIds(prev =>
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    )
  }, [])

  const handleBulkToggleAskAtRuntime = useCallback((fieldIds: string[], enable: boolean) => {
    setAskAtRuntimeIds(prev => {
      if (enable) return [...new Set([...prev, ...fieldIds])]
      const removeSet = new Set(fieldIds)
      return prev.filter(id => !removeSet.has(id))
    })
  }, [])

  const handleWorkflowToggle = useCallback((workflowId: string) => {
    setSelectedWorkflowIds(prev =>
      prev.includes(workflowId) ? prev.filter(w => w !== workflowId) : [...prev, workflowId]
    )
  }, [])

  const handleChatClick = useCallback(() => {
    if (!assistantId) return
    navigate({ to: `${spacePath}/assistant/${encodeURIComponent(assistantId)}/chat` })
  }, [navigate, spacePath, assistantId])

  const handleExport = useCallback(() => {
    if (!spaceFS || isExporting || isNew) return
    setIsExporting(true)
    setTimeout(() => setIsExporting(false), 1500)
  }, [spaceFS, isExporting, isNew])

  // Workflow action handlers
  const handleDetachWorkflow = useCallback((slashActionId: string) => {
    const wfId = slashActionId.replace('sa_', '')
    setSelectedWorkflowIds(prev => prev.filter(w => w !== wfId))
  }, [])

  const handleToggleSlashAction = useCallback(() => {
    // Toggle is visual only for now
  }, [])

  const handleEditSlashAction = useCallback((slashActionId: string) => {
    const wfId = slashActionId.replace('sa_', '')
    if (assistantId) {
      navigate({ to: `${spacePath}/assistant/${encodeURIComponent(assistantId)}/workflow/${encodeURIComponent(wfId)}` })
    }
  }, [assistantId, navigate, spacePath])

  const rightTabs = [
    { id: 'actions', label: `Actions (${attachedWorkflows.length})` },
    { id: 'tools', label: 'Tools (0)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* US-201: Application Header */}
      <AssistantHeader
        name={draftName}
        description={draftDescription}
        isNew={isNew}
        hasUnsavedChanges={hasUnsavedChanges}
        isValid={isValid}
        isThingOpen={isThingOpen}
        isExporting={isExporting}
        onNameChange={setDraftName}
        onDescriptionChange={setDraftDescription}
        onSave={handleSave}
        onBack={handleBack}
        onToggleThing={toggleThing}
        onExport={handleExport}
      />

      {/* US-202: Knowledge Pill Selection Bar */}
      <KnowledgePillBar
        fields={knowledgeFields}
        selectedIds={selectedFieldIds}
        onToggle={handleFieldToggle}
        onClearAll={handleClearAllFields}
      />

      {/* Main content area: three-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Center: Main content */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
            <Stack gap="lg">
              {/* US-203: Main Instructions */}
              <div className="panel">
                <div className="panel__header">
                  <Label>Main Instructions (optional)</Label>
                </div>
                <div className="panel__body">
                  <textarea
                    className="input"
                    value={draftInstructions}
                    onChange={e => setDraftInstructions(e.target.value)}
                    placeholder="Write the agent's core system prompt here. Define its behavior, personality, and operational guidelines..."
                    style={{ minHeight: '240px', fontFamily: 'monospace', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Prompt Preview */}
              <PromptPreviewPanel
                instructions={draftInstructions}
                selectedFieldIds={selectedFieldIds}
              />

              {/* Configuration Form (dynamic fields from knowledge schemas) */}
              {fieldSchemas.length > 0 && (
                <ConfigurationForm
                  schemas={fieldSchemas}
                  values={resolvedFormValues}
                  onValueChange={handleFormValueChange}
                  askAtRuntimeIds={askAtRuntimeIds}
                  onToggleAskAtRuntime={handleToggleAskAtRuntime}
                  onBulkToggleAskAtRuntime={handleBulkToggleAskAtRuntime}
                />
              )}
            </Stack>
          </div>
        </main>

        {/* US-205: Right panel - Actions/Tools tabs */}
        <aside style={{
          width: '20rem',
          flexShrink: 0,
          borderLeft: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <TabBar
            tabs={rightTabs}
            activeTab={rightTab}
            onTabChange={(id) => setRightTab(id as 'actions' | 'tools')}
          />

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {rightTab === 'actions' ? (
              <ActionsPanel
                attachedWorkflows={attachedWorkflows}
                onToggleEnabled={handleToggleSlashAction}
                onEditAction={handleEditSlashAction}
                onDetachWorkflow={handleDetachWorkflow}
                onOpenWorkflowBuilder={() => setIsAttachModalOpen(true)}
              />
            ) : (
              <ToolsPanel
                enabledTools={[]}
                onOpenLibrary={() => {}}
                onRemoveTool={() => {}}
                onConfigureTool={() => {}}
              />
            )}
          </div>
        </aside>

        {/* US-213: Thing sliding panel */}
        {isThingOpen && (
          <ThingPanel onClose={() => setIsThingOpen(false)} />
        )}
      </div>

      {/* US-208: Floating Chat Button */}
      {assistantId && (
        <ChatFAB onClick={handleChatClick} />
      )}

      {/* US-206: Attach Workflow Modal */}
      <AttachWorkflowModal
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        workflows={workflowList}
        alreadyAttachedIds={selectedWorkflowIds}
        onAttach={handleWorkflowToggle}
      />
    </div>
  )
}

export { AssistantBuilder as default }
