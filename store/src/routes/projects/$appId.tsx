import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Database, FileCode, Globe, Package, Zap, type LucideIcon } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { getCatalogApp } from '@/lib/apps-manifest'
import { installUrlForApp } from '@/lib/pod-api'

export const Route = createFileRoute('/projects/$appId')({
  component: AppDetail,
})

function AppDetail() {
  const { appId } = Route.useParams()
  const app = getCatalogApp(appId)

  // The public store can't reach a user's authenticated pod. Installing hands off to
  // the lmthing.app install page, which runs in the user's pod context and performs it.
  function handleInstall() {
    window.location.href = installUrlForApp(appId)
  }

  if (!app) {
    return (
      <Page>
        <PageBody>
          <Stack gap="sm">
            <Caption muted>App &quot;{appId}&quot; was not found in the catalog.</Caption>
            <Link to="/projects" className="text-sm text-primary underline">
              Back to catalog
            </Link>
          </Stack>
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader>
        <Link
          to="/projects"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Back to catalog
        </Link>
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-2xl"
            aria-hidden="true"
          >
            {app.icon ? app.icon : <Package className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />}
          </span>
          <div>
            <Heading level={1}>{app.title}</Heading>
            <Caption muted>{app.id}</Caption>
          </div>
        </div>
        {app.description && <p className="mt-2 max-w-2xl text-muted-foreground">{app.description}</p>}
      </PageHeader>
      <PageBody>
        <Stack gap="lg">
          <Card>
            <CardHeader>
              <Heading level={3}>Install to my pod</Heading>
              <Caption muted>
                Takes you to <code className="rounded bg-muted px-1 py-0.5">lmthing.app</code>, signed in to your
                own workspace, to install <span className="font-medium">{app.title}</span> and open it. The public
                store can&apos;t reach your private pod, so the install happens there.
              </Caption>
            </CardHeader>
            <CardBody>
              <Button onClick={handleInstall}>Install to my pod</Button>
            </CardBody>
          </Card>

          <Section title="Tables" icon={Database} items={app.tables} empty="No database tables." />
          <Section title="Pages" icon={FileCode} items={app.pages} empty="No pages." />
          <Section title="Endpoints" icon={Globe} items={app.endpoints} empty="No API endpoints." />
          <Section title="Hooks" icon={Zap} items={app.hooks} empty="No hooks." />
        </Stack>
      </PageBody>
    </Page>
  )
}

function Section({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string
  icon: LucideIcon
  items: string[]
  empty: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <Heading level={4}>{title}</Heading>
          <Badge variant="muted">{items.length}</Badge>
        </div>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <Caption muted>{empty}</Caption>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {items.map((item) => (
              <li key={item}>
                <Badge>{item}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
