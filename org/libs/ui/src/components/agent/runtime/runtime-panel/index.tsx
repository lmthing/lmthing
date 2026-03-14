import '@lmthing/css/components/agent/runtime/index.css'
import { useToggle } from '@lmthing/state'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Select, SelectOption } from '@lmthing/ui/elements/forms/select'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Sidebar } from '@lmthing/ui/elements/nav/sidebar'
import { PanelHeader } from '@lmthing/ui/elements/content/panel'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'

interface RuntimeField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'toggle'
  value: string | string[] | boolean
  field?: string
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

interface RuntimeAgentConfig {
  id: string
  name: string
  description: string
  fields: string[]
  runtimeFields: RuntimeField[]
  enabledTools: EnabledTool[]
}

interface RuntimePanelProps {
  agent: RuntimeAgentConfig
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

export function RuntimePanel({ agent, runtimeFieldValues = {}, isToolsExpanded = false, onRuntimeFieldChange }: RuntimePanelProps) {
  const [toolsExpanded, toggleToolsExpanded] = useToggle(`runtime-panel.${agent.id}.tools-expanded`, isToolsExpanded)

  const fieldTools = agent.enabledTools.filter(t => t.source === 'field')
  const manualTools = agent.enabledTools.filter(t => t.source === 'manual')

  return (
    <Sidebar className="runtime-panel">
      <PanelHeader>
        <Label className="runtime-panel__name">{agent.name}</Label>
        <Caption muted className="runtime-panel__description">{agent.description}</Caption>
        <div className="runtime-panel__tags">
          {agent.fields.map(field => (
            <Badge key={field} variant="muted" className="runtime-panel__badge">{field}</Badge>
          ))}
        </div>
      </PanelHeader>

      <div className="runtime-panel__scroll-area">
        {agent.runtimeFields.length > 0 && (
          <section className="runtime-panel__fields-section">
            <Label compact className="runtime-panel__fields-label">Runtime Fields ({agent.runtimeFields.length})</Label>
            <Card>
              <CardBody>
                {agent.runtimeFields.map(field => (
                  <div key={field.id} className="runtime-panel__field-item">
                    <Stack row className="runtime-panel__field-header">
                      <Label compact>{field.label}</Label>
                      {field.field && <Badge variant="muted" className="runtime-panel__badge">{field.field}</Badge>}
                    </Stack>
                    <RuntimeFieldInput field={field} value={runtimeFieldValues[field.id] ?? field.value} onChange={(v) => onRuntimeFieldChange?.(field.id, v)} />
                  </div>
                ))}
              </CardBody>
            </Card>
            <Caption muted className="runtime-panel__field-hint">Changes take effect immediately</Caption>
          </section>
        )}

        {agent.enabledTools.length > 0 && (
          <section>
            <Button onClick={toggleToolsExpanded} variant="ghost" className="runtime-panel__tools-toggle">
              <Label compact>Enabled Tools ({agent.enabledTools.length})</Label>
              <span>{toolsExpanded ? '▲' : '▼'}</span>
            </Button>
            {toolsExpanded && (
              <Stack gap="sm">
                {fieldTools.length > 0 && (
                  <div>
                    <Caption muted className="runtime-panel__tool-section-label">Auto-enabled from fields</Caption>
                    {fieldTools.map(tool => (
                      <div key={tool.toolId} className="list-item">
                        <span>{tool.icon}</span>
                        <div className="runtime-panel__tool-info">
                          <Label>{tool.name}</Label>
                          <Caption muted className="runtime-panel__tool-package">{tool.package}@{tool.version}</Caption>
                        </div>
                        <Badge variant={tool.installed ? 'success' : 'primary'} className="runtime-panel__badge">
                          {tool.installed ? 'Installed' : 'Not Installed'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {manualTools.length > 0 && (
                  <div>
                    <Caption muted className="runtime-panel__tool-section-label">Manually added</Caption>
                    {manualTools.map(tool => (
                      <div key={tool.toolId} className="list-item">
                        <span>{tool.icon}</span>
                        <div className="runtime-panel__tool-info">
                          <Label>{tool.name}</Label>
                          <Caption muted className="runtime-panel__tool-package">{tool.package}@{tool.version}</Caption>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Stack>
            )}
          </section>
        )}

        {agent.runtimeFields.length === 0 && agent.enabledTools.length === 0 && (
          <Stack className="runtime-panel__empty-state">
            <div className="runtime-panel__empty-icon">✓</div>
            <Caption muted>This agent has no runtime configuration. Ready to chat!</Caption>
          </Stack>
        )}
      </div>
    </Sidebar>
  )
}
