/**
 * TopicViewer - Knowledge topic detail viewer and editor.
 * Uses new hooks from Phase 3 (useFile, useKnowledgeFields)
 * and element components instead of raw Tailwind.
 */
import { useState, useCallback, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { useSpaceFS } from '@lmthing/state'
import { Page, PageHeader, PageBody } from '@/elements/layouts/page'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Stack } from '@/elements/layouts/stack'
import { Badge } from '@/elements/content/badge'
import { Button } from '@/elements/forms/button'
import { useFile } from '@/hooks/fs/useFile'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'

export interface TopicViewerProps {
  fieldId?: string
  topicPath?: string
}

export function TopicViewer({ fieldId, topicPath }: TopicViewerProps) {
  const params = useParams({ strict: false }) as { fieldId?: string; topicId?: string }
  const effectiveFieldId = fieldId || params.fieldId
  const effectiveTopicPath = topicPath || (effectiveFieldId && params.topicId ? `knowledge/${effectiveFieldId}/${params.topicId}.md` : undefined)

  const spaceFS = useSpaceFS()
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

  const handleSave = useCallback(() => {
    if (!spaceFS || !effectiveTopicPath || !hasUnsavedChanges) return
    spaceFS.writeFile(effectiveTopicPath, draft)
    setHasUnsavedChanges(false)
    setSavedAt(new Date().toLocaleTimeString())
  }, [spaceFS, effectiveTopicPath, draft, hasUnsavedChanges])

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
          {effectiveFieldId && <Caption muted>Field: {effectiveFieldId}</Caption>}
        </div>
        <Stack row gap="sm" style={{ alignItems: 'center' }}>
          {hasUnsavedChanges && <Badge variant="muted">Unsaved changes</Badge>}
          {savedAt && <Caption muted>Saved at {savedAt}</Caption>}
          <Button variant="primary" size="sm" disabled={!hasUnsavedChanges} onClick={handleSave}>
            Save
          </Button>
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
