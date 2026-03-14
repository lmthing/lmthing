import '@lmthing/css/components/agent/builder/index.css'
import { useUIState } from '@lmthing/state'
import { Bot, X } from 'lucide-react'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Card, CardHeader, CardBody } from '@lmthing/ui/elements/content/card'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'

interface CreateAgentInlineProps {
  onSubmit: (name: string, description: string) => void
  onCancel: () => void
}

export function CreateAgentInline({ onSubmit, onCancel }: CreateAgentInlineProps) {
  const [name, setName] = useUIState('create-assistant-inline.name', '')
  const [description, setDescription] = useUIState('create-assistant-inline.description', '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) { onSubmit(name.trim(), description.trim()); setName(''); setDescription('') }
  }

  return (
    <Card className="create-assistant-inline">
      <CardHeader>
        <Stack row className="create-assistant-inline__header-row">
          <Stack row gap="sm" className="create-assistant-inline__header-left">
            <div className="create-assistant-inline__avatar">
              <Bot className="create-assistant-inline__avatar-icon" />
            </div>
            <div>
              <Label>Create New Agent</Label>
              <Caption muted>Define a new AI agent</Caption>
            </div>
          </Stack>
          <Button onClick={onCancel} variant="ghost" size="sm"><X className="create-assistant-inline__close-icon" /></Button>
        </Stack>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <div>
              <Label compact required>Name</Label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Assessment Agent" autoFocus required />
            </div>
            <div>
              <Label compact>Description (Optional)</Label>
              <Textarea compact value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of what this agent does" />
            </div>
            <Stack row gap="sm" className="create-assistant-inline__actions">
              <Button type="button" onClick={onCancel} variant="ghost" className="create-assistant-inline__btn">Cancel</Button>
              <Button type="submit" disabled={!name.trim()} variant="primary" className="create-assistant-inline__btn">Create Agent</Button>
            </Stack>
          </Stack>
        </form>
      </CardBody>
    </Card>
  )
}
