import { useState, useCallback, useEffect } from 'react'
import { Stack } from '@/elements/layouts/stack'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { useFile } from '@/hooks/fs/useFile'
import '@/css/elements/forms/input/index.css'
import '@/css/elements/forms/button/index.css'
import '@/css/elements/layouts/stack/index.css'

interface TopicEditorProps {
  topicPath: string
}

export function TopicEditor({ topicPath }: TopicEditorProps) {
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
          <button className="btn btn--primary btn--sm" disabled={!hasUnsavedChanges}>Save</button>
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
