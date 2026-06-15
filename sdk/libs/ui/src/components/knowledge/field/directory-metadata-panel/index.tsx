import { useEffect, useCallback } from 'react'
import { useUIState, useSpaceFS, useKnowledgeFieldIndex, serializeKnowledgeFieldIndex } from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { BookOpen } from 'lucide-react'
import '@lmthing/css/components/knowledge/index.css'

interface FieldIndexPanelProps {
  domain: string
  field: string
}

export function FieldIndexPanel({ domain, field }: FieldIndexPanelProps) {
  const spaceFS = useSpaceFS()
  const indexPath = `knowledge/${domain}/${field}/index.md`
  const parsed = useKnowledgeFieldIndex(domain, field)

  const [type, setType] = useUIState<string>('field-index-panel.type', 'string')
  const [variable, setVariable] = useUIState<string>('field-index-panel.variable', '')
  const [defaultVal, setDefaultVal] = useUIState<string>('field-index-panel.default', '')
  const [description, setDescription] = useUIState<string>('field-index-panel.description', '')
  const [isDirty, setIsDirty] = useUIState<boolean>('field-index-panel.is-dirty', false)

  useEffect(() => {
    if (!parsed) return
    setType(parsed.type || 'string')
    setVariable(parsed.variable || '')
    setDefaultVal(parsed.default || '')
    setDescription(parsed.description || '')
    setIsDirty(false)
  }, [parsed])

  const markDirty = useCallback(() => setIsDirty(true), [])

  const handleSave = useCallback(() => {
    if (!spaceFS) return
    const content = serializeKnowledgeFieldIndex(
      { type, variable, ...(defaultVal ? { default: defaultVal } : {}) },
      description
    )
    spaceFS.writeFile(indexPath, content)
    setIsDirty(false)
  }, [spaceFS, indexPath, type, variable, defaultVal, description])

  return (
    <div className="dir-metadata">
      <Stack gap="md">
        <Stack row className="dir-metadata__header">
          <BookOpen className="dir-metadata__icon" />
          <div>
            <Heading level={3}>{field}</Heading>
            <Caption muted>{indexPath}</Caption>
          </div>
        </Stack>

        <div>
          <Label compact>Type</Label>
          <select
            className="input"
            value={type}
            onChange={e => { setType(e.target.value); markDirty() }}
          >
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="object">object</option>
            <option value="array">array</option>
          </select>
        </div>

        <div>
          <Label compact>Variable</Label>
          <Input
            type="text"
            value={variable}
            onChange={e => { setVariable(e.target.value); markDirty() }}
            placeholder="camelCaseVar"
          />
          <Caption muted>JS identifier injected into agent context</Caption>
        </div>

        <div>
          <Label compact>Default Option</Label>
          <Input
            type="text"
            value={defaultVal}
            onChange={e => { setDefaultVal(e.target.value); markDirty() }}
            placeholder="option-slug (optional)"
          />
        </div>

        <div>
          <Label compact>Description</Label>
          <Textarea
            value={description}
            onChange={e => { setDescription(e.target.value); markDirty() }}
            placeholder="Describe what this field controls..."
            compact
          />
        </div>

        <div className="dir-metadata__footer">
          <Button variant="primary" size="sm" disabled={!isDirty} onClick={handleSave}>
            Save
          </Button>
        </div>
      </Stack>
    </div>
  )
}

// Backward-compat alias
export { FieldIndexPanel as DirectoryMetadataPanel }
