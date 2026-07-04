import React, { useState } from 'react';
import { useApi, useApiMutation } from '@app/runtime';
import { SubscriptionRow, type SubscriptionLike } from '../components/SubscriptionRow';
import { Spinner } from '../components/Spinner';

export default function Subscriptions() {
  const { data: subscriptions, isLoading, error } = useApi<SubscriptionLike[]>('listSubscriptions', {});

  const createSubscription = useApiMutation<SubscriptionLike>('createSubscription', {
    invalidates: ['listSubscriptions'],
  });
  const updateSubscription = useApiMutation<SubscriptionLike>('updateSubscription', {
    invalidates: ['listSubscriptions'],
  });
  const removeSubscription = useApiMutation<{ ok: boolean }>('removeSubscription', {
    invalidates: ['listSubscriptions'],
  });

  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tags, setTags] = useState('');
  const [cadence, setCadence] = useState<'realtime' | 'daily' | 'weekly'>('daily');
  const [channel, setChannel] = useState<'in-app' | 'email'>('in-app');

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await createSubscription.mutate({
        name: name.trim(),
        query: { keyword: keyword.trim() || undefined, tags: tagList.length > 0 ? tagList : undefined },
        cadence,
        channel,
      });
      setName('');
      setKeyword('');
      setTags('');
    } catch {
      // error surfaced below via createSubscription.error
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Subscriptions</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">New subscription</h2>
        <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Subscription name"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <div className="flex gap-3">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Keyword (optional)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as 'realtime' | 'daily' | 'weekly')}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="realtime">Realtime</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as 'in-app' | 'email')}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="in-app">In-app</option>
              <option value="email">Email</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={createSubscription.isPending || !name.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {createSubscription.isPending ? 'Creating…' : 'Create subscription'}
          </button>
          {createSubscription.error ? (
            <p className="text-sm text-destructive">
              {(createSubscription.error as { message?: string })?.message ?? 'Failed to create subscription.'}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Your subscriptions</h2>

        {isLoading ? <Spinner /> : null}
        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load subscriptions.
          </div>
        ) : null}
        {!isLoading && !error && (subscriptions ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No subscriptions yet. Create one above.
          </div>
        ) : null}

        <div className="space-y-2">
          {(subscriptions ?? []).map((s) => (
            <SubscriptionRow
              key={s.id}
              subscription={s}
              onToggle={() => updateSubscription.mutate({ id: s.id, active: !s.active })}
              onRemove={() => removeSubscription.mutate({ id: s.id })}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
