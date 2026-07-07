import React, { useEffect, useRef, useState } from 'react';
import type { Article } from '@app/types';
import { useApi, useApiMutation, apiCall } from '@app/runtime';
import { ArticleCard } from '../components/ArticleCard';
import { StatsStrip, type Stats } from '../components/StatsStrip';
import { FeedSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/EmptyState';

type Filter = 'all' | 'unread' | 'saved';

export default function Feed() {
  const [filter, setFilter] = useState<Filter>('all');

  const { data: stats, refetch: refetchStats } = useApi<Stats>('feedStats', {});
  const {
    data: articles,
    isLoading,
    error,
    refetch,
  } = useApi<Article[]>('feedList', {
    unreadOnly: filter === 'unread' ? true : undefined,
    savedOnly: filter === 'saved' ? true : undefined,
  });

  const markAllRead = useApiMutation<{ count: number }>('markAllRead', {
    invalidates: ['feedList', 'feedStats'],
  });

  // "N new stories" pill: poll feed totals in the background and, when the
  // count grows beyond what's on screen, offer to pull the new stories in
  // rather than reflowing the feed silently (§1.4).
  const baseline = useRef<number | null>(null);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    // Reset the baseline whenever the visible set changes.
    if (articles) baseline.current = stats?.total ?? articles.length;
    setNewCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const id = setInterval(() => {
      refetchStats?.();
    }, 60000);
    return () => clearInterval(id);
  }, [refetchStats]);

  useEffect(() => {
    if (typeof stats?.total !== 'number') return;
    if (baseline.current === null) {
      baseline.current = stats.total;
      return;
    }
    const delta = stats.total - baseline.current;
    if (delta > 0) setNewCount(delta);
  }, [stats?.total]);

  const showNewStories = () => {
    baseline.current = stats?.total ?? baseline.current;
    setNewCount(0);
    refetch?.();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onPin = async (a: Article) => {
    try {
      await apiCall('pinArticle', { id: a.id, pinned: !a.pinned });
      refetch?.();
    } catch {
      // ignore — non-critical action
    }
  };

  const onDismiss = async (a: Article) => {
    try {
      await apiCall('dismissArticle', { id: a.id });
      refetch?.();
    } catch {
      // ignore — non-critical action
    }
  };

  const list = articles ?? [];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      {stats ? <StatsStrip stats={stats} /> : null}

      {newCount > 0 ? (
        <button
          type="button"
          onClick={showNewStories}
          aria-live="polite"
          className="sticky top-16 z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
        >
          {newCount} new {newCount === 1 ? 'story' : 'stories'} — show
        </button>
      ) : null}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'unread', 'saved'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
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

      {isLoading ? <FeedSkeleton /> : null}

      {error ? <ErrorState message="Failed to load your feed." onRetry={() => refetch?.()} /> : null}

      {!isLoading && !error && list.length === 0 ? (
        filter === 'saved' ? (
          <EmptyState
            icon="save"
            title="Nothing saved yet"
            message="Bookmark stories from the feed and they'll collect here for later."
            ctaLabel="Browse the feed"
            ctaHref="/"
          />
        ) : filter === 'unread' ? (
          <EmptyState
            icon="feed"
            title="You're all caught up"
            message="No unread stories right now. New ones arrive as the newsroom refreshes."
            ctaLabel="Discover topics"
            ctaHref="/discover"
          />
        ) : (
          <EmptyState
            icon="feed"
            title="Your newsroom is warming up"
            message="Add a few sources and the newsroom will start fetching and synthesizing stories for your feed."
            ctaLabel="Add sources"
            ctaHref="/preferences"
          />
        )
      ) : null}

      <div className="space-y-3">
        {list.map((a) => (
          <ArticleCard
            key={a.id}
            article={a}
            onPin={() => onPin(a)}
            onDismiss={() => onDismiss(a)}
          />
        ))}
      </div>
    </main>
  );
}
