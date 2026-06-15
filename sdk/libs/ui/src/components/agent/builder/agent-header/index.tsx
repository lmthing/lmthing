import '@lmthing/css/components/agent/builder/index.css'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { ArrowLeft } from 'lucide-react'

export interface AgentHeaderProps {
  title: string
  isNew: boolean
  hasUnsavedChanges: boolean
  isValid: boolean
  onTitleChange: (title: string) => void
  onSave: () => void
  onBack: () => void
}

export function AgentHeader({
  title,
  isNew,
  hasUnsavedChanges,
  isValid,
  onTitleChange,
  onSave,
  onBack,
}: AgentHeaderProps) {
  return (
    <header className="agent-header">
      <Stack row className="agent-header__left">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="agent-header__icon" />
        </Button>
        <Input
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Agent title"
          className="input--sm agent-header__name-input"
        />
      </Stack>
      <Stack row gap="sm" className="agent-header__right">
        {hasUnsavedChanges && (
          <Button variant="primary" size="sm" onClick={onSave} disabled={!isValid}>
            {isNew ? 'Create' : 'Save'}
          </Button>
        )}
      </Stack>
    </header>
  )
}
