/**
 * AssistantBuilder - Main assistant builder view with form, tools, actions.
 * Uses new composite hooks from Phase 3 and element components.
 */
import { useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import '@/css/elements/layouts/page/index.css'
import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/content/panel/index.css'
import { Page, PageHeader, PageBody } from '@/elements/layouts/page'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { Card, CardBody } from '@/elements/content/card'
import { useAssistant } from '@/hooks/useAssistant'
import { useAssistantList } from '@/hooks/useAssistantList'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'
import { useWorkflowList } from '@/hooks/useWorkflowList'

export function AssistantBuilder() {
  const { agentId } = useParams<{ agentId: string }>()
  const [view, setView] = useState<'builder' | 'agents'>('builder')

  // New composite hooks from Phase 3
  const assistant = useAssistant(agentId || '')
  const assistantList = useAssistantList()
  const knowledgeFields = useKnowledgeFields()
  const workflowList = useWorkflowList()

  const assistantName = assistant?.instruct?.name || agentId || 'New Assistant'
  const assistantDescription = assistant?.instruct?.description || ''
  const assistantInstructions = assistant?.instruct?.instructions || ''

  const [draftName, setDraftName] = useState(assistantName)
  const [draftDescription, setDraftDescription] = useState(assistantDescription)
  const [draftInstructions, setDraftInstructions] = useState(assistantInstructions)

  // Sync draft when assistant changes
  useMemo(() => {
    setDraftName(assistantName)
    setDraftDescription(assistantDescription)
    setDraftInstructions(assistantInstructions)
  }, [assistantName, assistantDescription, assistantInstructions])

  return (
    <Page full>
      {/* View Toggle */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0 1rem' }}>
          <button
            onClick={() => setView('builder')}
            className="btn btn--ghost"
            style={{
              borderBottom: view === 'builder' ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: 0,
              color: view === 'builder' ? 'var(--color-primary)' : undefined,
            }}
          >
            Assistant Builder
          </button>
          <button
            onClick={() => setView('agents')}
            className="btn btn--ghost"
            style={{
              borderBottom: view === 'agents' ? '2px solid var(--color-primary)' : '2px solid transparent',
              borderRadius: 0,
              color: view === 'agents' ? 'var(--color-primary)' : undefined,
            }}
          >
            Saved Assistants ({assistantList.length})
          </button>
        </div>
      </div>

      <PageBody>
        {view === 'builder' ? (
          <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
            <Stack gap="lg">
              <div>
                <Heading level={2}>{draftName || 'New Assistant'}</Heading>
                <Caption muted>{draftDescription || 'Configure your assistant below'}</Caption>
              </div>

              {/* Name & Description */}
              <div className="panel">
                <div className="panel__header">Identity</div>
                <div className="panel__body">
                  <Stack gap="md">
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>Name</label>
                      <input className="input" value={draftName} onChange={e => setDraftName(e.target.value)} placeholder="Assistant name" />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem' }}>Description</label>
                      <input className="input" value={draftDescription} onChange={e => setDraftDescription(e.target.value)} placeholder="What does this assistant do?" />
                    </div>
                  </Stack>
                </div>
              </div>

              {/* Instructions */}
              <div className="panel">
                <div className="panel__header">Instructions</div>
                <div className="panel__body">
                  <textarea
                    className="input"
                    value={draftInstructions}
                    onChange={e => setDraftInstructions(e.target.value)}
                    placeholder="Enter the main instructions for this assistant..."
                    style={{ minHeight: '200px', fontFamily: 'monospace', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Knowledge & Workflows summary */}
              <Stack row gap="md">
                <div className="panel" style={{ flex: 1 }}>
                  <div className="panel__header">Knowledge ({knowledgeFields.length})</div>
                  <div className="panel__body">
                    {knowledgeFields.length === 0 ? (
                      <Caption muted>No knowledge areas configured.</Caption>
                    ) : (
                      <Stack gap="sm">
                        {knowledgeFields.map(f => (
                          <Badge key={f.id} variant="muted">{f.id}</Badge>
                        ))}
                      </Stack>
                    )}
                  </div>
                </div>
                <div className="panel" style={{ flex: 1 }}>
                  <div className="panel__header">Workflows ({workflowList.length})</div>
                  <div className="panel__body">
                    {workflowList.length === 0 ? (
                      <Caption muted>No workflows configured.</Caption>
                    ) : (
                      <Stack gap="sm">
                        {workflowList.map(w => (
                          <Badge key={w.id} variant="muted">{w.id}</Badge>
                        ))}
                      </Stack>
                    )}
                  </div>
                </div>
              </Stack>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn--primary">Save Assistant</button>
              </div>
            </Stack>
          </div>
        ) : (
          <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
            <Heading level={2} style={{ marginBottom: '1rem' }}>Saved Assistants</Heading>
            {assistantList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <Caption muted>No assistants saved yet.</Caption>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                {assistantList.map(item => (
                  <Card key={item.id} interactive>
                    <CardBody>
                      <Heading level={4}>{item.id}</Heading>
                      <Caption muted style={{ marginTop: '0.25rem' }}>Agent ID: {item.id}</Caption>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </PageBody>
    </Page>
  )
}

export { AssistantBuilder as default }
