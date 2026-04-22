import { useEffect } from 'react'
import { useUIState, useToggle } from '@lmthing/state'
import type { JSONSchema } from '@/../product/sections/flow-builder/types'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { cn } from '@lmthing/ui/lib/utils'
import '@lmthing/css/components/workflow/step-schema-editor/index.css'

interface StepSchemaEditorProps {
  value: JSONSchema | null
  onChange: (schema: JSONSchema | null) => void
}

type PropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array'

interface Property {
  id?: string
  name: string
  type: PropertyType
  required: boolean
  description?: string
  format?: string
  enum?: string[]
  minimum?: number
  maximum?: number
  properties?: Record<string, Omit<Property, 'name' | 'required' | 'id'>>
  items?: Omit<Property, 'name' | 'id' | 'required'>
}

const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'string', label: 'Text (Paragraph / Word)' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'List of Items' },
]

const STRING_FORMATS = ['date', 'date-time', 'email', 'uri', 'uuid', 'time', 'duration']

const TYPE_ICON_CLASS: Record<PropertyType, string> = {
  string: 'property-row__type-icon--string',
  number: 'property-row__type-icon--number',
  boolean: 'property-row__type-icon--boolean',
  object: 'property-row__type-icon--object',
  array: 'property-row__type-icon--array',
}

