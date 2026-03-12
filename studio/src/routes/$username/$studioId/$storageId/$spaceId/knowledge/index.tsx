import { useCallback } from 'react'
import { useToggle, useSpaceFS } from '@lmthing/state'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Label } from '@/elements/typography/label'
import { Badge } from '@/elements/content/badge'
import { Card, CardBody } from '@/elements/content/card'
import { Stack } from '@/elements/layouts/stack'
import { Button } from '@/elements/forms/button'
import { useKnowledgeFields } from '@/hooks/useKnowledgeFields'
import { useKnowledgeField } from '@/hooks/useKnowledgeField'
import { CreateFieldInline } from '@/components/knowledge/field/create-field-inline'
import { buildSpacePathFromParams } from '@/lib/space-url'
import { Plus } from 'lucide-react'
import type { DomainMeta } from '@/hooks/useKnowledgeFields'

function FieldCard({ field, spacePath }: { field: DomainMeta; spacePath: string }) {
  const navigate = useNavigate()
  const knowledge = useKnowledgeField(field.id)
  const title = knowledge.config?.title || field.id
  const description = knowledge.config?.description
  const entryCount = knowledge.entries.length

  return (
    <Card
      interactive
      onClick={() => navigate({ to: `${spacePath}/knowledge/${encodeURIComponent(field.id)}` })}
      style={{ cursor: 'pointer' }}
    >
      <CardBody>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Label>{title}</Label>
            {description && (
              <Caption muted style={{ marginTop: '0.125rem' }}>{description}</Caption>
            )}
            <Caption muted style={{ marginTop: '0.125rem' }}>
              {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            </Caption>
          </div>
          <Badge variant="muted">Open</Badge>
        </Stack>
      </CardBody>
    </Card>
  )
}

function KnowledgePage() {
  const params = Route.useParams()
  const { username, studioId, storageId, spaceId } = params
  const fields = useKnowledgeFields()
  const spaceFS = useSpaceFS()
  const [showCreate, toggleShowCreate, setShowCreate] = useToggle('knowledge-page.show-create', false)

  const spacePath = buildSpacePathFromParams(username, studioId, storageId, spaceId)

  const handleCreateField = useCallback((name: string, description: string) => {
    if (!spaceFS) return
    const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    const config: Record<string, string> = { title: name }
    if (description) config.description = description
    spaceFS.writeFile(`knowledge/${id}/config.json`, JSON.stringify(config, null, 2))
    setShowCreate(false)
  }, [spaceFS])

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Stack gap="lg">
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Heading level={2}>Knowledge</Heading>
            <Caption muted>
              {fields.length} knowledge field{fields.length !== 1 ? 's' : ''} configured.
            </Caption>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} />
            New Field
          </Button>
        </Stack>

        {showCreate && (
          <CreateFieldInline
            onSubmit={handleCreateField}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {fields.length === 0 && !showCreate ? (
          <Caption muted>No knowledge fields yet. Create one to get started.</Caption>
        ) : (
          <Stack gap="sm">
            {fields.map(f => (
              <FieldCard key={f.id} field={f} spacePath={spacePath} />
            ))}
          </Stack>
        )}
      </Stack>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/knowledge/',
)({
  component: KnowledgePage,
})
