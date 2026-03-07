/**
 * AssistantHeader - Header bar for the assistant builder.
 * Phase 4: Name, description, status indicator, save/delete/duplicate actions.
 */
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { Stack } from '@/elements/layouts/stack'
import { Button } from '@/elements/forms/button'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/elements/overlays/dialog'

export interface AssistantHeaderProps {
  name: string
  description: string
  isNew: boolean
  hasUnsavedChanges: boolean
  isValid: boolean
  onSave: () => void
  onSaveAsNew: () => void
  onDelete: () => void
}

export function AssistantHeader({
  name,
  description,
  isNew,
  hasUnsavedChanges,
  isValid,
  onSave,
  onSaveAsNew,
  onDelete,
}: AssistantHeaderProps) {
  return (
    <Stack row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <Stack row gap="sm" style={{ alignItems: 'center' }}>
          <Heading level={2}>{name || 'New Assistant'}</Heading>
          <Badge variant={isValid ? 'success' : 'muted'}>
            {isValid ? 'Ready' : 'Incomplete'}
          </Badge>
          {hasUnsavedChanges && <Badge variant="primary">Unsaved</Badge>}
        </Stack>
        <Caption muted>{description || 'Configure your assistant below'}</Caption>
      </div>
      <Stack row gap="sm">
        {!isNew && (
          <>
            <Button variant="outline" size="sm" onClick={onSaveAsNew}>
              Save as New
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">Delete</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Assistant</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <Stack row gap="sm" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive" onClick={onDelete}>Delete</Button>
                  </DialogClose>
                </Stack>
              </DialogContent>
            </Dialog>
          </>
        )}
        <Button
          variant="primary"
          onClick={onSave}
          disabled={!isValid}
        >
          {isNew ? 'Create Assistant' : 'Save'}
        </Button>
      </Stack>
    </Stack>
  )
}
