import { Card, CardBody } from '@/elements/content/card'
import { Stack } from '@/elements/layouts/stack'
import { Page, PageHeader, PageBody } from '@/elements/layouts/page'
import { Heading } from '@/elements/typography/heading'
import { Caption } from '@/elements/typography/caption'
import { Badge } from '@/elements/content/badge'
import { useSpace } from '@/hooks/useSpace'
import '@/css/elements/content/card/index.css'
import '@/css/elements/layouts/page/index.css'
import '@/css/elements/layouts/stack/index.css'

export function StudioList() {
  const space = useSpace()

  const studios = space?.studios ?? []

  return (
    <Page full>
      <PageHeader>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Heading level={2}>Studios</Heading>
            <Caption muted>Browse and manage your studios</Caption>
          </div>
          <Badge variant="muted">{studios.length} studio{studios.length !== 1 ? 's' : ''}</Badge>
        </Stack>
      </PageHeader>

      <PageBody>
        {studios.length === 0 ? (
          <Stack style={{ alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <Heading level={3}>No Studios</Heading>
            <Caption muted>Create a studio to get started.</Caption>
          </Stack>
        ) : (
          <Stack gap="md">
            {studios.map((studio: { id: string; name: string; description?: string }) => (
              <Card key={studio.id}>
                <CardBody>
                  <Heading level={4}>{studio.name}</Heading>
                  {studio.description && <Caption muted>{studio.description}</Caption>}
                </CardBody>
              </Card>
            ))}
          </Stack>
        )}
      </PageBody>
    </Page>
  )
}
