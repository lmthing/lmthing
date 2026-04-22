import { useEffect, useCallback } from 'react'
import { useUIState } from '@lmthing/state'
import { useSpaceFS } from '@lmthing/state'
import { useFile } from '@lmthing/ui/hooks/fs/useFile'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Button } from '@lmthing/ui/elements/forms/button'
import { FolderOpen } from 'lucide-react'
import '@lmthing/css/components/knowledge/index.css'

interface DirectoryMetadataPanelProps {
  directoryPath: string
}

interface DirectoryConfig {
  label?: string
  description?: string
  icon?: string
  color?: string
  fieldType?: string
  variableName?: string
  required?: boolean
  [key: string]: unknown
}

export function DirectoryMetadataPanel({ directoryPath }: DirectoryMetadataPanelProps) {
  const spaceFS = useSpaceFS()
  const configPath = `${directoryPath}/config.json`
  const rawConfig = useFile(configPath)

  const [config, setConfig] = useUIState<DirectoryConfig>('directory-metadata-panel.config', {})
  const [isDirty, setIsDirty] = useUIState<boolean>('directory-metadata-panel.is-dirty', false)

  useEffect(() => {
    if (rawConfig === null || rawConfig === undefined) {
      setConfig({})
      return
    }
    try {
      setConfig(JSON.parse(rawConfig))
    } catch {
      setConfig({})
    }
    setIsDirty(false)
  }, [rawConfig])

  const updateField = useCallback((key: keyof DirectoryConfig, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(() => {
    if (!spaceFS) return
    // Remove empty string values for cleanliness
    const cleaned = Object.fromEntries(
      Object.entries(config).filter(([, v]) => v !== '' && v !== undefined)
    )
    spaceFS.writeFile(configPath, JSON.stringify(cleaned, null, 2))
    setIsDirty(false)
  }, [spaceFS, configPath, config])

  const dirName = directoryPath.split('/').pop() || directoryPath

  return (
    <div className="dir-metadata">
      <Stack gap="md">
        <Stack row className="dir-metadata__header">
          <FolderOpen className="dir-metadata__icon" />
          <div>
            <Heading level={3}>{config.label || dirName}</Heading>
            <Caption muted>{directoryPath}</Caption>
          </div>
        </Stack>

        <div>
          <Label compact>Label</Label>
          <Input
            type="text"
            value={config.label || ''}
            onChange={e => updateField('label', e.target.value)}
            placeholder="Display name"
          />
        </div>

        <div>
          <Label compact>Description</Label>
          <Input
            type="text"
            value={config.description || ''}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Brief description"
          />
        </div>

        <div>
          <Label compact>Icon</Label>
          <Input
            type="text"
            value={config.icon || ''}
            onChange={e => updateField('icon', e.target.value)}
            placeholder="e.g. book, folder, star"
          />
        </div>

        <div>
          <Label compact>Color</Label>
          <div className="dir-metadata__color-row">
            <Input
              type="text"
              value={config.color || ''}
              onChange={e => updateField('color', e.target.value)}
              placeholder="#10b981"
              className="dir-metadata__color-input"
            />
            {config.color && (
              <div className="dir-metadata__color-swatch" style={{ backgroundColor: config.color }} />
            )}
          </div>
        </div>

        <div>
          <Label compact>Field Type</Label>
          <Input
            type="text"
            value={config.fieldType || ''}
            onChange={e => updateField('fieldType', e.target.value)}
            placeholder="e.g. text, reference, list"
          />
        </div>

        <div>
          <Label compact>Variable Name</Label>
          <Input
            type="text"
            value={config.variableName || ''}
            onChange={e => updateField('variableName', e.target.value)}
            placeholder="e.g. myVariable"
          />
        </div>

        <div className="dir-metadata__checkbox-row">
          <input
            type="checkbox"
            id="dir-required"
            checked={config.required || false}
            onChange={e => updateField('required', e.target.checked)}
          />
          <Label compact htmlFor="dir-required" className="dir-metadata__checkbox-label">Required</Label>
        </div>

        <div className="dir-metadata__footer">
          <Button variant="primary" size="sm" disabled={!isDirty} onClick={handleSave}>
            Save Configuration
          </Button>
        </div>
      </Stack>
    </div>
  )
}
