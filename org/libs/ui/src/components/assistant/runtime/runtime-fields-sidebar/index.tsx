/**
 * RuntimeFieldsSidebar - Sidebar shown during chat runtime for fields marked "Ask at runtime".
 * Renders the same field types as ConfigurationForm but in a compact sidebar layout.
 * Values changed here dynamically update the system prompt.
 */
import { useCallback } from 'react'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import { Panel, PanelHeader, PanelBody } from '@lmthing/ui/elements/content/panel'
import type { SchemaField, FieldSchema } from '@/hooks/useFieldSchema'

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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
      {options.map(opt => {
        const isSelected = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`badge ${isSelected ? 'badge--primary' : 'badge--muted'}`}
            style={{ cursor: 'pointer', border: 'none', fontSize: '0.6875rem' }}
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
      style={{
        position: 'relative',
        width: '2.5rem',
        height: '1.375rem',
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
        width: '1.125rem',
        height: '1.125rem',
        borderRadius: '9999px',
        backgroundColor: 'white',
        transition: 'transform 0.2s',
        transform: checked ? 'translateX(1.125rem)' : 'translateX(0)',
      }} />
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
      <Stack row gap="sm" style={{ alignItems: 'center', marginBottom: '0.25rem' }}>
        <Label compact style={{ fontSize: '0.8125rem' }}>{field.label}</Label>
        {field.required && <span style={{ color: 'var(--color-warning)', fontSize: '0.6875rem' }}>*</span>}
      </Stack>
      {field.description && (
        <Caption muted style={{ marginBottom: '0.375rem', fontSize: '0.6875rem' }}>{field.description}</Caption>
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
    <aside style={{
      width: '18rem',
      flexShrink: 0,
      borderLeft: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Panel style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <PanelHeader>
          <Stack row gap="sm" style={{ alignItems: 'center' }}>
            <Label compact style={{ fontSize: '0.8125rem' }}>Configuration</Label>
            <Badge variant="muted">
              {runtimeFields.reduce((sum, rf) => sum + rf.fields.length, 0)} field{runtimeFields.reduce((sum, rf) => sum + rf.fields.length, 0) !== 1 ? 's' : ''}
            </Badge>
          </Stack>
        </PanelHeader>
        <PanelBody style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem' }}>
          <Caption muted style={{ marginBottom: '0.75rem', fontSize: '0.6875rem' }}>
            Adjust these options to customize the agent for this conversation.
          </Caption>
          <Stack gap="lg">
            {runtimeFields.map(({ schema, fields }) => (
              <div key={schema.fieldId}>
                <Caption style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.6875rem' }}>
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
