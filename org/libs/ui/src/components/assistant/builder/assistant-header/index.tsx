/**
 * AssistantHeader - Application header for agent configuration.
 * US-201: Back button, agent name/description, Thing and Export utility buttons.
 * US-212: Export button for agent-specific export.
 * US-213: Thing toggle button.
 */
import '@lmthing/css/components/assistant/builder/index.css'
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
    <header className="assistant-header">
      <Stack row className="assistant-header__left">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="assistant-header__icon" />
        </Button>
        <div className="assistant-header__name-wrap">
          <Input
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="Agent name"
            className="input--sm assistant-header__name-input"
          />
          <Input
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="What does this agent do?"
            className="input--sm assistant-header__desc-input"
          />
        </div>
      </Stack>

      <Stack row gap="sm" className="assistant-header__right">
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
          <Bot className="assistant-header__btn-icon" />
          {isThingOpen ? 'Hide Thing' : 'Thing'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onExport} disabled={isExporting || isNew}>
          <Download className="assistant-header__btn-icon" />
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </Stack>
    </header>
  )
}
