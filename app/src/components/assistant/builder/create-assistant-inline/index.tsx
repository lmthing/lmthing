import { useState } from 'react'
import { Bot, X } from 'lucide-react'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Textarea } from '@/elements/forms/textarea'
import { Card, CardHeader, CardBody } from '@/elements/content/card'
import { Stack } from '@/elements/layouts/stack'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'

interface CreateAssistantInlineProps {
  onSubmit: (name: string, description: string) => void
  onCancel: () => void
}

export function CreateAssistantInline({ onSubmit, onCancel }: CreateAssistantInlineProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) { onSubmit(name.trim(), description.trim()); setName(''); setDescription('') }
  }

  return (
    <Card style={{ marginBottom: '1.5rem' }}>
      <CardHeader>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Stack row gap="sm" style={{ alignItems: 'center' }}>
            <div style={{ padding: '0.5rem', background: '#8b5cf6', borderRadius: '0.5rem' }}>
              <Bot className="w-5 h-5" style={{ color: 'white' }} />
            </div>
            <div>
              <Label>Create New Assistant</Label>
              <Caption muted>Define a new AI assistant</Caption>
            </div>
          </Stack>
          <Button onClick={onCancel} variant="ghost" size="sm"><X className="w-4 h-4" /></Button>
        </Stack>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <div>
              <Label compact required>Name</Label>
              <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Assessment Assistant" autoFocus required />
            </div>
            <div>
              <Label compact>Description (Optional)</Label>
              <Textarea compact value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of what this assistant does" />
            </div>
            <Stack row gap="sm" style={{ paddingTop: '0.25rem' }}>
              <Button type="button" onClick={onCancel} variant="ghost" style={{ flex: 1 }}>Cancel</Button>
              <Button type="submit" disabled={!name.trim()} variant="primary" style={{ flex: 1 }}>Create Assistant</Button>
            </Stack>
          </Stack>
        </form>
      </CardBody>
    </Card>
  )
}
