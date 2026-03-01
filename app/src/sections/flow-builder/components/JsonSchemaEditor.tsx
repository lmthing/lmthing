import { useState, useEffect } from 'react'
import type { JSONSchema } from '@/../product/sections/flow-builder/types'

interface JsonSchemaEditorProps {
  value: JSONSchema | null
  onChange: (schema: JSONSchema | null) => void
}

type PropertyType = 'string' | 'number' | 'boolean' | 'object' | 'array'

interface Property {
  id: string // unique ID for stable keys
  name: string
  type: PropertyType
  required: boolean
  description?: string
  // String-specific
  format?: string
  enum?: string[]
  // Number-specific
  minimum?: number
  maximum?: number
  // Object-specific
  properties?: Record<string, Omit<Property, 'name' | 'required' | 'id'>>
  // Array-specific
  items?: Omit<Property, 'name' | 'id'>
}

const TYPE_OPTIONS: { value: PropertyType; label: string; icon: string }[] = [
  { value: 'string', label: 'Text (Paragraph / Word)', icon: 'text' },
  { value: 'number', label: 'Number', icon: '123' },
  { value: 'boolean', label: 'Boolean', icon: 'bool' },
  { value: 'object', label: 'Object', icon: '{ }' },
  { value: 'array', label: 'List of Items', icon: '[ ]' },
]

const STRING_FORMATS = ['date', 'date-time', 'email', 'uri', 'uuid', 'time', 'duration']

function TypeIcon({ type }: { type: PropertyType }) {
  const icons = {
    string: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h16v3M9 20h6M12 4v16" />
      </svg>
    ),
    number: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 7V4h3M17 4h3v3M21 17v3h-3M7 20H4v-3M8 9h8M12 9v6" />
      </svg>
    ),
    boolean: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    object: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 7h10M7 12h10M7 17h6" />
      </svg>
    ),
    array: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    ),
  }
  return icons[type] || icons.string
}

