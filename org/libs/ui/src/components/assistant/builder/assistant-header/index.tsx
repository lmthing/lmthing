/**
 * AssistantHeader - Application header for agent configuration.
 * US-201: Back button, agent name/description, Thing and Export utility buttons.
 * US-212: Export button for agent-specific export.
 * US-213: Thing toggle button.
 */
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { ArrowLeft, Bot, Download } from 'lucide-react'

export interface AssistantHeaderProps {
  name: string
  description: string
  isNew: boolean
  hasUnsavedChanges: boolean
  isValid: boolean
  isThingOpen: boolean
  isExporting: boolean
  onNameChange: (name: string) => void
  onDescriptionChange: (description: string) => void
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
  onNameChange,
  onDescriptionChange,
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <Input
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="Agent name"
            className="input--sm"
            style={{
              fontWeight: 600,
              fontSize: '1.125rem',
              border: 'none',
              background: 'transparent',
              boxShadow: 'none',
              paddingLeft: 0,
              height: 'auto',
            }}
          />
          <Input
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="What does this agent do?"
            className="input--sm"
            style={{
              fontSize: '0.8125rem',
              border: 'none',
              background: 'transparent',
              boxShadow: 'none',
              paddingLeft: 0,
              height: 'auto',
              color: 'var(--color-text-muted, hsl(var(--muted-foreground)))',
            }}
          />
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
