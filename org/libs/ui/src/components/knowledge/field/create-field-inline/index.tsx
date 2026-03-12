import { useUIState } from '@lmthing/state'
import { FolderPlus, X } from 'lucide-react'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Heading } from '@lmthing/ui/elements/typography/heading'

interface CreateFieldInlineProps {
    onSubmit: (name: string, description: string) => void
    onCancel: () => void
}

export function CreateFieldInline({ onSubmit, onCancel }: CreateFieldInlineProps) {
    const [name, setName] = useUIState<string>('create-field-inline.name', '')
    const [description, setDescription] = useUIState<string>('create-field-inline.description', '')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim()) {
            onSubmit(name.trim(), description.trim())
            setName('')
            setDescription('')
        }
    }

    return (
        <div className="panel" style={{ marginBottom: '1.5rem' }}>
            <div className="panel__header">
                <Stack row gap="md" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Stack row gap="md" style={{ alignItems: 'center' }}>
                        <FolderPlus style={{ width: '1.25rem', height: '1.25rem' }} />
                        <div>
                            <Heading level={3}>Create Knowledge Field</Heading>
                            <Caption muted>Define a new field of knowledge</Caption>
                        </div>
                    </Stack>
                    <Button variant="ghost" size="icon" onClick={onCancel}>
                        <X style={{ width: '1rem', height: '1rem' }} />
                    </Button>
                </Stack>
            </div>
            <div className="panel__body">
                <form onSubmit={handleSubmit}>
                    <Stack gap="md">
                        <div>
                            <Label compact required>Name</Label>
                            <Input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Project Documentation"
                                autoFocus
                                required
                            />
                        </div>
                        <div>
                            <Label compact>Description (Optional)</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of this knowledge field"
                                compact
                            />
                        </div>
                        <Stack row gap="sm">
                            <Button variant="outline" onClick={onCancel} style={{ flex: 1 }}>
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit" disabled={!name.trim()} style={{ flex: 1 }}>
                                Create Field
                            </Button>
                        </Stack>
                    </Stack>
                </form>
            </div>
        </div>
    )
}
