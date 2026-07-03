import React, { useState } from 'react';
import type { Article } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { ArticleCard } from '../components/ArticleCard';
import { StatsStrip, type Stats } from '../components/StatsStrip';
import { Spinner } from '../components/Spinner';

type Filter = 'all' | 'unread' | 'saved';

export default function Feed() {
  const [filter, setFilter] = useState<Filter>('all');

  const { data: stats } = useApi<Stats>('feedStats', {});
  const {
    data: articles,
    isLoading,
    error,
  } = useApi<Article[]>('feedList', {
    unreadOnly: filter === 'unread' ? true : undefined,
    savedOnly: filter === 'saved' ? true : undefined,
  });

  const markAllRead = useApiMutation<{ count: number }>('markAllRead', {
    invalidates: ['feedList', 'feedStats'],
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      {stats ? <StatsStrip stats={stats} /> : null}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'unread', 'saved'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? 'rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground'
                  : 'rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'
              }
            >
              {f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Saved'}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={markAllRead.isPending}
          onClick={() => markAllRead.mutate({})}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          {markAllRead.isPending ? 'Marking…' : 'Mark all read'}
        </button>
      </div>

      {isLoading ? <Spinner /> : null}

      {error ? (
        <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
          Failed to load feed.
        </div>
      ) : null}

      {!isLoading && !error && (articles ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          No articles yet.
        </div>
      ) : null}

      <div className="space-y-3">
        {(articles ?? []).map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </main>
  );
}
