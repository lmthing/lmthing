import { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useSpaceFS } from '@lmthing/state'
import { parseFrontmatter, serializeFrontmatter } from '@lmthing/state'
import { useUIState, useToggle } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { useFile } from '@/hooks/fs/useFile'
import { MarkdownToolbar, type FormatAction, type EditorMode } from './markdown-toolbar'
import { MarkdownPreview } from './markdown-preview'
import { FileMetadataPanel } from './file-metadata-panel'
import {
  wrapSelection,
  insertLinePrefix,
  insertCodeBlock,
  insertLink,
  insertHR,
  insertTab,
  type TextState,
} from './markdown-utils'
import { Settings } from 'lucide-react'

export interface TopicEditorHandle {
  save: () => void
}

interface TopicEditorProps {
  topicPath: string
  onUnsavedChange?: (hasChanges: boolean) => void
}

export const TopicEditor = forwardRef<TopicEditorHandle, TopicEditorProps>(
  function TopicEditor({ topicPath, onUnsavedChange }, ref) {
    const spaceFS = useSpaceFS()
    const rawContent = useFile(topicPath)

    const [draftBody, setDraftBody] = useUIState<string>('topic-editor.draft-body', '')
    const [hasUnsavedChanges, setHasUnsavedChanges] = useUIState<boolean>('topic-editor.has-unsaved-changes', false)
    const [mode, setMode] = useUIState<EditorMode>('topic-editor.mode', 'edit')
    const [showMetadata, toggleShowMetadata] = useToggle('topic-editor.show-metadata', false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Parse frontmatter on load, show only body in editor
    useEffect(() => {
      if (rawContent !== null && rawContent !== undefined) {
        const { content } = parseFrontmatter(rawContent)
        setDraftBody(content)
        setHasUnsavedChanges(false)
        onUnsavedChange?.(false)
      }
    }, [rawContent, onUnsavedChange])

    const handleChange = useCallback((newContent: string) => {
      setDraftBody(newContent)
      setHasUnsavedChanges(true)
      onUnsavedChange?.(true)
    }, [onUnsavedChange])

    const handleSave = useCallback(() => {
      if (!spaceFS || !hasUnsavedChanges) return
      // Re-read latest frontmatter at save time to preserve metadata changes
      const currentRaw = rawContent || ''
      const { frontmatter } = parseFrontmatter(currentRaw)
      const hasFrontmatter = Object.keys(frontmatter).length > 0
      const newContent = hasFrontmatter
        ? serializeFrontmatter(frontmatter, draftBody)
        : draftBody
      spaceFS.writeFile(topicPath, newContent)
      setHasUnsavedChanges(false)
      onUnsavedChange?.(false)
    }, [spaceFS, topicPath, draftBody, hasUnsavedChanges, rawContent, onUnsavedChange])

    useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave])

    // Apply formatting action to textarea
    const applyFormat = useCallback((action: FormatAction) => {
      const ta = textareaRef.current
      if (!ta) return
      const state: TextState = {
        text: draftBody,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      }

      let result: TextState
      switch (action) {
        case 'bold':
          result = wrapSelection(state, '**', '**')
          break
        case 'italic':
          result = wrapSelection(state, '*', '*')
          break
        case 'heading':
          result = insertLinePrefix(state, '## ')
          break
        case 'bullet-list':
          result = insertLinePrefix(state, '- ')
          break
        case 'numbered-list':
          result = insertLinePrefix(state, '1. ')
          break
        case 'inline-code':
          result = wrapSelection(state, '`', '`')
          break
        case 'code-block':
          result = insertCodeBlock(state)
          break
        case 'link':
          result = insertLink(state)
          break
        case 'blockquote':
          result = insertLinePrefix(state, '> ')
          break
        case 'hr':
          result = insertHR(state)
          break
        default:
          return
      }

      handleChange(result.text)
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(result.selectionStart, result.selectionEnd)
      })
    }, [draftBody, handleChange])

    // Keyboard shortcuts on textarea
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 's') {
        e.preventDefault()
        handleSave()
      } else if (mod && e.key === 'b') {
        e.preventDefault()
        applyFormat('bold')
      } else if (mod && e.key === 'i') {
        e.preventDefault()
        applyFormat('italic')
      } else if (e.key === 'Tab') {
        e.preventDefault()
        const ta = textareaRef.current
        if (!ta) return
        const state: TextState = {
          text: draftBody,
          selectionStart: ta.selectionStart,
          selectionEnd: ta.selectionEnd,
        }
        const result = insertTab(state)
        handleChange(result.text)
        requestAnimationFrame(() => {
          ta.setSelectionRange(result.selectionStart, result.selectionEnd)
        })
      }
    }, [handleSave, applyFormat, draftBody, handleChange])

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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleShowMetadata()}
              title="Toggle metadata"
              style={showMetadata ? { backgroundColor: 'var(--color-muted)' } : undefined}
            >
              <Settings style={{ width: '0.875rem', height: '0.875rem' }} />
            </Button>
            <Button variant="primary" size="sm" disabled={!hasUnsavedChanges} onClick={handleSave}>
              Save
            </Button>
          </Stack>
        </Stack>

        {showMetadata && <FileMetadataPanel topicPath={topicPath} />}

        <div style={{ border: '1px solid var(--color-border)', borderRadius: '0.375rem', overflow: 'hidden' }}>
          <MarkdownToolbar mode={mode} onFormat={applyFormat} onModeChange={setMode} />

          {mode === 'edit' ? (
            <textarea
              ref={textareaRef}
              className="input"
              value={draftBody}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              style={{
                width: '100%',
                height: 'calc(100vh - 14rem)',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                lineHeight: '1.6',
                resize: 'none',
                border: 'none',
                outline: 'none',
                padding: '1rem',
                borderRadius: 0,
              }}
              placeholder="Write content in Markdown..."
            />
          ) : (
            <MarkdownPreview markdown={draftBody} />
          )}
        </div>
      </Stack>
    )
  }
)
