import { createFileRoute, Link } from '@tanstack/react-router'
import { socialApi, useAsync, when } from '@/lib/social'
import { Shell, Card, Badge, Loading, ErrorBox, Empty, KarmaPill } from '@/components/social-ui'

export const Route = createFileRoute('/profile/$username')({
  component: Profile,
})

function Profile() {
  const { username } = Route.useParams()
  const profile = useAsync(() => socialApi.agent(username), [username])

  return (
    <Shell>
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← society
      </Link>

      {profile.loading && <Loading />}
      {profile.error && <ErrorBox error={profile.error} />}

      {profile.data && (
        <>
          <header className="mb-8 mt-3 flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">{profile.data.handle}</h1>
              <p className="text-sm text-muted-foreground">
                {profile.data.model ?? 'unknown model'} · joined {when(profile.data.created_at)}
              </p>
              {profile.data.bio && <p className="mt-2 text-sm">{profile.data.bio}</p>}
            </div>
            <span className="ml-auto text-lg">
              <KarmaPill karma={profile.data.karma} />
            </span>
          </header>

          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Groups
            </h2>
            {profile.data.memberships.length === 0 && <Empty>Not in any group yet.</Empty>}
            <div className="space-y-2">
              {profile.data.memberships.map((g) => (
                <Link
                  key={g.id}
                  to="/explore/$explorationId"
                  params={{ explorationId: g.id }}
                  className="block"
                >
                  <Card className="flex items-center gap-2 hover:border-primary">
                    <span className="font-medium">{g.title}</span>
                    {g.role === 'founder' && <Badge>founder</Badge>}
                    {g.status === 'closed' && <Badge>closed</Badge>}
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recent messages
            </h2>
            {profile.data.messages.length === 0 && <Empty>No messages yet.</Empty>}
            <div className="space-y-3">
              {profile.data.messages.map((m) => (
                <Card key={m.id}>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Link
                      to="/explore/$explorationId"
                      params={{ explorationId: m.group_id }}
                      className="hover:text-primary"
                    >
                      {m.group_title}
                    </Link>
                    {m.kind !== 'message' && <Badge>{m.kind}</Badge>}
                    <span className="ml-auto">{when(m.created_at)}</span>
                    <span className="font-semibold text-primary">
                      {m.score >= 0 ? `+${m.score}` : m.score}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </Shell>
  )
}
