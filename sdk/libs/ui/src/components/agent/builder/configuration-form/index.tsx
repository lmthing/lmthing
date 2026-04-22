/**
 * ConfigurationForm - Dynamic form rendered from knowledge field schemas.
 * Phase 7: Reads schema from selected knowledge fields, renders form controls,
 * stores values in values.json via useSpaceFS.
 */
import '@lmthing/css/components/agent/builder/index.css'
import { useCallback } from 'react'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import type { SchemaField, FieldSchema } from '@lmthing/ui/hooks/useFieldSchema'

export type FormValues = Record<string, string | string[] | boolean>

export interface ConfigurationFormProps {
  schemas: FieldSchema[]
  values: FormValues
  onValueChange: (fieldId: string, value: string | string[] | boolean) => void
  askAtRuntimeIds?: string[]
  onToggleAskAtRuntime?: (fieldId: string) => void
  onBulkToggleAskAtRuntime?: (fieldIds: string[], enable: boolean) => void
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={`configuration-form__toggle-switch ${checked ? 'configuration-form__toggle-switch--on' : 'configuration-form__toggle-switch--off'}`}
    >
      <span className={`configuration-form__toggle-knob ${checked ? 'configuration-form__toggle-knob--on' : 'configuration-form__toggle-knob--off'}`} />
    </button>
  )
}

