import { Button } from '@/elements/forms/button'
import { Badge } from '@/elements/content/badge'
import { CardFooter } from '@/elements/content/card'
import { Stack } from '@/elements/layouts/stack'
import { PanelHeader } from '@/elements/content/panel'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'
import { Code } from '@/elements/typography/code'

interface PromptPreview {
  generatedPrompt: string
  tokenCount?: number
  domains?: string[]
}

interface PromptPreviewPanelProps {
  promptPreview?: PromptPreview
  onGenerate: () => void
}

export function PromptPreviewPanel({ promptPreview, onGenerate }: PromptPreviewPanelProps) {
  const hasPreview = promptPreview?.generatedPrompt && promptPreview.generatedPrompt.length > 0

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelHeader>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Label compact>System Prompt</Label>
          <Stack row gap="sm" style={{ alignItems: 'center' }}>
            {hasPreview && promptPreview?.tokenCount && (
              <Caption muted>~{promptPreview.tokenCount} tokens</Caption>
            )}
            <Button onClick={onGenerate} variant="ghost" size="sm" title="Regenerate preview">↻</Button>
          </Stack>
        </Stack>
      </PanelHeader>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {!hasPreview ? (
          <Stack style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</div>
            <Label>No preview available</Label>
            <Caption muted style={{ maxWidth: '200px', margin: '0 auto' }}>
              Select areas and fill forms to generate the system prompt
            </Caption>
          </Stack>
        ) : (
          <div>
            <Code block style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {promptPreview?.generatedPrompt || ''}
            </Code>
            {promptPreview?.domains && promptPreview.domains.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.75rem' }}>
                {promptPreview.domains.map((domain, idx) => (
                  <Badge key={idx} variant="muted" style={{ fontSize: '0.625rem' }}>{domain}</Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {hasPreview && (
        <CardFooter>
          <Caption muted style={{ textAlign: 'center', display: 'block' }}>
            Preview updates automatically as you configure your assistant
          </Caption>
        </CardFooter>
      )}
    </div>
  )
}
