/**
 * AssistantHeader - Application header for agent configuration.
 * US-201: Back button, agent name/description, Thing and Export utility buttons.
 * US-212: Export button for agent-specific export.
 * US-213: Thing toggle button.
 */
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Stack } from '@/elements/layouts/stack'
import { Button } from '@/elements/forms/button'
import { ArrowLeft, Bot, Download } from 'lucide-react'

export interface AssistantHeaderProps {
  name: string
  description: string
  isNew: boolean
  hasUnsavedChanges: boolean
  isValid: boolean
  isThingOpen: boolean
  isExporting: boolean
  onSave: () => void
  onBack: () => void
  onToggleThing: () => void
  onExport: () => void
}

export function AssistantHeader({
  name,
  description,
  isNew,
  hasUnsavedChanges,
  isValid,
  isThingOpen,
  isExporting,
  onSave,
  onBack,
  onToggleThing,
  onExport,
}: AssistantHeaderProps) {
  return (
    <header style={{
      padding: '0.75rem 1rem',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    }}>
      <Stack row style={{ alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft style={{ width: '1rem', height: '1rem' }} />
        </Button>
        <div style={{ minWidth: 0 }}>
          <Heading level={3} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name || 'New Agent'}
          </Heading>
          {description && (
            <Caption muted style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {description}
            </Caption>
          )}
        </div>
      </Stack>

      <Stack row gap="sm" style={{ alignItems: 'center', flexShrink: 0 }}>
        {hasUnsavedChanges && (
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            disabled={!isValid}
          >
            {isNew ? 'Create' : 'Save'}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onToggleThing}>
          <Bot style={{ width: '1rem', height: '1rem', marginRight: '0.375rem' }} />
          {isThingOpen ? 'Hide Thing' : 'Thing'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onExport} disabled={isExporting || isNew}>
          <Download style={{ width: '1rem', height: '1rem', marginRight: '0.375rem' }} />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </Stack>
    </header>
  )
}
