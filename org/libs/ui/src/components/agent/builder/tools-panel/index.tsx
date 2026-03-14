import '@lmthing/css/components/agent/builder/index.css'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Card, CardBody, CardFooter } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { PanelHeader } from '@lmthing/ui/elements/content/panel'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'

export type ToolConfigStatus = 'installed' | 'needs-config' | 'ready'

export interface Tool {
  id: string
  name: string
  description: string
  category: string
  version: string
  package?: string
  configRequired?: boolean
}

export interface EnabledToolMapping {
  tool: Tool
  status: ToolConfigStatus
  source: 'manual' | 'field'
}

interface ToolsPanelProps {
  enabledTools: EnabledToolMapping[]
  onOpenLibrary: () => void
  onRemoveTool: (toolId: string) => void
  onConfigureTool: (toolId: string, config: Record<string, unknown>) => void
}

const statusLabels: Record<ToolConfigStatus, { label: string; variant: 'success' | 'primary' | 'muted'; icon: string }> = {
  installed: { label: 'Installed', variant: 'success', icon: '\u2713' },
  'needs-config': { label: 'Needs Config', variant: 'primary', icon: '\u2699' },
  ready: { label: 'Ready', variant: 'muted', icon: '\u25CF' },
}

export function ToolsPanel({ enabledTools, onOpenLibrary, onRemoveTool, onConfigureTool }: ToolsPanelProps) {
  return (
    <div className="tools-panel">
      <PanelHeader>
        <Stack row className="tools-panel__header-row">
          <Label compact>Enabled Tools</Label>
          <Button onClick={onOpenLibrary} variant="primary" size="sm">+ Add Tools</Button>
        </Stack>
      </PanelHeader>

      <div className="tools-panel__body">
        {enabledTools.length === 0 ? (
          <Stack className="tools-panel__empty">
            <div className="tools-panel__empty-icon">🔧</div>
            <Label>No tools enabled</Label>
            <Caption muted className="tools-panel__empty-caption">
              Add tools from the library to extend your agent's capabilities
            </Caption>
            <Button onClick={onOpenLibrary} variant="ghost" size="sm" className="tools-panel__empty-btn">
              Browse Tool Library
            </Button>
          </Stack>
        ) : (
          <Stack gap="sm">
            {enabledTools.map(mapping => (
              <ToolCard
                key={mapping.tool.id}
                mapping={mapping}
                onRemove={mapping.source === 'manual' ? () => onRemoveTool(mapping.tool.id) : undefined}
                onConfigure={() => onConfigureTool(mapping.tool.id, {})}
              />
            ))}
          </Stack>
        )}
      </div>

      <CardFooter>
        <Caption muted className="tools-panel__footer-caption">
          Tools are manually enabled from the library
        </Caption>
      </CardFooter>
    </div>
  )
}

function ToolCard({ mapping, onRemove, onConfigure }: { mapping: EnabledToolMapping; onRemove?: () => void; onConfigure?: () => void }) {
  const status = statusLabels[mapping.status]
  return (
    <Card interactive>
      <CardBody>
        <Stack row gap="sm" className="tools-panel__card-row">
          <div className="tools-panel__card-icon">📦</div>
          <div className="tools-panel__card-content">
            <Stack row gap="sm" className="tools-panel__card-title-row">
              <Label className="tools-panel__card-label">{mapping.tool.name}</Label>
              <Badge variant={status.variant} className="tools-panel__badge-sm">{status.icon} {status.label}</Badge>
            </Stack>
            <Caption muted className="tools-panel__card-description">
              {mapping.tool.description}
            </Caption>
            <Stack row gap="sm" className="tools-panel__card-meta-row">
              <Badge variant="muted" className="tools-panel__badge-sm">{mapping.tool.category}</Badge>
              <Caption muted>v{mapping.tool.version}</Caption>
            </Stack>
          </div>
          <Stack gap="sm" className="tools-panel__card-actions">
            {mapping.tool.configRequired && mapping.status !== 'ready' && (
              <Button onClick={onConfigure} variant="ghost" size="sm" title="Configure tool">⚙</Button>
            )}
            {mapping.source === 'manual' && onRemove && (
              <Button onClick={onRemove} variant="ghost" size="sm" title="Remove tool">✕</Button>
            )}
          </Stack>
        </Stack>
      </CardBody>
    </Card>
  )
}
