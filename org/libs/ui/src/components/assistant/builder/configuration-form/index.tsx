/**
 * ConfigurationForm - Dynamic form rendered from knowledge field schemas.
 * Phase 7: Reads schema from selected knowledge fields, renders form controls,
 * stores values in values.json via useSpaceFS.
 */
import { useCallback } from 'react'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import type { SchemaField, FieldSchema } from '@/hooks/useFieldSchema'

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
      style={{
        position: 'relative',
        width: '2.75rem',
        height: '1.5rem',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-muted)',
      }}
    >
      <span style={{
        position: 'absolute',
        top: '0.125rem',
        left: '0.125rem',
        width: '1.25rem',
        height: '1.25rem',
        borderRadius: '9999px',
        backgroundColor: 'white',
        transition: 'transform 0.2s',
        transform: checked ? 'translateX(1.25rem)' : 'translateX(0)',
      }} />
    </button>
  )
}

function MultiSelectPills({ options, selected, onToggle }: {
  options: { id: string; label: string; description?: string }[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {options.map(opt => {
        const isSelected = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`badge ${isSelected ? 'badge--primary' : 'badge--muted'}`}
            style={{ cursor: 'pointer', border: 'none' }}
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
      <Stack row gap="sm" style={{ alignItems: 'center', marginBottom: '0.25rem', justifyContent: 'space-between' }}>
        <Stack row gap="sm" style={{ alignItems: 'center' }}>
          <Label compact>{field.label}</Label>
          {field.required && <span style={{ color: 'var(--color-warning)', fontSize: '0.75rem' }}>*</span>}
        </Stack>
        {onToggleAskAtRuntime && (
          <button
            type="button"
            onClick={onToggleAskAtRuntime}
            className={`badge ${isAskAtRuntime ? 'badge--primary' : 'badge--muted'}`}
            style={{ cursor: 'pointer', border: 'none', fontSize: '0.625rem' }}
          >
            {isAskAtRuntime ? 'Asked at runtime' : 'Ask at runtime'}
          </button>
        )}
      </Stack>
      {field.description && (
        <Caption muted style={{ marginBottom: '0.5rem' }}>{field.description}</Caption>
      )}

      {isAskAtRuntime && (
        <div style={{
          border: '2px dashed var(--color-warning, #f59e0b)',
          borderRadius: 'var(--radius-md, 6px)',
          padding: '0.75rem',
          backgroundColor: 'color-mix(in srgb, var(--color-warning, #f59e0b) 5%, transparent)',
        }}>
          <Stack row gap="sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Caption muted style={{ fontStyle: 'italic' }}>
              Shown to the user at runtime in the chat sidebar.
            </Caption>
            {onToggleAskAtRuntime && (
              <button type="button" onClick={onToggleAskAtRuntime}
                className="badge badge--primary" style={{ cursor: 'pointer', border: 'none', fontSize: '0.625rem' }}>
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
          <Stack row gap="sm" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack row gap="sm" style={{ alignItems: 'center' }}>
              <Label>{schema.fieldLabel}</Label>
              <Badge variant="muted">
                {schema.sections.length} field{schema.sections.length !== 1 ? 's' : ''}
              </Badge>
            </Stack>
            {onBulkToggleAskAtRuntime && allFieldIds.length > 0 && (
              <button
                type="button"
                onClick={() => onBulkToggleAskAtRuntime(allFieldIds, !allAreRuntime)}
                className={`badge ${allAreRuntime ? 'badge--primary' : 'badge--muted'}`}
                style={{ cursor: 'pointer', border: 'none', fontSize: '0.625rem' }}
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
                <Caption style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{label}</Caption>
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
          <Label style={{
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '0.6875rem',
            marginBottom: '0.75rem',
            display: 'block',
            opacity: 0.7,
          }}>
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
