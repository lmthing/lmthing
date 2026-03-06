/**
 * AssistantBuilder - Main assistant builder view with form, tools, actions sidebar.
 * Phase 1: Core builder with FS persistence, navigation, split layout.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useSpaceFS, P, serializeAgentInstruct, serializeAgentConfig } from '@lmthing/state'
import type { AgentConfig } from '@lmthing/state'
import { Page } from '@/elements/layouts/page'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { Button } from '@/elements/forms/button'
import { TabBar } from '@/elements/nav/tab-bar'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/elements/overlays/dialog'
import { useAssistant } from '@/hooks/useAssistant'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'
import { useWorkflowList } from '@/hooks/useWorkflowList'
import { buildSpacePathFromParams } from '@/lib/space-url'
import { AssistantForm } from '../assistant-form'
import { ActionsPanel } from '../actions-panel'
import type { AttachedWorkflow } from '../actions-panel'
import { ToolsPanel } from '../tools-panel'
import { PromptPreviewPanel } from '../prompt-preview'

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

  const [rightTab, setRightTab] = useState<'actions' | 'tools'>('actions')

  const assistant = useAssistant(assistantId || '')
  const knowledgeFields = useKnowledgeFields()
  const workflowList = useWorkflowList()

  // Draft state
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftInstructions, setDraftInstructions] = useState('')
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([])
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([])

  // Sync draft state when assistant data loads or assistantId changes.
  // We track a composite key (id + instruct name) to detect both route changes
  // and initial data load for the same route.
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
    } else if (!assistantId) {
      setDraftName('')
      setDraftDescription('')
      setDraftInstructions('')
      setSelectedFieldIds([])
      setSelectedWorkflowIds([])
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
    }
    spaceFS.writeFile(P.agentConfig(id), serializeAgentConfig(config))

    if (!assistantId) {
      navigate({ to: `${spacePath}/assistant/${encodeURIComponent(id)}` })
    }
  }, [spaceFS, isValid, assistantId, draftName, draftDescription, draftInstructions, selectedFieldIds, selectedWorkflowIds, assistant.config, navigate, spacePath])

  const handleDelete = useCallback(() => {
    if (!spaceFS || !assistantId) return
    spaceFS.deletePath(P.agent(assistantId))
    navigate({ to: `${spacePath}/assistant` })
  }, [spaceFS, assistantId, navigate, spacePath])

  const handleDuplicate = useCallback(() => {
    if (!spaceFS || !assistantId) return
    const newId = `${assistantId}-copy`
    spaceFS.duplicatePath(P.agent(assistantId), P.agent(newId))
    navigate({ to: `${spacePath}/assistant/${encodeURIComponent(newId)}` })
  }, [spaceFS, assistantId, navigate, spacePath])

  const handleFieldToggle = useCallback((fieldId: string) => {
    setSelectedFieldIds(prev =>
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    )
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

  const handleOpenWorkflowBuilder = useCallback(() => {
    // Could navigate to workflow list or open selector
  }, [])

  const rightTabs = [
    { id: 'actions', label: `Actions (${attachedWorkflows.length})` },
    { id: 'tools', label: 'Tools (0)' },
  ]

  return (
    <Page full>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main content area */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
            <Stack gap="lg">
              {/* Header with status + actions */}
              <Stack row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Stack row gap="sm" style={{ alignItems: 'center' }}>
                    <Heading level={2}>{draftName || 'New Assistant'}</Heading>
                    <Badge variant={isValid ? 'success' : 'muted'}>
                      {isValid ? 'Ready' : 'Incomplete'}
                    </Badge>
                    {hasUnsavedChanges && <Badge variant="primary">Unsaved</Badge>}
                  </Stack>
                  <Caption muted>{draftDescription || 'Configure your assistant below'}</Caption>
                </div>
                <Stack row gap="sm">
                  {assistantId && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleDuplicate}>
                        Save as New
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="destructive" size="sm">Delete</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Delete Assistant</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to delete &quot;{draftName || assistantId}&quot;? This action cannot be undone.
                            </DialogDescription>
                          </DialogHeader>
                          <Stack row gap="sm" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <DialogClose asChild>
                              <Button variant="ghost">Cancel</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                            </DialogClose>
                          </Stack>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!isValid}
                  >
                    {isNew ? 'Create Assistant' : 'Save'}
                  </Button>
                </Stack>
              </Stack>

              {/* Prompt Preview */}
              <PromptPreviewPanel
                instructions={draftInstructions}
                selectedFieldIds={selectedFieldIds}
              />

              {/* Form */}
              <AssistantForm
                name={draftName}
                description={draftDescription}
                instructions={draftInstructions}
                selectedFieldIds={selectedFieldIds}
                selectedWorkflowIds={selectedWorkflowIds}
                knowledgeFields={knowledgeFields}
                workflowList={workflowList}
                onNameChange={setDraftName}
                onDescriptionChange={setDraftDescription}
                onInstructionsChange={setDraftInstructions}
                onFieldToggle={handleFieldToggle}
                onWorkflowToggle={handleWorkflowToggle}
              />
            </Stack>
          </div>
        </main>

        {/* Right sidebar: Actions + Tools */}
        <aside style={{ width: '20rem', flexShrink: 0, borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
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
                onOpenWorkflowBuilder={handleOpenWorkflowBuilder}
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

          {/* Chat button */}
          {assistantId && (
            <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border)' }}>
              <Button
                variant="primary"
                onClick={handleChatClick}
                style={{ width: '100%' }}
              >
                Chat
              </Button>
            </div>
          )}
        </aside>
      </div>
    </Page>
  )
}

export { AssistantBuilder as default }
