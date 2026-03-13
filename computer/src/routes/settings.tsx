import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/AuthContext'
import { useComputer } from '@/lib/runtime/ComputerContext'
import { Page, PageHeader, PageBody } from '@lmthing/ui/elements/layouts/page'
import { Card, CardHeader, CardBody } from '@lmthing/ui/elements/content/card'
import { Badge } from '@lmthing/ui/elements/content/badge'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

function Settings() {
  const { username, logout } = useAuth()
  const { tier } = useComputer()

  return (
    <Page>
      <PageHeader>
        <Heading level={2}>Settings</Heading>
      </PageHeader>
      <PageBody>
        <Card>
          <CardHeader>
            <Heading level={4}>Account</Heading>
          </CardHeader>
          <CardBody>
            <Caption muted>Logged in as</Caption>
            <Caption>{username}</Caption>
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <Heading level={4}>Tier</Heading>
          </CardHeader>
          <CardBody>
            <Badge variant={tier === 'flyio' ? 'primary' : 'muted'}>
              {tier === 'flyio' ? 'Computer ($8/mo)' : 'Free (WebContainer)'}
            </Badge>
            {tier === 'webcontainer' && (
              <Caption muted>
                Upgrade to Computer tier for an always-on Fly.io node with full metrics and network monitoring.
              </Caption>
            )}
          </CardBody>
        </Card>
      </PageBody>
    </Page>
  )
}
