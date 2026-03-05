import { useState } from 'react'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Textarea } from '@/elements/forms/textarea'
import { Select, SelectOption } from '@/elements/forms/select'
import { Card, CardBody } from '@/elements/content/card'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { Sidebar } from '@/elements/nav/sidebar'
import { PanelHeader } from '@/elements/content/panel'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'

interface RuntimeField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'toggle'
  value: string | string[] | boolean
  domain?: string
  placeholder?: string
  options?: string[]
}

interface EnabledTool {
  toolId: string
  name: string
  icon: string
  package: string
  version: string
  installed: boolean
  source: 'field' | 'manual'
  sourceField?: string
}

interface RuntimeAssistantConfig {
  id: string
  name: string
  description: string
  fields: string[]
  runtimeFields: RuntimeField[]
  enabledTools: EnabledTool[]
}

interface RuntimePanelProps {
  assistant: RuntimeAssistantConfig
  runtimeFieldValues?: Record<string, string | string[] | boolean>
  isToolsExpanded?: boolean
  onRuntimeFieldChange?: (fieldId: string, value: string | string[] | boolean) => void
}

function RuntimeFieldInput({ field, value, onChange }: { field: RuntimeField; value: string | string[] | boolean; onChange: (v: string | string[] | boolean) => void }) {
  switch (field.type) {
    case 'text':
      return <Input type="text" placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`} value={value as string} onChange={(e) => onChange(e.target.value)} />
    case 'textarea':
      return <Textarea placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`} value={value as string} onChange={(e) => onChange(e.target.value)} rows={3} />
    case 'select':
      return (
        <Select value={value as string} onChange={(e) => onChange(e.target.value)}>
          <SelectOption value="">Select {field.label.toLowerCase()}...</SelectOption>
          {field.options?.map(opt => <SelectOption key={opt} value={opt}>{opt}</SelectOption>)}
        </Select>
      )
    case 'toggle':
      return (
        <Button type="button" onClick={() => onChange(!(value as boolean))} variant={value ? 'primary' : 'ghost'} size="sm">
          {value ? 'On' : 'Off'}
        </Button>
      )
    default:
      return <Input type="text" value={value as string} onChange={(e) => onChange(e.target.value)} />
  }
}

export function RuntimePanel({ assistant, runtimeFieldValues = {}, isToolsExpanded = false, onRuntimeFieldChange }: RuntimePanelProps) {
  const [toolsExpanded, setToolsExpanded] = useState(isToolsExpanded)

  const fieldTools = assistant.enabledTools.filter(t => t.source === 'field')
  const manualTools = assistant.enabledTools.filter(t => t.source === 'manual')

  return (
    <Sidebar style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PanelHeader>
        <Label style={{ fontWeight: 600 }}>{assistant.name}</Label>
        <Caption muted style={{ marginTop: '0.25rem' }}>{assistant.description}</Caption>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.75rem' }}>
          {assistant.fields.map(field => (
            <Badge key={field} variant="muted" style={{ fontSize: '0.625rem' }}>{field}</Badge>
          ))}
        </div>
      </PanelHeader>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {assistant.runtimeFields.length > 0 && (
          <section style={{ marginBottom: '1.5rem' }}>
            <Label compact style={{ marginBottom: '0.75rem' }}>Runtime Fields ({assistant.runtimeFields.length})</Label>
            <Card>
              <CardBody>
                {assistant.runtimeFields.map(field => (
                  <div key={field.id} style={{ marginBottom: '1rem' }}>
                    <Stack row style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <Label compact>{field.label}</Label>
                      {field.domain && <Badge variant="muted" style={{ fontSize: '0.625rem' }}>{field.domain}</Badge>}
                    </Stack>
                    <RuntimeFieldInput field={field} value={runtimeFieldValues[field.id] ?? field.value} onChange={(v) => onRuntimeFieldChange?.(field.id, v)} />
                  </div>
                ))}
              </CardBody>
            </Card>
            <Caption muted style={{ marginTop: '0.5rem' }}>Changes take effect immediately</Caption>
          </section>
        )}

        {assistant.enabledTools.length > 0 && (
          <section>
            <Button onClick={() => setToolsExpanded(!toolsExpanded)} variant="ghost" style={{ width: '100%', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <Label compact>Enabled Tools ({assistant.enabledTools.length})</Label>
              <span>{toolsExpanded ? '▲' : '▼'}</span>
            </Button>
            {toolsExpanded && (
              <Stack gap="sm">
                {fieldTools.length > 0 && (
                  <div>
                    <Caption muted style={{ marginBottom: '0.5rem' }}>Auto-enabled from fields</Caption>
                    {fieldTools.map(tool => (
                      <div key={tool.toolId} className="list-item">
                        <span>{tool.icon}</span>
                        <div style={{ flex: 1 }}>
                          <Label>{tool.name}</Label>
                          <Caption muted style={{ display: 'block' }}>{tool.package}@{tool.version}</Caption>
                        </div>
                        <Badge variant={tool.installed ? 'success' : 'primary'} style={{ fontSize: '0.625rem' }}>
                          {tool.installed ? 'Installed' : 'Not Installed'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {manualTools.length > 0 && (
                  <div>
                    <Caption muted style={{ marginBottom: '0.5rem' }}>Manually added</Caption>
                    {manualTools.map(tool => (
                      <div key={tool.toolId} className="list-item">
                        <span>{tool.icon}</span>
                        <div style={{ flex: 1 }}>
                          <Label>{tool.name}</Label>
                          <Caption muted style={{ display: 'block' }}>{tool.package}@{tool.version}</Caption>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Stack>
            )}
          </section>
        )}

        {assistant.runtimeFields.length === 0 && assistant.enabledTools.length === 0 && (
          <Stack style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✓</div>
            <Caption muted>This assistant has no runtime configuration. Ready to chat!</Caption>
          </Stack>
        )}
      </div>
    </Sidebar>
  )
}
