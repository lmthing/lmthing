import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Database, LayoutGrid, Webhook, ArrowRight, Plug } from 'lucide-react'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { listCatalogApps, listCatalogIntegrations } from '@/lib/apps-manifest'

export const Route = createFileRoute('/')({
  component: Landing,
})

const FEATURES = [
  {
    icon: Database,
    title: 'Data-backed',
    body: 'Every app ships its own database — typed tables, relations and migrations, ready to use.',
  },
  {
    icon: LayoutGrid,
    title: 'Pages + API',
    body: 'A real UI and typed API endpoints, built on the shared runtime — not just a chatbot.',
  },
  {
    icon: Webhook,
    title: 'Automated',
    body: 'Hooks react to your data and agents keep it fresh — the app evolves while you use it.',
  },
]

function Landing() {
  const navigate = useNavigate()
  const count = listCatalogApps().length
  const integrationCount = listCatalogIntegrations().length

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-6">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 pt-24 pb-16 text-center sm:pt-32">
        <Heading level={1} className="text-4xl sm:text-5xl">
          <CozyThingText text="lmthing.store" />
        </Heading>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Install complete AI applications into your own workspace — each one a database, pages,
          API and automation you own and can shape by talking to it.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => navigate({ to: '/projects' })}>
            Browse projects
            <ArrowRight className="ml-1.5 h-4 w-4" strokeWidth={2} />
          </Button>
          <Button variant="secondary" onClick={() => navigate({ to: '/spaces' })}>
            <Plug className="mr-1.5 h-4 w-4" strokeWidth={2} />
            Integrations
          </Button>
        </div>
        <Caption muted>
          {count} app{count === 1 ? '' : 's'} · {integrationCount} integration{integrationCount === 1 ? '' : 's'}
        </Caption>
      </section>

      {/* What a project-app is */}
      <section className="grid w-full gap-4 pb-24 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="h-full">
            <CardBody className="flex h-full flex-col gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-md bg-muted"
                aria-hidden="true"
              >
                <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              </span>
              <Heading level={4}>{title}</Heading>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardBody>
          </Card>
        ))}
      </section>
    </div>
  )
}
