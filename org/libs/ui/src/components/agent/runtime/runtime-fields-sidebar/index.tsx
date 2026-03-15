/**
 * RuntimeFieldsSidebar - Sidebar shown during chat runtime for fields marked "Ask at runtime".
 * Renders the same field types as ConfigurationForm but in a compact sidebar layout.
 * Values changed here dynamically update the system prompt.
 */
import '@lmthing/css/components/agent/runtime/index.css'
import { useCallback } from 'react'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import { Panel, PanelHeader, PanelBody } from '@lmthing/ui/elements/content/panel'
import type { SchemaField, FieldSchema } from '@lmthing/ui/hooks/useFieldSchema'

export type RuntimeValues = Record<string, string | string[] | boolean>

export interface RuntimeFieldsSidebarProps {
  schemas: FieldSchema[]
  askAtRuntimeIds: string[]
  values: RuntimeValues
  onValueChange: (fieldId: string, value: string | string[] | boolean) => void
}

function MultiSelectPills({ options, selected, onToggle }: {
  options: { id: string; label: string; description?: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="runtime-fields__pills">
      {options.map(opt => {
        const isSelected = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`runtime-fields__pill badge ${isSelected ? 'badge--primary' : 'badge--muted'}`}
            title={opt.description}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={`runtime-fields__toggle ${checked ? 'runtime-fields__toggle--on' : 'runtime-fields__toggle--off'}`}
    >
      <span className={`runtime-fields__toggle-thumb ${checked ? 'runtime-fields__toggle-thumb--on' : 'runtime-fields__toggle-thumb--off'}`} />
    </button>
  )
}

function RuntimeField({ field, value, onValueChange }: {
  field: SchemaField
  value: string | string[] | boolean | undefined
  onValueChange: (fieldId: string, value: string | string[] | boolean) => void
}) {
  const effectiveValue = value ?? field.default

  const handleMultiToggle = useCallback((optionId: string) => {
    const current = Array.isArray(effectiveValue) ? effectiveValue : []
    const next = current.includes(optionId)
      ? current.filter(v => v !== optionId)
      : [...current, optionId]
    onValueChange(field.id, next)
  }, [effectiveValue, field.id, onValueChange])

  return (
    <div>
      <Stack row gap="sm" className="runtime-fields__field-header">
        <Label compact className="runtime-fields__field-label">{field.label}</Label>
        {field.required && <span className="runtime-fields__field-required">*</span>}
      </Stack>
      {field.description && (
        <Caption muted className="runtime-fields__field-description">{field.description}</Caption>
      )}

      {field.fieldType === 'text' && (
        <Input
          type="text"
          value={(effectiveValue as string) || ''}
          onChange={e => onValueChange(field.id, e.target.value)}
          placeholder={field.label}
        />
      )}

      {field.fieldType === 'textarea' && (
        <Textarea
          value={(effectiveValue as string) || ''}
          onChange={e => onValueChange(field.id, e.target.value)}
          placeholder={field.label}
          compact
        />
      )}

      {field.fieldType === 'select' && (
        <Select
          value={(effectiveValue as string) || ''}
          onChange={e => onValueChange(field.id, e.target.value)}
        >
          <SelectOption value="">Select...</SelectOption>
          {field.options.map(opt => (
            <SelectOption key={opt.id} value={opt.id}>
              {opt.label}
            </SelectOption>
          ))}
        </Select>
      )}

      {field.fieldType === 'multiselect' && (
        <MultiSelectPills
          options={field.options}
          selected={Array.isArray(effectiveValue) ? effectiveValue : []}
          onToggle={handleMultiToggle}
        />
      )}

      {field.fieldType === 'toggle' && (
        <ToggleSwitch
          checked={Boolean(effectiveValue)}
          onChange={v => onValueChange(field.id, v)}
        />
      )}
    </div>
  )
}

export function RuntimeFieldsSidebar({ schemas, askAtRuntimeIds, values, onValueChange }: RuntimeFieldsSidebarProps) {
  // Filter schemas to only include fields marked as ask-at-runtime
  const runtimeFields: { schema: FieldSchema; fields: SchemaField[] }[] = []

  for (const schema of schemas) {
    const fields = schema.sections.filter(f => askAtRuntimeIds.includes(f.id))
    if (fields.length > 0) {
      runtimeFields.push({ schema, fields })
    }
  }

  if (runtimeFields.length === 0) return null

  return (
    <aside className="runtime-fields">
      <Panel className="runtime-fields__panel">
        <PanelHeader>
          <Stack row gap="sm" className="runtime-fields__header-row">
            <Label compact className="runtime-fields__header-label">Configuration</Label>
            <Badge variant="muted">
              {runtimeFields.reduce((sum, rf) => sum + rf.fields.length, 0)} field{runtimeFields.reduce((sum, rf) => sum + rf.fields.length, 0) !== 1 ? 's' : ''}
            </Badge>
          </Stack>
        </PanelHeader>
        <PanelBody className="runtime-fields__body">
          <Caption muted className="runtime-fields__hint">
            Adjust these options to customize the agent for this conversation.
          </Caption>
          <Stack gap="lg">
            {runtimeFields.map(({ schema, fields }) => (
              <div key={schema.fieldId}>
                <Caption className="runtime-fields__group-label">
                  {schema.fieldLabel}
                </Caption>
                <Stack gap="md">
                  {fields.map(field => (
                    <RuntimeField
                      key={field.id}
                      field={field}
                      value={values[field.id]}
                      onValueChange={onValueChange}
                    />
                  ))}
                </Stack>
              </div>
            ))}
          </Stack>
        </PanelBody>
      </Panel>
    </aside>
  )
}
