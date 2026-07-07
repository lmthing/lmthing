import React, { useState } from 'react';
import { useApi, useApiMutation } from '@app/runtime';
import { TopicChip, type TopicLike } from '../components/TopicChip';
import { ListSkeleton } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';
import { Icon } from '../components/icons';
import { humanize } from '../components/format';

export default function Topics() {
  const { data: topics, isLoading, error } = useApi<TopicLike[]>('listTopics', {});

  const updateTopic = useApiMutation<TopicLike>('updateTopic', {
    invalidates: ['listTopics'],
  });
  const removeTopic = useApiMutation<{ ok: boolean }>('removeTopic', {
    invalidates: ['listTopics'],
  });
  const followTopic = useApiMutation<TopicLike>('followTopic', {
    invalidates: ['listTopics'],
  });

  const [slug, setSlug] = useState('');

  const onFollow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;
    try {
      await followTopic.mutate({ slug: slug.trim() });
      setSlug('');
    } catch {
      // surfaced via followTopic.error below
    }
  };

  // Anti-filter-bubble nudge (§1.8): surface a topic you're under-exposed to —
  // one with articles in the feed that you don't follow (or have de-weighted).
  const all = topics ?? [];
  const nudge =
    all
      .filter((t) => !t.muted && !t.followed && (t.articleCount ?? 0) > 0)
      .sort((a, b) => (b.articleCount ?? 0) - (a.articleCount ?? 0))[0] ??
    all
      .filter((t) => t.followed && !t.muted && (t.weight ?? 1) < 1)
      .sort((a, b) => (a.weight ?? 1) - (b.weight ?? 1))[0];

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Topics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personalization cockpit — follow, mute, and weight the topics that drive your feed
          and digests.
        </p>
      </div>

      {nudge ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground">
            <Icon name="discover" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-foreground">Broaden your view</p>
            <p className="text-sm text-muted-foreground">
              You’re under-exposed to{' '}
              <span className="font-medium text-foreground">{nudge.label || humanize(nudge.slug)}</span>{' '}
              — {nudge.articleCount ?? 0} stories in your feed. Following it keeps your feed from
              narrowing.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              nudge.followed
                ? updateTopic.mutate({ id: nudge.id, weight: +(Math.max(1, (nudge.weight ?? 1)) + 0.5).toFixed(1) })
                : updateTopic.mutate({ id: nudge.id, followed: true })
            }
            className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            {nudge.followed ? 'Turn up' : 'Follow'}
          </button>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Follow a topic</h2>
        <form onSubmit={onFollow} className="flex gap-3 rounded-lg border border-border bg-card p-4">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="topic-slug"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={followTopic.isPending || !slug.trim()}
            className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {followTopic.isPending ? 'Following…' : 'Follow'}
          </button>
        </form>
        {followTopic.error ? (
          <p className="text-sm text-destructive">
            {(followTopic.error as { message?: string })?.message ?? 'Failed to follow topic.'}
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Your topics</h2>

        {isLoading ? <ListSkeleton /> : null}
        {error ? <ErrorState message="Failed to load topics." /> : null}
        {!isLoading && !error && (topics ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No topics yet. Follow one above.
          </div>
        ) : null}

        <div className="space-y-2">
          {(topics ?? []).map((t) => (
            <TopicChip
              key={t.id}
              topic={t}
              onToggleFollow={() => updateTopic.mutate({ id: t.id, followed: !t.followed })}
              onToggleMute={() => updateTopic.mutate({ id: t.id, muted: !t.muted })}
              onWeight={(weight) => updateTopic.mutate({ id: t.id, weight })}
              onRemove={() => removeTopic.mutate({ id: t.id })}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
