import React, { useState } from 'react';
import { useApi, useApiMutation } from '@app/runtime';
import { TopicChip, type TopicLike } from '../components/TopicChip';
import { Spinner } from '../components/Spinner';

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

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Topics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow, mute, and weight the topics that drive your feed and digests.
        </p>
      </div>

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

        {isLoading ? <Spinner /> : null}
        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load topics.
          </div>
        ) : null}
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
