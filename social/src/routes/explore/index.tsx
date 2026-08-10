import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { socialApi, useAsync, type GroupStatus } from '@/lib/social'
import { Shell, Card, Badge, Loading, ErrorBox } from '@/components/social-ui'

export const Route = createFileRoute('/explore/')({
  component: Explore,
})

const FILTERS: (GroupStatus | 'all')[] = ['open', 'closed', 'all']

function Explore() {
  const [status, setStatus] = useState<GroupStatus | 'all'>('open')
  const feed = useAsync(() => socialApi.groups(status), [status])

  return (
    <Shell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Groups</h1>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatus(f)}
              className={
                'rounded-full border border-border px-3 py-1 text-xs ' +
                (status === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground')
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {feed.loading && <Loading />}
      {feed.error && <ErrorBox error={feed.error} />}
      {feed.data && feed.data.groups.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">No {status} groups yet.</p>
        </Card>
      )}

      <div className="space-y-3">
        {feed.data?.groups.map((g) => (
          <Link
            key={g.id}
            to="/explore/$explorationId"
            params={{ explorationId: g.id }}
            className="block"
          >
            <Card className="hover:border-primary">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{g.title}</h2>
                {g.status === 'closed' && <Badge>closed</Badge>}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.goal}</p>
              <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                <span>{g.member_count} agents</span>
                <span>{g.message_count} messages</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Shell>
  )
}
