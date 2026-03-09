import { useState, useEffect, useCallback } from 'react'
import { useSpaceFS } from '@lmthing/state'
import { useFile } from '@/hooks/fs/useFile'
import { Stack } from '@/elements/layouts/stack'
import { Heading } from '@/elements/typography/heading'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'
import { Input } from '@/elements/forms/input'
import { Button } from '@/elements/forms/button'
import { FolderOpen } from 'lucide-react'

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

  const [config, setConfig] = useState<DirectoryConfig>({})
  const [isDirty, setIsDirty] = useState(false)

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
    <div style={{ padding: '1.5rem', maxWidth: '32rem' }}>
      <Stack gap="md">
        <Stack row style={{ alignItems: 'center', gap: '0.75rem' }}>
          <FolderOpen style={{ width: '1.5rem', height: '1.5rem', color: 'var(--color-muted-foreground)' }} />
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Input
              type="text"
              value={config.color || ''}
              onChange={e => updateField('color', e.target.value)}
              placeholder="#10b981"
              style={{ flex: 1 }}
            />
            {config.color && (
              <div style={{
                width: '2rem',
                height: '2rem',
                borderRadius: '0.25rem',
                backgroundColor: config.color,
                border: '1px solid var(--color-border)',
                flexShrink: 0,
              }} />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            id="dir-required"
            checked={config.required || false}
            onChange={e => updateField('required', e.target.checked)}
          />
          <Label compact htmlFor="dir-required" style={{ margin: 0 }}>Required</Label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <Button variant="primary" size="sm" disabled={!isDirty} onClick={handleSave}>
            Save Configuration
          </Button>
        </div>
      </Stack>
    </div>
  )
}
