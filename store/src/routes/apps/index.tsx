import { createFileRoute, Link } from '@tanstack/react-router'
import { Package } from 'lucide-react'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { listCatalogApps } from '@/lib/apps-manifest'

export const Route = createFileRoute('/apps/')({
  component: AppsBrowse,
})

function AppsBrowse() {
  const apps = listCatalogApps()

  return (
    <Page>
      <PageHeader>
        <Heading level={1}>App catalog</Heading>
        <Caption muted>
          Installable project-apps — a database, pages, API endpoints and hooks in one package.
        </Caption>
      </PageHeader>
      <PageBody>
        {apps.length === 0 ? (
          <Caption muted>No apps published yet.</Caption>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Link key={app.id} to="/apps/$appId" params={{ appId: app.id }} className="block">
                <Card interactive className="flex h-full flex-col">
                  <CardBody className="flex h-full flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg"
                        aria-hidden="true"
                      >
                        {app.icon ? app.icon : <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />}
                      </span>
                      <Heading level={4} className="line-clamp-1">
                        {app.title}
                      </Heading>
                    </div>
                    {app.description && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{app.description}</p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <Badge variant="muted">
                        {app.tables.length} table{app.tables.length === 1 ? '' : 's'}
                      </Badge>
                      <Badge variant="muted">
                        {app.pages.length} page{app.pages.length === 1 ? '' : 's'}
                      </Badge>
                      <Badge variant="muted">
                        {app.endpoints.length} endpoint{app.endpoints.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </Page>
  )
}
