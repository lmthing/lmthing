import { useCallback, useEffect } from 'react'
import { useUIState, useSpaceFS } from '@lmthing/state'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { useFile } from '@lmthing/ui/hooks/fs/useFile'
import '@lmthing/css/components/knowledge/index.css'

export interface TopicViewerProps {
  optionPath?: string
  // legacy props kept for backward compat (ignored)
  fieldId?: string
  topicPath?: string
}

export function TopicViewer({ optionPath, topicPath }: TopicViewerProps) {
  const effectivePath = optionPath || topicPath
  const spaceFS = useSpaceFS()
  const content = useFile(effectivePath || '')

  const [draft, setDraft] = useUIState<string>('topic-viewer.draft', '')
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
    if (!spaceFS || !effectivePath || !hasUnsavedChanges) return
    spaceFS.writeFile(effectivePath, draft)
    setHasUnsavedChanges(false)
    setSavedAt(new Date().toLocaleTimeString())
  }, [spaceFS, effectivePath, draft, hasUnsavedChanges])

  if (!effectivePath) {
    return (
      <Page full>
        <PageBody>
          <Stack className="topic-viewer__empty">
            <Heading level={3}>Select an Option</Heading>
            <Caption muted className="topic-viewer__empty-caption">
              Choose an option file from the tree to view and edit its content.
            </Caption>
          </Stack>
        </PageBody>
      </Page>
    )
  }

  const name = effectivePath.split('/').pop()?.replace('.md', '') || 'Option'

  return (
    <Page full>
      <PageHeader className="topic-viewer__header">
        <div>
          <Heading level={3}>{name}</Heading>
          <Caption muted>{effectivePath}</Caption>
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
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault()
              handleSave()
            }
          }}
          spellCheck={false}
          placeholder="Write option content in Markdown..."
        />
      </PageBody>
    </Page>
  )
}

export default TopicViewer
