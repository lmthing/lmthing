import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft, Plug, KeyRound } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { getCatalogSpace } from '@/lib/apps-manifest'
import { installUrlForSpace } from '@/lib/pod-api'

export const Route = createFileRoute('/spaces/$spaceId')({
  component: SpaceDetail,
})

interface SettingsSchema {
  properties?: Record<string, { title?: string; format?: string }>
  required?: string[]
}

function SpaceDetail() {
  const { spaceId } = Route.useParams()
  const space = getCatalogSpace(spaceId)

  // The public store can't reach a user's authenticated pod. Installing hands off to
  // the lmthing.app install page, which runs in the user's pod context, lets them
  // pick a project, and performs it.
  function handleInstall() {
    window.location.href = installUrlForSpace(spaceId)
  }

  if (!space) {
    return (
      <Page>
        <PageBody>
          <Stack gap="sm">
            <Caption muted>Integration &quot;{spaceId}&quot; was not found in the catalog.</Caption>
            <Link to="/spaces" className="text-sm text-primary underline">
              Back to integrations
            </Link>
          </Stack>
        </PageBody>
      </Page>
    )
  }

  const schema = (space.settings ?? null) as SettingsSchema | null
  const fields = Object.entries(schema?.properties ?? {})
  const required = new Set(schema?.required ?? [])

  return (
    <Page>
      <PageHeader>
        <Link
          to="/spaces"
          className="mb-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Back to integrations
        </Link>
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-muted text-2xl"
            aria-hidden="true"
          >
            {space.icon ? space.icon : <Plug className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />}
          </span>
          <div>
            <Heading level={1}>{space.title}</Heading>
            <Caption muted>{space.id}</Caption>
          </div>
        </div>
        {space.description && <p className="mt-2 max-w-2xl text-muted-foreground">{space.description}</p>}
      </PageHeader>
      <PageBody>
        <Stack gap="lg">
          <Card>
            <CardHeader>
              <Heading level={3}>Install to my pod</Heading>
              <Caption muted>
                Takes you to <code className="rounded bg-muted px-1 py-0.5">lmthing.app</code>, signed in to your own
                workspace, to install <span className="font-medium">{space.title}</span> into a project you choose —
                then add your own token in that project&apos;s Settings → Integrations. The public store can&apos;t
                reach your private pod, so the install happens there.
              </Caption>
            </CardHeader>
            <CardBody>
              <Button onClick={handleInstall}>Install to my pod</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <Heading level={4}>Configuration</Heading>
                <Badge variant="muted">{fields.length}</Badge>
              </div>
            </CardHeader>
            <CardBody>
              {fields.length === 0 ? (
                <Caption muted>No configuration required.</Caption>
              ) : (
                <ul className="flex flex-col gap-2">
                  {fields.map(([key, prop]) => (
                    <li key={key} className="flex flex-wrap items-center gap-2">
                      <Badge>{key}</Badge>
                      {prop.title && <span className="text-sm text-muted-foreground">{prop.title}</span>}
                      {required.has(key) ? (
                        <Badge variant="muted">required</Badge>
                      ) : (
                        <Badge variant="muted">optional</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </Stack>
      </PageBody>
    </Page>
  )
}
