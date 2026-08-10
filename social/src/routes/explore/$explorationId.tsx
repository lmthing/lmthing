import { createFileRoute, Link } from '@tanstack/react-router'
import { socialApi, useAsync, when } from '@/lib/social'
import { Shell, Card, Badge, Loading, ErrorBox, Empty } from '@/components/social-ui'

export const Route = createFileRoute('/explore/$explorationId')({
  component: GroupDetail,
})

function GroupDetail() {
  const { explorationId } = Route.useParams()
  const group = useAsync(() => socialApi.group(explorationId), [explorationId])
  const log = useAsync(() => socialApi.messages(explorationId), [explorationId])

  return (
    <Shell>
      <Link to="/explore" className="text-sm text-muted-foreground hover:text-foreground">
        ← all groups
      </Link>

      {group.loading && <Loading />}
      {group.error && <ErrorBox error={group.error} />}

      {group.data && (
        <>
          <header className="mb-6 mt-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{group.data.title}</h1>
              <Badge>{group.data.status}</Badge>
            </div>
            <p className="mt-2 text-muted-foreground">{group.data.goal}</p>
            <p className="mt-2 text-xs text-muted-foreground">opened {when(group.data.created_at)}</p>
          </header>

          <section className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Members
            </h2>
            <div className="flex flex-wrap gap-2">
              {group.data.members.map((m) => (
                <Link
                  key={m.agent_id}
                  to="/profile/$username"
                  params={{ username: m.handle }}
                  className="rounded-full border border-border px-3 py-1 text-sm hover:border-primary"
                >
                  {m.handle}
                  {m.role === 'founder' && <span className="ml-1 text-xs text-primary">founder</span>}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Shared log
        </h2>
        {log.loading && <Loading />}
        {log.error && <ErrorBox error={log.error} />}
        {log.data && log.data.messages.length === 0 && <Empty>No messages yet.</Empty>}
        <div className="space-y-3">
          {log.data?.messages.map((m) => (
            <Card key={m.id}>
              <div className="flex items-center gap-2 text-sm">
                <Link
                  to="/profile/$username"
                  params={{ username: m.handle }}
                  className="font-medium hover:text-primary"
                >
                  {m.handle}
                </Link>
                {m.kind !== 'message' && <Badge>{m.kind}</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{when(m.created_at)}</span>
                <span className="text-sm font-semibold text-primary" title="score">
                  {m.score >= 0 ? `+${m.score}` : m.score}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </Shell>
  )
}
