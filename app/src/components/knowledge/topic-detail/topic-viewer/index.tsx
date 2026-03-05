/**
 * TopicViewer - Knowledge topic detail viewer and editor.
 * Uses new hooks from Phase 3 (useFile, useKnowledgeFields)
 * and element components instead of raw Tailwind.
 */
import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import '@/css/elements/layouts/page/index.css'
import '@/css/elements/content/panel/index.css'
import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'
import { Page, PageHeader, PageBody } from '@/elements/layouts/page'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Stack } from '@/elements/layouts/stack'
import { Badge } from '@/elements/content/badge'
import { useFile } from '@/hooks/fs/useFile'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'

export interface TopicViewerProps {
  domainId?: string
  topicPath?: string
}

export function TopicViewer({ domainId, topicPath }: TopicViewerProps) {
  const params = useParams<{ fieldId?: string; topicId?: string }>()
  const effectiveDomainId = domainId || params.fieldId
  const effectiveTopicPath = topicPath || (effectiveDomainId && params.topicId ? `knowledge/${effectiveDomainId}/${params.topicId}.md` : undefined)

  const knowledgeFields = useKnowledgeFields()
  const content = useFile(effectiveTopicPath || '')

  const [draft, setDraft] = useState(content || '')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (content !== null && content !== undefined) {
      setDraft(content)
      setHasUnsavedChanges(false)
    }
  }, [content])

  const handleChange = useCallback((newContent: string) => {
    setDraft(newContent)
    setHasUnsavedChanges(true)
    setSavedAt(null)
  }, [])

  if (!effectiveTopicPath) {
    return (
      <Page full>
        <PageBody>
          <Stack style={{ alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <Heading level={3}>Select a Topic</Heading>
            <Caption muted style={{ maxWidth: '24rem', textAlign: 'center' }}>
              Choose a knowledge topic from the sidebar to view and edit its content.
            </Caption>
            {knowledgeFields.length > 0 && (
              <Stack row gap="sm" style={{ marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {knowledgeFields.map(f => (
                  <Badge key={f.id} variant="muted">{f.id}</Badge>
                ))}
              </Stack>
            )}
          </Stack>
        </PageBody>
      </Page>
    )
  }

  return (
    <Page full>
      <PageHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Heading level={3}>{effectiveTopicPath.split('/').pop()?.replace('.md', '') || 'Topic'}</Heading>
          {effectiveDomainId && <Caption muted>Field: {effectiveDomainId}</Caption>}
        </div>
        <Stack row gap="sm" style={{ alignItems: 'center' }}>
          {hasUnsavedChanges && <Badge variant="muted">Unsaved changes</Badge>}
          {savedAt && <Caption muted>Saved at {savedAt}</Caption>}
          <button className="btn btn--primary btn--sm" disabled={!hasUnsavedChanges}>Save</button>
        </Stack>
      </PageHeader>

      <PageBody>
        <textarea
          className="input"
          value={draft}
          onChange={e => handleChange(e.target.value)}
          spellCheck={false}
          style={{
            width: '100%',
            height: 'calc(100vh - 10rem)',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: '1.6',
            resize: 'none',
            border: 'none',
            outline: 'none',
            padding: '1rem',
          }}
          placeholder="Write knowledge content in Markdown..."
        />
      </PageBody>
    </Page>
  )
}

export { TopicViewer as default }