function MultiSelectPills({ options, selected, onToggle }: {
  options: { id: string; label: string; description?: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="configuration-form__multiselect-pills">
      {options.map(opt => {
        const isSelected = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`badge configuration-form__pill-btn ${isSelected ? 'badge--primary' : 'badge--muted'}`}
            title={opt.description}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function FormField({ field, value, onValueChange, isAskAtRuntime, onToggleAskAtRuntime }: {
  field: SchemaField
  value: string | string[] | boolean | undefined
  onValueChange: (fieldId: string, value: string | string[] | boolean) => void
  isAskAtRuntime?: boolean
  onToggleAskAtRuntime?: () => void
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
      <Stack row gap="sm" className="configuration-form__field-header">
        <Stack row gap="sm" className="configuration-form__field-label-row">
          <Label compact>{field.label}</Label>
          {field.required && <span className="configuration-form__required-mark">*</span>}
        </Stack>
        {onToggleAskAtRuntime && (
          <button
            type="button"
            onClick={onToggleAskAtRuntime}
            className={`badge configuration-form__runtime-badge ${isAskAtRuntime ? 'badge--primary' : 'badge--muted'}`}
          >
            {isAskAtRuntime ? 'Asked at runtime' : 'Ask at runtime'}
          </button>
        )}
      </Stack>
      {field.description && (
        <Caption muted className="configuration-form__field-description">{field.description}</Caption>
      )}

      {isAskAtRuntime && (
        <div className="configuration-form__runtime-box">
          <Stack row gap="sm" className="configuration-form__runtime-inner">
            <Caption muted className="configuration-form__runtime-hint">
              Shown to the user at runtime in the chat sidebar.
            </Caption>
            {onToggleAskAtRuntime && (
              <button type="button" onClick={onToggleAskAtRuntime}
                className="badge badge--primary configuration-form__runtime-badge">
                Edit Now
              </button>
            )}
          </Stack>
        </div>
      )}

      {!isAskAtRuntime && field.fieldType === 'text' && (
        <Input
          type="text"
          value={(effectiveValue as string) || ''}
          onChange={e => onValueChange(field.id, e.target.value)}
          placeholder={field.label}
        />
      )}

      {!isAskAtRuntime && field.fieldType === 'textarea' && (
        <Textarea
          value={(effectiveValue as string) || ''}
          onChange={e => onValueChange(field.id, e.target.value)}
          placeholder={field.label}
          compact
        />
      )}

      {!isAskAtRuntime && field.fieldType === 'select' && (
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

      {!isAskAtRuntime && field.fieldType === 'multiselect' && (
        <MultiSelectPills
          options={field.options}
          selected={Array.isArray(effectiveValue) ? effectiveValue : []}
          onToggle={handleMultiToggle}
        />
      )}

      {!isAskAtRuntime && field.fieldType === 'toggle' && (
        <ToggleSwitch
          checked={Boolean(effectiveValue)}
          onChange={v => onValueChange(field.id, v)}
        />
      )}
    </div>
  )
}

export function ConfigurationForm({ schemas, values, onValueChange, askAtRuntimeIds = [], onToggleAskAtRuntime, onBulkToggleAskAtRuntime }: ConfigurationFormProps) {
  if (schemas.length === 0) {
    return (
      <Caption muted>
        Select knowledge fields with configurable options to see the configuration form.
      </Caption>
    )
  }

  // Group schemas by category
  const categoryGroups = new Map<string, FieldSchema[]>()
  const uncategorized: FieldSchema[] = []
  for (const schema of schemas) {
    if (schema.category) {
      const group = categoryGroups.get(schema.category)
      if (group) group.push(schema)
      else categoryGroups.set(schema.category, [schema])
    } else {
      uncategorized.push(schema)
    }
  }

  function renderSchema(schema: FieldSchema) {
    // Group fields by section
    const sections = new Map<string, { label: string; fields: SchemaField[] }>()
    const ungrouped: SchemaField[] = []

    for (const field of schema.sections) {
      if (field.sectionId && field.sectionLabel) {
        const existing = sections.get(field.sectionId)
        if (existing) {
          existing.fields.push(field)
        } else {
          sections.set(field.sectionId, { label: field.sectionLabel, fields: [field] })
        }
      } else {
        ungrouped.push(field)
      }
    }

    const allFieldIds = schema.sections.map(f => f.id)
    const allAreRuntime = allFieldIds.length > 0 && allFieldIds.every(id => askAtRuntimeIds.includes(id))

    return (
      <div key={schema.fieldId} className="panel">
        <div className="panel__header">
          <Stack row gap="sm" className="configuration-form__schema-header">
            <Stack row gap="sm" className="configuration-form__schema-label-row">
              <Label>{schema.fieldLabel}</Label>
              <Badge variant="muted">
                {schema.sections.length} field{schema.sections.length !== 1 ? 's' : ''}
              </Badge>
            </Stack>
            {onBulkToggleAskAtRuntime && allFieldIds.length > 0 && (
              <button
                type="button"
                onClick={() => onBulkToggleAskAtRuntime(allFieldIds, !allAreRuntime)}
                className={`badge configuration-form__bulk-runtime-badge ${allAreRuntime ? 'badge--primary' : 'badge--muted'}`}
              >
                {allAreRuntime ? 'Disable All Runtime' : 'Enable All For Runtime'}
              </button>
            )}
          </Stack>
        </div>
        <div className="panel__body">
          <Stack gap="lg">
            {/* Ungrouped fields */}
            {ungrouped.length > 0 && (
              <Stack gap="md">
                {ungrouped.map(field => (
                  <FormField
                    key={field.id}
                    field={field}
                    value={values[field.id]}
                    onValueChange={onValueChange}
                    isAskAtRuntime={askAtRuntimeIds.includes(field.id)}
                    onToggleAskAtRuntime={onToggleAskAtRuntime ? () => onToggleAskAtRuntime(field.id) : undefined}
                  />
                ))}
              </Stack>
            )}

            {/* Grouped by section */}
            {[...sections.entries()].map(([sectionId, { label, fields }]) => (
              <div key={sectionId}>
                <Caption className="configuration-form__section-label">{label}</Caption>
                <Stack gap="md">
                  {fields.map(field => (
                    <FormField
                      key={field.id}
                      field={field}
                      value={values[field.id]}
                      onValueChange={onValueChange}
                      isAskAtRuntime={askAtRuntimeIds.includes(field.id)}
                      onToggleAskAtRuntime={onToggleAskAtRuntime ? () => onToggleAskAtRuntime(field.id) : undefined}
                    />
                  ))}
                </Stack>
              </div>
            ))}
          </Stack>
        </div>
      </div>
    )
  }

  return (
    <Stack gap="lg">
      {/* Categorized schemas */}
      {[...categoryGroups.entries()].map(([category, groupSchemas]) => (
        <div key={category}>
          <Label className="configuration-form__category-label">
            {category}
          </Label>
          <Stack gap="lg">
            {groupSchemas.map(renderSchema)}
          </Stack>
        </div>
      ))}
      {/* Uncategorized schemas */}
      {uncategorized.map(renderSchema)}
    </Stack>
  )
}
