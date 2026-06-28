import { useEffect, useCallback } from 'react'
import { useSpaceFS } from '@lmthing/state'
import { parseKnowledgeOption, serializeKnowledgeOption } from '@lmthing/state'
import { useUIState } from '@lmthing/state'
import { useFile } from '@lmthing/ui/hooks/fs/useFile'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Button } from '@lmthing/ui/elements/forms/button'
import '@lmthing/css/components/knowledge/index.css'

interface FileMetadataPanelProps {
  topicPath: string
}

export function FileMetadataPanel({ topicPath }: FileMetadataPanelProps) {
  const spaceFS = useSpaceFS()
  const rawContent = useFile(topicPath)

  // Per SPACE-SPEC: knowledge option frontmatter only allows description, icon, color, label.
  // description is REQUIRED when frontmatter is present.
  const [description, setDescription] = useUIState<string>('file-metadata-panel.description', '')
  const [icon, setIcon] = useUIState<string>('file-metadata-panel.icon', '')
  const [color, setColor] = useUIState<string>('file-metadata-panel.color', '')
  const [label, setLabel] = useUIState<string>('file-metadata-panel.label', '')
  const [isDirty, setIsDirty] = useUIState<boolean>('file-metadata-panel.is-dirty', false)
  const [parseError, setParseError] = useUIState<string>('file-metadata-panel.parse-error', '')

  useEffect(() => {
    if (rawContent === null || rawContent === undefined) return
    try {
      const parsed = parseKnowledgeOption(rawContent)
      setDescription(parsed.description)
      setIcon(parsed.icon ?? '')
      setColor(parsed.color ?? '')
      setLabel(parsed.label ?? '')
      setParseError('')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err))
    }
    setIsDirty(false)
  }, [rawContent])

  const handleChange = useCallback(
    (setter: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value)
        setIsDirty(true)
      },
    [],
  )

  const handleSave = useCallback(() => {
    if (!spaceFS || !rawContent) return

    // Parse the existing content to get the current body; re-use parseKnowledgeOption
    // but fall back gracefully if the file currently has invalid keys (allow repair).
    let body = rawContent
    try {
      const parsed = parseKnowledgeOption(rawContent)
      body = parsed.body
    } catch {
      // If the file has legacy/invalid keys, strip frontmatter entirely and keep everything
      // after the closing --- as the body so the user can repair the metadata.
      const fmEnd = rawContent.indexOf('\n---\n', 4)
      body = fmEnd !== -1 ? rawContent.slice(fmEnd + 5).trim() : rawContent.trim()
    }

    const updated = serializeKnowledgeOption({
      description,
      icon: icon || undefined,
      color: color || undefined,
      label: label || undefined,
      body,
    })

    spaceFS.writeFile(topicPath, updated)
    setIsDirty(false)
    setParseError('')
  }, [spaceFS, topicPath, rawContent, description, icon, color, label])

  const filename = topicPath.split('/').pop() || ''

  return (
    <div className="file-metadata">
      <Stack gap="sm">
        <div>
          <Label compact>Filename</Label>
          <Caption muted>{filename}</Caption>
        </div>

        {parseError && (
          <Caption muted style={{ color: 'var(--color-danger, #c0392b)' }}>
            {parseError}
          </Caption>
        )}

        <div>
          <Label compact>Description *</Label>
          <Input
            type="text"
            value={description}
            onChange={handleChange(setDescription)}
            placeholder="Required — shown to the model in the system block"
          />
        </div>

        <div>
          <Label compact>Icon</Label>
          <Input
            type="text"
            value={icon}
            onChange={handleChange(setIcon)}
            placeholder="Emoji or icon identifier (e.g. 🍳)"
          />
        </div>

        <div>
          <Label compact>Color</Label>
          <Input
            type="text"
            value={color}
            onChange={handleChange(setColor)}
            placeholder="Hex color (e.g. #f5a623)"
          />
        </div>

        <div>
          <Label compact>Label</Label>
          <Input
            type="text"
            value={label}
            onChange={handleChange(setLabel)}
            placeholder="Display name"
          />
        </div>

        <div className="file-metadata__footer">
          <Button variant="primary" size="sm" disabled={!isDirty} onClick={handleSave}>
            Save Metadata
          </Button>
        </div>
      </Stack>
    </div>
  )
}
