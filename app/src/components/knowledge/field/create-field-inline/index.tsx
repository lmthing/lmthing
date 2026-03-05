import { useState } from 'react'
import { FolderPlus, X } from 'lucide-react'
import { Button } from '@/elements/forms/button'
import { Input } from '@/elements/forms/input'
import { Textarea } from '@/elements/forms/textarea'
import { Card, CardHeader, CardBody } from '@/elements/content/card'
import { Stack } from '@/elements/layouts/stack'
import { Label } from '@/elements/typography/label'
import { Caption } from '@/elements/typography/caption'
import { Heading } from '@/elements/typography/heading'

interface CreateFieldInlineProps {
    onSubmit: (name: string, description: string) => void
    onCancel: () => void
}

export function CreateFieldInline({ onSubmit, onCancel }: CreateFieldInlineProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim()) {
            onSubmit(name.trim(), description.trim())
            setName('')
            setDescription('')
        }
    }

    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-xl p-5 mb-6 animate-in slide-in-from-top-2 duration-200">
            <Stack row gap="md" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <Stack row gap="md" style={{ alignItems: 'center' }}>
                    <div className="p-2 bg-emerald-500 rounded-lg">
                        <FolderPlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <Heading level={3}>Create Knowledge Field</Heading>
                        <Caption muted>Define a new field of knowledge</Caption>
                    </div>
                </Stack>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                    <X className="w-4 h-4" />
                </Button>
            </Stack>
            <form onSubmit={handleSubmit} className="space-y-3">
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
            </form>
        </div>
    )
}
