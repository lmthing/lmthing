/**
 * TopicViewer - Knowledge topic detail viewer and editor.
 * Uses new hooks from Phase 3 (useFile, useKnowledgeFields)
 * and element components instead of raw Tailwind.
 */
import { useCallback, useEffect } from 'react'
import { useUIState } from '@lmthing/state'
import { useParams } from '@tanstack/react-router'
import { useSpaceFS } from '@lmthing/state'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { useFile } from '@lmthing/ui/hooks/fs/useFile'
import { useKnowledgeFields } from '@lmthing/ui/hooks/useKnowledgeFields'
import '@lmthing/css/components/knowledge/index.css'

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

  const [draft, setDraft] = useUIState<string>('topic-viewer.draft', content || '')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useUIState<boolean>('topic-viewer.has-unsaved-changes', false)
  const [savedAt, setSavedAt] = useUIState<string | null>('topic-viewer.saved-at', null)

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
          <Stack className="topic-viewer__empty">
            <Heading level={3}>Select a Topic</Heading>
            <Caption muted className="topic-viewer__empty-caption">
              Choose a knowledge topic from the sidebar to view and edit its content.
            </Caption>
            {knowledgeFields.length > 0 && (
              <Stack row gap="sm" className="topic-viewer__empty-fields">
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
      <PageHeader className="topic-viewer__header">
        <div>
          <Heading level={3}>{effectiveTopicPath.split('/').pop()?.replace('.md', '') || 'Topic'}</Heading>
          {effectiveFieldId && <Caption muted>Field: {effectiveFieldId}</Caption>}
        </div>
        <Stack row gap="sm" className="topic-viewer__header-actions">
          {hasUnsavedChanges && <Badge variant="muted">Unsaved changes</Badge>}
          {savedAt && <Caption muted>Saved at {savedAt}</Caption>}
          <Button variant="primary" size="sm" disabled={!hasUnsavedChanges} onClick={handleSave}>
            Save
          </Button>
        </Stack>
      </PageHeader>

      <PageBody>
        <textarea
          className="input topic-viewer__textarea"
          value={draft}
          onChange={e => handleChange(e.target.value)}
          spellCheck={false}
          placeholder="Write knowledge content in Markdown..."
        />
      </PageBody>
    </Page>
  )
}

export { TopicViewer as default }
