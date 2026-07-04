import React from 'react';
import { useApi, Chat } from '@app/runtime';
import type { TopicLike } from '../components/TopicChip';
import { TopicWeightBar } from '../components/TopicWeightBar';
import { Spinner } from '../components/Spinner';
import type { InsightsLike } from '../components/InsightsPanel';

export default function Discover() {
  const { data: topics, isLoading, error } = useApi<TopicLike[]>('listTopics', {});
  const { data: insights } = useApi<InsightsLike>('feedInsights', {});

  const followed = (topics ?? []).filter((t) => t.followed && !t.muted);
  const trending = [...followed].sort((a, b) => (b.articleCount ?? 0) - (a.articleCount ?? 0)).slice(0, 8);
  const topTopics = insights?.topTopics ?? [];

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Discover</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See what's trending across your topics, and ask the editorial curator to assemble a custom
          digest just for you.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Trending topics</h2>

        {isLoading ? <Spinner /> : null}
        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load topics.
          </div>
        ) : null}
        {!isLoading && !error && trending.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            Follow some topics to see trends here.
          </div>
        ) : null}

        {trending.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            {trending.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-foreground">{t.label || t.slug}</span>
                <span className="text-muted-foreground">{t.articleCount ?? 0} articles</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {topTopics.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-bold uppercase text-muted-foreground">Your top topics</h2>
          <div className="space-y-1.5">
            {topTopics.map((t) => (
              <TopicWeightBar key={t.slug} slug={t.slug} weight={t.weight} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3 border-t border-border pt-6">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Ask the curator</h2>
        <p className="text-sm text-muted-foreground">
          Describe what you want to read about and the curator will assemble a custom digest.
        </p>
        <Chat agent="editorial/curator" />
      </section>
    </main>
  );
}
