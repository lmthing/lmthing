import { useState, useCallback, useEffect } from 'react'
import { useSpaceFS } from '@lmthing/state'
import { Stack } from '@/elements/layouts/stack'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { Button } from '@/elements/forms/button'
import { useFile } from '@/hooks/fs/useFile'

interface TopicEditorProps {
  topicPath: string
}

export function TopicEditor({ topicPath }: TopicEditorProps) {
  const spaceFS = useSpaceFS()
  const content = useFile(topicPath)

  const [draft, setDraft] = useState(content || '')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    if (content !== null && content !== undefined) {
      setDraft(content)
      setHasUnsavedChanges(false)
    }
  }, [content])

  const handleChange = useCallback((newContent: string) => {
    setDraft(newContent)
    setHasUnsavedChanges(true)
  }, [])

  const handleSave = useCallback(() => {
    if (!spaceFS || !hasUnsavedChanges) return
    spaceFS.writeFile(topicPath, draft)
    setHasUnsavedChanges(false)
  }, [spaceFS, topicPath, draft, hasUnsavedChanges])

  const topicName = topicPath.split('/').pop()?.replace('.md', '') || 'Topic'

  return (
    <Stack gap="sm">
      <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Heading level={3}>{topicName}</Heading>
          <Caption muted>{topicPath}</Caption>
        </div>
        <Stack row gap="sm" style={{ alignItems: 'center' }}>
          {hasUnsavedChanges && <Badge variant="muted">Unsaved changes</Badge>}
          <Button variant="primary" size="sm" disabled={!hasUnsavedChanges} onClick={handleSave}>
            Save
          </Button>
        </Stack>
      </Stack>

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
        placeholder="Write content in Markdown..."
      />
    </Stack>
  )
}
