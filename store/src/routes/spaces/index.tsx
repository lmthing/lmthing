import { createFileRoute, Link } from '@tanstack/react-router'
import { Plug } from 'lucide-react'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { listCatalogIntegrations } from '@/lib/apps-manifest'

export const Route = createFileRoute('/spaces/')({
  component: IntegrationsBrowse,
})

function IntegrationsBrowse() {
  const spaces = listCatalogIntegrations()

  return (
    <Page>
      <PageHeader>
        <Heading level={1}>Integrations</Heading>
        <Caption muted>
          Connect your workspace to Slack, GitHub and more — install one into a project from your Studio,
          then paste your own token in the project&apos;s settings.
        </Caption>
      </PageHeader>
      <PageBody>
        {spaces.length === 0 ? (
          <Caption muted>No integrations published yet.</Caption>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => {
              const fieldCount = Object.keys(
                (space.settings as { properties?: Record<string, unknown> } | null)?.properties ?? {},
              ).length
              return (
                <Link key={space.id} to="/spaces/$spaceId" params={{ spaceId: space.id }} className="block">
                  <Card interactive className="flex h-full flex-col">
                    <CardBody className="flex h-full flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg"
                          aria-hidden="true"
                        >
                          {space.icon ? space.icon : <Plug className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
                        </span>
                        <Heading level={4} className="line-clamp-1">
                          {space.title}
                        </Heading>
                      </div>
                      {space.description && (
                        <p className="line-clamp-3 text-sm text-muted-foreground">{space.description}</p>
                      )}
                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        <Badge variant="muted">Integration</Badge>
                        {fieldCount > 0 && (
                          <Badge variant="muted">
                            {fieldCount} setting{fieldCount === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </PageBody>
    </Page>
  )
}
