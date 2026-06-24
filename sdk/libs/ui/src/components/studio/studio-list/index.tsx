import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { useProjects } from '@lmthing/state'
import '@lmthing/css/elements/content/card/index.css'
import '@lmthing/css/elements/layouts/page/index.css'
import '@lmthing/css/elements/layouts/stack/index.css'
import '@lmthing/css/components/studio/index.css'

/**
 * StudioList — legacy list surface.
 *
 * Under the pod-backed architecture the "studio" concept is renamed to
 * "project" and projects live at the app level (the pod's PVC), not within a
 * space. This component now lists projects via {@link useProjects}.
 */
export function StudioList() {
  const { projects } = useProjects()

  return (
    <Page full>
      <PageHeader>
        <Stack row className="studio-list__header">
          <div>
            <Heading level={2}>Projects</Heading>
            <Caption muted>Browse and manage your projects</Caption>
          </div>
          <Badge variant="muted">{projects.length} project{projects.length !== 1 ? 's' : ''}</Badge>
        </Stack>
      </PageHeader>

      <PageBody>
        {projects.length === 0 ? (
          <Stack className="studio-list__empty">
            <Heading level={3}>No Projects</Heading>
            <Caption muted>Create a project to get started.</Caption>
          </Stack>
        ) : (
          <Stack gap="md">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardBody>
                  <Heading level={4}>{project.name || project.id}</Heading>
                </CardBody>
              </Card>
            ))}
          </Stack>
        )}
      </PageBody>
    </Page>
  )
}