function PropertyRow({
  property,
  index,
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
  const [isExpanded, setIsExpanded] = useState(false)
  const [enumInput, setEnumInput] = useState(property.enum?.join(', ') || '')

  const hasNestedConfig = property.type === 'object' || property.type === 'array'
  const showTypeSpecific = property.type === 'string' || property.type === 'number'

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
      {/* Main row */}
      <div className={`flex items-center gap-3 p-3 ${hasNestedConfig ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
           onClick={() => hasNestedConfig && setIsExpanded(!isExpanded)}>
        {/* Drag handle / move buttons */}
        <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className={`p-0.5 rounded ${isFirst ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className={`p-0.5 rounded ${isLast ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        </div>

        {/* Expand/collapse for nested types */}
        {hasNestedConfig && (
          <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}>
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        {/* Property name */}
        <input
          type="text"
          value={property.name}
          onChange={(e) => onUpdate({ ...property, name: e.target.value })}
          placeholder="property_name"
          className="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Type selector */}
        <select
          value={property.type}
          onChange={(e) => onUpdate({ ...property, type: e.target.value as PropertyType })}
          className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {TYPE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Type icon badge */}
        <span className={`p-1.5 rounded-lg ${
          property.type === 'string' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' :
          property.type === 'number' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
          property.type === 'boolean' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
          property.type === 'object' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' :
          'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
        }`}>
          <TypeIcon type={property.type} />
        </span>

        {/* Required toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleRequired() }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            property.required
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 ring-1 ring-red-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {property.required ? 'required' : 'optional'}
        </button>

        {/* Description hint */}
        {property.description && (
          <span className="text-xs text-slate-400 dark:text-slate-600 truncate max-w-[100px]" title={property.description}>
            {property.description}
          </span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className={`p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 ${showTypeSpecific ? '' : 'hidden'}`}
            title="Type-specific options"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6" />
              <path d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24M2 12h6m6 0h6M4.93 19.07l4.24-4.24m5.66-5.66 4.24-4.24" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-400"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Type-specific options panel */}
      {showTypeSpecific && (
        <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 pt-3">
            {/* String: format */}
            {property.type === 'string' && (
              <select
                value={property.format || ''}
                onChange={(e) => onUpdate({ ...property, format: e.target.value || undefined })}
                className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">No format</option>
                {STRING_FORMATS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}

            {/* String: enum */}
            {property.type === 'string' && (
              <div className="flex-1">
                <input
                  type="text"
                  value={enumInput}
                  onChange={(e) => {
                    setEnumInput(e.target.value)
                    const values = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    onUpdate({ ...property, enum: values.length > 0 ? values : undefined })
                  }}
                  placeholder="enum: value1, value2, value3"
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            )}

            {/* Number: min/max */}
            {property.type === 'number' && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={property.minimum ?? ''}
                  onChange={(e) => onUpdate({ ...property, minimum: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Min"
                  className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                />
                <span className="text-slate-400">→</span>
                <input
                  type="number"
                  value={property.maximum ?? ''}
                  onChange={(e) => onUpdate({ ...property, maximum: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="Max"
                  className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                />
              </div>
            )}

            {/* Description */}
            <input
              type="text"
              value={property.description || ''}
              onChange={(e) => onUpdate({ ...property, description: e.target.value || undefined })}
              placeholder="Description"
              className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Nested properties (object type) */}
      {property.type === 'object' && isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-800/30">
          <NestedPropertiesEditor
            properties={property.properties || {}}
            onChange={(props) => onUpdate({ ...property, properties: props })}
          />
        </div>
      )}

      {/* Array items */}
      {property.type === 'array' && isExpanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Array Item Type
            {property.items && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                (each item in the array will be of this type)
              </span>
            )}
          </div>
          {property.items ? (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center gap-3">
                {/* Type selector */}
                <span className="text-xs text-slate-500 uppercase font-medium">Type</span>
                <select
                  value={property.items.type}
                  onChange={(e) => onUpdate({
                    ...property,
                    items: { ...property.items, type: e.target.value as PropertyType }
                  })}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Type icon badge */}
                <span className={`p-1.5 rounded-lg ${
                  property.items.type === 'string' ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400' :
                  property.items.type === 'number' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                  property.items.type === 'boolean' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                  property.items.type === 'object' ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' :
                  'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                }`}>
                  <TypeIcon type={property.items.type} />
                </span>

                <div className="flex-1" />

                {/* String format for array items */}
                {property.items.type === 'string' && (
                  <select
                    value={property.items.format || ''}
                    onChange={(e) => onUpdate({
                      ...property,
                      items: { ...property.items, format: e.target.value || undefined }
                    })}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="">No format</option>
                    {STRING_FORMATS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                )}

                {/* String enum for array items */}
                {property.items.type === 'string' && (
                  <input
                    type="text"
                    value={property.items.enum?.join(', ') || ''}
                    onChange={(e) => {
                      const values = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      onUpdate({
                        ...property,
                        items: { ...property.items, enum: values.length > 0 ? values : undefined }
                      })
                    }}
                    placeholder="enum: value1, value2"
                    className="w-40 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                  />
                )}

                {/* Number min/max for array items */}
                {property.items.type === 'number' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={property.items.minimum ?? ''}
                      onChange={(e) => onUpdate({
                        ...property,
                        items: { ...property.items, minimum: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Min"
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                    />
                    <span className="text-slate-400">→</span>
                    <input
                      type="number"
                      value={property.items.maximum ?? ''}
                      onChange={(e) => onUpdate({
                        ...property,
                        items: { ...property.items, maximum: e.target.value ? Number(e.target.value) : undefined }
                      })}
                      placeholder="Max"
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-700 dark:text-slate-300 focus:outline-none"
                    />
                  </div>
                )}

                <button
                  onClick={() => onUpdate({ ...property, items: undefined })}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-400"
                  title="Remove array type definition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onUpdate({ ...property, items: { type: 'string' } })}
              className="w-full p-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-violet-500 hover:text-violet-500 transition-colors text-sm"
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
  properties: Record<string, Omit<Property, 'name' | 'required'>>
  onChange: (properties: Record<string, Omit<Property, 'name' | 'required'>>) => void
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
    const newProps: Record<string, Omit<Property, 'name' | 'required'>> = {}
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

    const newProps: Record<string, Omit<Property, 'name' | 'required'>> = {}
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
    <div className="space-y-2">
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
      <button
        onClick={handleAddProperty}
        className="w-full p-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-violet-500 hover:text-violet-500 transition-colors text-sm flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add nested property
      </button>
    </div>
  )
}

function propertiesToJsonSchema(properties: Property[], required: string[]): JSONSchema {
  const schema: JSONSchema = { type: 'object' }

  if (properties.length > 0) {
    schema.properties = {}
    const requiredFields: string[] = []

    for (const prop of properties) {
      const { id, name, required: _, ...propData } = prop
      const propSchema: JSONSchema = { type: prop.type }

      // String-specific
      if (prop.type === 'string') {
        if (prop.format) propSchema.format = prop.format
        if (prop.enum && prop.enum.length > 0) propSchema.enum = prop.enum
      }

      // Number-specific
      if (prop.type === 'number') {
        if (prop.minimum !== undefined) propSchema.minimum = prop.minimum
        if (prop.maximum !== undefined) propSchema.maximum = prop.maximum
      }

      // Object-specific
      if (prop.type === 'object' && prop.properties) {
        const nestedProps = Object.entries(prop.properties).map(([name, p]) => ({
          id: generateId(),
          name,
          ...p,
          required: false,
        }))
        propSchema.properties = propertiesToJsonSchema(nestedProps, []).properties
      }

      // Array-specific
      if (prop.type === 'array' && prop.items) {
        propSchema.items = {
          type: prop.items.type,
          ...(prop.items.format && { format: prop.items.format }),
          ...(prop.items.enum && { enum: prop.items.enum }),
          ...(prop.items.minimum !== undefined && { minimum: prop.items.minimum }),
          ...(prop.items.maximum !== undefined && { maximum: prop.items.maximum }),
        } as JSONSchema
      }

      // Object nested properties (from propData.properties)
      if (propData.properties && Object.keys(propData.properties).length > 0) {
        const nestedEntries = Object.entries(propData.properties)
        const nestedProps = nestedEntries.map(([n, p]) => ({
          id: generateId(),
          name: n,
          ...p,
          required: false,
        }))
        propSchema.properties = propertiesToJsonSchema(nestedProps, []).properties
      }

      schema.properties[name] = propSchema

      if (prop.required) {
        requiredFields.push(name)
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

    // Nested object properties
    if (propSchema.type === 'object' && propSchema.properties) {
      const nestedProps = jsonSchemaToProperties({ type: 'object', properties: propSchema.properties })
      property.properties = {}
      nestedProps.forEach(p => {
        const { name: _, id: __, ...rest } = p
        property.properties![p.name] = rest
      })
    }

    // Array items
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

export function JsonSchemaEditor({ value, onChange }: JsonSchemaEditorProps) {
  const [properties, setProperties] = useState<Property[]>(() => jsonSchemaToProperties(value))
  const [viewMode, setViewMode] = useState<'visual' | 'code'>('visual')
  const [codeValue, setCodeValue] = useState(() => value ? JSON.stringify(value, null, 2) : '')

  // Sync properties when value prop changes (e.g., when editing different tasks)
  useEffect(() => {
    const converted = jsonSchemaToProperties(value)
    setProperties(converted)
    setCodeValue(value ? JSON.stringify(value, null, 2) : '')
  }, [value])

  // Sync with prop changes
  const handlePropertiesChange = (newProperties: Property[]) => {
    setProperties(newProperties)
    const requiredFields = newProperties.filter(p => p.required).map(p => p.name)
    onChange(newProperties.length > 0 ? propertiesToJsonSchema(newProperties, requiredFields) : null)
  }

  // Switch to code mode
  const handleSwitchToCode = () => {
    // Sync current properties state to code value
    const requiredFields = properties.filter(p => p.required).map(p => p.name)
    const currentSchema = properties.length > 0 ? propertiesToJsonSchema(properties, requiredFields) : null
    setCodeValue(currentSchema ? JSON.stringify(currentSchema, null, 2) : '')
    setViewMode('code')
  }

  // Handle code input
  const handleCodeChange = (newValue: string) => {
    setCodeValue(newValue)
    try {
      const parsed = JSON.parse(newValue)
      onChange(parsed)
    } catch {
      // Invalid JSON, don't update
    }
  }

  // Add new property
  const handleAddProperty = () => {
    const newProp: Property = {
      name: `field_${properties.length + 1}`,
      type: 'string',
      required: false,
    }
    handlePropertiesChange([...properties, newProp])
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl overflow-hidden">
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Schema Properties
        </div>
        <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('visual')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
              viewMode === 'visual'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Visual
          </button>
          <button
            onClick={handleSwitchToCode}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
              viewMode === 'code'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Code
          </button>
        </div>
      </div>

      {/* Visual editor */}
      {viewMode === 'visual' && (
        <div className="p-3">
          {properties.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12 7-12 7z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                No properties defined yet
              </p>
              <button
                onClick={handleAddProperty}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-medium hover:bg-violet-600 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add Property
              </button>
            </div>
          ) : (
            <div className="space-y-2">
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
                className="w-full p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-violet-500 hover:text-violet-500 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        <div className="p-3">
          <textarea
            value={codeValue}
            onChange={(e) => handleCodeChange(e.target.value)}
            rows={10}
            className="w-full font-mono text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg p-3 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            placeholder='{\n  "type": "object",\n  "properties": {\n    "example": { "type": "string" }\n  }\n}'
          />
          {(() => {
            try {
              JSON.parse(codeValue)
              return null
            } catch {
              return (
                <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  Invalid JSON schema
                </p>
              )
            }
          })()}
        </div>
      )}
    </div>
  )
}
