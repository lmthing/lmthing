/**
 * AgentBuilder - New spec.
 * Edits agents/<slug>/instruct.md ONLY.
 * Fields: title, body, actions[], defaultAction, functions[], components[], knowledge[], canDelegateTo[]
 */
import '@lmthing/css/components/agent/builder/index.css'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  useSpaceFS,
  useAgent,
  useGlob,
  useUIState,
  P,
  serializeAgentInstruct,
} from '@lmthing/state'
import type { AgentInstruct } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import { AgentHeader } from '../agent-header'
import { buildSpacePath } from '@lmthing/ui/lib/space-path'

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled'
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Multiselect pill grid */
function MultiSelectField({ label, available, selected, onChange }: {
  label: string
  available: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (item: string) => {
    onChange(selected.includes(item) ? selected.filter(x => x !== item) : [...selected, item])
  }
  return (
    <div className="panel">
      <div className="panel__header">
        <Label>{label} ({selected.length}/{available.length})</Label>
      </div>
      <div className="panel__body">
        {available.length === 0 ? (
          <Caption muted>None available in this space.</Caption>
        ) : (
          <div className="agent-builder__pill-grid">
            {available.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => toggle(item)}
                className={`badge ${selected.includes(item) ? 'badge--primary' : 'badge--muted'} agent-builder__pill`}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** Delegation editor (add/remove canDelegateTo string entries) */
function CanDelegateToField({ refs, onChange }: {
  refs: string[]
  onChange: (next: string[]) => void
}) {
  const [newRef, setNewRef] = useUIState('agent-builder.new-delegate-ref', '')

  const add = () => {
    const v = newRef.trim()
    if (v && !refs.includes(v)) { onChange([...refs, v]); setNewRef('') }
  }
  const remove = (ref: string) => onChange(refs.filter(d => d !== ref))

  return (
    <div className="panel">
      <div className="panel__header"><Label>Can Delegate To ({refs.length})</Label></div>
      <div className="panel__body">
        <Stack gap="sm">
          {refs.map(ref => (
            <Stack key={ref} row gap="sm" className="agent-builder__dep-row">
              <Caption className="agent-builder__dep-text">{ref}</Caption>
              <Button variant="ghost" size="sm" onClick={() => remove(ref)}>✕</Button>
            </Stack>
          ))}
          <Stack row gap="sm">
            <Input
              value={newRef}
              onChange={e => setNewRef(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
              placeholder="space-ref/agent-slug or agent-slug#action"
              className="agent-builder__dep-input"
            />
            <Button variant="ghost" size="sm" onClick={add} disabled={!newRef.trim()}>Add</Button>
          </Stack>
        </Stack>
      </div>
    </div>
  )
}

/** One action row */
function ActionRow({ action, tasklistNames, onChange, onRemove }: {
  action: { id: string; label: string; description: string; tasklist: string }
  tasklistNames: string[]
  onChange: (updated: typeof action) => void
  onRemove: () => void
}) {
  return (
    <div className="panel agent-builder__action-row">
      <div className="panel__body">
        <Stack gap="sm">
          <Stack row gap="sm">
            <div style={{ flex: 1 }}>
              <Label compact>ID</Label>
              <Input value={action.id} onChange={e => onChange({ ...action, id: e.target.value })} placeholder="action-id" />
            </div>
            <div style={{ flex: 2 }}>
              <Label compact>Label</Label>
              <Input value={action.label} onChange={e => onChange({ ...action, label: e.target.value })} placeholder="Action label" />
            </div>
            <Button variant="ghost" size="sm" onClick={onRemove} style={{ alignSelf: 'flex-end' }}>✕</Button>
          </Stack>
          <div>
            <Label compact>Description</Label>
            <Input value={action.description} onChange={e => onChange({ ...action, description: e.target.value })} placeholder="What does this action do?" />
          </div>
          <div>
            <Label compact>Tasklist</Label>
            <Select value={action.tasklist} onChange={e => onChange({ ...action, tasklist: e.target.value })}>
              <SelectOption value="">— select tasklist —</SelectOption>
              {tasklistNames.map(name => (
                <SelectOption key={name} value={name}>{name}</SelectOption>
              ))}
            </Select>
          </div>
        </Stack>
      </div>
    </div>
  )
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function AgentBuilder() {
  const params = useParams({ strict: false }) as {
    projectId?: string; spaceId?: string; agentId?: string
  }
  const { projectId, spaceId, agentId } = params
  const navigate = useNavigate()
  const spaceFS = useSpaceFS()

  // ── space resource discovery ──────────────────────────────────────────────
  const tasklistMatches = useGlob(P.globs.allTasklists)
  const functionMatches = useGlob(P.globs.allFunctions)
  const viewComponentMatches = useGlob(P.globs.allViewComponents)
  const formComponentMatches = useGlob(P.globs.allFormComponents)
  const knowledgeIndexMatches = useGlob(P.globs.allKnowledgeIndexes)

  const tasklistNames = useMemo(() => {
    const names = new Set<string>()
    for (const path of tasklistMatches) {
      const parts = path.split('/')
      if (parts.length >= 2) names.add(parts[1])
    }
    return Array.from(names).sort()
  }, [tasklistMatches])

  const functionNames = useMemo(() =>
    functionMatches.map(p => p.split('/').pop()?.replace(/\.ts$/, '') ?? '').filter(Boolean).sort()
  , [functionMatches])

  const componentNames = useMemo(() => {
    const names = new Set<string>()
    for (const p of viewComponentMatches) {
      const n = p.split('/').pop()?.replace(/\.tsx$/, '')
      if (n) names.add(n)
    }
    for (const p of formComponentMatches) {
      // components/form/<Name>.tsx (single-file)
      const n = p.split('/').pop()?.replace(/\.tsx$/, '')
      if (n) names.add(n)
    }
    return Array.from(names).sort()
  }, [viewComponentMatches, formComponentMatches])

  // Option-level: knowledge/<domain>/<field>/<slug>.md (excludes index.md)
  const knowledgeOptionMatches = useGlob(P.globs.allKnowledgeOptions)

  const knowledgeRefs = useMemo(() => {
    // 2-part field-level refs: knowledge/<domain>/<field>/index.md → "domain/field"
    const fieldRefs = knowledgeIndexMatches.map(p => {
      const parts = p.split('/')
      if (parts.length >= 3) return `${parts[1]}/${parts[2]}`
      return null
    }).filter((x): x is string => x !== null)

    // 3-part option-level refs: knowledge/<domain>/<field>/<slug>.md → "domain/field/slug"
    const optionRefs = knowledgeOptionMatches.map(p => {
      const parts = p.split('/')
      // parts: ["knowledge", domain, field, "slug.md"]
      if (parts.length >= 4) {
        const slug = parts[3].replace(/\.md$/, '')
        return `${parts[1]}/${parts[2]}/${slug}`
      }
      return null
    }).filter((x): x is string => x !== null)

    return [...fieldRefs, ...optionRefs].sort()
  }, [knowledgeIndexMatches, knowledgeOptionMatches])

  // ── load existing agent ───────────────────────────────────────────────────
  const agent = useAgent(agentId ?? '')

  // ── draft state ───────────────────────────────────────────────────────────
  const [draftTitle, setDraftTitle] = useUIState('agent-builder.draft-title', '')
  const [draftBody, setDraftBody] = useUIState('agent-builder.draft-body', '')
  const [draftActions, setDraftActions] = useUIState<AgentInstruct['actions']>('agent-builder.draft-actions', [])
  const [draftDefaultAction, setDraftDefaultAction] = useUIState('agent-builder.draft-default-action', '')
  const [draftFunctions, setDraftFunctions] = useUIState<string[]>('agent-builder.draft-functions', [])
  const [draftComponents, setDraftComponents] = useUIState<string[]>('agent-builder.draft-components', [])
  const [draftKnowledge, setDraftKnowledge] = useUIState<string[]>('agent-builder.draft-knowledge', [])
  const [draftCanDelegateTo, setDraftCanDelegateTo] = useUIState<string[]>('agent-builder.draft-candelegateto', [])

  // Sync draft from instruct when agent loads / agentId changes
  const syncKey = `${agentId}::${agent.instruct?.title ?? ''}`
  const lastSyncKey = useRef('')
  useEffect(() => {
    if (lastSyncKey.current === syncKey) return
    lastSyncKey.current = syncKey
    const inst = agent.instruct
    if (agentId && inst) {
      setDraftTitle(inst.title ?? '')
      setDraftBody(inst.body ?? '')
      setDraftActions(inst.actions ?? [])
      setDraftDefaultAction(inst.defaultAction ?? '')
      setDraftFunctions(inst.functions ?? [])
      setDraftComponents(inst.components ?? [])
      setDraftKnowledge(inst.knowledge ?? [])
      setDraftCanDelegateTo(inst.canDelegateTo ?? [])
    } else if (!agentId) {
      setDraftTitle(''); setDraftBody(''); setDraftActions([])
      setDraftDefaultAction(''); setDraftFunctions([]); setDraftComponents([])
      setDraftKnowledge([]); setDraftCanDelegateTo([])
    }
  })

  const spacePath = buildSpacePath(projectId, spaceId)
  const isNew = !agentId
  const isValid = draftTitle.trim().length > 0

  const hasUnsavedChanges = isNew
    ? isValid
    : (
      draftTitle !== (agent.instruct?.title ?? '') ||
      draftBody !== (agent.instruct?.body ?? '') ||
      JSON.stringify(draftActions) !== JSON.stringify(agent.instruct?.actions ?? []) ||
      draftDefaultAction !== (agent.instruct?.defaultAction ?? '') ||
      JSON.stringify(draftFunctions) !== JSON.stringify(agent.instruct?.functions ?? []) ||
      JSON.stringify(draftComponents) !== JSON.stringify(agent.instruct?.components ?? []) ||
      JSON.stringify(draftKnowledge) !== JSON.stringify(agent.instruct?.knowledge ?? []) ||
      JSON.stringify(draftCanDelegateTo) !== JSON.stringify(agent.instruct?.canDelegateTo ?? [])
    )

  const handleSave = useCallback(() => {
    if (!spaceFS || !isValid) return
    const id = agentId || slugify(draftTitle)
    const instruct: AgentInstruct = {
      title: draftTitle.trim(),
      body: draftBody.trim(),
      actions: draftActions,
      defaultAction: draftDefaultAction || undefined,
      functions: draftFunctions,
      components: draftComponents,
      knowledge: draftKnowledge,
      canDelegateTo: draftCanDelegateTo,
    }
    spaceFS.writeFile(P.instruct(id), serializeAgentInstruct(instruct))
    if (!agentId) {
      navigate({ to: `${spacePath}/agent/${encodeURIComponent(id)}` })
    }
  }, [spaceFS, isValid, agentId, draftTitle, draftBody, draftActions, draftDefaultAction, draftFunctions, draftComponents, draftKnowledge, draftCanDelegateTo, spacePath, navigate])

  const handleBack = useCallback(() => {
    navigate({ to: `${spacePath}/agent` })
  }, [navigate, spacePath])

  // Actions helpers
  const addAction = useCallback(() => {
    setDraftActions(prev => [...prev, { id: '', label: '', description: '', tasklist: '' }])
  }, [setDraftActions])

  const updateAction = useCallback((idx: number, updated: AgentInstruct['actions'][number]) => {
    setDraftActions(prev => prev.map((a, i) => i === idx ? updated : a))
  }, [setDraftActions])

  const removeAction = useCallback((idx: number) => {
    setDraftActions(prev => prev.filter((_, i) => i !== idx))
  }, [setDraftActions])

  return (
    <div className="agent-builder">
      <AgentHeader
        title={draftTitle}
        isNew={isNew}
        hasUnsavedChanges={hasUnsavedChanges}
        isValid={isValid}
        onTitleChange={setDraftTitle}
        onSave={handleSave}
        onBack={handleBack}
      />

      <div className="agent-builder__content">
        <main className="agent-builder__main">
          <div className="agent-builder__main-inner">
            <Stack gap="lg">

              {/* System Prompt Body */}
              <div className="panel">
                <div className="panel__header"><Label>System Prompt</Label></div>
                <div className="panel__body">
                  <textarea
                    className="input agent-builder__textarea"
                    value={draftBody}
                    onChange={e => setDraftBody(e.target.value)}
                    placeholder="Write the agent's system prompt here..."
                    rows={10}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="panel">
                <div className="panel__header">
                  <Stack row className="agent-builder__section-header-row">
                    <Label>Actions ({draftActions.length})</Label>
                    <Button variant="ghost" size="sm" onClick={addAction}>+ Add Action</Button>
                  </Stack>
                </div>
                <div className="panel__body">
                  {draftActions.length === 0 ? (
                    <Caption muted>No actions yet. Actions link this agent to a tasklist.</Caption>
                  ) : (
                    <Stack gap="md">
                      {draftActions.map((action, idx) => (
                        <ActionRow
                          key={idx}
                          action={action}
                          tasklistNames={tasklistNames}
                          onChange={updated => updateAction(idx, updated)}
                          onRemove={() => removeAction(idx)}
                        />
                      ))}
                    </Stack>
                  )}
                </div>
              </div>

              {/* Default Action */}
              {draftActions.length > 0 && (
                <div className="panel">
                  <div className="panel__header"><Label>Default Action (optional)</Label></div>
                  <div className="panel__body">
                    <Select value={draftDefaultAction} onChange={e => setDraftDefaultAction(e.target.value)}>
                      <SelectOption value="">— none —</SelectOption>
                      {draftActions.filter(a => a.id).map(a => (
                        <SelectOption key={a.id} value={a.id}>{a.label || a.id}</SelectOption>
                      ))}
                    </Select>
                  </div>
                </div>
              )}

              {/* Knowledge */}
              <MultiSelectField
                label="Knowledge"
                available={knowledgeRefs}
                selected={draftKnowledge}
                onChange={setDraftKnowledge}
              />

              {/* Functions */}
              <MultiSelectField
                label="Functions"
                available={functionNames}
                selected={draftFunctions}
                onChange={setDraftFunctions}
              />

              {/* Components */}
              <MultiSelectField
                label="Components"
                available={componentNames}
                selected={draftComponents}
                onChange={setDraftComponents}
              />

              {/* Dependencies */}
              <CanDelegateToField refs={draftCanDelegateTo} onChange={setDraftCanDelegateTo} />

            </Stack>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AgentBuilder
