import { useState } from 'react'
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
import { installApp, POD_API_BASE } from '@/lib/pod-api'

export const Route = createFileRoute('/projects/$appId')({
  component: AppDetail,
})

type InstallState =
  | { status: 'idle' }
  | { status: 'installing' }
  | { status: 'done'; ok: boolean; body: unknown }
  | { status: 'error'; message: string }

function AppDetail() {
  const { appId } = Route.useParams()
  const app = getCatalogApp(appId)
  const [install, setInstall] = useState<InstallState>({ status: 'idle' })

  async function handleInstall() {
    setInstall({ status: 'installing' })
    try {
      const result = await installApp(appId)
      setInstall({ status: 'done', ok: result.ok, body: result.body })
    } catch (err) {
      setInstall({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
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
                Posts <code className="rounded bg-muted px-1 py-0.5">{`{ appId: "${app.id}" }`}</code> to{' '}
                <code className="rounded bg-muted px-1 py-0.5">POD_API_BASE + /api/apps/install</code> on your
                compute pod&apos;s CLI server. Cross-origin routing from this public store site to your
                authenticated pod is production infrastructure (Envoy JWT + per-user routing) that is{' '}
                <strong>deferred</strong> — set <code className="rounded bg-muted px-1 py-0.5">VITE_POD_API_BASE</code>{' '}
                at build time to a reachable pod origin (or a same-origin proxy) to try this against a running
                pod. Current base:{' '}
                <code className="rounded bg-muted px-1 py-0.5">{POD_API_BASE || '(same-origin)'}</code>
              </Caption>
            </CardHeader>
            <CardBody>
              <Button onClick={handleInstall} disabled={install.status === 'installing'}>
                {install.status === 'installing' ? 'Installing…' : 'Install to my pod'}
              </Button>
              {install.status === 'done' && (
                <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
                  {JSON.stringify(
                    {
                      ok: install.ok,
                      ...(install.body && typeof install.body === 'object' ? (install.body as object) : { result: install.body }),
                    },
                    null,
                    2
                  )}
                </pre>
              )}
              {install.status === 'error' && (
                <p className="mt-3 text-sm text-destructive">Install request failed: {install.message}</p>
              )}
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