function TypeIcon({ type }: { type: PropertyType }) {
  const icons = {
    string: (
      <svg className="property-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    ),
    number: (
      <svg className="property-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h3M17 4h3v3M21 17v3h-3M7 20H4v-3M8 9h8M12 9v6" />
      </svg>
    ),
    boolean: (
      <svg className="property-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    object: (
      <svg className="property-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 7h10M7 12h10M7 17h6" />
      </svg>
    ),
    array: (
      <svg className="property-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  }
  return icons[type] || icons.string
}

function PropertyRow({
  property,
  index: _index,
  onUpdate,
  onDelete,
  onToggleRequired,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  property: Property
  index: number
  onUpdate: (property: Property) => void
  onDelete: () => void
  onToggleRequired: () => void
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [isExpanded, toggleIsExpanded] = useToggle(`schema-editor.property-expanded.${property.id || property.name}`, false)
  const [enumInput, setEnumInput] = useUIState(`schema-editor.property-enum.${property.id || property.name}`, property.enum?.join(', ') || '')

  const hasNestedConfig = property.type === 'object' || property.type === 'array'
  const showTypeSpecific = property.type === 'string' || property.type === 'number'

  return (
    <div className="property-row">
      {/* Main row */}
      <div className={cn(
             'property-row__main',
             hasNestedConfig && 'property-row__main--clickable'
           )}
           onClick={() => hasNestedConfig && toggleIsExpanded()}>
        {/* Move buttons */}
        <div className="property-row__move-buttons" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={onMoveUp} disabled={isFirst}>
            <svg className="property-row__move-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon" onClick={onMoveDown} disabled={isLast}>
            <svg className="property-row__move-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </Button>
        </div>

        {/* Expand/collapse for nested types */}
        {hasNestedConfig && (
          <button className="property-row__expand-btn" onClick={(e) => { e.stopPropagation(); toggleIsExpanded() }}>
            <svg className={cn('property-row__expand-icon', isExpanded && 'property-row__expand-icon--open')} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        {/* Property name */}
        <Input
          type="text"
          value={property.name}
          onChange={(e) => onUpdate({ ...property, name: e.target.value })}
          placeholder="property_name"
          onClick={(e) => e.stopPropagation()}
          className="property-row__name-input"
        />

        {/* Type selector */}
        <Select
          value={property.type}
          onChange={(e) => onUpdate({ ...property, type: e.target.value as PropertyType })}
          onClick={(e) => e.stopPropagation()}
        >
          {TYPE_OPTIONS.map(opt => (
            <SelectOption key={opt.value} value={opt.value}>{opt.label}</SelectOption>
          ))}
        </Select>

        {/* Type icon badge */}
        <span className={cn('property-row__type-icon', TYPE_ICON_CLASS[property.type])}>
          <TypeIcon type={property.type} />
        </span>

        {/* Required toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleRequired() }}
          className={cn(
            'property-row__required-btn',
            property.required ? 'property-row__required-btn--required' : 'property-row__required-btn--optional'
          )}
        >
          {property.required ? 'required' : 'optional'}
        </button>

        {/* Description hint */}
        {property.description && (
          <Caption muted className="property-row__description-hint" title={property.description}>
            {property.description}
          </Caption>
        )}

        {/* Actions */}
        <div className="property-row__actions">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <svg className="property-row__delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Type-specific options panel */}
      {showTypeSpecific && (
        <div className="property-row__type-options">
          <div className="property-row__type-options-inner">
            {property.type === 'string' && (
              <Select
                value={property.format || ''}
                onChange={(e) => onUpdate({ ...property, format: e.target.value || undefined })}
              >
                <SelectOption value="">No format</SelectOption>
                {STRING_FORMATS.map(f => (
                  <SelectOption key={f} value={f}>{f}</SelectOption>
                ))}
              </Select>
            )}

            {property.type === 'string' && (
              <div className="property-row__enum-input">
                <Input
                  type="text"
                  value={enumInput}
                  onChange={(e) => {
                    setEnumInput(e.target.value)
                    const values = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    onUpdate({ ...property, enum: values.length > 0 ? values : undefined })
                  }}
                  placeholder="enum: value1, value2, value3"
                />
              </div>
            )}

            {property.type === 'number' && (
              <div className="property-row__range-inputs">
                <Input
                  type="number"
                  value={property.minimum ?? ''}
                  onChange={(e) => onUpdate({ ...property, minimum: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Min"
                  className="property-row__range-input"
                />
                <span className="property-row__range-arrow">&rarr;</span>
                <Input
                  type="number"
                  value={property.maximum ?? ''}
                  onChange={(e) => onUpdate({ ...property, maximum: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Max"
                  className="property-row__range-input"
                />
              </div>
            )}

            <Input
              type="text"
              value={property.description || ''}
              onChange={(e) => onUpdate({ ...property, description: e.target.value || undefined })}
              placeholder="Description"
              className="property-row__description-input"
            />
          </div>
        </div>
      )}

      {/* Nested properties (object type) */}
      {property.type === 'object' && isExpanded && (
        <div className="property-row__nested">
          <NestedPropertiesEditor
            properties={property.properties || {}}
            onChange={(props) => onUpdate({ ...property, properties: props })}
          />
        </div>
      )}

      {/* Array items */}
      {property.type === 'array' && isExpanded && (
        <div className="property-row__nested">
          <Label compact>Array Item Type</Label>
          {property.items ? (
            <div className="property-row__array-item">
              <div className="property-row__array-item-inner">
                <Caption muted>Type</Caption>
                <Select
                  value={property.items.type}
                  onChange={(e) => onUpdate({
                    ...property,
                    items: { ...property.items, type: e.target.value as PropertyType }
                  })}
                >
                  {TYPE_OPTIONS.map(opt => (
                    <SelectOption key={opt.value} value={opt.value}>{opt.label}</SelectOption>
                  ))}
                </Select>

                <span className={cn('property-row__type-icon', TYPE_ICON_CLASS[property.items.type])}>
                  <TypeIcon type={property.items.type} />
                </span>

                <div className="property-row__array-spacer" />

                <Button variant="ghost" size="icon" onClick={() => onUpdate({ ...property, items: undefined })}>
                  <svg className="property-row__delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onUpdate({ ...property, items: { type: 'string' } })}
              className="property-row__add-item-btn"
            >
              + Define array item type
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function NestedPropertiesEditor({
  properties,
  onChange,
}: {
  properties: Record<string, Omit<Property, 'name' | 'required' | 'id'>>
  onChange: (properties: Record<string, Omit<Property, 'name' | 'required' | 'id'>>) => void
}) {
  const entries = Object.entries(properties)

  const handleUpdateProperty = (key: string, updates: Partial<Property>) => {
    const current = properties[key]
    const updated = { ...current, ...updates }
    onChange({ ...properties, [key]: updated })
  }

  const handleDeleteProperty = (key: string) => {
    const newProps = { ...properties }
    delete newProps[key]
    onChange(newProps)
  }

  const handleRenameProperty = (oldKey: string, newKey: string) => {
    if (!newKey || newKey === oldKey) return
    const newProps: Record<string, Omit<Property, 'name' | 'required' | 'id'>> = {}
    Object.entries(properties).forEach(([k, v]) => {
      newProps[k === oldKey ? newKey : k] = v
    })
    onChange(newProps)
  }

  const handleMoveProperty = (fromIndex: number, toIndex: number) => {
    const keys = Object.keys(properties)
    if (toIndex < 0 || toIndex >= keys.length) return

    const newKeys = [...keys]
    const [moved] = newKeys.splice(fromIndex, 1)
    newKeys.splice(toIndex, 0, moved)

    const newProps: Record<string, Omit<Property, 'name' | 'required' | 'id'>> = {}
    newKeys.forEach(key => {
      newProps[key] = properties[key]
    })
    onChange(newProps)
  }

  const handleAddProperty = () => {
    const newKey = `property_${entries.length + 1}`
    onChange({ ...properties, [newKey]: { type: 'string' } })
  }

  return (
    <div className="nested-properties">
      {entries.map(([key, prop], index) => (
        <PropertyRow
          key={key}
          property={{ ...prop, name: key, required: false }}
          index={index}
          onUpdate={(updates) => {
            if (updates.name !== key) {
              handleRenameProperty(key, updates.name)
            }
            handleUpdateProperty(key, updates)
          }}
          onDelete={() => handleDeleteProperty(key)}
          onToggleRequired={() => {}}
          isFirst={index === 0}
          isLast={index === entries.length - 1}
          onMoveUp={() => handleMoveProperty(index, index - 1)}
          onMoveDown={() => handleMoveProperty(index, index + 1)}
        />
      ))}
      <Button variant="ghost" onClick={handleAddProperty} className="nested-properties__add-btn">
        <svg className="nested-properties__add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add nested property
      </Button>
    </div>
  )
}

function propertiesToJsonSchema(properties: Property[], _required: string[]): JSONSchema {
  const schema: JSONSchema = { type: 'object' }

  if (properties.length > 0) {
    schema.properties = {}
    const requiredFields: string[] = []

    for (const prop of properties) {
      const propSchema: JSONSchema = { type: prop.type }

      if (prop.type === 'string') {
        if (prop.format) propSchema.format = prop.format
        if (prop.enum && prop.enum.length > 0) propSchema.enum = prop.enum
      }

      if (prop.type === 'number') {
        if (prop.minimum !== undefined) propSchema.minimum = prop.minimum
        if (prop.maximum !== undefined) propSchema.maximum = prop.maximum
      }

      if (prop.type === 'object' && prop.properties) {
        const nestedProps = Object.entries(prop.properties).map(([name, p]) => ({
          id: generateId(),
          name,
          ...p,
          required: false,
        }))
        propSchema.properties = propertiesToJsonSchema(nestedProps, []).properties
      }

      if (prop.type === 'array' && prop.items) {
        propSchema.items = {
          type: prop.items.type,
          ...(prop.items.format && { format: prop.items.format }),
          ...(prop.items.enum && { enum: prop.items.enum }),
          ...(prop.items.minimum !== undefined && { minimum: prop.items.minimum }),
          ...(prop.items.maximum !== undefined && { maximum: prop.items.maximum }),
        } as JSONSchema
      }

      schema.properties[prop.name] = propSchema

      if (prop.required) {
        requiredFields.push(prop.name)
      }
    }

    if (requiredFields.length > 0) {
      schema.required = requiredFields
    }
  }

  return schema
}

let idCounter = 0
const generateId = () => `prop_${++idCounter}_${Date.now()}`

function jsonSchemaToProperties(schema: JSONSchema | null): Property[] {
  if (!schema || schema.type !== 'object' || !schema.properties) {
    return []
  }

  const requiredFields = schema.required || []

  return Object.entries(schema.properties).map(([name, propSchema]) => {
    const property: Property = {
      id: generateId(),
      name,
      type: (propSchema.type as PropertyType) || 'string',
      required: requiredFields.includes(name),
    }

    if (propSchema.format) property.format = propSchema.format
    if (propSchema.enum) property.enum = propSchema.enum
    if (propSchema.minimum !== undefined) property.minimum = propSchema.minimum
    if (propSchema.maximum !== undefined) property.maximum = propSchema.maximum

    if (propSchema.type === 'object' && propSchema.properties) {
      const nestedProps = jsonSchemaToProperties({ type: 'object', properties: propSchema.properties })
      property.properties = {}
      nestedProps.forEach(p => {
        const { name: _, id: __, ...rest } = p
        property.properties![p.name] = rest
      })
    }

    if (propSchema.type === 'array' && propSchema.items) {
      const itemSchema = propSchema.items as JSONSchema
      property.items = {
        type: (itemSchema.type as PropertyType) || 'string',
        ...(itemSchema.format && { format: itemSchema.format }),
        ...(itemSchema.enum && { enum: itemSchema.enum }),
        ...(itemSchema.minimum !== undefined && { minimum: itemSchema.minimum }),
        ...(itemSchema.maximum !== undefined && { maximum: itemSchema.maximum }),
      }
    }

    return property
  })
}

export function StepSchemaEditor({ value, onChange }: StepSchemaEditorProps) {
  const [properties, setProperties] = useUIState<Property[]>('schema-editor.properties', jsonSchemaToProperties(value))
  const [viewMode, setViewMode] = useUIState<'visual' | 'code'>('schema-editor.view-mode', 'visual')
  const [codeValue, setCodeValue] = useUIState('schema-editor.code-value', value ? JSON.stringify(value, null, 2) : '')

  useEffect(() => {
    const converted = jsonSchemaToProperties(value)
    setProperties(converted)
    setCodeValue(value ? JSON.stringify(value, null, 2) : '')
  }, [value])

  const handlePropertiesChange = (newProperties: Property[]) => {
    setProperties(newProperties)
    const requiredFields = newProperties.filter(p => p.required).map(p => p.name)
    onChange(newProperties.length > 0 ? propertiesToJsonSchema(newProperties, requiredFields) : null)
  }

  const handleSwitchToCode = () => {
    const requiredFields = properties.filter(p => p.required).map(p => p.name)
    const currentSchema = properties.length > 0 ? propertiesToJsonSchema(properties, requiredFields) : null
    setCodeValue(currentSchema ? JSON.stringify(currentSchema, null, 2) : '')
    setViewMode('code')
  }

  const handleCodeChange = (newValue: string) => {
    setCodeValue(newValue)
    try {
      const parsed = JSON.parse(newValue)
      onChange(parsed)
    } catch {
      // Invalid JSON, don't update
    }
  }

  const handleAddProperty = () => {
    const newProp: Property = {
      id: generateId(),
      name: `field_${properties.length + 1}`,
      type: 'string',
      required: false,
    }
    handlePropertiesChange([...properties, newProp])
  }

  return (
    <div className="schema-editor">
      {/* Header with mode toggle */}
      <div className="schema-editor__header">
        <Label compact>Schema Properties</Label>
        <div className="schema-editor__mode-toggle">
          <button
            onClick={() => setViewMode('visual')}
            className={cn(
              'schema-editor__mode-btn',
              viewMode === 'visual' && 'schema-editor__mode-btn--active'
            )}
          >
            Visual
          </button>
          <button
            onClick={handleSwitchToCode}
            className={cn(
              'schema-editor__mode-btn',
              viewMode === 'code' && 'schema-editor__mode-btn--active'
            )}
          >
            Code
          </button>
        </div>
      </div>

      {/* Visual editor */}
      {viewMode === 'visual' && (
        <div className="schema-editor__body">
          {properties.length === 0 ? (
            <div className="schema-editor__empty">
              <div className="schema-editor__empty-icon-wrapper">
                <svg className="schema-editor__empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12 7-12 7z" />
                </svg>
              </div>
              <Caption muted className="schema-editor__empty-caption">No properties defined yet</Caption>
              <Button variant="primary" onClick={handleAddProperty}>
                <svg className="schema-editor__add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Property
              </Button>
            </div>
          ) : (
            <div className="schema-editor__property-list">
              {properties.map((property, index) => (
                <PropertyRow
                  key={property.id}
                  property={property}
                  index={index}
                  onUpdate={(updated) => {
                    const newProperties = [...properties]
                    newProperties[index] = updated
                    handlePropertiesChange(newProperties)
                  }}
                  onDelete={() => {
                    handlePropertiesChange(properties.filter((_, i) => i !== index))
                  }}
                  onToggleRequired={() => {
                    const newProperties = [...properties]
                    newProperties[index] = { ...property, required: !property.required }
                    handlePropertiesChange(newProperties)
                  }}
                  isFirst={index === 0}
                  isLast={index === properties.length - 1}
                  onMoveUp={() => {
                    if (index > 0) {
                      const newProperties = [...properties]
                      ;[newProperties[index - 1], newProperties[index]] = [newProperties[index], newProperties[index - 1]]
                      handlePropertiesChange(newProperties)
                    }
                  }}
                  onMoveDown={() => {
                    if (index < properties.length - 1) {
                      const newProperties = [...properties]
                      ;[newProperties[index], newProperties[index + 1]] = [newProperties[index + 1], newProperties[index]]
                      handlePropertiesChange(newProperties)
                    }
                  }}
                />
              ))}
              <button
                onClick={handleAddProperty}
                className="schema-editor__add-btn"
              >
                <svg className="schema-editor__add-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Property
              </button>
            </div>
          )}
        </div>
      )}

      {/* Code editor */}
      {viewMode === 'code' && (
        <div className="schema-editor__body">
          <Textarea
            value={codeValue}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="schema-editor__code-textarea"
            placeholder='{\n  "type": "object",\n  "properties": {\n    "example": { "type": "string" }\n  }\n}'
          />
          {(() => {
            try {
              JSON.parse(codeValue)
              return null
            } catch {
              return (
                <Caption muted className="schema-editor__code-error">
                  Invalid JSON schema
                </Caption>
              )
            }
          })()}
        </div>
      )}
    </div>
  )
}
