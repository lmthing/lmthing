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

/**
 * `fieldType` is a UI hint for how to render/ask for this field — the value
 * must name a control available in the catalog (see SPACE-SPEC "Built-in
 * catalog components", Form section). Field-level `renderAs` was removed —
 * rendering is inferred from `fieldType`.
 */
const FIELD_TYPE_OPTIONS = [
  { value: '', label: '— none (use type default) —' },
  { value: 'text', label: 'Text (TextField)' },
  { value: 'textarea', label: 'Text area (TextArea)' },
  { value: 'number', label: 'Number (NumberField)' },
  { value: 'select', label: 'Select (Select)' },
  { value: 'multiselect', label: 'Multi-select (MultiSelect)' },
  { value: 'combobox', label: 'Combobox' },
  { value: 'radio', label: 'Radio group (RadioGroup)' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'toggle', label: 'Toggle (Switch)' },
  { value: 'slider', label: 'Slider' },
  { value: 'date', label: 'Date (DatePicker)' },
] as const

export function FieldIndexPanel({ domain, field }: FieldIndexPanelProps) {
  const spaceFS = useSpaceFS()
  const indexPath = `knowledge/${domain}/${field}/index.md`
  const parsed = useKnowledgeFieldIndex(domain, field)

  const [type, setType] = useUIState<string>('field-index-panel.type', 'string')
  const [label, setLabel] = useUIState<string>('field-index-panel.label', '')
  const [variable, setVariable] = useUIState<string>('field-index-panel.variable', '')
  const [defaultVal, setDefaultVal] = useUIState<string>('field-index-panel.default', '')
  const [fieldType, setFieldType] = useUIState<string>('field-index-panel.field-type', '')
  const [required, setRequired] = useUIState<boolean>('field-index-panel.required', false)
  const [description, setDescription] = useUIState<string>('field-index-panel.description', '')
  const [isDirty, setIsDirty] = useUIState<boolean>('field-index-panel.is-dirty', false)

  useEffect(() => {
    if (!parsed) return
    setType(parsed.type || 'string')
    setLabel(parsed.label || '')
    setVariable(parsed.variable || '')
    setDefaultVal(parsed.default || '')
    setFieldType(parsed.fieldType || '')
    setRequired(parsed.required ?? false)
    setDescription(parsed.description || '')
    setIsDirty(false)
  }, [parsed])

  const markDirty = useCallback(() => setIsDirty(true), [])

  const handleSave = useCallback(() => {
    if (!spaceFS) return
    const content = serializeKnowledgeFieldIndex(
      {
        type,
        ...(label ? { label } : {}),
        variable,
        ...(defaultVal ? { default: defaultVal } : {}),
        ...(fieldType ? { fieldType } : {}),
        ...(required ? { required } : {}),
      },
      description
    )
    spaceFS.writeFile(indexPath, content)
    setIsDirty(false)
  }, [spaceFS, indexPath, type, label, variable, defaultVal, fieldType, required, description])

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
          <Label compact>Label</Label>
          <Input
            type="text"
            value={label}
            onChange={e => { setLabel(e.target.value); markDirty() }}
            placeholder="Human-readable label (optional)"
          />
          <Caption muted>Display name shown in studio UI. If blank, the field dir name is used.</Caption>
        </div>

        <div>
          <Label compact>Variable</Label>
          <Input
            type="text"
            value={variable}
            onChange={e => { setVariable(e.target.value); markDirty() }}
            placeholder="camelCaseVar"
          />
          <Caption muted>JS identifier injected into agent context. If blank, inferred from the field directory name.</Caption>
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
          <Label compact>Field Type</Label>
          <select
            className="input"
            value={fieldType}
            onChange={e => { setFieldType(e.target.value); markDirty() }}
          >
            {FIELD_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Caption muted>UI hint: how studio/chat should render or ask for this field. Must name a catalog form control.</Caption>
        </div>

        <div>
          <Label compact>Required</Label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={required}
              onChange={e => { setRequired(e.target.checked); markDirty() }}
            />
            <span className="caption">This field must be filled before the agent runs</span>
          </label>
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
