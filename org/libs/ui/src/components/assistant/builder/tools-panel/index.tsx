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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PanelHeader>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Label compact>Enabled Tools</Label>
          <Button onClick={onOpenLibrary} variant="primary" size="sm">+ Add Tools</Button>
        </Stack>
      </PanelHeader>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {enabledTools.length === 0 ? (
          <Stack style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔧</div>
            <Label>No tools enabled</Label>
            <Caption muted style={{ maxWidth: '200px', margin: '0 auto' }}>
              Add tools from the library to extend your assistant's capabilities
            </Caption>
            <Button onClick={onOpenLibrary} variant="ghost" size="sm" style={{ marginTop: '1rem' }}>
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
        <Caption muted style={{ textAlign: 'center', display: 'block' }}>
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
        <Stack row gap="sm" style={{ alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.25rem', flexShrink: 0 }}>📦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Stack row gap="sm" style={{ alignItems: 'center', marginBottom: '0.25rem' }}>
              <Label style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mapping.tool.name}</Label>
              <Badge variant={status.variant} style={{ fontSize: '0.625rem' }}>{status.icon} {status.label}</Badge>
            </Stack>
            <Caption muted style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {mapping.tool.description}
            </Caption>
            <Stack row gap="sm" style={{ marginTop: '0.5rem' }}>
              <Badge variant="muted" style={{ fontSize: '0.625rem' }}>{mapping.tool.category}</Badge>
              <Caption muted>v{mapping.tool.version}</Caption>
            </Stack>
          </div>
          <Stack gap="sm" style={{ opacity: 0 }}>
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
