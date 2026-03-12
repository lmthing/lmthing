/**
 * PromptPreviewPanel - Live preview of generated system prompt.
 * Phase 3: Auto-generates from instructions + selected knowledge content,
 * shows token count, copy to clipboard, collapsible.
 */
import { useMemo, useCallback } from 'react'
import { useToggle, useUIState, useGlobRead } from '@lmthing/state'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { CardFooter } from '@lmthing/ui/elements/content/card'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { PanelHeader } from '@lmthing/ui/elements/content/panel'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Code } from '@lmthing/ui/elements/typography/code'

interface PromptPreviewPanelProps {
  instructions: string
  selectedFieldIds: string[]
}

export function PromptPreviewPanel({ instructions, selectedFieldIds }: PromptPreviewPanelProps) {
  const [isExpanded, toggleExpanded] = useToggle('prompt-preview.expanded', false)
  const [copied, setCopied] = useUIState('prompt-preview.copied', false)

  // Read all knowledge files for all fields at once
  const allKnowledgeFiles = useGlobRead('knowledge/**/*.md')

  // Generate the prompt from instructions + knowledge content
  const generatedPrompt = useMemo(() => {
    const parts: string[] = []

    if (instructions.trim()) {
      parts.push(instructions.trim())
    }

    for (const fieldId of selectedFieldIds) {
      const prefix = `knowledge/${fieldId}/`
      const fileEntries = Object.entries(allKnowledgeFiles)
        .filter(([path]) => path.startsWith(prefix))
        .sort(([a], [b]) => a.localeCompare(b))

      if (fileEntries.length === 0) continue

      parts.push(`\n--- Knowledge: ${fieldId} ---\n`)
      for (const [path, content] of fileEntries) {
        const fileName = path.split('/').pop()?.replace(/\.md$/, '') || path
        parts.push(`## ${fileName}\n${content.trim()}`)
      }
    }

    return parts.join('\n\n')
  }, [instructions, selectedFieldIds, allKnowledgeFiles])

  const tokenCount = useMemo(() => Math.ceil(generatedPrompt.length / 4), [generatedPrompt])

  const hasContent = generatedPrompt.length > 0

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [generatedPrompt])

  return (
    <div className="panel" style={{ overflow: 'hidden' }}>
      <PanelHeader
        onClick={toggleExpanded}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack row gap="sm" style={{ alignItems: 'center' }}>
            <Label compact>System Prompt Preview</Label>
            {hasContent && (
              <Badge variant="muted">~{tokenCount} tokens</Badge>
            )}
          </Stack>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : undefined }}>
            ▼
          </span>
        </Stack>
      </PanelHeader>

      {isExpanded && (
        <>
          <div className="panel__body">
            {!hasContent ? (
              <Stack style={{ textAlign: 'center', padding: '2rem 0' }}>
                <Caption muted>
                  Add instructions or select knowledge fields to preview the generated prompt.
                </Caption>
              </Stack>
            ) : (
              <div>
                {selectedFieldIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                    {selectedFieldIds.map(fieldId => (
                      <Badge key={fieldId} variant="muted" style={{ fontSize: '0.625rem' }}>{fieldId}</Badge>
                    ))}
                  </div>
                )}
                <Code block style={{ maxHeight: '400px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {generatedPrompt}
                </Code>
              </div>
            )}
          </div>

          {hasContent && (
            <CardFooter>
              <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Caption muted>Preview updates as you edit</Caption>
                <Button onClick={handleCopy} variant="ghost" size="sm">
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </Stack>
            </CardFooter>
          )}
        </>
      )}
    </div>
  )
}
